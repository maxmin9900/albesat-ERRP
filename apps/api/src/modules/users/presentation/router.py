import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.users.application.schemas import (
    CreateUserRequest,
    UpdateUserRolesRequest,
    UserAdminResponse,
    UserListResponse,
)
from src.modules.users.application.service import UsersAdminService
from src.shared.database.session import get_db

router = APIRouter(prefix="/admin/users", tags=["User Management"])


class SetActiveRequest(BaseModel):
    is_active: bool


@router.get("", response_model=UserListResponse)
async def list_users(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserListResponse:
    return await UsersAdminService(db).list_users(user)


@router.post("", response_model=UserAdminResponse)
async def create_user(
    data: CreateUserRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserAdminResponse:
    return await UsersAdminService(db).create_user(data, user)


@router.patch("/{user_id}/roles", response_model=UserAdminResponse)
async def update_user_roles(
    user_id: uuid.UUID,
    data: UpdateUserRolesRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserAdminResponse:
    return await UsersAdminService(db).update_roles(user_id, data, user)


@router.patch("/{user_id}/active", response_model=UserAdminResponse)
async def set_user_active(
    user_id: uuid.UUID,
    data: SetActiveRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserAdminResponse:
    return await UsersAdminService(db).set_active(user_id, data.is_active, user)
