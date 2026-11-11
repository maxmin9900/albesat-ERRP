from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from src.core.geo import is_inside_oman
from src.core.phone import normalize_customer_phone


def _validate_oman_coords(latitude: Decimal | None, longitude: Decimal | None) -> None:
    if latitude is None or longitude is None:
        raise ValueError("Map location inside Oman is required")
    if not is_inside_oman(float(latitude), float(longitude)):
        raise ValueError("Location must be inside Oman")


class PublicBookingSchema(BaseModel):
    # US-5: ثبت نام، شماره تماس، آدرس، لوکیشن، توضیحات، نوع خدمات
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=8, max_length=20)
    pickup_address: str = Field(..., min_length=5)
    house_number: str | None = Field(None, max_length=50)
    latitude: Decimal | None = Field(None, ge=-90, le=90)
    longitude: Decimal | None = Field(None, ge=-180, le=180)
    service_type: str = Field(..., pattern="^(standard|premium|antique)$")
    notes: str | None = None
    customer_email: str | None = Field(None, max_length=255)

    @field_validator("phone")
    @classmethod
    def validate_oman_phone(cls, v: str) -> str:
        return normalize_customer_phone(v)

    @model_validator(mode="after")
    def validate_location(self) -> "PublicBookingSchema":
        _validate_oman_coords(self.latitude, self.longitude)
        return self


class AdminCreateOrderSchema(BaseModel):
    # US-6 sources: تماس (phone) | واتساپ (whatsapp) | سایر (other) — plus website / partner.
    customer_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=8, max_length=20)
    customer_email: str | None = Field(None, max_length=255)
    carpet_description: str | None = Field(None, max_length=500)
    source: str = Field(default="phone", pattern="^(website|whatsapp|phone|partner|other)$")
    service_type: str = Field(default="standard", pattern="^(standard|premium|antique)$")
    notes: str | None = None
    pickup_address: str | None = None
    latitude: Decimal | None = Field(None, ge=-90, le=90)
    longitude: Decimal | None = Field(None, ge=-180, le=180)
    partner_id: UUID | None = None
    partner_reference: str | None = Field(None, max_length=100)

    @field_validator("phone")
    @classmethod
    def validate_oman_phone(cls, v: str) -> str:
        return normalize_customer_phone(v)

    @model_validator(mode="after")
    def validate_location(self) -> "AdminCreateOrderSchema":
        # Partner orders may omit coordinates entirely — the service auto-fills
        # the pickup location from the selected partner's registered location.
        # A single provided coordinate is always invalid.
        if self.source == "partner" or self.partner_id is not None:
            if self.latitude is None and self.longitude is None:
                return self
        _validate_oman_coords(self.latitude, self.longitude)
        return self


class AdminUpdateOrderSchema(BaseModel):
    customer_name: str | None = Field(None, min_length=2, max_length=255)
    customer_phone: str | None = Field(None, min_length=8, max_length=20)
    customer_email: str | None = Field(None, max_length=255)
    carpet_description: str | None = None
    notes: str | None = None
    pickup_address: str | None = None
    house_number: str | None = Field(None, max_length=50)
    service_type: str | None = Field(None, pattern="^(standard|premium|antique)$")
    status: str | None = None

    @field_validator("customer_phone")
    @classmethod
    def validate_oman_phone_optional(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return v
        return normalize_customer_phone(v)


class OrderStatusUpdateSchema(BaseModel):
    status: str
    note: str | None = None


class TimelineStep(BaseModel):
    status: str
    label: str
    timestamp: datetime | None
    is_completed: bool
    is_current: bool


class TrackOrderResponse(BaseModel):
    tracking_code: str
    order_number: str
    customer_name: str
    carpet_description: str | None
    current_status: str
    current_status_label: str
    estimated_delivery_at: datetime | None
    timeline: list[TimelineStep]
    total: Decimal
    currency: str


class BookingResponse(BaseModel):
    order_id: UUID
    tracking_code: str
    message: str


class OrderResponse(BaseModel):
    id: UUID
    order_number: str
    tracking_code: str
    customer_name: str
    customer_phone: str
    customer_email: str | None
    carpet_description: str | None
    carpet_count: int = 1
    carpet_dimensions: str | None = None
    source: str
    service_type: str
    status: str
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    notes: str | None
    pickup_address: str | None
    house_number: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    partner_id: UUID | None = None
    partner_name: str | None = None
    is_partner_order: bool = False
    session_code: str | None = None
    estimated_delivery_at: datetime | None
    created_at: datetime
    updated_at: datetime
    is_paid: bool = False

    model_config = {"from_attributes": True}


class MarkOrderPaidResponse(BaseModel):
    order_id: UUID
    is_paid: bool
    paid_at: datetime
    message: str


class PaginatedOrdersResponse(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    page_size: int


class MapLinkResolveResponse(BaseModel):
    """Coordinates read from a pasted WhatsApp / Google Maps location."""

    latitude: float
    longitude: float


class CustomerLookupResponse(BaseModel):
    """Lookup returning profile hints only — never resumes an old order/session."""

    found: bool
    customer_name: str = ""
    phone: str = ""
    customer_email: str | None = None
    pickup_address: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    previous_orders: int = 0


class QrScanResponse(BaseModel):
    tracking_code: str
    order_number: str
    customer_name: str
    carpet_description: str | None
    status: str
    status_label: str
    total: Decimal
    currency: str
