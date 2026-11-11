"""US-3 role management — list roles with permissions and edit role permissions.

Gated by `roles:manage` (system manager only; admin is intentionally denied).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.modules.auth.infrastructure.models import (
    Permission,
    Role,
    RolePermission,
    User,
)
from src.modules.users.application.schemas import (
    PermissionInfo,
    RoleDetail,
    RolesCatalogResponse,
)

# Roles whose permission set is protected from edits (lock-out / privilege safety).
_PROTECTED_ROLES = {"super_admin"}


class RolesAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _require(self, user: User, perm: str = "roles:manage") -> None:
        if not user.check_permission(perm):
            raise ForbiddenError(f"Missing {perm}")

    async def _all_permissions(self) -> list[Permission]:
        result = await self.db.execute(select(Permission).order_by(Permission.name))
        return list(result.scalars().all())

    async def list_roles(self, user: User) -> RolesCatalogResponse:
        self._require(user)
        result = await self.db.execute(
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .order_by(Role.name)
        )
        roles = result.scalars().all()
        role_details = [
            RoleDetail(
                id=r.id,
                slug=r.slug,
                name=r.name,
                description=r.description,
                permissions=sorted(rp.permission.name for rp in r.role_permissions),
            )
            for r in roles
        ]
        perms = await self._all_permissions()
        return RolesCatalogResponse(
            roles=role_details,
            all_permissions=[
                PermissionInfo(
                    name=p.name, resource=p.resource, action=p.action, description=p.description
                )
                for p in perms
            ],
        )

    async def update_role_permissions(
        self, slug: str, permission_names: list[str], user: User
    ) -> RoleDetail:
        self._require(user)
        if slug in _PROTECTED_ROLES:
            raise ForbiddenError(f"Role '{slug}' permissions cannot be modified")

        role_result = await self.db.execute(
            select(Role)
            .where(Role.slug == slug)
            .options(selectinload(Role.role_permissions))
        )
        role = role_result.scalar_one_or_none()
        if not role:
            raise NotFoundError("Role not found")

        wanted = list(dict.fromkeys(permission_names))  # de-dup, keep order
        perms_result = await self.db.execute(
            select(Permission).where(Permission.name.in_(wanted))
        )
        found = {p.name: p for p in perms_result.scalars().all()}
        missing = [name for name in wanted if name not in found]
        if missing:
            raise ValidationError(f"Unknown permissions: {', '.join(missing)}")

        for rp in list(role.role_permissions):
            await self.db.delete(rp)
        await self.db.flush()
        for name in wanted:
            self.db.add(RolePermission(role_id=role.id, permission_id=found[name].id))
        await self.db.flush()

        return RoleDetail(
            id=role.id,
            slug=role.slug,
            name=role.name,
            description=role.description,
            permissions=sorted(wanted),
        )
