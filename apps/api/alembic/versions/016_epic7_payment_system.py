"""EPIC 7: payment system — due dates, overdue, reminders, driver payment audit.

Revision ID: 016
Revises: 015
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE customerpaymentstatus ADD VALUE IF NOT EXISTS 'overdue' AFTER 'failed_payment'"
        )

    op.add_column("invoices", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column(
        "invoices",
        sa.Column("proforma_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("driver_confirmed", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("confirmation_reference", sa.String(120), nullable=True),
    )

    op.create_table(
        "payment_reminder_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "invoice_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("invoices.id"),
            nullable=False,
        ),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="sent"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "sent_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_payment_reminder_logs_invoice_id", "payment_reminder_logs", ["invoice_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_payment_reminder_logs_invoice_id", table_name="payment_reminder_logs")
    op.drop_table("payment_reminder_logs")
    op.drop_column("payment_transactions", "confirmation_reference")
    op.drop_column("payment_transactions", "driver_confirmed")
    op.drop_column("invoices", "proforma_id")
    op.drop_column("invoices", "due_date")
