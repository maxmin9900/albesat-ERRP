"""EPIC 6 / US-20A: delivery completion + final invoice structure.

Revision ID: 015
Revises: 014
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

customer_payment_status = postgresql.ENUM(
    "unpaid",
    "partially_paid",
    "paid",
    "failed_payment",
    name="customerpaymentstatus",
    create_type=False,
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE TYPE customerpaymentstatus AS ENUM "
            "('unpaid', 'partially_paid', 'paid', 'failed_payment')"
        )

    op.add_column("invoices", sa.Column("customer_name", sa.String(255), nullable=True))
    op.add_column("invoices", sa.Column("customer_phone", sa.String(20), nullable=True))
    op.add_column("invoices", sa.Column("customer_address", sa.Text(), nullable=True))
    op.add_column("invoices", sa.Column("carpet_count", sa.Integer(), nullable=True))
    op.add_column("invoices", sa.Column("service_type", sa.String(50), nullable=True))
    op.add_column("invoices", sa.Column("service_area", sa.String(120), nullable=True))
    op.add_column("invoices", sa.Column("service_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("invoices", sa.Column("repair_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column(
        "invoices",
        sa.Column(
            "payment_status",
            customer_payment_status,
            server_default="unpaid",
            nullable=False,
        ),
    )
    op.add_column("invoices", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("carpets", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "carpets",
        sa.Column(
            "delivered_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("carpets", "delivered_by_user_id")
    op.drop_column("carpets", "delivered_at")
    op.drop_column("invoices", "delivered_at")
    op.drop_column("invoices", "payment_status")
    op.drop_column("invoices", "repair_amount")
    op.drop_column("invoices", "service_amount")
    op.drop_column("invoices", "service_area")
    op.drop_column("invoices", "service_type")
    op.drop_column("invoices", "carpet_count")
    op.drop_column("invoices", "customer_address")
    op.drop_column("invoices", "customer_phone")
    op.drop_column("invoices", "customer_name")
    op.execute("DROP TYPE IF EXISTS customerpaymentstatus")
