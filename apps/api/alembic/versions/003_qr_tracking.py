"""QR tracking tables and carpet seed

Revision ID: 003
Revises: 002

"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

carpet_status = postgresql.ENUM(
    "registered", "in_transit", "in_washing", "drying", "ready", "delivered",
    name="carpetstatus", create_type=True,
)


def upgrade() -> None:
    op.create_table(
        "carpets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("carpet_code", sa.String(30), nullable=False, unique=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("dimensions", sa.String(50), nullable=True),
        sa.Column("status", carpet_status, nullable=False, server_default="registered"),
        sa.Column("location_note", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_carpets_order_id", "carpets", ["order_id"])
    op.create_index("ix_carpets_carpet_code", "carpets", ["carpet_code"])

    op.create_table(
        "qr_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("carpet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("carpets.id"), nullable=False),
        sa.Column("code", sa.String(512), nullable=False, unique=True),
        sa.Column("signature_hash", sa.String(64), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("issued_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "qr_scan_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("carpet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("carpets.id"), nullable=False),
        sa.Column("scanned_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("scan_method", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("code_presented", sa.String(512), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.execute(
        sa.text(
            """INSERT INTO carpets (id, order_id, carpet_code, description, status)
               SELECT gen_random_uuid(), o.id, o.tracking_code,
                      COALESCE(o.carpet_description, 'Carpet'),
                      CASE o.status::text
                        WHEN 'in_washing' THEN 'in_washing'::carpetstatus
                        WHEN 'ready_for_delivery' THEN 'ready'::carpetstatus
                        WHEN 'delivered' THEN 'delivered'::carpetstatus
                        ELSE 'registered'::carpetstatus
                      END
               FROM orders o
               WHERE NOT EXISTS (SELECT 1 FROM carpets c WHERE c.order_id = o.id)"""
        )
    )


def downgrade() -> None:
    op.drop_table("qr_scan_logs")
    op.drop_table("qr_codes")
    op.drop_table("carpets")
    op.execute(sa.text("DROP TYPE IF EXISTS carpetstatus"))
