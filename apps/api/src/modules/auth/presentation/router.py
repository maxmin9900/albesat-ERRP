from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cookies import (
    REFRESH_COOKIE,
    clear_csrf_cookie,
    clear_refresh_cookie,
    set_csrf_cookie,
    set_refresh_cookie,
)
from src.core.dependencies import CurrentUser
from src.core.exceptions import ValidationError
from src.core.middleware.csrf import generate_csrf_token
from src.modules.auth.application.schemas import (
    AuthSessionResponse,
    CsrfResponse,
    LoginSuccessResponse,
    OtpRequestResponse,
    OtpRequestSchema,
    OtpVerifySchema,
    PinLoginSchema,
    RegisterSchema,
    RoleSelectSchema,
    TokenResponse,
    UpdateProfileSchema,
    UserResponse,
)
from src.modules.auth.application.service import AuthService
from src.shared.database.session import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _apply_auth_cookies(response: Response, tokens: TokenResponse, csrf: str) -> None:
    set_refresh_cookie(response, tokens.refresh_token)
    set_csrf_cookie(response, csrf)


@router.get("/csrf", response_model=CsrfResponse)
async def get_csrf(response: Response) -> CsrfResponse:
    token = generate_csrf_token()
    set_csrf_cookie(response, token)
    return CsrfResponse(csrf_token=token)


@router.post("/register", response_model=OtpRequestResponse)
async def register(
    data: RegisterSchema,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OtpRequestResponse:
    return await AuthService(db).register(data, _client_ip(request))


@router.post("/otp/request", response_model=OtpRequestResponse)
async def request_otp(
    data: OtpRequestSchema,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OtpRequestResponse:
    service = AuthService(db)
    return await service.request_otp(data.phone, _client_ip(request))


@router.post("/login", response_model=LoginSuccessResponse)
async def login_with_pin(
    data: PinLoginSchema,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginSuccessResponse:
    service = AuthService(db)
    result = await service.login_with_pin(
        data, request.headers.get("User-Agent"), _client_ip(request)
    )
    csrf = generate_csrf_token()
    _apply_auth_cookies(response, result.tokens, csrf)
    return result.model_copy(update={"csrf_token": csrf})


@router.post("/otp/verify", response_model=AuthSessionResponse)
async def verify_otp(
    data: OtpVerifySchema,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthSessionResponse:
    service = AuthService(db)
    return await service.verify_otp(data)


@router.post("/role/select", response_model=LoginSuccessResponse)
async def select_role(
    data: RoleSelectSchema,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_session_token: Annotated[str | None, Header(alias="X-Session-Token")] = None,
) -> LoginSuccessResponse:
    if not x_session_token:
        raise ValidationError("X-Session-Token header required")
    service = AuthService(db)
    result = await service.select_role(
        data, x_session_token, request.headers.get("User-Agent"), _client_ip(request)
    )
    csrf = generate_csrf_token()
    _apply_auth_cookies(response, result.tokens, csrf)
    return result.model_copy(update={"csrf_token": csrf})


@router.post("/refresh", response_model=LoginSuccessResponse)
async def refresh_tokens(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginSuccessResponse:
    refresh = request.cookies.get(REFRESH_COOKIE)
    if not refresh:
        raise ValidationError("Refresh token cookie required")
    service = AuthService(db)
    result, csrf = await service.refresh_session(
        refresh, request.headers.get("User-Agent"), _client_ip(request)
    )
    _apply_auth_cookies(response, result.tokens, csrf)
    return result.model_copy(update={"csrf_token": csrf})


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    refresh = request.cookies.get(REFRESH_COOKIE)
    service = AuthService(db)
    await service.logout(refresh)
    clear_refresh_cookie(response)
    clear_csrf_cookie(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    service = AuthService(db)
    active_role = getattr(user, "_active_role_slug", None)
    response, _ = await service._build_user_response(user, active_role)
    return response


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileSchema,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    service = AuthService(db)
    return await service.update_profile(user, data)
