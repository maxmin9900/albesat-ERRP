"""EPIC 2: order geo-location (US-5/US-7) and 'other' order source (US-6).

Revision ID: 011
Revises: 010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # US-6: add "other" to the order source enum (idempotent, autocommit-safe).
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ordersource ADD VALUE IF NOT EXISTS 'other'")

    # US-5 / US-7: pickup geo-location.
    op.add_column("orders", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("orders", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "longitude")
    op.drop_column("orders", "latitude")
    # Note: PostgreSQL cannot easily drop a single enum value; leaving 'other' in place.
