from datetime import datetime
from uuid import UUID

import re

from pydantic import BaseModel, Field, field_validator

from src.core.sanitize import sanitize_string


def _normalize_phone_e164(v: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", v.strip())
    if len(cleaned) < 10:
        raise ValueError("Invalid phone number")
    if cleaned.startswith("+"):
        return cleaned
    if cleaned.startswith("0") and len(cleaned) >= 10:
        return f"+98{cleaned[1:]}"
    if cleaned.startswith("98") and len(cleaned) >= 12:
        return f"+{cleaned}"
    # Iranian mobile without leading 0 (9XXXXXXXXX)
    if len(cleaned) == 10 and cleaned.startswith("9"):
        return f"+98{cleaned}"
    if len(cleaned) == 11 and cleaned.startswith("1"):
        return f"+{cleaned}"
    if len(cleaned) == 10:
        return f"+1{cleaned}"
    return f"+{cleaned}"


class RegisterSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    full_name: str = Field(..., min_length=2, max_length=255)

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return _normalize_phone_e164(v)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return sanitize_string(v, max_length=255)


class OtpRequestSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return _normalize_phone_e164(v)


class OtpVerifySchema(BaseModel):
    phone: str
    code: str = Field(..., min_length=4, max_length=8)

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return _normalize_phone_e164(v)


class PinLoginSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    code: str = Field(..., min_length=4, max_length=8)

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return _normalize_phone_e164(v)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return re.sub(r"\D", "", v.strip())


class RoleSelectSchema(BaseModel):
    role_slug: str = Field(..., min_length=2, max_length=50)

    @field_validator("role_slug")
    @classmethod
    def sanitize_role(cls, v: str) -> str:
        return sanitize_string(v, max_length=50)


class CsrfResponse(BaseModel):
    csrf_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RoleInfo(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: UUID
    phone: str
    full_name: str
    email: str | None
    roles: list[RoleInfo]
    permissions: list[str]

    model_config = {"from_attributes": True}


class UpdateProfileSchema(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: str | None = Field(None, max_length=255)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return sanitize_string(v, max_length=255)

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = sanitize_string(v.strip(), max_length=255)
        return cleaned or None


class OtpRequestResponse(BaseModel):
    message: str
    expires_in_seconds: int
    dev_code: str | None = None


class AuthSessionResponse(BaseModel):
    user: UserResponse
    available_roles: list[RoleInfo]
    requires_role_selection: bool
    session_token: str | None = None


class LoginSuccessResponse(BaseModel):
    user: UserResponse
    selected_role: RoleInfo
    tokens: TokenResponse
    csrf_token: str | None = None
