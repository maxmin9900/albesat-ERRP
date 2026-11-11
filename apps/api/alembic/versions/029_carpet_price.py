"""Add per-carpet price column.

Drivers now record a separate price for each carpet at pickup; the order total
is the sum of its carpets' prices.

Revision ID: 029
Revises: 028
"""

from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "carpets",
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("carpets", "price")
