import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from src.core.config import get_settings
from src.core.exceptions import AppException
from src.core.logging_config import setup_logging
from src.core.middleware.audit import AuditMiddleware
from src.core.middleware.csrf import CsrfMiddleware
from src.core.middleware.rate_limit import RateLimitMiddleware
from src.core.middleware.rbac import RBACMiddleware
from src.core.middleware.request_logging import RequestLoggingMiddleware
from src.core.middleware.security_headers import SecurityHeadersMiddleware
from src.modules.auth.presentation.router import router as auth_router
from src.modules.dashboard.presentation.router import router as dashboard_router
from src.modules.orders.presentation.router import router as orders_router
from src.modules.logistics.presentation.router import router as driver_router
from src.modules.operations.presentation.router import router as operations_router
from src.modules.payments.presentation.router import router as payments_router
from src.modules.qr_tracking.presentation.router import router as qr_router
from src.modules.sessions.presentation.router import router as sessions_router
from src.modules.users.presentation.router import router as users_admin_router
from src.modules.users.presentation.roles_router import router as roles_admin_router
from src.modules.customers.presentation.router import router as customers_admin_router
from src.modules.repair.presentation.router import router as repair_router
from src.modules.notifications.presentation.router import router as notifications_router

settings = get_settings()
setup_logging()
logger = logging.getLogger("firoozeh-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Firoozeh Carpet Pro API",
    description="Carpet cleaning management platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Middleware order: last added = outermost (runs first on request)
app.add_middleware(AuditMiddleware)
app.add_middleware(CsrfMiddleware)
app.add_middleware(RBACMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


@app.exception_handler(AppException)
async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message, "details": getattr(exc, "details", {})},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    message = "Internal server error"
    if settings.debug:
        message = f"{type(exc).__name__}: {exc}"
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": message},
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "firoozeh-api"}


@app.get("/health/db")
async def health_db() -> JSONResponse:
    from src.shared.database.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return JSONResponse({"status": "ok", "database": "connected"})
    except Exception as exc:
        logger.exception("Database health check failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "database": "disconnected",
                "message": str(exc) if settings.debug else "Database connection failed",
            },
        )


app.include_router(auth_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(qr_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(driver_router, prefix="/api/v1")
app.include_router(operations_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(sessions_router, prefix="/api/v1")
app.include_router(users_admin_router, prefix="/api/v1")
app.include_router(customers_admin_router, prefix="/api/v1")
app.include_router(roles_admin_router, prefix="/api/v1")
app.include_router(repair_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
