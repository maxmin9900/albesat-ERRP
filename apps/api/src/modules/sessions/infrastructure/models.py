import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.database.base import Base, TimestampMixin, UUIDMixin, pg_enum


class ServiceSessionStatus(str, enum.Enum):
    OPEN = "open"
    IN_LOGISTICS = "in_logistics"
    IN_OPERATIONS = "in_operations"
    READY = "ready"
    DELIVERED = "delivered"
    CLOSED = "closed"


class RouteSessionStatus(str, enum.Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "service_sessions"

    session_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, unique=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[ServiceSessionStatus] = mapped_column(
        pg_enum(ServiceSessionStatus), default=ServiceSessionStatus.OPEN, nullable=False
    )
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partners.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="service_session")


class DeliveryRouteSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "delivery_route_sessions"

    route_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    driver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[RouteSessionStatus] = mapped_column(
        pg_enum(RouteSessionStatus), default=RouteSessionStatus.PLANNED, nullable=False
    )
    total_stops: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_distance_km: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    est_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    stops: Mapped[list["DeliveryRouteStop"]] = relationship(
        "DeliveryRouteStop", back_populates="route_session", cascade="all, delete-orphan"
    )


class DeliveryRouteStop(Base, UUIDMixin):
    __tablename__ = "delivery_route_stops"

    route_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("delivery_route_sessions.id"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    stop_number: Mapped[int] = mapped_column(Integer, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    is_completed: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    route_session: Mapped["DeliveryRouteSession"] = relationship("DeliveryRouteSession", back_populates="stops")
