"""Route → permission mapping for RBAC middleware."""

from typing import NamedTuple


class RoutePermission(NamedTuple):
    method: str
    path_prefix: str
    permission: str


# Order matters: first match wins
ROUTE_PERMISSIONS: list[RoutePermission] = [
    RoutePermission("GET", "/api/v1/dashboard", "reports:read"),
    RoutePermission("POST", "/api/v1/orders/", "orders:update"),
    RoutePermission("POST", "/api/v1/orders", "orders:create"),
    RoutePermission("PATCH", "/api/v1/orders", "orders:update"),
    RoutePermission("DELETE", "/api/v1/orders", "orders:delete"),
    RoutePermission("GET", "/api/v1/orders", "orders:read"),
    RoutePermission("POST", "/api/v1/qr/generate", "qr:generate"),
    RoutePermission("POST", "/api/v1/qr/scan", "qr:scan"),
    RoutePermission("GET", "/api/v1/qr/registry", "orders:read"),
    RoutePermission("POST", "/api/v1/qr/registry", "qr:generate"),
    RoutePermission("PATCH", "/api/v1/qr/registry", "qr:generate"),
    RoutePermission("GET", "/api/v1/qr/carpets", "orders:read"),
    RoutePermission("GET", "/api/v1/driver", "logistics:read"),
    RoutePermission("POST", "/api/v1/driver", "logistics:read"),
    RoutePermission("GET", "/api/v1/operations", "operations:read"),
    RoutePermission("POST", "/api/v1/operations", "operations:update"),
    RoutePermission("GET", "/api/v1/payments", "payments:read"),
    RoutePermission("POST", "/api/v1/payments", "payments:create"),
    RoutePermission("PUT", "/api/v1/payments", "payments:create"),
    RoutePermission("GET", "/api/v1/sessions", "sessions:read"),
    RoutePermission("POST", "/api/v1/sessions", "sessions:read"),
    RoutePermission("GET", "/api/v1/admin/users", "users:read"),
    RoutePermission("PATCH", "/api/v1/admin/users", "users:manage"),
    RoutePermission("POST", "/api/v1/admin/users", "users:manage"),
    RoutePermission("GET", "/api/v1/admin/customers", "orders:read"),
    RoutePermission("POST", "/api/v1/admin/customers/mark-paid", "orders:update"),
    RoutePermission("POST", "/api/v1/admin/customers", "orders:create"),
    RoutePermission("GET", "/api/v1/admin/roles", "roles:manage"),
    RoutePermission("PATCH", "/api/v1/admin/roles", "roles:manage"),
    RoutePermission("POST", "/api/v1/admin/roles", "roles:manage"),
    RoutePermission("GET", "/api/v1/repairs", "repair:read"),
    RoutePermission("POST", "/api/v1/repairs/", "repair:approve"),
    RoutePermission("POST", "/api/v1/repairs", "repair:create"),
    RoutePermission("PATCH", "/api/v1/repairs/", "repair:update"),
    RoutePermission("POST", "/api/v1/payments/partners", "partners:manage"),
    RoutePermission("PATCH", "/api/v1/payments/partners", "partners:manage"),
    RoutePermission("DELETE", "/api/v1/payments/partners", "partners:manage"),
]

PUBLIC_PREFIXES = (
    "/health",
    "/health/db",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/register",
    "/api/v1/auth/otp",
    "/api/v1/auth/login",
    "/api/v1/auth/role/select",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/auth/csrf",
    "/api/v1/orders/public",
    "/api/v1/orders/track",
)


def permission_for_route(method: str, path: str) -> str | None:
    for rule in ROUTE_PERMISSIONS:
        if method == rule.method and path.startswith(rule.path_prefix):
            return rule.permission
    return None


def is_public_path(path: str) -> bool:
    return any(path.startswith(p) for p in PUBLIC_PREFIXES)
