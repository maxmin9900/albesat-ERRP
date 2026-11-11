import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.database.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    pass


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    roles: Mapped[List["UserRole"]] = relationship("UserRole", back_populates="user", lazy="selectin")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship("RefreshToken", back_populates="user")

    def has_permission(self, permission: str, active_role_slug: str | None = None) -> bool:
        for user_role in self.roles:
            role = user_role.role
            if active_role_slug and role.slug != active_role_slug:
                continue
            for rp in role.role_permissions:
                if rp.permission.name == permission:
                    return True
        return False

    def get_role_slugs(self) -> list[str]:
        return [ur.role.slug for ur in self.roles]

    def check_permission(self, permission: str) -> bool:
        active = getattr(self, "_active_role_slug", None)
        return self.has_permission(permission, active)


class Role(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    role_permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission", back_populates="role", lazy="selectin"
    )
    user_roles: Mapped[List["UserRole"]] = relationship("UserRole", back_populates="role")


class Permission(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id"), primary_key=True
    )

    role: Mapped["Role"] = relationship("Role", back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship("Permission", lazy="selectin")


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="roles")
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles", lazy="selectin")


class RefreshToken(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    jti: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


class OtpCode(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "otp_codes"

    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
