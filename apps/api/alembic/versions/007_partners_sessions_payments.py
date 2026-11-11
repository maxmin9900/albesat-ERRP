"""Partners, service sessions, delivery routes, payments, users permissions

Revision ID: 007
Revises: 006

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

invoice_type = postgresql.ENUM("proforma", "invoice", name="invoicetype", create_type=False)
invoice_status = postgresql.ENUM("draft", "issued", "paid", "cancelled", name="invoicestatus", create_type=False)
payment_status = postgresql.ENUM("pending", "success", "failed", name="paymentstatus", create_type=False)
settlement_status = postgresql.ENUM("pending", "paid", name="settlementstatus", create_type=False)
session_status = postgresql.ENUM(
    "open", "in_logistics", "in_operations", "ready", "delivered", "closed",
    name="servicesessionstatus", create_type=False,
)
route_status = postgresql.ENUM("planned", "active", "completed", "cancelled", name="routesessionstatus", create_type=False)


def upgrade() -> None:
    op.execute("CREATE TYPE invoicetype AS ENUM ('proforma', 'invoice')")
    op.execute("CREATE TYPE invoicestatus AS ENUM ('draft', 'issued', 'paid', 'cancelled')")
    op.execute("CREATE TYPE paymentstatus AS ENUM ('pending', 'success', 'failed')")
    op.execute("CREATE TYPE settlementstatus AS ENUM ('pending', 'paid')")
    op.execute(
        "CREATE TYPE servicesessionstatus AS ENUM "
        "('open', 'in_logistics', 'in_operations', 'ready', 'delivered', 'closed')"
    )
    op.execute("CREATE TYPE routesessionstatus AS ENUM ('planned', 'active', 'completed', 'cancelled')")

    op.create_table(
        "partners",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("contact_phone", sa.String(20), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("commission_rate", sa.Numeric(5, 2), nullable=False, server_default="15.00"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_partners_slug", "partners", ["slug"])

    op.create_table(
        "service_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_code", sa.String(30), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("customer_name", sa.String(255), nullable=False),
        sa.Column("customer_phone", sa.String(20), nullable=False),
        sa.Column("status", session_status, nullable=False, server_default="open"),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("session_code"),
        sa.UniqueConstraint("order_id"),
    )
    op.create_index("ix_service_sessions_session_code", "service_sessions", ["session_code"])

    op.create_table(
        "delivery_route_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("route_code", sa.String(30), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", route_status, nullable=False, server_default="planned"),
        sa.Column("total_stops", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_distance_km", sa.Numeric(8, 2), nullable=True),
        sa.Column("est_minutes", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("route_code"),
    )

    op.create_table(
        "delivery_route_stops",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("route_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_route_sessions.id"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("stop_number", sa.Integer(), nullable=False),
        sa.Column("customer_name", sa.String(255), nullable=False),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("distance_km", sa.Numeric(6, 2), nullable=True),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_delivery_route_stops_route_session_id", "delivery_route_stops", ["route_session_id"])

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_number", sa.String(30), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("service_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("service_sessions.id"), nullable=True),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=True),
        sa.Column("invoice_type", invoice_type, nullable=False),
        sa.Column("status", invoice_status, nullable=False, server_default="draft"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("invoice_number"),
    )

    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("transaction_number", sa.String(30), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("method", sa.String(30), nullable=False),
        sa.Column("status", payment_status, nullable=False, server_default="success"),
        sa.Column("recorded_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("transaction_number"),
    )

    op.create_table(
        "partner_settlements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("gross_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("net_payable", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", settlement_status, nullable=False, server_default="pending"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    op.add_column("orders", sa.Column("partner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("partners.id"), nullable=True))
    op.create_index("ix_orders_partner_id", "orders", ["partner_id"])

    for perm, desc in [
        ("payments:read", "View payments and settlements"),
        ("payments:create", "Record payments"),
        ("partners:read", "View partners"),
        ("partners:manage", "Manage partners"),
        ("users:read", "View users"),
        ("users:manage", "Manage users and roles"),
        ("sessions:read", "View service and route sessions"),
    ]:
        op.execute(
            sa.text(
                f"""INSERT INTO permissions (id, name, resource, action, description, created_at, updated_at)
                    SELECT gen_random_uuid(), '{perm}', split_part('{perm}', ':', 1), split_part('{perm}', ':', 2),
                           '{desc}', NOW(), NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = '{perm}')"""
            )
        )

    op.execute(
        sa.text(
            """INSERT INTO role_permissions (role_id, permission_id)
               SELECT r.id, p.id FROM roles r, permissions p
               WHERE r.slug IN ('super_admin', 'admin')
                 AND p.name IN ('payments:read', 'payments:create', 'partners:read', 'partners:manage',
                                'users:read', 'users:manage', 'sessions:read')
                 AND NOT EXISTS (
                   SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
                 )"""
        )
    )


def downgrade() -> None:
    op.drop_index("ix_orders_partner_id", table_name="orders")
    op.drop_column("orders", "partner_id")
    op.drop_table("partner_settlements")
    op.drop_table("payment_transactions")
    op.drop_table("invoices")
    op.drop_index("ix_delivery_route_stops_route_session_id", table_name="delivery_route_stops")
    op.drop_table("delivery_route_stops")
    op.drop_table("delivery_route_sessions")
    op.drop_index("ix_service_sessions_session_code", table_name="service_sessions")
    op.drop_table("service_sessions")
    op.drop_index("ix_partners_slug", table_name="partners")
    op.drop_table("partners")
    for perm in (
        "payments:read", "payments:create", "partners:read", "partners:manage",
        "users:read", "users:manage", "sessions:read",
    ):
        op.execute(sa.text(f"DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name = '{perm}')"))
        op.execute(sa.text(f"DELETE FROM permissions WHERE name = '{perm}'"))
    op.execute("DROP TYPE IF EXISTS routesessionstatus")
    op.execute("DROP TYPE IF EXISTS servicesessionstatus")
    op.execute("DROP TYPE IF EXISTS settlementstatus")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS invoicestatus")
    op.execute("DROP TYPE IF EXISTS invoicetype")
