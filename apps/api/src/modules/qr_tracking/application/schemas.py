from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GenerateQrRequest(BaseModel):
    order_id: UUID | None = None
    carpet_id: UUID | None = None


class QrGenerateResponse(BaseModel):
    carpet_id: UUID
    carpet_code: str
    qr_code: str
    qr_image_svg: str
    issued_at: datetime
    order_number: str
    tracking_code: str


class QrScanRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)


class ScanLogItem(BaseModel):
    id: UUID
    scan_method: str
    is_valid: bool
    note: str | None
    scanned_by_name: str | None
    created_at: datetime


class StatusEventItem(BaseModel):
    id: UUID
    from_status: str | None
    to_status: str
    changed_by_name: str | None
    note: str | None
    created_at: datetime


class DeliveryLogItem(BaseModel):
    id: UUID
    event_type: str
    location: str | None
    driver_name: str | None
    note: str | None
    performed_by_name: str | None
    created_at: datetime


class OperationLogItem(BaseModel):
    id: UUID
    operation: str
    note: str | None
    performed_by_name: str | None
    created_at: datetime


class TrackingHistoryItem(BaseModel):
    event_type: str
    title: str
    description: str | None
    actor_name: str | None
    created_at: datetime


class CarpetDetailResponse(BaseModel):
    id: UUID
    carpet_code: str
    description: str | None
    dimensions: str | None
    status: str
    location_note: str | None
    order_id: UUID
    order_number: str
    tracking_code: str
    customer_name: str
    customer_phone: str
    order_status: str
    order_status_label: str
    service_type: str
    total: str
    currency: str
    qr_code: str | None
    qr_issued_at: datetime | None
    last_scanned_at: datetime | None
    created_at: datetime
    scan_logs: list[ScanLogItem] = []
    status_timeline: list[StatusEventItem] = []
    delivery_logs: list[DeliveryLogItem] = []
    operation_logs: list[OperationLogItem] = []
    tracking_history: list[TrackingHistoryItem] = []


class QrScanResponse(BaseModel):
    valid: bool
    carpet: CarpetDetailResponse | None
    message: str | None = None


class CarpetListItem(BaseModel):
    id: UUID
    carpet_code: str
    description: str | None
    status: str
    order_number: str
    tracking_code: str
    customer_name: str
    has_qr: bool
    created_at: datetime


class PaginatedCarpetsResponse(BaseModel):
    items: list[CarpetListItem]
    total: int
    page: int
    page_size: int


class CreatePhysicalQrRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)
    label: str | None = Field(None, max_length=120)


class BulkCreatePhysicalQrRequest(BaseModel):
    """Register many pre-printed punch tags at once (one code per line in UI)."""
    codes: list[str] = Field(..., min_length=1, max_length=500)
    label_prefix: str | None = Field(None, max_length=80)


class BulkCreatePhysicalQrResponse(BaseModel):
    created: int
    skipped: int
    duplicates: list[str]


class PhysicalQrTagItem(BaseModel):
    id: UUID
    code: str
    label: str | None
    is_active: bool
    in_use: bool
    created_at: datetime
    last_used_at: datetime | None


class PaginatedPhysicalQrResponse(BaseModel):
    items: list[PhysicalQrTagItem]
    total: int
    page: int
    page_size: int
