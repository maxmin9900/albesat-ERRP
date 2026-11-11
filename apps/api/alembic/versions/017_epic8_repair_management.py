"""EPIC 8: repair management — photos, source, damage type, completion notes.

Revision ID: 017
Revises: 016
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("repair_requests", sa.Column("flagged_source", sa.String(20), nullable=True))
    op.add_column("repair_requests", sa.Column("damage_type", sa.String(120), nullable=True))
    op.add_column("repair_requests", sa.Column("completion_notes", sa.Text(), nullable=True))
    op.add_column(
        "repair_requests",
        sa.Column("repair_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "repair_requests",
        sa.Column("repair_completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "repair_request_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "repair_request_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repair_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("photo_data", sa.Text(), nullable=False),
        sa.Column("caption", sa.String(255), nullable=True),
        sa.Column(
            "uploaded_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_repair_request_photos_repair_request_id",
        "repair_request_photos",
        ["repair_request_id"],
    )

    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r, permissions p
            WHERE r.slug = 'driver' AND p.name = 'repair:create'
            AND NOT EXISTS (
                SELECT 1 FROM role_permissions rp
                WHERE rp.role_id = r.id AND rp.permission_id = p.id
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_repair_request_photos_repair_request_id", table_name="repair_request_photos")
    op.drop_table("repair_request_photos")
    op.drop_column("repair_requests", "repair_completed_at")
    op.drop_column("repair_requests", "repair_started_at")
    op.drop_column("repair_requests", "completion_notes")
    op.drop_column("repair_requests", "damage_type")
    op.drop_column("repair_requests", "flagged_source")
