"""EPIC 3: carpet type + physical-QR active uniqueness.

US-11: a physical QR may live on only ONE active carpet at a time, but can be
reused after being revoked. Replace the global unique on qr_codes.code with a
partial unique index over active (non-revoked) codes, and add carpets.carpet_type.

Revision ID: 012
Revises: 011
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # US-11: نوع فرش
    op.add_column("carpets", sa.Column("carpet_type", sa.String(120), nullable=True))

    # Drop the global unique constraint on qr_codes.code (column-level UNIQUE from 003).
    op.execute("ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_code_key")
    # Keep a non-unique lookup index on code.
    op.execute("CREATE INDEX IF NOT EXISTS ix_qr_codes_code ON qr_codes (code)")
    # A code may be active on at most one carpet at a time.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_qr_codes_active_code "
        "ON qr_codes (code) WHERE revoked_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_qr_codes_active_code")
    op.execute("DROP INDEX IF EXISTS ix_qr_codes_code")
    op.execute("ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_code_key UNIQUE (code)")
    op.drop_column("carpets", "carpet_type")
