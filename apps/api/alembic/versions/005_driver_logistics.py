"""Driver logistics fields and demo orders

Revision ID: 005
Revises: 004

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("assigned_driver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )
    op.add_column("orders", sa.Column("pickup_workflow", sa.String(30), nullable=True))
    op.add_column("orders", sa.Column("delivery_workflow", sa.String(30), nullable=True))
    op.add_column("orders", sa.Column("pickup_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("payment_method", sa.String(30), nullable=True))
    op.add_column("orders", sa.Column("carpet_count", sa.Integer(), server_default="1", nullable=False))
    op.add_column("orders", sa.Column("carpet_dimensions", sa.String(50), nullable=True))
    op.add_column("orders", sa.Column("distance_km", sa.Numeric(6, 2), nullable=True))
    op.create_index("ix_orders_assigned_driver_id", "orders", ["assigned_driver_id"])

    # Driver logistics permissions
    op.execute(
        sa.text(
            """INSERT INTO permissions (id, name, resource, action, description, created_at, updated_at)
               VALUES
                 (gen_random_uuid(), 'logistics:read', 'logistics', 'read', 'View driver logistics', NOW(), NOW()),
                 (gen_random_uuid(), 'logistics:pickup', 'logistics', 'pickup', 'Pickup workflow', NOW(), NOW()),
                 (gen_random_uuid(), 'logistics:deliver', 'logistics', 'deliver', 'Delivery workflow', NOW(), NOW())
               ON CONFLICT (name) DO NOTHING"""
        )
    )
    op.execute(
        sa.text(
            """INSERT INTO role_permissions (role_id, permission_id)
               SELECT r.id, p.id FROM roles r, permissions p
               WHERE r.slug = 'driver' AND p.name IN (
                 'logistics:read', 'logistics:pickup', 'logistics:deliver', 'qr:generate'
               )
               ON CONFLICT DO NOTHING"""
        )
    )

    # Set pickup_workflow pending on existing pending_pickup orders
    op.execute(
        sa.text(
            """UPDATE orders SET pickup_workflow = 'pending'
               WHERE status = 'pending_pickup' AND pickup_workflow IS NULL"""
        )
    )
    op.execute(
        sa.text(
            """UPDATE orders SET delivery_workflow = 'pending'
               WHERE status = 'ready_for_delivery' AND delivery_workflow IS NULL"""
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM orders WHERE order_number LIKE 'ORD-2024-%'"
        )
    )
    op.drop_index("ix_orders_assigned_driver_id", "orders")
    op.drop_column("orders", "distance_km")
    op.drop_column("orders", "carpet_dimensions")
    op.drop_column("orders", "carpet_count")
    op.drop_column("orders", "payment_method")
    op.drop_column("orders", "pickup_started_at")
    op.drop_column("orders", "delivery_workflow")
    op.drop_column("orders", "pickup_workflow")
    op.drop_column("orders", "assigned_driver_id")
