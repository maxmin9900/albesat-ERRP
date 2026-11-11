"""Demote every 'driver' except the one real driver phone (09120157674).

Test/QA logins created junk 'User <last4>' accounts that picked up the
driver role, so the operations "Destination driver" dropdown listed many
fake drivers. This removes the driver role from all of them, leaving only
the phone whose last 10 digits are 9120157674 (+989120157674).

It only touches the user_roles link for the driver role — accounts and
their other roles are left intact, so it is safe to re-run.

Run on the server (host-db compose):
  docker-compose -f docker-compose.hostdb.yml run --rm --entrypoint sh \
    migrate -c "PYTHONPATH=/app python scripts/cleanup_drivers.py"
"""

import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.config import get_settings

# National part of the only real driver (09120157674 / +989120157674).
KEEP_PHONE_DIGITS = "9120157674"


async def main() -> int:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with engine.begin() as conn:
            role = await conn.execute(
                text("SELECT id FROM roles WHERE slug = 'driver'")
            )
            driver_role_id = role.scalar_one_or_none()
            if driver_role_id is None:
                print("No 'driver' role found — nothing to do.")
                return 0

            # Drivers we will remove: have the driver role but are not the
            # real driver phone (compared by digits-only, last 10).
            doomed = await conn.execute(
                text(
                    """
                    SELECT u.id, u.full_name, u.phone
                    FROM users u
                    JOIN user_roles ur ON ur.user_id = u.id
                    WHERE ur.role_id = :role_id
                      AND right(regexp_replace(u.phone, '\\D', '', 'g'), 10)
                          <> :keep
                    ORDER BY u.full_name
                    """
                ),
                {"role_id": driver_role_id, "keep": KEEP_PHONE_DIGITS},
            )
            rows = doomed.fetchall()

            if not rows:
                print("Only the real driver has the driver role. Nothing to do.")
            else:
                print(f"Removing driver role from {len(rows)} account(s):")
                for r in rows:
                    print(f"  - {r.full_name} ({r.phone})")
                await conn.execute(
                    text(
                        """
                        DELETE FROM user_roles
                        WHERE role_id = :role_id
                          AND user_id IN (
                            SELECT u.id FROM users u
                            WHERE right(
                              regexp_replace(u.phone, '\\D', '', 'g'), 10
                            ) <> :keep
                          )
                        """
                    ),
                    {"role_id": driver_role_id, "keep": KEEP_PHONE_DIGITS},
                )

            remaining = await conn.execute(
                text(
                    """
                    SELECT u.full_name, u.phone
                    FROM users u
                    JOIN user_roles ur ON ur.user_id = u.id
                    WHERE ur.role_id = :role_id
                    ORDER BY u.full_name
                    """
                ),
                {"role_id": driver_role_id},
            )
            kept = remaining.fetchall()
            print(f"\nDrivers remaining ({len(kept)}):")
            for r in kept:
                print(f"  - {r.full_name} ({r.phone})")
    finally:
        await engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
