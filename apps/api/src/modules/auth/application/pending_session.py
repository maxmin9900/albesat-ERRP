"""Pending OTP login sessions (role selection) — Redis with in-memory fallback."""

from __future__ import annotations

import json
import logging
from typing import Any

from src.core.config import get_settings

logger = logging.getLogger(__name__)

PENDING_PREFIX = "auth:pending:"
PENDING_TTL_SECONDS = 900  # 15 minutes

_memory: dict[str, dict[str, Any]] = {}
_redis_client = None


async def _redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis

        _redis_client = aioredis.from_url(
            get_settings().redis_url,
            decode_responses=True,
        )
        return _redis_client
    except Exception as exc:
        logger.warning("Redis unavailable for pending sessions: %s", exc)
        return None


async def save_pending_session(session_id: str, payload: dict[str, Any]) -> None:
    _memory[session_id] = payload
    client = await _redis()
    if client is None:
        return
    try:
        await client.setex(
            f"{PENDING_PREFIX}{session_id}",
            PENDING_TTL_SECONDS,
            json.dumps(payload),
        )
    except Exception as exc:
        logger.warning("Failed to persist pending session to Redis: %s", exc)


async def load_pending_session(session_id: str) -> dict[str, Any] | None:
    client = await _redis()
    if client is not None:
        try:
            raw = await client.get(f"{PENDING_PREFIX}{session_id}")
            if raw:
                return json.loads(raw)
        except Exception as exc:
            logger.warning("Failed to load pending session from Redis: %s", exc)
    return _memory.get(session_id)


async def delete_pending_session(session_id: str) -> None:
    _memory.pop(session_id, None)
    client = await _redis()
    if client is None:
        return
    try:
        await client.delete(f"{PENDING_PREFIX}{session_id}")
    except Exception:
        pass
