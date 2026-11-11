"""Request/response logging middleware."""

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.core.logging_config import get_logger

logger = get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:12])
        request.state.request_id = request_id
        start = time.perf_counter()
        client = request.client.host if request.client else "-"

        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id

        logger.info(
            "%s %s %s %d %.1fms",
            request.method,
            request.url.path,
            client,
            response.status_code,
            duration_ms,
            extra={"request_id": request_id},
        )
        return response
