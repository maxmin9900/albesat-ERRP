"""Initial schema and RBAC seed

Revision ID: 001
Revises:
Create Date: 2026-05-19

"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=True, unique=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_phone", "users", ["phone"])

    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("resource", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("permissions.id"), primary_key=True),
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id"), primary_key=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("jti", sa.String(36), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "otp_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_otp_codes_phone", "otp_codes", ["phone"])

    order_source = postgresql.ENUM("website", "whatsapp", "phone", "partner", name="ordersource", create_type=True)
    service_type = postgresql.ENUM("standard", "premium", "antique", name="servicetype", create_type=True)
    order_status = postgresql.ENUM(
        "pending_pickup", "picked_up", "in_washing", "drying", "repairing",
        "ready_for_delivery", "out_for_delivery", "delivered", "cancelled",
        name="orderstatus", create_type=True,
    )

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_number", sa.String(20), nullable=False, unique=True),
        sa.Column("tracking_code", sa.String(30), nullable=False, unique=True),
        sa.Column("customer_name", sa.String(255), nullable=False),
        sa.Column("customer_phone", sa.String(20), nullable=False),
        sa.Column("customer_email", sa.String(255), nullable=True),
        sa.Column("pickup_address", sa.Text(), nullable=True),
        sa.Column("carpet_description", sa.String(500), nullable=True),
        sa.Column("source", order_source, nullable=False),
        sa.Column("service_type", service_type, nullable=False),
        sa.Column("status", order_status, nullable=False, server_default="pending_pickup"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("estimated_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_tracking_code", "orders", ["tracking_code"])

    op.create_table(
        "order_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("from_status", sa.String(50), nullable=True),
        sa.Column("to_status", sa.String(50), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    _seed_rbac()


def _seed_rbac() -> None:
    roles = [
        ("super_admin", "System Manager", "Full access to all modules and reports"),
        ("admin", "Admin", "User management and system settings"),
        ("operation_team", "Operations Operator", "Manage orders and wash operations"),
        ("driver", "Driver", "Handle pickups and deliveries"),
        ("customer", "Customer", "View own orders"),
    ]
    permissions = [
        ("users:manage", "users", "manage"),
        ("roles:manage", "roles", "manage"),
        ("orders:create", "orders", "create"),
        ("orders:read", "orders", "read"),
        ("orders:update", "orders", "update"),
        ("orders:delete", "orders", "delete"),
        ("reports:read", "reports", "read"),
        ("reports:export", "reports", "export"),
        ("payments:manage", "payments", "manage"),
        ("payments:read", "payments", "read"),
        ("qr:scan", "qr", "scan"),
        ("qr:generate", "qr", "generate"),
    ]

    role_ids: dict[str, uuid.UUID] = {}
    for slug, name, desc in roles:
        rid = uuid.uuid4()
        role_ids[slug] = rid
        op.execute(
            sa.text(
                "INSERT INTO roles (id, name, slug, description) VALUES (:id, :name, :slug, :desc)"
            ).bindparams(id=rid, name=name, slug=slug, desc=desc)
        )

    perm_ids: dict[str, uuid.UUID] = {}
    for pname, resource, action in permissions:
        pid = uuid.uuid4()
        perm_ids[pname] = pid
        op.execute(
            sa.text(
                "INSERT INTO permissions (id, name, resource, action) VALUES (:id, :name, :res, :act)"
            ).bindparams(id=pid, name=pname, res=resource, act=action)
        )

    super_admin_perms = list(perm_ids.keys())
    admin_perms = [p for p in super_admin_perms if p not in ("roles:manage",)]
    role_perm_map = {
        "super_admin": super_admin_perms,
        "admin": admin_perms,
        "operation_team": ["orders:create", "orders:read", "orders:update", "qr:scan", "qr:generate"],
        "driver": ["orders:read", "pickups:read"] if "pickups:read" in perm_ids else ["orders:read"],
        "customer": ["orders:read"],
    }
    role_perm_map["driver"] = ["orders:read", "qr:scan"]

    for role_slug, perms in role_perm_map.items():
        for perm_name in perms:
            if perm_name in perm_ids:
                op.execute(
                    sa.text(
                        "INSERT INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid)"
                    ).bindparams(rid=role_ids[role_slug], pid=perm_ids[perm_name])
                )

def downgrade() -> None:
    op.drop_table("order_status_history")
    op.drop_table("orders")
    op.execute(sa.text("DROP TYPE IF EXISTS orderstatus"))
    op.execute(sa.text("DROP TYPE IF EXISTS servicetype"))
    op.execute(sa.text("DROP TYPE IF EXISTS ordersource"))
    op.drop_table("otp_codes")
    op.drop_table("refresh_tokens")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_table("users")
