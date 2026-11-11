"""EPIC 5: operation management timestamps + load-for-delivery fields.

US-15..US-17A: start/complete operation, load carpet onto driver vehicle.

Revision ID: 014
Revises: 013
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "carpets", sa.Column("operation_started_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "carpets",
        sa.Column(
            "operation_started_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "carpets", sa.Column("operation_completed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "carpets",
        sa.Column(
            "operation_completed_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "carpets", sa.Column("loaded_for_delivery_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "carpets",
        sa.Column(
            "loaded_for_delivery_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "carpets",
        sa.Column(
            "loaded_for_driver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("carpets", "loaded_for_driver_id")
    op.drop_column("carpets", "loaded_for_delivery_by_user_id")
    op.drop_column("carpets", "loaded_for_delivery_at")
    op.drop_column("carpets", "operation_completed_by_user_id")
    op.drop_column("carpets", "operation_completed_at")
    op.drop_column("carpets", "operation_started_by_user_id")
    op.drop_column("carpets", "operation_started_at")
