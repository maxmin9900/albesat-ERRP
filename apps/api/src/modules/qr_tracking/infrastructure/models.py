import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.database.base import Base, TimestampMixin, UUIDMixin, pg_enum


class CarpetStatus(str, enum.Enum):
    REGISTERED = "registered"
    IN_TRANSIT = "in_transit"
    RECEIVED_BY_OPERATION = "received_by_operation"
    IN_WASHING = "in_washing"
    DRYING = "drying"
    READY = "ready"
    DELIVERED = "delivered"


class Carpet(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "carpets"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True
    )
    carpet_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # US-11: نوع فرش (carpet type recorded by driver at QR attach time)
    carpet_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    dimensions: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Per-carpet price recorded by the driver at pickup (order.total = sum of these).
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[CarpetStatus] = mapped_column(
        pg_enum(CarpetStatus), default=CarpetStatus.REGISTERED, nullable=False
    )
    location_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # US-13: operations receipt (operator scanned and accepted the carpet)
    received_by_ops_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_by_ops_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # US-15 / US-17: wash operation lifecycle
    operation_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    operation_started_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    operation_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    operation_completed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # US-17A: loaded onto driver vehicle (QR scan at load time)
    loaded_for_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    loaded_for_delivery_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    loaded_for_driver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    qr_codes: Mapped[list["QrCode"]] = relationship("QrCode", back_populates="carpet", lazy="selectin")
    scan_logs: Mapped[list["QrScanLog"]] = relationship("QrScanLog", back_populates="carpet")
    status_events: Mapped[list["CarpetStatusEvent"]] = relationship(
        "CarpetStatusEvent", back_populates="carpet"
    )
    delivery_logs: Mapped[list["CarpetDeliveryLog"]] = relationship(
        "CarpetDeliveryLog", back_populates="carpet"
    )
    operation_logs: Mapped[list["CarpetOperationLog"]] = relationship(
        "CarpetOperationLog", back_populates="carpet"
    )


class PhysicalQrTag(Base, UUIDMixin, TimestampMixin):
    """Pre-registered physical QR codes on leather punch tags."""

    __tablename__ = "physical_qr_tags"

    code: Mapped[str] = mapped_column(String(512), unique=True, nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class QrCode(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "qr_codes"

    # US-11: a physical QR code may be reused across carpets over time, but must
    # be active (revoked_at IS NULL) on at most ONE carpet at a time. Enforced by
    # the partial unique index below (not a plain global unique constraint).
    __table_args__ = (
        Index(
            "uq_qr_codes_active_code",
            "code",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    carpet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carpets.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    signature_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    issued_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    carpet: Mapped["Carpet"] = relationship("Carpet", back_populates="qr_codes")


class QrScanLog(Base, UUIDMixin):
    __tablename__ = "qr_scan_logs"

    carpet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carpets.id"), nullable=False, index=True
    )
    scanned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    scan_method: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    code_presented: Mapped[str] = mapped_column(String(512), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    is_valid: Mapped[bool] = mapped_column(default=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    carpet: Mapped["Carpet"] = relationship("Carpet", back_populates="scan_logs")


class CarpetStatusEvent(Base, UUIDMixin):
    __tablename__ = "carpet_status_events"

    carpet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carpets.id"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    carpet: Mapped["Carpet"] = relationship("Carpet", back_populates="status_events")


class CarpetDeliveryLog(Base, UUIDMixin):
    __tablename__ = "carpet_delivery_logs"

    carpet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carpets.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    carpet: Mapped["Carpet"] = relationship("Carpet", back_populates="delivery_logs")


class CarpetOperationLog(Base, UUIDMixin):
    __tablename__ = "carpet_operation_logs"

    carpet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carpets.id"), nullable=False, index=True
    )
    operation: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    carpet: Mapped["Carpet"] = relationship("Carpet", back_populates="operation_logs")
