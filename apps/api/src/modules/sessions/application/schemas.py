import uuid
from datetime import datetime

from pydantic import BaseModel


class ServiceSessionResponse(BaseModel):
    id: uuid.UUID
    session_code: str
    order_id: uuid.UUID
    customer_name: str
    customer_phone: str
    status: str
    partner_id: uuid.UUID | None
    created_at: datetime
    closed_at: datetime | None = None

    model_config = {"from_attributes": True}


class RouteStopResponse(BaseModel):
    stop_number: int
    order_id: uuid.UUID
    customer_name: str
    address: str | None
    distance_km: str | None
    is_completed: bool


class DeliveryRouteResponse(BaseModel):
    id: uuid.UUID
    route_code: str
    status: str
    total_stops: int
    total_distance_km: str | None
    est_minutes: int | None
    started_at: datetime | None
    stops: list[RouteStopResponse]


class CreateRouteRequest(BaseModel):
    order_ids: list[uuid.UUID] | None = None
