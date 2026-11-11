"""Sliding-window rate limiting per client IP."""

import time
from collections import defaultdict
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.core.config import get_settings
from src.core.rbac_policy import is_public_path

settings = get_settings()

_store: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_allowed(key: str) -> bool:
    now = time.time()
    window = 60.0
    limit = settings.rate_limit_per_minute
    with _lock:
        hits = [t for t in _store[key] if now - t < window]
        if len(hits) >= limit:
            _store[key] = hits
            return False
        hits.append(now)
        _store[key] = hits
        return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS" or is_public_path(request.url.path):
            return await call_next(request)

        key = _client_key(request)
        if not _is_allowed(key):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "message": "Too many requests. Please slow down.",
                },
            )
        return await call_next(request)
