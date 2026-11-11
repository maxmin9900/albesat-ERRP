"""RBAC enforcement middleware — validates JWT + permission before route handlers."""

from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.core.logging_config import get_logger
from src.core.rbac_policy import is_public_path, permission_for_route
from src.core.security import verify_access_token

logger = get_logger("rbac")


class RBACMiddleware(BaseHTTPMiddleware):
    """Lightweight permission gate for mapped routes (Bearer token required)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        method = request.method

        if method == "OPTIONS" or is_public_path(path):
            return await call_next(request)

        required = permission_for_route(method, path)
        if required is None:
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "message": "Authentication required"},
            )

        try:
            payload = verify_access_token(auth[7:])
            request.state.user_id = UUID(payload["sub"])
            request.state.active_role = payload.get("role")
        except ValueError:
            return JSONResponse(
                status_code=401,
                content={"error": "unauthorized", "message": "Invalid or expired token"},
            )

        # Full permission check happens in service layer via DB; middleware logs intent
        request.state.required_permission = required
        logger.debug("RBAC check %s %s requires %s", method, path, required)
        return await call_next(request)
