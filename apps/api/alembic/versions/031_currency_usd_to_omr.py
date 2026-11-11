"""Switch currency from USD to Omani Rial (OMR).

The app launches in Oman, so all monetary values must be in Omani Rial.
This updates the column server defaults and relabels every existing row that
still carries the old "USD" code. Only the currency *label* changes — the
stored numeric amounts are left untouched (the driver re-enters the real OMR
price on-site during pickup measurement).

Revision ID: 031
Revises: 030
"""

from alembic import op
import sqlalchemy as sa

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None

# (table, currency column) pairs carrying a 3-letter currency code.
CURRENCY_COLUMNS = (
    ("orders", "currency"),
    ("invoices", "currency"),
    ("payment_transactions", "currency"),
)


def upgrade() -> None:
    conn = op.get_bind()
    for table, column in CURRENCY_COLUMNS:
        op.alter_column(table, column, server_default="OMR")
        conn.execute(
            sa.text(
                f"UPDATE {table} SET {column} = 'OMR' WHERE {column} = 'USD'"
            )
        )


def downgrade() -> None:
    conn = op.get_bind()
    for table, column in CURRENCY_COLUMNS:
        op.alter_column(table, column, server_default="USD")
        conn.execute(
            sa.text(
                f"UPDATE {table} SET {column} = 'USD' WHERE {column} = 'OMR'"
            )
        )
