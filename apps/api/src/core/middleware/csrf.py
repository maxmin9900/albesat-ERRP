"""CSRF double-submit cookie protection."""

import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.core.config import get_settings
from src.core.cookies import CSRF_COOKIE
from src.core.rbac_policy import is_public_path

settings = get_settings()

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class CsrfMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not settings.csrf_enabled:
            return await call_next(request)

        path = request.url.path
        if request.method in SAFE_METHODS or is_public_path(path):
            return await call_next(request)

        cookie_token = request.cookies.get(CSRF_COOKIE)
        header_token = request.headers.get(settings.csrf_header_name)

        if not cookie_token or not header_token or cookie_token != header_token:
            from starlette.responses import JSONResponse

            return JSONResponse(
                status_code=403,
                content={
                    "error": "csrf_validation_failed",
                    "message": "CSRF token missing or invalid",
                },
            )
        return await call_next(request)


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)
