"""EPIC 4: operations receipt — 'received_by_operation' carpet status + receipt fields.

US-13: operator scans the carpet QR to accept it into operations.

Revision ID: 013
Revises: 012
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New carpet status (autocommit-safe enum value add).
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE carpetstatus ADD VALUE IF NOT EXISTS 'received_by_operation' AFTER 'in_transit'"
        )

    op.add_column(
        "carpets", sa.Column("received_by_ops_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "carpets",
        sa.Column(
            "received_by_ops_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("carpets", "received_by_ops_user_id")
    op.drop_column("carpets", "received_by_ops_at")
    # enum value 'received_by_operation' left in place (PG cannot easily drop labels)
