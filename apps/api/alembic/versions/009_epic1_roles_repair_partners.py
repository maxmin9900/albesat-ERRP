"""EPIC 1: repair_team, finance_team roles, repair requests, partner location fields

Revision ID: 009
Revises: 008
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

repair_workflow_status = postgresql.ENUM(
    "pending_approval",
    "waiting_customer_response",
    "customer_approved",
    "customer_rejected",
    "in_repair",
    "repair_completed",
    "repair_cancelled",
    name="repairworkflowstatus",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE repairworkflowstatus AS ENUM (
            'pending_approval',
            'waiting_customer_response',
            'customer_approved',
            'customer_rejected',
            'in_repair',
            'repair_completed',
            'repair_cancelled'
        )
        """
    )

    op.add_column("partners", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("partners", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("partners", sa.Column("notes", sa.Text(), nullable=True))

    op.create_table(
        "repair_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("carpet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("carpets.id"), nullable=False),
        sa.Column("service_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_sessions.id"), nullable=True),
        sa.Column("status", repair_workflow_status, nullable=False, server_default="pending_approval"),
        sa.Column("damage_description", sa.Text(), nullable=True),
        sa.Column("repair_type", sa.String(120), nullable=True),
        sa.Column("quoted_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("repair_deadline", sa.Date(), nullable=True),
        sa.Column("customer_contact_notes", sa.Text(), nullable=True),
        sa.Column("contacted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contacted_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("admin_approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("admin_approved_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_repair_requests_order_id", "repair_requests", ["order_id"])
    op.create_index("ix_repair_requests_status", "repair_requests", ["status"])

    conn = op.get_bind()

    roles = [
        ("repair_team", "Repair Team", "Repair queue and repair workflow"),
        ("finance_team", "Finance & CRM", "Invoices, payments, partner settlements, CRM"),
    ]
    for slug, name, desc in roles:
        conn.execute(
            sa.text(
                """
                INSERT INTO roles (id, slug, name, description, created_at, updated_at)
                SELECT gen_random_uuid(),
                       CAST(:slug AS VARCHAR), CAST(:name AS VARCHAR), CAST(:desc AS TEXT),
                       NOW(), NOW()
                WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = CAST(:slug AS VARCHAR))
                """
            ),
            {"slug": slug, "name": name, "desc": desc},
        )

    perms = [
        ("repair:read", "repair", "read", "View repair queue and details"),
        ("repair:update", "repair", "update", "Update repair work status"),
        ("repair:approve", "repair", "approve", "Customer contact and repair approval (admin)"),
        ("repair:create", "repair", "create", "Flag carpet for repair (operations)"),
        ("finance:read", "finance", "read", "View finance dashboard and invoices"),
        ("finance:manage", "finance", "manage", "Record payments and manage settlements"),
        ("crm:read", "crm", "read", "View customer CRM data"),
    ]
    for name, resource, action, desc in perms:
        conn.execute(
            sa.text(
                """
                INSERT INTO permissions (id, name, resource, action, description, created_at, updated_at)
                SELECT gen_random_uuid(),
                       CAST(:name AS VARCHAR), CAST(:resource AS VARCHAR),
                       CAST(:action AS VARCHAR), CAST(:desc AS TEXT),
                       NOW(), NOW()
                WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = CAST(:name AS VARCHAR))
                """
            ),
            {"name": name, "resource": resource, "action": action, "desc": desc},
        )

    role_perms = {
        "super_admin": [
            "repair:read", "repair:update", "repair:approve", "repair:create",
            "finance:read", "finance:manage", "crm:read",
            "partners:manage", "roles:manage",
        ],
        "admin": [
            "repair:read", "repair:approve", "repair:create", "repair:update",
            "finance:read", "crm:read",
            "partners:read", "partners:manage",
            "users:read", "orders:create", "orders:read", "orders:update",
            "sessions:read",
        ],
        "operation_team": [
            "repair:read", "repair:create",
            "operations:read", "operations:update",
            "qr:scan", "orders:read",
        ],
        "repair_team": [
            "repair:read", "repair:update",
            "qr:scan", "orders:read",
        ],
        "finance_team": [
            "finance:read", "finance:manage", "crm:read",
            "payments:read", "payments:create", "payments:manage",
            "partners:read", "reports:read", "orders:read",
        ],
        "driver": [
            "logistics:read", "logistics:pickup", "logistics:deliver",
            "qr:scan", "payments:read", "orders:read",
        ],
    }

    for role_slug, perm_names in role_perms.items():
        for perm_name in perm_names:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id FROM roles r, permissions p
                    WHERE r.slug = :role_slug AND p.name = :perm_name
                      AND NOT EXISTS (
                        SELECT 1 FROM role_permissions rp
                        WHERE rp.role_id = r.id AND rp.permission_id = p.id
                      )
                    """
                ),
                {"role_slug": role_slug, "perm_name": perm_name},
            )


def downgrade() -> None:
    op.drop_index("ix_repair_requests_status", table_name="repair_requests")
    op.drop_index("ix_repair_requests_order_id", table_name="repair_requests")
    op.drop_table("repair_requests")
    op.drop_column("partners", "notes")
    op.drop_column("partners", "longitude")
    op.drop_column("partners", "latitude")
    op.execute("DROP TYPE IF EXISTS repairworkflowstatus")
