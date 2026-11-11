"""Activate staff accounts, assign single roles, fix pending pickup workflow.

Revision ID: 020
Revises: 019

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# E.164 — matches auth phone normalization (09… → +989…)
STAFF_USERS: tuple[tuple[str, str, str], ...] = (
    ("+989100617724", "ادمین", "admin"),
    ("+989359415243", "سوپر ادمین", "super_admin"),
    ("+989120157674", "راننده", "driver"),
    ("+989151552233", "عملیات", "operation_team"),
)


def upgrade() -> None:
    conn = op.get_bind()

    for phone, full_name, role_slug in STAFF_USERS:
        row = conn.execute(
            sa.text("SELECT id FROM users WHERE phone = :phone"),
            {"phone": phone},
        ).fetchone()

        if row:
            user_id = row[0]
            conn.execute(
                sa.text(
                    "UPDATE users SET full_name = :name, is_active = true, updated_at = NOW() WHERE id = :id"
                ),
                {"name": full_name, "id": user_id},
            )
        else:
            user_id = conn.execute(
                sa.text(
                    """
                    INSERT INTO users (id, phone, full_name, is_active, created_at, updated_at)
                    VALUES (gen_random_uuid(), :phone, :name, true, NOW(), NOW())
                    RETURNING id
                    """
                ),
                {"phone": phone, "name": full_name},
            ).scalar_one()

        conn.execute(
            sa.text("DELETE FROM user_roles WHERE user_id = :uid"),
            {"uid": user_id},
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO user_roles (user_id, role_id)
                SELECT :uid, r.id FROM roles r WHERE r.slug = :slug
                """
            ),
            {"uid": user_id, "slug": role_slug},
        )

    conn.execute(
        sa.text(
            """
            UPDATE orders
            SET pickup_workflow = 'pending'
            WHERE status = 'pending_pickup'
              AND (pickup_workflow IS NULL OR pickup_workflow = '')
            """
        )
    )


def downgrade() -> None:
    pass
