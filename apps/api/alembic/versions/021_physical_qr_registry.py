"""Physical QR tag registry for pre-punched leather tags.

Revision ID: 021
Revises: 020
Create Date: 2026-06-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "physical_qr_tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(512), nullable=False, unique=True),
        sa.Column("label", sa.String(120), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_physical_qr_tags_code", "physical_qr_tags", ["code"])


def downgrade() -> None:
    op.drop_index("ix_physical_qr_tags_code", table_name="physical_qr_tags")
    op.drop_table("physical_qr_tags")
