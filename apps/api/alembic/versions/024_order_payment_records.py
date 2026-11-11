"""Per-order admin payment flags (replace customer-level paid for order list).

Revision ID: 024
Revises: 023
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "order_payment_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False, unique=True),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("marked_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_order_payment_records_order_id", "order_payment_records", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_order_payment_records_order_id", table_name="order_payment_records")
    op.drop_table("order_payment_records")
