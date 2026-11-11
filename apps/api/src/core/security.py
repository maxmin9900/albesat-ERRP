import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from src.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_otp_code(length: int | None = None) -> str:
    length = length or settings.otp_length
    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "access"}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, jti: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expire_days)
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "refresh", "jti": jti}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def verify_access_token(token: str) -> dict[str, Any]:
    try:
        payload = decode_token(token)
    except JWTError as e:
        raise ValueError("Invalid token") from e
    if payload.get("type") != "access":
        raise ValueError("Invalid token type")
    return payload


def verify_refresh_token(token: str) -> dict[str, Any]:
    try:
        payload = decode_token(token)
    except JWTError as e:
        raise ValueError("Invalid token") from e
    if payload.get("type") != "refresh":
        raise ValueError("Invalid token type")
    return payload


def subject_from_uuid(user_id: UUID) -> str:
    return str(user_id)
