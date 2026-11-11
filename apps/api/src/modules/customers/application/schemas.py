from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from src.core.phone import normalize_customer_phone


class CustomerListItem(BaseModel):
    phone: str
    customer_name: str
    order_count: int
    last_order_at: datetime | None
    total_spent: str
    tier: str
    paid_order_count: int
    is_paid: bool
    paid_at: datetime | None = None


class CustomerCreateRequest(BaseModel):
    """Add Customer form (edit doc): name, phone, location on map, address."""

    name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=8, max_length=20)
    address: str | None = Field(None, max_length=1000)
    latitude: Decimal | None = Field(None, ge=-90, le=90)
    longitude: Decimal | None = Field(None, ge=-180, le=180)
    notes: str | None = Field(None, max_length=2000)

    @field_validator("phone")
    @classmethod
    def validate_oman_phone(cls, v: str) -> str:
        return normalize_customer_phone(v)


class CustomerProfileResponse(BaseModel):
    id: UUID
    phone: str
    name: str
    address: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerOrderLine(BaseModel):
    """One order row inside Customer Detail (edit doc section 4)."""

    order_id: UUID
    order_number: str
    tracking_code: str
    created_at: datetime
    carpet_count: int
    service_type: str
    status: str
    total: Decimal
    paid_amount: Decimal
    payment_status: str  # paid | partially_paid | unpaid


class CustomerDetailResponse(BaseModel):
    """Customer Detail (edit doc): profile info + order/financial summary."""

    phone: str
    name: str
    address: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    notes: str | None = None
    has_profile: bool = False
    order_count: int = 0
    total_carpets: int = 0
    total_amount: Decimal = Decimal("0")
    paid_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    tier: str = "NEW"
    first_order_at: datetime | None = None
    last_order_at: datetime | None = None
    orders: list[CustomerOrderLine] = []


class CustomerListResponse(BaseModel):
    items: list[CustomerListItem]
    total: int


class MarkCustomerPaidRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    customer_name: str | None = Field(None, max_length=255)


class MarkCustomerPaidResponse(BaseModel):
    phone: str
    is_paid: bool
    paid_at: datetime
    message: str
