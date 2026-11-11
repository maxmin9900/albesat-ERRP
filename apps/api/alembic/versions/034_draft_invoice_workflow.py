"""Draft invoice (پیش‌فاکتور) workflow: per-carpet invoice items, driver
confirmation and WhatsApp send tracking, new proforma statuses.

Revision ID: 034
Revises: 033
Create Date: 2026-08-23
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PG 12+: ADD VALUE is allowed inside a transaction as long as the new
    # label is not used by this same migration.
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'confirmed'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'sent'")

    op.add_column("invoices", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "invoices",
        sa.Column("confirmed_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )
    op.add_column("invoices", sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("invoices", sa.Column("sent_to_phone", sa.String(20), nullable=True))
    op.add_column("invoices", sa.Column("sent_status", sa.String(20), nullable=True))

    op.create_table(
        "invoice_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "invoice_id",
            UUID(as_uuid=True),
            sa.ForeignKey("invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("carpet_id", UUID(as_uuid=True), sa.ForeignKey("carpets.id"), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("carpet_type", sa.String(120), nullable=True),
        sa.Column("services", JSONB(), nullable=False, server_default="[]"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_invoice_items_invoice_id", "invoice_items", ["invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_invoice_items_invoice_id", table_name="invoice_items")
    op.drop_table("invoice_items")
    op.drop_column("invoices", "sent_status")
    op.drop_column("invoices", "sent_to_phone")
    op.drop_column("invoices", "sent_at")
    op.drop_column("invoices", "confirmed_by_id")
    op.drop_column("invoices", "confirmed_at")
    # PostgreSQL cannot drop individual enum labels; 'confirmed'/'sent' stay.
