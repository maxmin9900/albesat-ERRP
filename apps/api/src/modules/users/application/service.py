import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.modules.auth.infrastructure.models import Role, User, UserRole
from src.core.sanitize import sanitize_string
from src.modules.auth.application.schemas import _normalize_phone_e164
from src.modules.users.application.schemas import (
    CreateUserRequest,
    RoleBrief,
    UpdateUserRolesRequest,
    UserAdminResponse,
    UserListResponse,
)


class UsersAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(self, user: User) -> UserListResponse:
        if not user.check_permission("users:manage"):
            raise ForbiddenError("Missing users:manage")
        result = await self.db.execute(
            select(User).options(selectinload(User.roles).selectinload(UserRole.role)).order_by(User.full_name)
        )
        users = [
            UserAdminResponse(
                id=u.id,
                full_name=u.full_name,
                phone=u.phone,
                email=u.email,
                is_active=u.is_active,
                roles=[ur.role.slug for ur in u.roles],
                last_login_at=u.last_login_at,
                created_at=u.created_at,
            )
            for u in result.scalars().all()
        ]
        roles_result = await self.db.execute(select(Role).order_by(Role.name))
        roles = [RoleBrief(id=r.id, slug=r.slug, name=r.name) for r in roles_result.scalars().all()]
        return UserListResponse(users=users, roles=roles)

    async def create_user(self, data: CreateUserRequest, actor: User) -> UserAdminResponse:
        if not actor.check_permission("users:manage"):
            raise ForbiddenError("Missing users:manage")
        phone = _normalize_phone_e164(data.phone)
        existing = await self.db.execute(select(User).where(User.phone == phone))
        if existing.scalar_one_or_none():
            raise ValidationError("Phone already registered")
        roles_result = await self.db.execute(select(Role).where(Role.slug.in_(data.role_slugs)))
        roles = {r.slug: r for r in roles_result.scalars().all()}
        if len(roles) != len(set(data.role_slugs)):
            raise ValidationError("One or more roles are invalid")
        user = User(
            phone=phone,
            full_name=sanitize_string(data.full_name, max_length=255),
            email=data.email,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()
        for slug in data.role_slugs:
            self.db.add(UserRole(user_id=user.id, role_id=roles[slug].id))
        await self.db.flush()
        return UserAdminResponse(
            id=user.id,
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            is_active=user.is_active,
            roles=list(data.role_slugs),
            last_login_at=None,
            created_at=user.created_at,
        )

    async def update_roles(self, user_id: uuid.UUID, data: UpdateUserRolesRequest, actor: User) -> UserAdminResponse:
        if not actor.check_permission("users:manage"):
            raise ForbiddenError("Missing users:manage")
        result = await self.db.execute(
            select(User).where(User.id == user_id).options(selectinload(User.roles))
        )
        target = result.scalar_one_or_none()
        if not target:
            raise NotFoundError("User not found")
        roles_result = await self.db.execute(select(Role).where(Role.slug.in_(data.role_slugs)))
        roles = {r.slug: r for r in roles_result.scalars().all()}
        if len(roles) != len(set(data.role_slugs)):
            raise ValidationError("One or more roles are invalid")

        await self.db.execute(delete(UserRole).where(UserRole.user_id == user_id))
        await self.db.flush()

        for slug in data.role_slugs:
            self.db.add(UserRole(user_id=target.id, role_id=roles[slug].id))
        await self.db.flush()
        return UserAdminResponse(
            id=target.id,
            full_name=target.full_name,
            phone=target.phone,
            email=target.email,
            is_active=target.is_active,
            roles=list(data.role_slugs),
            last_login_at=target.last_login_at,
            created_at=target.created_at,
        )

    async def set_active(self, user_id: uuid.UUID, is_active: bool, actor: User) -> UserAdminResponse:
        if not actor.check_permission("users:manage"):
            raise ForbiddenError("Missing users:manage")
        result = await self.db.execute(
            select(User).where(User.id == user_id).options(selectinload(User.roles).selectinload(UserRole.role))
        )
        target = result.scalar_one_or_none()
        if not target:
            raise NotFoundError("User not found")
        target.is_active = is_active
        await self.db.flush()
        return UserAdminResponse(
            id=target.id,
            full_name=target.full_name,
            phone=target.phone,
            email=target.email,
            is_active=target.is_active,
            roles=[ur.role.slug for ur in target.roles],
            last_login_at=target.last_login_at,
            created_at=target.created_at,
        )
