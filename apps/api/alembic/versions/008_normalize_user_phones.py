"""Normalize duplicate phone formats and grant staff roles to dev user."""

from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            keeper_id uuid;
        BEGIN
            SELECT id INTO keeper_id FROM users
            WHERE phone IN (
                '9226607453', '09226607453', '009226607453',
                '+989226607453', '989226607453'
            )
            ORDER BY CASE WHEN phone = '+989226607453' THEN 0 ELSE 1 END, created_at
            LIMIT 1;

            IF keeper_id IS NULL THEN
                RETURN;
            END IF;

            UPDATE users SET phone = '+989226607453' WHERE id = keeper_id;

            DELETE FROM user_roles ur
            USING users u
            WHERE ur.user_id = u.id
              AND u.phone IN (
                '9226607453', '09226607453', '009226607453',
                '+989226607453', '989226607453'
              )
              AND u.id <> keeper_id;

            DELETE FROM users
            WHERE phone IN (
                '9226607453', '09226607453', '009226607453',
                '+989226607453', '989226607453'
            )
            AND id <> keeper_id;

            INSERT INTO user_roles (user_id, role_id)
            SELECT keeper_id, r.id
            FROM roles r
            WHERE r.slug IN ('super_admin', 'admin', 'operation_team', 'driver')
              AND NOT EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = keeper_id AND ur.role_id = r.id
              );
        END $$;
        """
    )


def downgrade() -> None:
    pass
