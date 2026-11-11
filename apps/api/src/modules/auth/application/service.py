import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.config import get_settings
from src.core.exceptions import ForbiddenError, NotFoundError, RateLimitError, UnauthorizedError, ValidationError
from src.core.middleware.csrf import generate_csrf_token
from src.core.security import (
    create_access_token,
    create_refresh_token,
    generate_otp_code,
    hash_otp,
    hash_token,
    subject_from_uuid,
    verify_refresh_token,
)
from src.modules.auth.application.pending_session import (
    delete_pending_session,
    load_pending_session,
    save_pending_session,
)
from src.modules.auth.application.role_pins import role_slug_from_pin
from src.core.sanitize import sanitize_string
from src.modules.auth.application.schemas import (
    AuthSessionResponse,
    LoginSuccessResponse,
    OtpRequestResponse,
    OtpVerifySchema,
    PinLoginSchema,
    RegisterSchema,
    RoleInfo,
    RoleSelectSchema,
    TokenResponse,
    UserResponse,
    UpdateProfileSchema,
)
from src.modules.auth.infrastructure.models import (
    OtpCode,
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserRole,
)

settings = get_settings()


def _role_otp_map() -> dict[str, str]:
    """Parse STAFF_FIXED_OTP_ROLE_CODES into {role_slug: code}."""
    out: dict[str, str] = {}
    for pair in settings.staff_fixed_otp_role_codes.split(","):
        slug, _, code = pair.partition(":")
        slug, code = slug.strip(), code.strip()
        if slug and code:
            out[slug] = code
    return out


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterSchema, ip: str | None = None) -> OtpRequestResponse:
        phone = data.phone
        result = await self.db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        if user:
            user.full_name = sanitize_string(data.full_name, max_length=255)
            if not user.is_active:
                user.is_active = True
        else:
            roles_result = await self.db.execute(select(Role).where(Role.slug == "customer"))
            customer_role = roles_result.scalar_one_or_none()
            if not customer_role:
                raise NotFoundError("Default roles not seeded. Run migrations.")
            user = User(
                phone=phone,
                full_name=sanitize_string(data.full_name, max_length=255),
                is_active=True,
            )
            self.db.add(user)
            await self.db.flush()
            self.db.add(UserRole(user_id=user.id, role_id=customer_role.id))
            await self.db.flush()
        return await self.request_otp(phone, ip)

    async def login_with_pin(
        self, data: PinLoginSchema, user_agent: str | None, ip: str | None
    ) -> LoginSuccessResponse:
        role_slug = role_slug_from_pin(data.code)
        if not role_slug:
            raise UnauthorizedError("Invalid access code")

        result = await self.db.execute(
            select(User)
            .where(User.phone == data.phone)
            .options(
                selectinload(User.roles)
                .selectinload(UserRole.role)
                .selectinload(Role.role_permissions)
            )
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise UnauthorizedError("Invalid phone number or access code")

        if role_slug not in user.get_role_slugs():
            raise ForbiddenError("This access code is not assigned to your account")

        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()
        return await self._issue_tokens(user, role_slug, user_agent, ip)

    async def request_otp(self, phone: str, ip: str | None = None) -> OtpRequestResponse:
        # Dev/local: no hourly cap so QA can log in freely; production keeps the limit.
        if not settings.debug and settings.environment != "development":
            since = datetime.now(timezone.utc) - timedelta(hours=1)
            recent = await self.db.execute(
                select(OtpCode).where(OtpCode.phone == phone, OtpCode.created_at >= since)
            )
            if len(recent.scalars().all()) >= settings.otp_rate_limit_per_phone:
                raise RateLimitError("Too many OTP requests. Try again later.")

        # Staff share the business handset, so a delivered OTP would mean
        # messaging that number from itself. Accounts holding a configured
        # role sign in with their role's code instead; everyone else (i.e.
        # customers) still gets a generated one-time code.
        fixed_code = None
        role_codes = _role_otp_map()
        if role_codes:
            existing = await self.db.execute(
                select(User).where(User.phone == phone).options(selectinload(User.roles))
            )
            staff = existing.scalar_one_or_none()
            if staff:
                for slug in staff.get_role_slugs():
                    if slug in role_codes:
                        fixed_code = role_codes[slug]
                        break
        code = fixed_code or generate_otp_code()
        otp = OtpCode(
            phone=phone,
            code_hash=hash_otp(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.otp_expire_minutes),
            ip_address=ip,
        )
        self.db.add(otp)
        await self.db.flush()

        sent_via_whatsapp = False
        from src.modules.notifications.whatsapp import whatsapp_credentials_ok

        # Provider-aware: with 360messenger there is no Meta token, and
        # checking for one used to skip the send silently.
        _credentials_ok = whatsapp_credentials_ok()
        if fixed_code:
            # Nothing to deliver — the staff member already knows this code.
            return OtpRequestResponse(
                message="Enter your staff access code",
                expires_in_seconds=settings.otp_expire_minutes * 60,
                dev_code=None,
            )
        if settings.otp_send_via_whatsapp and settings.whatsapp_mode != "disabled":
            if settings.whatsapp_mode == "cloud" and not _credentials_ok:
                pass
            else:
                try:
                    from src.modules.notifications.tasks import send_otp_whatsapp

                    send_otp_whatsapp.delay(phone, code)
                    sent_via_whatsapp = True
                except Exception:
                    if settings.whatsapp_mode == "cloud":
                        from src.modules.notifications.whatsapp import send_otp_sync

                        sent_via_whatsapp = send_otp_sync(phone, code)

        show_dev_code = settings.debug and (
            settings.whatsapp_mode == "mock" or not sent_via_whatsapp
        )
        message = (
            "Verification code sent to your WhatsApp"
            if sent_via_whatsapp
            else "Verification code sent"
        )
        return OtpRequestResponse(
            message=message,
            expires_in_seconds=settings.otp_expire_minutes * 60,
            dev_code=code if show_dev_code else None,
        )

    async def verify_otp(self, data: OtpVerifySchema) -> AuthSessionResponse:
        result = await self.db.execute(
            select(OtpCode)
            .where(
                OtpCode.phone == data.phone,
                OtpCode.verified_at.is_(None),
                OtpCode.expires_at > datetime.now(timezone.utc),
            )
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
        otp = result.scalar_one_or_none()
        if not otp:
            raise UnauthorizedError("Invalid or expired verification code")

        otp.attempts += 1
        if otp.attempts > settings.otp_max_attempts:
            raise UnauthorizedError("Too many attempts")

        if otp.code_hash != hash_otp(data.code):
            raise UnauthorizedError("Invalid verification code")

        otp.verified_at = datetime.now(timezone.utc)

        user = await self._get_or_create_user(data.phone)
        if not user.is_active:
            user.is_active = True
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

        user_response, roles = await self._build_user_response(user)
        session_id = secrets.token_urlsafe(32)
        await save_pending_session(
            session_id,
            {"user_id": str(user.id), "phone": data.phone},
        )

        return AuthSessionResponse(
            user=user_response,
            available_roles=roles,
            requires_role_selection=len(roles) > 1,
            session_token=session_id,
        )

    async def select_role(
        self, data: RoleSelectSchema, session_token: str, user_agent: str | None, ip: str | None
    ) -> LoginSuccessResponse:
        session = await load_pending_session(session_token)
        if not session:
            raise UnauthorizedError("Invalid or expired session. Please verify OTP again.")

        user_id = uuid.UUID(session["user_id"])
        user = await self._get_user_with_roles(user_id)
        role_slugs = user.get_role_slugs()
        if data.role_slug not in role_slugs:
            raise ForbiddenError("Role not assigned to user")

        await delete_pending_session(session_token)
        return await self._issue_tokens(user, data.role_slug, user_agent, ip)

    async def complete_login(
        self, session_token: str | None, role_slug: str | None, user_agent: str | None, ip: str | None
    ) -> LoginSuccessResponse:
        if session_token:
            if not role_slug:
                raise ValidationError("role_slug required when session_token provided")
            return await self.select_role(
                RoleSelectSchema(role_slug=role_slug), session_token, user_agent, ip
            )

        raise ValidationError("session_token required")

    async def login_with_single_role(
        self, data: OtpVerifySchema, user_agent: str | None, ip: str | None
    ) -> LoginSuccessResponse:
        session = await self.verify_otp(data)
        if session.requires_role_selection:
            if not session.session_token or not session.available_roles:
                raise ValidationError("Role selection required")
            return await self.select_role(
                RoleSelectSchema(role_slug=session.available_roles[0].slug),
                session.session_token,
                user_agent,
                ip,
            )
        role_slug = session.user.roles[0].slug if session.user.roles else "admin"
        user = await self._get_user_with_roles(session.user.id)
        return await self._issue_tokens(user, role_slug, user_agent, ip)

    async def _issue_tokens(
        self, user: User, active_role_slug: str, user_agent: str | None, ip: str | None
    ) -> LoginSuccessResponse:
        jti = str(uuid.uuid4())
        access = create_access_token(
            subject_from_uuid(user.id),
            extra={"role": active_role_slug},
        )
        refresh = create_refresh_token(
            subject_from_uuid(user.id), jti, extra={"role": active_role_slug}
        )
        refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            jti=jti,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days),
            user_agent=user_agent,
            ip_address=ip,
        )
        self.db.add(refresh_record)

        user_response, roles = await self._build_user_response(user, active_role_slug)
        selected = next((r for r in roles if r.slug == active_role_slug), roles[0])

        return LoginSuccessResponse(
            user=user_response,
            selected_role=selected,
            tokens=TokenResponse(
                access_token=access,
                refresh_token=refresh,
                expires_in=settings.jwt_access_expire_minutes * 60,
            ),
        )

    async def _get_or_create_user(self, phone: str) -> User:
        result = await self.db.execute(
            select(User).where(User.phone == phone).options(
                selectinload(User.roles).selectinload(UserRole.role).selectinload(Role.role_permissions)  # noqa: E501
            )
        )
        user = result.scalar_one_or_none()
        if user:
            return user

        # New OTP users: customer in prod; staff roles in dev for portal testing
        role_slugs = (
            ["super_admin", "admin", "operation_team", "driver"]
            if settings.debug
            else ["customer"]
        )
        roles_result = await self.db.execute(select(Role).where(Role.slug.in_(role_slugs)))
        roles = list(roles_result.scalars().all())
        if not roles:
            raise NotFoundError("Default roles not seeded. Run migrations.")

        user = User(phone=phone, full_name=f"User {phone[-4:]}", is_active=True)
        self.db.add(user)
        await self.db.flush()
        for role in roles:
            self.db.add(UserRole(user_id=user.id, role_id=role.id))
        await self.db.flush()
        return await self._get_user_with_roles(user.id)

    async def _get_user_with_roles(self, user_id: uuid.UUID) -> User:
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.roles)
                .selectinload(UserRole.role)
                .selectinload(Role.role_permissions)
                .selectinload(RolePermission.permission)  # type: ignore[name-defined]
            )
        )
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError("User not found")
        return user

    async def _build_user_response(
        self, user: User, active_role_slug: str | None = None
    ) -> tuple[UserResponse, list[RoleInfo]]:
        roles: list[RoleInfo] = []
        permissions: set[str] = set()
        for ur in user.roles:
            roles.append(
                RoleInfo(id=ur.role.id, name=ur.role.name, slug=ur.role.slug, description=ur.role.description)
            )
            if active_role_slug is None or ur.role.slug == active_role_slug:
                for rp in ur.role.role_permissions:
                    permissions.add(rp.permission.name)

        return (
            UserResponse(
                id=user.id,
                phone=user.phone,
                full_name=user.full_name,
                email=user.email,
                roles=roles,
                permissions=sorted(permissions),
            ),
            roles,
        )

    async def update_profile(self, user: User, data: UpdateProfileSchema) -> UserResponse:
        if data.email:
            existing = await self.db.execute(
                select(User).where(User.email == data.email, User.id != user.id)
            )
            if existing.scalar_one_or_none():
                raise ValidationError("Email is already in use")

        user.full_name = data.full_name
        user.email = data.email
        await self.db.flush()
        refreshed = await self._get_user_with_roles(user.id)
        active_role = getattr(user, "_active_role_slug", None)
        response, _ = await self._build_user_response(refreshed, active_role)
        return response

    async def refresh_session(
        self,
        refresh_token: str,
        user_agent: str | None,
        ip: str | None,
    ) -> tuple[LoginSuccessResponse, str]:
        """Rotate refresh token; returns login response and new CSRF token."""
        try:
            payload = verify_refresh_token(refresh_token)
        except ValueError as e:
            raise UnauthorizedError("Invalid refresh token") from e

        jti = payload.get("jti")
        user_id = uuid.UUID(payload["sub"])
        token_hash = hash_token(refresh_token)

        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.jti == jti,
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        old_record = result.scalar_one_or_none()
        if not old_record:
            raise UnauthorizedError("Refresh token revoked or expired")

        old_record.revoked_at = datetime.now(timezone.utc)
        user = await self._get_user_with_roles(user_id)
        active_role = payload.get("role") or (user.get_role_slugs()[0] if user.get_role_slugs() else "admin")
        login = await self._issue_tokens(user, active_role, user_agent, ip)
        csrf = generate_csrf_token()
        return login, csrf

    async def logout(self, refresh_token: str | None) -> None:
        if not refresh_token:
            return
        try:
            payload = verify_refresh_token(refresh_token)
            jti = payload.get("jti")
            result = await self.db.execute(
                select(RefreshToken).where(RefreshToken.jti == jti, RefreshToken.revoked_at.is_(None))
            )
            record = result.scalar_one_or_none()
            if record:
                record.revoked_at = datetime.now(timezone.utc)
        except ValueError:
            pass

