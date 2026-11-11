"""Secure cookie helpers."""

from fastapi import Response

from src.core.config import get_settings

settings = get_settings()

REFRESH_COOKIE = "fz_refresh"
CSRF_COOKIE = "fz_csrf"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_refresh_expire_days * 86400,
        path="/api/v1/auth",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path="/api/v1/auth",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=CSRF_COOKIE,
        value=token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_refresh_expire_days * 86400,
        path="/",
    )


def clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(
        key=CSRF_COOKIE,
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
