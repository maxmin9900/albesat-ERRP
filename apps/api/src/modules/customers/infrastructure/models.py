"""Customer payment settlement flags (admin manual mark-as-paid)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.shared.database.base import Base, TimestampMixin, UUIDMixin


class CustomerProfile(Base, UUIDMixin, TimestampMixin):
    """Stand-alone customer registered from Admin → Customers (no order required).

    Business Rule 1 (edit doc): New Customer != New Order. Order-derived
    customers stay keyed by orders.customer_phone; this table only adds
    customers that have no orders yet, and both are merged in the admin list.
    """

    __tablename__ = "customer_profiles"

    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class CustomerPaymentRecord(Base, UUIDMixin, TimestampMixin):
    """One row per customer phone — paid flag is one-way (cannot unset)."""

    __tablename__ = "customer_payment_records"

    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    marked_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
