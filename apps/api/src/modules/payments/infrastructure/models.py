import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.shared.database.base import Base, TimestampMixin, UUIDMixin, pg_enum


class InvoiceType(str, enum.Enum):
    PROFORMA = "proforma"
    INVOICE = "invoice"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    # Draft-invoice workflow (پیش‌فاکتور): driver confirmed → sent to customer.
    CONFIRMED = "confirmed"
    SENT = "sent"
    ISSUED = "issued"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class CustomerPaymentStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    FAILED_PAYMENT = "failed_payment"
    OVERDUE = "overdue"


class SettlementStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"


class Partner(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "partners"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("15.00"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="partner")
    settlements: Mapped[list["PartnerSettlement"]] = relationship(
        "PartnerSettlement", back_populates="partner"
    )


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    service_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("service_sessions.id"), nullable=True
    )
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partners.id"), nullable=True
    )
    invoice_type: Mapped[InvoiceType] = mapped_column(pg_enum(InvoiceType), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(pg_enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="OMR", nullable=False)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # US-20A final invoice structure
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    customer_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    carpet_count: Mapped[int | None] = mapped_column(nullable=True)
    service_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    service_area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    service_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    repair_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    payment_status: Mapped[CustomerPaymentStatus] = mapped_column(
        pg_enum(CustomerPaymentStatus),
        default=CustomerPaymentStatus.UNPAID,
        nullable=False,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    proforma_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    # Draft-invoice workflow (پیش‌فاکتور): driver confirmation + WhatsApp send.
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    confirmed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_to_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sent_status: Mapped[str | None] = mapped_column(String(20), nullable=True)

    partner: Mapped["Partner | None"] = relationship("Partner", back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(
        "InvoiceItem",
        back_populates="invoice",
        order_by="InvoiceItem.position",
        cascade="all, delete-orphan",
    )
    payments: Mapped[list["PaymentTransaction"]] = relationship(
        "PaymentTransaction", back_populates="invoice"
    )
    reminder_logs: Mapped[list["PaymentReminderLog"]] = relationship(
        "PaymentReminderLog", back_populates="invoice"
    )


class InvoiceItem(Base, UUIDMixin, TimestampMixin):
    """One carpet line on a draft/final invoice with its per-service amounts.

    `services` is a JSON list of {"name": str, "amount": str} entries; the
    line `amount` is the sum of its service amounts, and the invoice total is
    the sum of its line amounts.
    """

    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    carpet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("carpets.id"), nullable=True
    )
    position: Mapped[int] = mapped_column(default=0, nullable=False)
    carpet_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    services: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class PaymentTransaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payment_transactions"

    transaction_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True
    )
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("partners.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="OMR", nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(pg_enum(PaymentStatus), default=PaymentStatus.SUCCESS, nullable=False)
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    driver_confirmed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    confirmation_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    invoice: Mapped["Invoice | None"] = relationship("Invoice", back_populates="payments")


class PartnerSettlement(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "partner_settlements"

    partner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("partners.id"), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    total_orders: Mapped[int] = mapped_column(default=0, nullable=False)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_payable: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[SettlementStatus] = mapped_column(
        pg_enum(SettlementStatus), default=SettlementStatus.PENDING, nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    partner: Mapped["Partner"] = relationship("Partner", back_populates="settlements")


class PaymentReminderLog(Base, UUIDMixin):
    __tablename__ = "payment_reminder_logs"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False, index=True
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="sent", nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="reminder_logs")
