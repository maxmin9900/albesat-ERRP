"""Audit logging for mutating API requests."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.core.config import get_settings
from src.core.rbac_policy import is_public_path
from src.modules.audit.application.service import AuditService
from src.shared.database.session import AsyncSessionLocal

settings = get_settings()
MUTATING = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if not settings.audit_enabled:
            return response

        if request.method not in MUTATING or is_public_path(request.url.path):
            return response

        user_id = getattr(request.state, "user_id", None)
        request_id = getattr(request.state, "request_id", None)

        try:
            async with AsyncSessionLocal() as db:
                await AuditService(db).log(
                    action=f"{request.method.lower()}_{request.url.path.strip('/').replace('/', '_')[:80]}",
                    method=request.method,
                    path=request.url.path,
                    user_id=user_id,
                    ip_address=_client_ip(request),
                    user_agent=request.headers.get("User-Agent"),
                    status_code=response.status_code,
                    request_id=request_id,
                )
                await db.commit()
        except Exception:
            pass  # never block response on audit failure

        return response


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
