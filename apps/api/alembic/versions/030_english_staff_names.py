"""Set staff user display names to English.

Migration 027 seeded the staff accounts with Persian full names ("سوپر ادمین",
"ادمین", "راننده", "عملیات"), which then show in the user menu and profile.
The product is delivered in English, so rename them by phone (the PIN-based
login identifies the account by phone, so the display name is cosmetic only).

Revision ID: 030
Revises: 029
"""

from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None

# (E.164 phone, English display name)
STAFF_NAMES = (
    ("+96899275151", "Super Admin"),
    ("+96897243806", "Admin"),
    ("+96899667661", "Driver"),
    ("+96899716383", "Operations"),
)


def upgrade() -> None:
    conn = op.get_bind()
    for phone, name in STAFF_NAMES:
        conn.execute(
            sa.text("UPDATE users SET full_name = :name WHERE phone = :phone"),
            {"name": name, "phone": phone},
        )


def downgrade() -> None:
    pass
