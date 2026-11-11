"""Replace staff phone numbers — keep exactly one user per staff role.

Sets the four staff accounts to the real Oman numbers and strips the staff
roles (super_admin / admin / driver / operation_team) from every other user,
so the driver dropdown and login only ever show these four accounts.

Login is PIN-based (role_pins.py): the user must exist by phone, be active,
and hold the matching role — 111111 super_admin, 222222 admin, 333333 driver,
444444 operation_team.

Revision ID: 027
Revises: 026
"""

from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None

# (E.164 phone, display name, single role slug)
STAFF_USERS: tuple[tuple[str, str, str], ...] = (
    ("+96899275151", "سوپر ادمین", "super_admin"),
    ("+96897243806", "ادمین", "admin"),
    ("+96899667661", "راننده", "driver"),
    ("+96899716383", "عملیات", "operation_team"),
)

STAFF_ROLE_SLUGS = ("super_admin", "admin", "driver", "operation_team")


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
                    "UPDATE users SET full_name = :name, is_active = true, "
                    "updated_at = NOW() WHERE id = :id"
                ),
                {"name": full_name, "id": user_id},
            )
        else:
            user_id = conn.execute(
                sa.text(
                    """
                    INSERT INTO users
                        (id, phone, full_name, is_active, created_at, updated_at)
                    VALUES (gen_random_uuid(), :phone, :name, true, NOW(), NOW())
                    RETURNING id
                    """
                ),
                {"phone": phone, "name": full_name},
            ).scalar_one()

        # Exactly one role for this account.
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

    # Strip staff roles from every OTHER user (old test numbers, auto-created
    # "User ####" drivers, etc.) so only the four accounts above remain staff.
    # Values are fixed, trusted constants — inlined to avoid any driver-specific
    # array-binding quirk during deploy migrations.
    slug_list = ", ".join(f"'{s}'" for s in STAFF_ROLE_SLUGS)
    phone_list = ", ".join(f"'{u[0]}'" for u in STAFF_USERS)
    conn.execute(
        sa.text(
            f"""
            DELETE FROM user_roles
            WHERE role_id IN (
                SELECT id FROM roles WHERE slug IN ({slug_list})
            )
            AND user_id NOT IN (
                SELECT id FROM users WHERE phone IN ({phone_list})
            )
            """
        )
    )


def downgrade() -> None:
    pass
