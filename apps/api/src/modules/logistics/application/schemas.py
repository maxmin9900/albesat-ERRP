from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class DriverDashboardResponse(BaseModel):
    done_today: int
    pickups_pending: int
    pickups_in_progress: int
    pickups_collected: int
    deliveries_pending: int
    route_distance_km: str
    route_stops: int
    route_est_minutes: int
    collectible_total: str
    carpets_ready: int


class CarpetSummary(BaseModel):
    """Per-carpet detail surfaced on a driver order card."""

    id: UUID
    carpet_code: str
    dimensions: str | None = None
    price: str | None = None
    carpet_type: str | None = None
    qr_code: str | None = None
    has_qr: bool = False
    needs_repair: bool = False


class DriverOrderCard(BaseModel):
    id: UUID
    order_number: str
    tracking_code: str
    customer_name: str
    customer_phone: str
    pickup_address: str | None
    house_number: str | None = None
    latitude: str | None = None
    longitude: str | None = None
    carpet_description: str | None
    carpet_count: int
    carpet_dimensions: str | None
    source: str
    service_type: str
    service_label: str
    status: str
    status_label: str
    pickup_workflow: str | None
    delivery_workflow: str | None
    total: str
    currency: str
    distance_km: str | None
    pickup_started_at: datetime | None
    assigned_to_me: bool
    has_qr: bool
    carpet_code: str | None
    carpet_type: str | None = None
    session_code: str | None
    qr_code: str | None = None
    loaded_at: datetime | None = None
    invoice_number: str | None = None
    invoice_total: str | None = None
    payment_status: str = "unpaid"
    payment_status_label: str = "Unpaid"
    carpets: list[CarpetSummary] = Field(default_factory=list)


class DeliveryScanResponse(BaseModel):
    """US-20: carpet info after mandatory QR scan."""
    order: DriverOrderCard
    carpet_id: UUID
    qr_code: str
    carpet_type: str | None
    customer_name: str
    customer_phone: str
    service_label: str
    invoice_number: str | None
    invoice_total: str
    payment_status: str
    payment_status_label: str
    message: str


class CompleteDeliveryResponse(BaseModel):
    order: DriverOrderCard
    invoice: dict
    message: str


class DriverOrdersListResponse(BaseModel):
    pending_pickup: list[DriverOrderCard]
    pickup_in_progress: list[DriverOrderCard]
    collected_pending_handoff: list[DriverOrderCard]
    deliveries: list[DriverOrderCard]
    history: list[DriverOrderCard]
    route_summary: dict[str, str | int]


class AcceptPickupResponse(BaseModel):
    order: DriverOrderCard
    message: str


class PickupQrResponse(BaseModel):
    order_id: UUID
    tracking_code: str
    carpet_id: UUID
    carpet_code: str
    session_code: str
    qr_code: str
    issued_at: datetime


class DriverQuickScanRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)
    order_id: UUID | None = None


class DriverQuickScanResponse(BaseModel):
    action: str
    message: str
    order_id: UUID | None = None
    tracking_code: str | None = None
    order: DriverOrderCard | None = None
    candidate_orders: list[DriverOrderCard] = Field(default_factory=list)


class ScanHandoffRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)


class PickupDetailsRequest(BaseModel):
    """Driver-entered carpet details at pickup: count, area, price."""

    carpet_count: int = Field(..., ge=1, le=999)
    dimensions: str | None = Field(None, max_length=50)
    price: Decimal | None = Field(None, ge=0)


class CarpetEntry(BaseModel):
    """One physical carpet recorded by the driver at pickup."""

    code: str = Field(..., min_length=3, max_length=512)
    carpet_type: str | None = Field(None, max_length=120)
    length: Decimal | None = Field(None, ge=0)
    width: Decimal | None = Field(None, ge=0)
    price: Decimal | None = Field(None, ge=0)
    needs_repair: bool = False
    damage_description: str | None = Field(None, max_length=2000)


class PickupCarpetsRequest(BaseModel):
    """US: per-carpet pickup details — one barcode + dimensions + price each."""

    carpets: list[CarpetEntry] = Field(..., min_length=1, max_length=999)


class AttachQrRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=512)
    carpet_type: str | None = Field(None, max_length=120)
    dimensions: str | None = Field(None, max_length=50)


class AttachQrResponse(BaseModel):
    order_id: UUID
    carpet_id: UUID
    carpet_code: str
    carpet_type: str | None
    qr_code: str
    session_code: str | None
    message: str


class CompleteDeliveryRequest(BaseModel):
    payment_method: str | None = Field(default=None, pattern="^(cash|card_transfer|pos)$")
    payment_amount: Decimal | None = Field(default=None, gt=0)
    confirmation_reference: str | None = Field(default=None, max_length=120)
    note: str | None = None


class RouteStop(BaseModel):
    stop_number: int
    order_id: UUID
    customer_name: str
    address: str
    latitude: str | None = None
    longitude: str | None = None
    tracking_code: str
    distance_km: str | None


class RouteMapResponse(BaseModel):
    total_distance_km: str
    stops_count: int
    est_minutes: int
    stops: list[RouteStop]
