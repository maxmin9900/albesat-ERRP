from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    debug: bool = True
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    database_url: str = "postgresql+asyncpg://firoozeh:firoozeh_secret@localhost:5432/firoozeh"
    redis_url: str = "redis://localhost:6379/0"

    cors_origins: str = "http://localhost:3000"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7

    otp_expire_minutes: int = 5
    otp_length: int = 6
    otp_max_attempts: int = 5
    otp_rate_limit_per_phone: int = 5

    qr_hmac_secret: str = "change-me-qr-secret"

    # Security
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    csrf_enabled: bool = True
    csrf_header_name: str = "X-CSRF-Token"
    rate_limit_per_minute: int = 120
    audit_enabled: bool = True

    # Which backend actually delivers WhatsApp messages.
    #   meta          - official Meta Cloud API (templates, 24h window)
    #   360messenger  - WhatsApp Web bridge on the business's own number
    #                   (plain text only, no templates, no 24h window)
    whatsapp_provider: str = "meta"
    messenger360_api_key: str = ""
    messenger360_base_url: str = "https://api.360messenger.com"

    # WhatsApp OTP (Meta Cloud API)
    whatsapp_mode: str = "mock"  # mock | cloud | disabled
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_otp_template_name: str = "otp_verification"
    whatsapp_otp_template_language: str = "en"
    whatsapp_otp_include_button: bool = False
    otp_send_via_whatsapp: bool = True
    # Per-role sign-in codes for staff, as "role_slug:code" pairs. Empty
    # disables the whole mechanism. Only accounts holding one of these roles
    # are affected, so customers always get a real one-time code.
    staff_fixed_otp_role_codes: str = ""
    # Draft-invoice template (US-DI-05). Cloud API rejects free-form text
    # outside the 24h customer-service window, so a customer who never
    # messaged us can only be reached through an approved template.
    whatsapp_invoice_template_name: str = "draft_invoice"
    whatsapp_invoice_template_language: str = "en"

    # Public base URL of the web app — used in customer-facing links
    # (e.g. the draft-invoice link sent via WhatsApp).
    public_web_url: str = "http://49.13.160.62:3050"

    # EPIC 7 — invoice payment terms
    invoice_payment_due_days: int = 14
    payment_reminder_whatsapp: bool = True
    payment_reminder_sms: bool = True

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if not v:
            return v
        # Alembic/SQLAlchemy async need asyncpg, not psycopg2
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://") :]
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://") :]
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | List[str]) -> str:
        if isinstance(v, list):
            return ",".join(v)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
