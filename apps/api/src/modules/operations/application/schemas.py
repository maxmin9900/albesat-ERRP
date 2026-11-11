from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OperationCarpetItem(BaseModel):
    id: UUID
    carpet_code: str
    description: str | None
    carpet_type: str | None = None
    dimensions: str | None
    status: str
    status_label: str
    order_id: UUID
    order_number: str
    tracking_code: str
    customer_name: str
    customer_phone: str | None = None
    service_type: str
    service_label: str
    current_step: str | None
    received_at: datetime | None
    qr_code: str | None = None
    repair_status: str | None = None
    repair_id: UUID | None = None
    operation_started_at: datetime | None = None
    operation_completed_at: datetime | None = None
    loaded_for_delivery_at: datetime | None = None
    loaded_for_driver_id: UUID | None = None
    loaded_for_driver_name: str | None = None


class OperationsQueueResponse(BaseModel):
    received: list[OperationCarpetItem]
    in_operation: list[OperationCarpetItem]
    drying: list[OperationCarpetItem]
    ready: list[OperationCarpetItem]


class ScanOperationRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)


class ReceiveCarpetRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)


class RecordStepRequest(BaseModel):
    step: str = Field(..., pattern="^(washing|drying|packaging)$")
    note: str | None = None


class LoadForDeliveryRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)
    driver_id: UUID


class DriverOption(BaseModel):
    id: UUID
    full_name: str
    phone: str | None = None


class OperationCarpetDetail(OperationCarpetItem):
    operation_logs: list[dict]
    status_timeline: list[dict]
    qr_code: str | None
