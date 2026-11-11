"""Customer payment settlement records.

Revision ID: 022
Revises: 021
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_payment_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("customer_name", sa.String(255), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("marked_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_customer_payment_records_phone", "customer_payment_records", ["phone"])


def downgrade() -> None:
    op.drop_index("ix_customer_payment_records_phone", table_name="customer_payment_records")
    op.drop_table("customer_payment_records")
