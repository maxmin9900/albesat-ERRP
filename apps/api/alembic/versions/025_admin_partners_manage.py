"""Grant admin the partners:manage permission (create/edit partners in admin panel).

Migration 010 reset the admin role to partners:read only, so the admin panel's
"Add partner" / "Edit partner" actions hit a silent 403 on POST/PATCH
/payments/partners (which require partners:manage). This grants it to admin.

Revision ID: 025
Revises: 024
"""

from alembic import op
import sqlalchemy as sa

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None

ADMIN_PARTNER_PERMS = ("partners:manage",)


def upgrade() -> None:
    conn = op.get_bind()
    for perm in ADMIN_PARTNER_PERMS:
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
    for perm in ADMIN_PARTNER_PERMS:
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
