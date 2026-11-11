"""Allow drivers to register orders from the driver panel.

Revision ID: 035
Revises: 034
Create Date: 2026-10-04

Drivers get `orders:create` so they can register a new order on the spot
(same POST /orders flow as the admin wizard). The order lands in the regular
order list, so admins see it like any other order.
"""

import sqlalchemy as sa
from alembic import op

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(
        sa.text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r, permissions p
            WHERE r.slug = 'driver' AND p.name = 'orders:create'
              AND NOT EXISTS (
                SELECT 1 FROM role_permissions rp
                WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
            """
        )
    )


def downgrade() -> None:
    op.get_bind().execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE role_id = (SELECT id FROM roles WHERE slug = 'driver')
              AND permission_id = (SELECT id FROM permissions WHERE name = 'orders:create')
            """
        )
    )
