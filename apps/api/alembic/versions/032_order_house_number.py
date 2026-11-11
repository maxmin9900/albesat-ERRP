"""Add customer house plaque number to orders.

Captured on the public booking form and editable by the driver at pickup.

Revision ID: 032
Revises: 031
"""

from alembic import op
import sqlalchemy as sa

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("house_number", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "house_number")
