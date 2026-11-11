"""Grant operation_team the repair:update permission.

EPIC 8: after the admin approves a flagged repair, the work (start / complete)
must be performed by the team on site. This deployment has no separate
repair_team user, so the operations team starts and completes the approved
repair from the operations panel — which requires repair:update.

Revision ID: 026
Revises: 025
"""

from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None

OPS_REPAIR_PERMS = ("repair:update",)


def upgrade() -> None:
    conn = op.get_bind()
    for perm in OPS_REPAIR_PERMS:
        conn.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.slug = 'operation_team'
                  AND p.name = :perm
                  AND NOT EXISTS (
                    SELECT 1 FROM role_permissions rp
                    WHERE rp.role_id = r.id AND rp.permission_id = p.id
                  )
                """
            ),
            {"perm": perm},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for perm in OPS_REPAIR_PERMS:
        conn.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE role_id = (SELECT id FROM roles WHERE slug = 'operation_team')
                  AND permission_id = (SELECT id FROM permissions WHERE name = :perm)
                """
            ),
            {"perm": perm},
        )
