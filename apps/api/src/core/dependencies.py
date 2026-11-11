from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, UnauthorizedError
from src.core.security import verify_access_token
from src.modules.auth.infrastructure.models import Permission, Role, RolePermission, User, UserRole
from src.shared.database.session import get_db

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_scheme)],
) -> User:
    if not credentials:
        raise UnauthorizedError("Authentication required")
    try:
        payload = verify_access_token(credentials.credentials)
    except ValueError as e:
        raise UnauthorizedError(str(e)) from e

    user_id = UUID(payload["sub"])
    active_role = payload.get("role")
    result = await db.execute(
        select(User)
        .where(User.id == user_id, User.is_active.is_(True))
        .options(
            selectinload(User.roles)
            .selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found")
    user._active_role_slug = active_role  # type: ignore[attr-defined]
    return user


def require_permission(permission: str):
    async def checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        active_role = getattr(user, "_active_role_slug", None)
        if not user.has_permission(permission, active_role):
            raise ForbiddenError(f"Missing permission: {permission}")
        return user

    return checker


def require_any_permission(*permissions: str):
    async def checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        active_role = getattr(user, "_active_role_slug", None)
        if any(user.has_permission(p, active_role) for p in permissions):
            return user
        raise ForbiddenError(f"Missing permission: one of {', '.join(permissions)}")

    return checker


CurrentUser = Annotated[User, Depends(get_current_user)]
