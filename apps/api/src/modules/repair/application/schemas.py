import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class RepairPhotoInput(BaseModel):
    data_url: str = Field(..., min_length=32, max_length=500_000)
    caption: str | None = Field(default=None, max_length=255)

    @field_validator("data_url")
    @classmethod
    def validate_data_url(cls, v: str) -> str:
        if not v.startswith("data:image/"):
            raise ValueError("Photo must be a data:image/ URL")
        return v


class RepairRequestCreate(BaseModel):
    carpet_id: uuid.UUID
    damage_description: str = Field(min_length=3, max_length=2000)
    damage_type: str | None = Field(default=None, max_length=120)
    repair_type: str | None = Field(default=None, max_length=120)
    quoted_price: Decimal | None = None
    repair_deadline: date | None = None
    photos: list[RepairPhotoInput] = Field(default_factory=list, max_length=5)


class DriverFlagRepairRequest(BaseModel):
    """US-26: driver flags repair need at pickup."""
    need_repair: bool = True
    damage_description: str = Field(min_length=3, max_length=2000)
    photos: list[RepairPhotoInput] = Field(default_factory=list, max_length=5)


class OperationsFlagRepairRequest(BaseModel):
    """US-27: operations flags repair during inspection."""
    code: str = Field(..., min_length=3, max_length=512)
    damage_type: str = Field(..., min_length=2, max_length=120)
    damage_description: str = Field(min_length=3, max_length=2000)
    photos: list[RepairPhotoInput] = Field(default_factory=list, max_length=5)


class RepairAssessmentUpdate(BaseModel):
    """US-29: repair specialist proposal for customer approval."""

    repair_type: str = Field(..., min_length=2, max_length=120)
    quoted_price: Decimal = Field(..., gt=0)
    repair_deadline: date
    assessment_notes: str | None = Field(default=None, max_length=2000)


class CustomerContactUpdate(BaseModel):
    outcome: Literal["approved", "rejected", "waiting"]
    notes: str | None = Field(default=None, max_length=2000)


class RepairWorkUpdate(BaseModel):
    status: Literal["in_repair", "repair_completed"]
    qr_code: str | None = Field(default=None, min_length=3, max_length=512)
    completion_notes: str | None = Field(default=None, max_length=2000)


class RepairPhotoResponse(BaseModel):
    id: uuid.UUID
    caption: str | None
    created_at: datetime
    view_url: str
    data_url: str


class RepairRequestResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    carpet_id: uuid.UUID
    service_session_id: uuid.UUID | None
    status: str
    flagged_source: str | None = None
    damage_type: str | None = None
    damage_description: str | None
    repair_type: str | None
    quoted_price: Decimal | None
    repair_deadline: date | None
    assessment_notes: str | None = None
    assessed_at: datetime | None = None
    completion_notes: str | None = None
    repair_started_at: datetime | None = None
    repair_completed_at: datetime | None = None
    customer_contact_notes: str | None
    contacted_at: datetime | None
    contacted_by_name: str | None
    admin_approved_at: datetime | None
    customer_name: str
    customer_phone: str
    customer_address: str | None
    tracking_code: str
    carpet_code: str
    qr_code: str | None = None
    carpet_description: str | None
    carpet_dimensions: str | None
    session_code: str | None
    photos: list[RepairPhotoResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class RepairListResponse(BaseModel):
    items: list[RepairRequestResponse]
    total: int
