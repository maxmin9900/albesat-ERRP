import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.database.base import Base, TimestampMixin, UUIDMixin, pg_enum


class OrderStatus(str, enum.Enum):
    PENDING_PICKUP = "pending_pickup"
    PICKED_UP = "picked_up"
    IN_WASHING = "in_washing"
    DRYING = "drying"
    REPAIRING = "repairing"
    READY_FOR_DELIVERY = "ready_for_delivery"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class OrderSource(str, enum.Enum):
    WEBSITE = "website"
    WHATSAPP = "whatsapp"
    PHONE = "phone"
    PARTNER = "partner"
    OTHER = "other"


class ServiceType(str, enum.Enum):
    STANDARD = "standard"
    PREMIUM = "premium"
    ANTIQUE = "antique"


class Order(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "orders"

    order_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    tracking_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pickup_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    # House plaque / unit number, captured at booking and editable by the driver.
    house_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Geo location (US-5/US-7): customer pickup point or partner location.
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    carpet_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source: Mapped[OrderSource] = mapped_column(pg_enum(OrderSource), nullable=False)
    service_type: Mapped[ServiceType] = mapped_column(pg_enum(ServiceType), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        pg_enum(OrderStatus), default=OrderStatus.PENDING_PICKUP, nullable=False, index=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="OMR", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    pickup_workflow: Mapped[str | None] = mapped_column(String(30), nullable=True)
    delivery_workflow: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pickup_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    carpet_count: Mapped[int] = mapped_column(default=1, nullable=False)
    carpet_dimensions: Mapped[str | None] = mapped_column(String(50), nullable=True)
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partners.id"), nullable=True, index=True
    )

    status_history: Mapped[list["OrderStatusHistory"]] = relationship(
        "OrderStatusHistory", back_populates="order", lazy="selectin"
    )
    service_session: Mapped["ServiceSession | None"] = relationship(
        "ServiceSession", back_populates="order", uselist=False, lazy="selectin"
    )


class OrderStatusHistory(Base, UUIDMixin):
    __tablename__ = "order_status_history"

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order: Mapped["Order"] = relationship("Order", back_populates="status_history")


class OrderPaymentRecord(Base, UUIDMixin, TimestampMixin):
    """Admin manual mark-as-paid — one row per order (not per customer)."""

    __tablename__ = "order_payment_records"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, unique=True, index=True
    )
    is_paid: Mapped[bool] = mapped_column(default=True, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    marked_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
