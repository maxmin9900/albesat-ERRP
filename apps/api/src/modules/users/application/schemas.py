import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RoleBrief(BaseModel):
    id: uuid.UUID
    slug: str
    name: str


class UserAdminResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: str
    email: str | None
    is_active: bool
    roles: list[str]
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    full_name: str = Field(min_length=2, max_length=255)
    role_slugs: list[str] = Field(min_length=1)
    email: str | None = None


class UpdateUserRolesRequest(BaseModel):
    role_slugs: list[str] = Field(min_length=1)


class UserListResponse(BaseModel):
    users: list[UserAdminResponse]
    roles: list[RoleBrief]


class PermissionInfo(BaseModel):
    name: str
    resource: str
    action: str
    description: str | None = None


class RoleDetail(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    permissions: list[str]


class RolesCatalogResponse(BaseModel):
    roles: list[RoleDetail]
    all_permissions: list[PermissionInfo]


class UpdateRolePermissionsRequest(BaseModel):
    permissions: list[str] = Field(default_factory=list)
