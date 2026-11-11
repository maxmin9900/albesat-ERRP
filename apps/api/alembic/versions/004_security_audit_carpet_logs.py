"""Security audit logs and carpet tracking history

Revision ID: 004
Revises: 003

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(64), nullable=True),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("request_id", sa.String(64), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.create_table(
        "carpet_status_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("carpet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("carpets.id"), nullable=False),
        sa.Column("from_status", sa.String(30), nullable=True),
        sa.Column("to_status", sa.String(30), nullable=False),
        sa.Column("changed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_carpet_status_events_carpet_id", "carpet_status_events", ["carpet_id"])

    op.create_table(
        "carpet_delivery_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("carpet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("carpets.id"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("driver_name", sa.String(255), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("performed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_carpet_delivery_logs_carpet_id", "carpet_delivery_logs", ["carpet_id"])

    op.create_table(
        "carpet_operation_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("carpet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("carpets.id"), nullable=False),
        sa.Column("operation", sa.String(50), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("performed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_carpet_operation_logs_carpet_id", "carpet_operation_logs", ["carpet_id"])

    # Seed initial status events for existing carpets
    op.execute(
        sa.text(
            """INSERT INTO carpet_status_events (id, carpet_id, from_status, to_status, note)
               SELECT gen_random_uuid(), c.id, NULL, c.status::text, 'Initial status'
               FROM carpets c
               WHERE NOT EXISTS (
                 SELECT 1 FROM carpet_status_events e WHERE e.carpet_id = c.id
               )"""
        )
    )


def downgrade() -> None:
    op.drop_table("carpet_operation_logs")
    op.drop_table("carpet_delivery_logs")
    op.drop_table("carpet_status_events")
    op.drop_table("audit_logs")
