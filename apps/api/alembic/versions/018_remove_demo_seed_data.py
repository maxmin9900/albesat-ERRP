"""Remove legacy demo seed data from existing databases.

Revision ID: 018
Revises: 017

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEMO_ORDER_NUMBERS = (
    "ORD-DEMO001",
    "ORD-1024",
    "ORD-1023",
    "ORD-1022",
    "ORD-1021",
    "ORD-1020",
    "ORD-2024-0042",
    "ORD-2024-0041",
    "ORD-2024-0040",
    "ORD-2024-0039",
    "ORD-2024-0038",
)

DEMO_PARTNER_SLUGS = ("brooklyn-rugs", "manhattan-home", "queens-outlet")

# Seeded admin, smoke-test, and demo customer phones
DEMO_USER_PHONES = (
    "+12125550147",
    "+15550007001",
    "+15550007002",
)

DEMO_CUSTOMER_PHONES = (
    "+9891226607453",
    "+989121111111",
    "+12125550100",
    "+12125550200",
    "+12125550300",
    "+12125550400",
    "+1-555-987-6543",
    "+1-555-123-4567",
    "+1-555-222-3333",
    "+1-555-444-5555",
    "+1-555-666-7777",
    "+1-555-100-2001",
    "+1-555-100-2002",
    "+1-555-100-2003",
)


def _delete_orders_for_ids(conn, order_ids_sql: str) -> None:
    """Delete child rows then orders for the given order id subquery."""
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
    for table in (
        "qr_scan_logs",
        "qr_codes",
        "carpet_status_events",
        "carpet_delivery_logs",
        "carpet_operation_logs",
    ):
        conn.execute(
            sa.text(
                f"""DELETE FROM {table}
                    WHERE carpet_id IN (
                      SELECT c.id FROM carpets c WHERE c.order_id IN ({order_ids_sql})
                    )"""
            )
        )
    conn.execute(sa.text(f"DELETE FROM carpets WHERE order_id IN ({order_ids_sql})"))
    conn.execute(sa.text(f"DELETE FROM orders WHERE id IN ({order_ids_sql})"))


def upgrade() -> None:
    conn = op.get_bind()
    order_nums = ", ".join(f"'{n}'" for n in DEMO_ORDER_NUMBERS)
    partner_slugs = ", ".join(f"'{s}'" for s in DEMO_PARTNER_SLUGS)
    user_phones = ", ".join(f"'{p}'" for p in DEMO_USER_PHONES)
    customer_phones = ", ".join(f"'{p}'" for p in DEMO_CUSTOMER_PHONES)

    # Orders matched by known demo order numbers
    order_ids_by_number = f"SELECT id FROM orders WHERE order_number IN ({order_nums})"
    _delete_orders_for_ids(conn, order_ids_by_number)

    # Orders matched by demo customer phones (seed migrations + partner contacts)
    order_ids_by_phone = f"SELECT id FROM orders WHERE customer_phone IN ({customer_phones})"
    _delete_orders_for_ids(conn, order_ids_by_phone)

    # Seed payment rows not tied to a specific order number pattern
    conn.execute(
        sa.text("DELETE FROM payment_transactions WHERE note = 'Seed transaction'")
    )

    # Demo partners — clear FK references before delete
    conn.execute(
        sa.text(
            f"""UPDATE service_sessions SET partner_id = NULL
                WHERE partner_id IN (SELECT id FROM partners WHERE slug IN ({partner_slugs}))"""
        )
    )
    conn.execute(
        sa.text(
            f"""UPDATE orders SET partner_id = NULL
                WHERE partner_id IN (SELECT id FROM partners WHERE slug IN ({partner_slugs}))"""
        )
    )
    conn.execute(
        sa.text(
            f"""UPDATE invoices SET partner_id = NULL
                WHERE partner_id IN (SELECT id FROM partners WHERE slug IN ({partner_slugs}))"""
        )
    )
    conn.execute(
        sa.text(
            f"""UPDATE payment_transactions SET partner_id = NULL
                WHERE partner_id IN (SELECT id FROM partners WHERE slug IN ({partner_slugs}))"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM partner_settlements
                WHERE partner_id IN (SELECT id FROM partners WHERE slug IN ({partner_slugs}))"""
        )
    )
    conn.execute(
        sa.text(f"DELETE FROM partners WHERE slug IN ({partner_slugs})")
    )

    demo_user_ids = f"SELECT id FROM users WHERE phone IN ({user_phones})"

    # Clear nullable FK references to demo users before delete
    for stmt in [
        f"UPDATE carpets SET received_by_ops_user_id = NULL, operation_started_by_user_id = NULL, operation_completed_by_user_id = NULL, loaded_for_delivery_by_user_id = NULL, loaded_for_driver_id = NULL, delivered_by_user_id = NULL WHERE received_by_ops_user_id IN ({demo_user_ids}) OR operation_started_by_user_id IN ({demo_user_ids}) OR operation_completed_by_user_id IN ({demo_user_ids}) OR loaded_for_delivery_by_user_id IN ({demo_user_ids}) OR loaded_for_driver_id IN ({demo_user_ids}) OR delivered_by_user_id IN ({demo_user_ids})",
        f"UPDATE qr_scan_logs SET scanned_by_id = NULL WHERE scanned_by_id IN ({demo_user_ids})",
        f"UPDATE qr_codes SET issued_by_id = NULL WHERE issued_by_id IN ({demo_user_ids})",
        f"UPDATE orders SET created_by_id = NULL, assigned_driver_id = NULL WHERE created_by_id IN ({demo_user_ids}) OR assigned_driver_id IN ({demo_user_ids})",
        f"UPDATE order_status_history SET changed_by_id = NULL WHERE changed_by_id IN ({demo_user_ids})",
        f"UPDATE payment_transactions SET recorded_by_id = NULL WHERE recorded_by_id IN ({demo_user_ids})",
        f"UPDATE payment_reminder_logs SET sent_by_id = NULL WHERE sent_by_id IN ({demo_user_ids})",
        f"UPDATE carpet_status_events SET changed_by_id = NULL WHERE changed_by_id IN ({demo_user_ids})",
        f"UPDATE carpet_delivery_logs SET performed_by_id = NULL WHERE performed_by_id IN ({demo_user_ids})",
        f"UPDATE carpet_operation_logs SET performed_by_id = NULL WHERE performed_by_id IN ({demo_user_ids})",
        f"UPDATE audit_logs SET user_id = NULL WHERE user_id IN ({demo_user_ids})",
        f"UPDATE repair_requests SET contacted_by_user_id = NULL, admin_approved_by_user_id = NULL, created_by_user_id = NULL, assessed_by_user_id = NULL WHERE contacted_by_user_id IN ({demo_user_ids}) OR admin_approved_by_user_id IN ({demo_user_ids}) OR created_by_user_id IN ({demo_user_ids}) OR assessed_by_user_id IN ({demo_user_ids})",
        f"UPDATE repair_request_photos SET uploaded_by_id = NULL WHERE uploaded_by_id IN ({demo_user_ids})",
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
        sa.text(
            f"DELETE FROM delivery_route_sessions WHERE driver_id IN ({demo_user_ids})"
        )
    )

    # Demo / smoke-test staff users
    conn.execute(
        sa.text(
            f"""DELETE FROM user_roles
                WHERE user_id IN (SELECT id FROM users WHERE phone IN ({user_phones}))"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM refresh_tokens
                WHERE user_id IN (SELECT id FROM users WHERE phone IN ({user_phones}))"""
        )
    )
    conn.execute(
        sa.text(
            f"""DELETE FROM otp_codes WHERE phone IN ({user_phones})"""
        )
    )
    conn.execute(
        sa.text(f"DELETE FROM users WHERE phone IN ({user_phones})")
    )


def downgrade() -> None:
    pass
