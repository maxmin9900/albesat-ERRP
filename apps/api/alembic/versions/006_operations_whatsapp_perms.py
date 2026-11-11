"""Operations permissions and WhatsApp OTP log channel

Revision ID: 006
Revises: 005

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """INSERT INTO permissions (id, name, resource, action, description, created_at, updated_at)
               SELECT gen_random_uuid(), 'operations:read', 'operations', 'read', 'View operations queue', NOW(), NOW()
               WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'operations:read')"""
        )
    )
    op.execute(
        sa.text(
            """INSERT INTO permissions (id, name, resource, action, description, created_at, updated_at)
               SELECT gen_random_uuid(), 'operations:update', 'operations', 'update', 'Manage wash operations', NOW(), NOW()
               WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'operations:update')"""
        )
    )
    op.execute(
        sa.text(
            """INSERT INTO role_permissions (role_id, permission_id)
               SELECT r.id, p.id FROM roles r, permissions p
               WHERE r.slug IN ('operation_team', 'super_admin', 'admin')
                 AND p.name IN ('operations:read', 'operations:update')
                 AND NOT EXISTS (
                   SELECT 1 FROM role_permissions rp
                   WHERE rp.role_id = r.id AND rp.permission_id = p.id
                 )"""
        )
    )
    op.execute(
        sa.text(
            """INSERT INTO role_permissions (role_id, permission_id)
               SELECT r.id, p.id FROM roles r, permissions p
               WHERE r.slug = 'operation_team'
                 AND p.name = 'qr:scan'
                 AND NOT EXISTS (
                   SELECT 1 FROM role_permissions rp
                   WHERE rp.role_id = r.id AND rp.permission_id = p.id
                 )"""
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """DELETE FROM role_permissions WHERE permission_id IN (
               SELECT id FROM permissions WHERE name IN ('operations:read', 'operations:update')
             )"""
        )
    )
    op.execute(
        sa.text("DELETE FROM permissions WHERE name IN ('operations:read', 'operations:update')")
    )
