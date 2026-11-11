"""Wipe all business data for a clean client handover.

Deletes every order/customer/carpet/invoice/payment/repair/session row and all
users, then re-creates exactly the four staff accounts (English names) so the
PIN login keeps working. Roles, permissions and the 500 pre-printed physical QR
tags are KEPT.

This is destructive and irreversible — it requires explicit confirmation.

Run (host-db compose) on the server:
  docker-compose -f docker-compose.hostdb.yml run --rm --entrypoint sh \\
    migrate -c "PYTHONPATH=/app python scripts/reset_for_handover.py --yes"

Locally:
  PYTHONPATH=. python scripts/reset_for_handover.py --yes
"""

import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.config import get_settings

# Transactional / business tables. Order is irrelevant because TRUNCATE ...
# CASCADE resolves foreign keys automatically. NOTE: "users" is handled
# separately below — it must NOT be TRUNCATE-CASCADEd, because
# physical_qr_tags.created_by_id is a FK to users, so a cascading truncate of
# users would also wipe the 500 pre-printed QR tags we must keep.
BUSINESS_TABLES = (
    "repair_request_photos",
    "repair_requests",
    "carpet_operation_logs",
    "carpet_delivery_logs",
    "carpet_status_events",
    "qr_scan_logs",
    "qr_codes",
    "carpets",
    "payment_reminder_logs",
    "partner_settlements",
    "payment_transactions",
    "invoice_items",
    "invoices",
    "order_payment_records",
    "order_status_history",
    "delivery_route_stops",
    "delivery_route_sessions",
    "service_sessions",
    "customer_payment_records",
    "customer_profiles",
    "orders",
    "partners",
    "audit_logs",
    "otp_codes",
    "refresh_tokens",
    "user_roles",
)

# Kept intact: roles, permissions, role_permissions, physical_qr_tags,
# alembic_version.

# (E.164 phone, English display name, single role slug) — mirrors migration 027.
STAFF_USERS = (
    ("+96899275151", "Super Admin", "super_admin"),
    ("+96897243806", "Admin", "admin"),
    ("+96899667661", "Driver", "driver"),
    ("+96899716383", "Operations", "operation_team"),
)


def _confirmed() -> bool:
    return "--yes" in sys.argv[1:] or os.getenv("RESET_CONFIRM") == "1"


async def main() -> int:
    if not _confirmed():
        print(
            "Refusing to run without confirmation.\n"
            "This DELETES all orders, customers, carpets, invoices, payments and users.\n"
            "Re-run with --yes (or RESET_CONFIRM=1) to proceed."
        )
        return 1

    engine = create_async_engine(get_settings().database_url)
    try:
        async with engine.begin() as conn:
            # Only truncate tables that actually exist in this database.
            present: list[str] = []
            for table in BUSINESS_TABLES:
                exists = await conn.execute(
                    text("SELECT to_regclass(:t)"), {"t": f"public.{table}"}
                )
                if exists.scalar() is not None:
                    present.append(table)

            if present:
                joined = ", ".join(present)
                print(f"Truncating {len(present)} table(s): {joined}")
                await conn.execute(text(f"TRUNCATE TABLE {joined} RESTART IDENTITY CASCADE"))

            # Detach the only kept FK that points at users, then DELETE users.
            # (TRUNCATE CASCADE on users would also wipe physical_qr_tags via its
            # created_by_id FK — so users must be removed with a plain DELETE.)
            await conn.execute(text("UPDATE physical_qr_tags SET created_by_id = NULL"))
            if (await conn.execute(text("SELECT to_regclass('public.users')"))).scalar() is not None:
                await conn.execute(text("DELETE FROM users"))
                print("Deleted all users.")

            # Free every physical QR tag (qr_codes was truncated above): clear
            # the "already used" mark and re-enable any tag that was switched
            # off, so all 500 pre-printed tags go back into circulation.
            await conn.execute(
                text(
                    "UPDATE physical_qr_tags "
                    "SET last_used_at = NULL, is_active = true"
                )
            )

            # Re-create the four staff accounts with English names.
            for phone, full_name, role_slug in STAFF_USERS:
                role = await conn.execute(
                    text("SELECT id FROM roles WHERE slug = :slug"), {"slug": role_slug}
                )
                role_id = role.scalar_one_or_none()
                if role_id is None:
                    print(f"  ! role '{role_slug}' missing — run migrations first; skipping {phone}")
                    continue
                user = await conn.execute(
                    text(
                        """
                        INSERT INTO users (id, phone, full_name, is_active, created_at, updated_at)
                        VALUES (gen_random_uuid(), :phone, :name, true, NOW(), NOW())
                        RETURNING id
                        """
                    ),
                    {"phone": phone, "name": full_name},
                )
                user_id = user.scalar_one()
                await conn.execute(
                    text(
                        "INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"
                    ),
                    {"uid": user_id, "rid": role_id},
                )
                print(f"  + {full_name} ({phone}) -> {role_slug}")

            tags = await conn.execute(
                text(
                    "SELECT count(*), count(*) FILTER (WHERE is_active), "
                    "count(*) FILTER (WHERE last_used_at IS NOT NULL) "
                    "FROM physical_qr_tags"
                )
            )
            total, active, used = tags.one()
            print(f"\nDone. Physical QR tags: {total} total, {active} active, {used} used")
    finally:
        await engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
