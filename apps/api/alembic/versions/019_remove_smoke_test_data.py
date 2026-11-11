"""Remove smoke-test and epic mock data left in the database.

Revision ID: 019
Revises: 018

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SMOKE_USER_PHONES = (
    "+12125550147",
    "+15550007001",
    "+15550007002",
)

# Orders created by _smoke_epic*.py and manual QA (driver/payments panels)
SMOKE_ORDER_IDS_SQL = """
SELECT id FROM orders
WHERE customer_phone LIKE '+1212111%'
   OR customer_phone LIKE '+1212000%'
   OR customer_phone LIKE '+1555000%'
   OR customer_name LIKE 'Epic%'
   OR customer_name IN (
        'Pickup One', 'Pickup Two', 'Ops Customer',
        'U1', 'End Customer', 'Repair Tester', 'Finance Tester'
   )
"""


def _delete_orders_for_ids(conn, order_ids_sql: str) -> None:
    conn.execute(
        sa.text(
            f"""DELETE FROM payment_reminder_logs
                WHERE invoice_id IN (
                  SELECT id FROM invoices WHERE order_id IN ({order_ids_sql})
                )"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM repair_request_photos
                WHERE repair_request_id IN (
                  SELECT id FROM repair_requests WHERE order_id IN ({order_ids_sql})
                )"""
        )
    )
    for table in (
        "repair_requests",
        "payment_transactions",
        "invoices",
        "delivery_route_stops",
        "service_sessions",
        "order_status_history",
    ):
        conn.execute(
            sa.text(f"DELETE FROM {table} WHERE order_id IN ({order_ids_sql})")
        )
    conn.execute(
        sa.text(
            f"""DELETE FROM qr_scan_logs
                WHERE carpet_id IN (
                  SELECT c.id FROM carpets c WHERE c.order_id IN ({order_ids_sql})
                )"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM qr_codes
                WHERE carpet_id IN (
                  SELECT c.id FROM carpets c WHERE c.order_id IN ({order_ids_sql})
                )"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM carpet_status_events
                WHERE carpet_id IN (
                  SELECT c.id FROM carpets c WHERE c.order_id IN ({order_ids_sql})
                )"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM carpet_delivery_logs
                WHERE carpet_id IN (
                  SELECT c.id FROM carpets c WHERE c.order_id IN ({order_ids_sql})
                )"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM carpet_operation_logs
                WHERE carpet_id IN (
                  SELECT c.id FROM carpets c WHERE c.order_id IN ({order_ids_sql})
                )"""
        )
    )
    conn.execute(sa.text(f"DELETE FROM carpets WHERE order_id IN ({order_ids_sql})"))
    conn.execute(sa.text(f"DELETE FROM orders WHERE id IN ({order_ids_sql})"))


def upgrade() -> None:
    conn = op.get_bind()
    user_phones = ", ".join(f"'{p}'" for p in SMOKE_USER_PHONES)
    demo_user_ids = f"SELECT id FROM users WHERE phone IN ({user_phones})"

    _delete_orders_for_ids(conn, SMOKE_ORDER_IDS_SQL)

    # RBAC smoke partner
    conn.execute(
        sa.text(
            """UPDATE service_sessions SET partner_id = NULL
               WHERE partner_id IN (SELECT id FROM partners WHERE name = 'Test Partner')"""
        )
    )
    conn.execute(
        sa.text(
            """UPDATE orders SET partner_id = NULL
               WHERE partner_id IN (SELECT id FROM partners WHERE name = 'Test Partner')"""
        )
    )
    conn.execute(
        sa.text("DELETE FROM partner_settlements WHERE partner_id IN (SELECT id FROM partners WHERE name = 'Test Partner')")
    )
    conn.execute(sa.text("DELETE FROM partners WHERE name = 'Test Partner'"))

    # Clear FK refs then remove smoke staff users if still present
    for stmt in [
        f"UPDATE carpets SET received_by_ops_user_id = NULL, operation_started_by_user_id = NULL, operation_completed_by_user_id = NULL, loaded_for_delivery_by_user_id = NULL, loaded_for_driver_id = NULL, delivered_by_user_id = NULL WHERE received_by_ops_user_id IN ({demo_user_ids}) OR operation_started_by_user_id IN ({demo_user_ids}) OR operation_completed_by_user_id IN ({demo_user_ids}) OR loaded_for_delivery_by_user_id IN ({demo_user_ids}) OR loaded_for_driver_id IN ({demo_user_ids}) OR delivered_by_user_id IN ({demo_user_ids})",
        f"UPDATE orders SET created_by_id = NULL, assigned_driver_id = NULL WHERE created_by_id IN ({demo_user_ids}) OR assigned_driver_id IN ({demo_user_ids})",
        f"UPDATE payment_transactions SET recorded_by_id = NULL WHERE recorded_by_id IN ({demo_user_ids})",
    ]:
        conn.execute(sa.text(stmt))

    conn.execute(
        sa.text(
            f"""DELETE FROM delivery_route_stops
                WHERE route_session_id IN (
                  SELECT id FROM delivery_route_sessions WHERE driver_id IN ({demo_user_ids})
                )"""
        )
    )
    conn.execute(
        sa.text(f"DELETE FROM delivery_route_sessions WHERE driver_id IN ({demo_user_ids})")
    )
    conn.execute(
        sa.text(f"DELETE FROM user_roles WHERE user_id IN ({demo_user_ids})")
    )
    conn.execute(
        sa.text(f"DELETE FROM refresh_tokens WHERE user_id IN ({demo_user_ids})")
    )
    conn.execute(
        sa.text(f"DELETE FROM otp_codes WHERE phone IN ({user_phones})")
    )
    conn.execute(
        sa.text(f"DELETE FROM users WHERE phone IN ({user_phones})")
    )


def downgrade() -> None:
    pass
