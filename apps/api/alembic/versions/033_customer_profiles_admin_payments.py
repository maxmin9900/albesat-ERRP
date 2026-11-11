"""Customer profiles (add customer without order) + grant admin payments:create.

Edit doc: "Add Customer" — admins can register a customer with no order
(Business Rule 1: New Customer != New Order). Customers were previously only
derived from orders; this table stores stand-alone profiles which merge with
order-derived customers in the admin list.

Also grants payments:create to the admin role so admins can confirm order
payments (Edit doc US-P-04) — previously only super_admin / finance_team could.

Revision ID: 033
Revises: 032
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None

ADMIN_PAYMENT_PERMS = ("payments:create",)


def upgrade() -> None:
    op.create_table(
        "customer_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_customer_profiles_phone", "customer_profiles", ["phone"])

    conn = op.get_bind()
    for perm in ADMIN_PAYMENT_PERMS:
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
    for perm in ADMIN_PAYMENT_PERMS:
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
    op.drop_index("ix_customer_profiles_phone", table_name="customer_profiles")
    op.drop_table("customer_profiles")
