"""Repair alembic_version when DB still has old filename-style revision IDs (e.g. 008_normalize_user_phones)."""

import asyncio
import re
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.core.config import get_settings


async def main() -> int:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with engine.begin() as conn:
            row = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
            current = row.scalar_one_or_none()
            if current is None:
                print("No alembic_version row — fresh database, nothing to fix.")
                return 0
            if re.fullmatch(r"\d{3}_.+", current):
                new = re.sub(r"^(\d{3})_.*", r"\1", current)
                await conn.execute(
                    text("UPDATE alembic_version SET version_num = :new WHERE version_num = :old"),
                    {"new": new, "old": current},
                )
                print(f"Fixed alembic revision: {current} -> {new}")
            else:
                print(f"Alembic revision OK: {current}")
    finally:
        await engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
