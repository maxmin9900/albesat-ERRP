"""Grant admin QR registry permissions (physical tag management in admin panel).

Revision ID: 023
Revisives: 022
"""

from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None

ADMIN_QR_PERMS = ("qr:generate", "qr:scan")


def upgrade() -> None:
    conn = op.get_bind()
    for perm in ADMIN_QR_PERMS:
        conn.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.slug = 'admin'
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
    for perm in ADMIN_QR_PERMS:
        conn.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE role_id = (SELECT id FROM roles WHERE slug = 'admin')
                  AND permission_id = (SELECT id FROM permissions WHERE name = :perm)
                """
            ),
            {"perm": perm},
        )
