import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.database.base import Base, TimestampMixin, UUIDMixin, pg_enum


class RepairWorkflowStatus(str, enum.Enum):
    PENDING_APPROVAL = "pending_approval"
    WAITING_CUSTOMER_RESPONSE = "waiting_customer_response"
    CUSTOMER_APPROVED = "customer_approved"
    CUSTOMER_REJECTED = "customer_rejected"
    IN_REPAIR = "in_repair"
    REPAIR_COMPLETED = "repair_completed"
    REPAIR_CANCELLED = "repair_cancelled"


class RepairRequest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "repair_requests"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True
    )
    carpet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carpets.id"), nullable=False, index=True
    )
    service_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("service_sessions.id"), nullable=True
    )
    status: Mapped[RepairWorkflowStatus] = mapped_column(
        pg_enum(RepairWorkflowStatus),
        default=RepairWorkflowStatus.PENDING_APPROVAL,
        nullable=False,
        index=True,
    )
    damage_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    repair_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    quoted_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    repair_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Repair-team assessment (US-4: ثبت نوع تعمیر/قیمت/Deadline/نتیجه بررسی)
    assessment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assessed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    customer_contact_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    contacted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    admin_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    admin_approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # EPIC 8
    flagged_source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    damage_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    completion_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    repair_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    repair_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    photos: Mapped[list["RepairRequestPhoto"]] = relationship(
        "RepairRequestPhoto", back_populates="repair_request", cascade="all, delete-orphan"
    )


class RepairRequestPhoto(Base, UUIDMixin):
    __tablename__ = "repair_request_photos"

    repair_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repair_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    photo_data: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(String(255), nullable=True)
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    repair_request: Mapped["RepairRequest"] = relationship("RepairRequest", back_populates="photos")
