from typing import Any


class AppException(Exception):
    def __init__(self, message: str, code: str = "APP_ERROR", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, code="NOT_FOUND", status_code=404)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, code="UNAUTHORIZED", status_code=401)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, code="FORBIDDEN", status_code=403)


class ValidationError(AppException):
    def __init__(self, message: str = "Validation failed", details: dict[str, Any] | None = None):
        super().__init__(message, code="VALIDATION_ERROR", status_code=422)
        self.details = details or {}


class RateLimitError(AppException):
    def __init__(self, message: str = "Too many requests"):
        super().__init__(message, code="RATE_LIMIT", status_code=429)
