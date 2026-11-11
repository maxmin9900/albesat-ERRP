"""US-3 role management endpoints (system manager only)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.users.application.roles_service import RolesAdminService
from src.modules.users.application.schemas import (
    RoleDetail,
    RolesCatalogResponse,
    UpdateRolePermissionsRequest,
)
from src.shared.database.session import get_db

router = APIRouter(prefix="/admin/roles", tags=["Role Management"])


@router.get("", response_model=RolesCatalogResponse)
async def list_roles(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RolesCatalogResponse:
    return await RolesAdminService(db).list_roles(user)


@router.patch("/{slug}/permissions", response_model=RoleDetail)
async def update_role_permissions(
    slug: str,
    data: UpdateRolePermissionsRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RoleDetail:
    return await RolesAdminService(db).update_role_permissions(slug, data.permissions, user)
