import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.core.phone import normalize_customer_phone
from src.modules.auth.infrastructure.models import User
from src.modules.customers.application.schemas import (
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerListItem,
    CustomerListResponse,
    CustomerOrderLine,
    CustomerProfileResponse,
    MarkCustomerPaidResponse,
)
from src.modules.customers.infrastructure.models import CustomerProfile
from src.modules.orders.infrastructure.models import Order, OrderPaymentRecord
from src.modules.payments.infrastructure.models import PaymentStatus, PaymentTransaction


def normalize_phone_key(phone: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if cleaned.startswith("+"):
        return cleaned
    if cleaned.startswith("0") and len(cleaned) >= 10:
        return f"+98{cleaned[1:]}"
    if cleaned.startswith("98") and len(cleaned) >= 12:
        return f"+{cleaned}"
    if len(cleaned) == 10 and cleaned.startswith("9"):
        return f"+98{cleaned}"
    if len(cleaned) == 8 and cleaned[0] in "79":
        return f"+968{cleaned}"
    if cleaned.startswith("968") and len(cleaned) >= 11:
        return f"+{cleaned}"
    return f"+{cleaned}" if cleaned else phone.strip()


def tier_for_count(count: int) -> str:
    if count >= 5:
        return "VIP"
    if count >= 2:
        return "ACTIVE"
    return "NEW"


class CustomersService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_customers(self, user: User, search: str | None = None) -> CustomerListResponse:
        if not user.check_permission("users:read") and not user.check_permission("orders:read"):
            raise ForbiddenError("Missing permission")

        orders_result = await self.db.execute(
            select(Order).order_by(Order.created_at.desc())
        )
        orders = orders_result.scalars().all()

        paid_result = await self.db.execute(
            select(OrderPaymentRecord.order_id).where(OrderPaymentRecord.is_paid.is_(True))
        )
        paid_order_ids = set(paid_result.scalars().all())

        aggregated: dict[str, dict] = {}
        for o in orders:
            key = normalize_phone_key(o.customer_phone)
            row = aggregated.get(key)
            amount = o.total or Decimal("0")
            order_paid = o.id in paid_order_ids
            if row:
                row["order_count"] += 1
                if order_paid:
                    row["paid_order_count"] += 1
                row["total_spent"] += amount
                if o.created_at > row["last_order_at"]:
                    row["last_order_at"] = o.created_at
                    row["customer_name"] = o.customer_name
            else:
                aggregated[key] = {
                    "phone": key,
                    "customer_name": o.customer_name,
                    "order_count": 1,
                    "paid_order_count": 1 if order_paid else 0,
                    "last_order_at": o.created_at,
                    "total_spent": amount,
                }

        # Merge stand-alone profiles (Add Customer without order — Rule 1).
        profiles_result = await self.db.execute(select(CustomerProfile))
        for profile in profiles_result.scalars().all():
            key = normalize_phone_key(profile.phone)
            row = aggregated.get(key)
            if row:
                # Profile name wins only when no order carries a fresher name.
                continue
            aggregated[key] = {
                "phone": key,
                "customer_name": profile.name,
                "order_count": 0,
                "paid_order_count": 0,
                "last_order_at": None,
                "total_spent": Decimal("0"),
            }

        items: list[CustomerListItem] = []
        for key, row in aggregated.items():
            if search:
                term = search.lower()
                if term not in row["customer_name"].lower() and term not in key and term not in key.replace("+", ""):
                    continue
            paid_count = row["paid_order_count"]
            order_count = row["order_count"]
            items.append(
                CustomerListItem(
                    phone=key,
                    customer_name=row["customer_name"],
                    order_count=order_count,
                    last_order_at=row["last_order_at"],
                    total_spent=str(row["total_spent"]),
                    tier=tier_for_count(order_count),
                    paid_order_count=paid_count,
                    is_paid=paid_count > 0 and paid_count == order_count,
                    paid_at=row["last_order_at"] if paid_count == order_count else None,
                )
            )

        items.sort(key=lambda x: x.order_count, reverse=True)
        return CustomerListResponse(items=items, total=len(items))

    async def create_customer(
        self, data: CustomerCreateRequest, user: User
    ) -> CustomerProfileResponse:
        """Add Customer (edit doc): register a customer without creating an order."""
        if not user.check_permission("orders:create") and not user.check_permission("users:manage"):
            raise ForbiddenError("Missing permission")

        try:
            phone = normalize_customer_phone(data.phone)
        except ValueError as exc:
            raise ValidationError(str(exc)) from None

        existing_profile = await self.db.execute(
            select(CustomerProfile).where(CustomerProfile.phone == phone)
        )
        if existing_profile.scalar_one_or_none():
            raise ValidationError("A customer with this phone number already exists")

        existing_order = await self.db.execute(
            select(func.count(Order.id)).where(Order.customer_phone == phone)
        )
        if (existing_order.scalar() or 0) > 0:
            raise ValidationError(
                "This phone number already belongs to an existing customer with orders"
            )

        profile = CustomerProfile(
            phone=phone,
            name=data.name.strip(),
            address=data.address,
            latitude=data.latitude,
            longitude=data.longitude,
            notes=data.notes,
            created_by_id=user.id,
        )
        self.db.add(profile)
        await self.db.flush()
        return CustomerProfileResponse.model_validate(profile)

    async def get_customer_detail(self, phone: str, user: User) -> CustomerDetailResponse:
        """Customer Detail (edit doc): profile + orders + financial summary."""
        if not user.check_permission("users:read") and not user.check_permission("orders:read"):
            raise ForbiddenError("Missing permission")

        # Accept both the Oman-normalized form and the raw value so legacy
        # orders stored with a non-normalized phone still resolve.
        candidates = {phone.strip()}
        try:
            candidates.add(normalize_customer_phone(phone))
        except ValueError:
            pass
        normalized = next(iter(sorted(candidates, key=len, reverse=True)))

        profile_result = await self.db.execute(
            select(CustomerProfile).where(CustomerProfile.phone.in_(candidates))
        )
        profile = profile_result.scalars().first()

        orders_result = await self.db.execute(
            select(Order)
            .where(Order.customer_phone.in_(candidates))
            .order_by(Order.created_at.desc())
        )
        orders = orders_result.scalars().all()

        if not profile and not orders:
            raise NotFoundError("Customer not found")

        order_ids = [o.id for o in orders]
        paid_by_order: dict[uuid.UUID, Decimal] = {}
        marked_paid_ids: set[uuid.UUID] = set()
        if order_ids:
            tx_result = await self.db.execute(
                select(
                    PaymentTransaction.order_id,
                    func.coalesce(func.sum(PaymentTransaction.amount), 0),
                )
                .where(
                    PaymentTransaction.order_id.in_(order_ids),
                    PaymentTransaction.status == PaymentStatus.SUCCESS,
                )
                .group_by(PaymentTransaction.order_id)
            )
            paid_by_order = {oid: Decimal(str(total)) for oid, total in tx_result.all()}

            marked_result = await self.db.execute(
                select(OrderPaymentRecord.order_id).where(
                    OrderPaymentRecord.order_id.in_(order_ids),
                    OrderPaymentRecord.is_paid.is_(True),
                )
            )
            marked_paid_ids = set(marked_result.scalars().all())

        lines: list[CustomerOrderLine] = []
        total_amount = Decimal("0")
        paid_amount = Decimal("0")
        total_carpets = 0
        for o in orders:
            order_total = o.total or Decimal("0")
            order_paid = paid_by_order.get(o.id, Decimal("0"))
            # An admin "mark as paid" flag counts as fully paid even with no
            # transaction ledger rows (legacy flow kept intact).
            if o.id in marked_paid_ids and order_paid < order_total:
                order_paid = order_total
            if order_paid >= order_total and order_total > 0:
                payment_status = "paid"
            elif order_paid > 0:
                payment_status = "partially_paid"
            else:
                payment_status = "unpaid"
            total_amount += order_total
            paid_amount += min(order_paid, order_total)
            total_carpets += o.carpet_count or 1
            lines.append(
                CustomerOrderLine(
                    order_id=o.id,
                    order_number=o.order_number,
                    tracking_code=o.tracking_code,
                    created_at=o.created_at,
                    carpet_count=o.carpet_count or 1,
                    service_type=o.service_type.value,
                    status=o.status.value,
                    total=order_total,
                    paid_amount=order_paid,
                    payment_status=payment_status,
                )
            )

        latest = orders[0] if orders else None
        name = (latest.customer_name if latest else None) or (profile.name if profile else "")
        address = (profile.address if profile else None) or (
            latest.pickup_address if latest else None
        )
        latitude = (profile.latitude if profile else None) or (latest.latitude if latest else None)
        longitude = (profile.longitude if profile else None) or (
            latest.longitude if latest else None
        )

        return CustomerDetailResponse(
            phone=normalized,
            name=name,
            address=address,
            latitude=latitude,
            longitude=longitude,
            notes=profile.notes if profile else None,
            has_profile=profile is not None,
            order_count=len(orders),
            total_carpets=total_carpets,
            total_amount=total_amount,
            paid_amount=paid_amount,
            remaining_amount=max(Decimal("0"), total_amount - paid_amount),
            tier=tier_for_count(len(orders)),
            first_order_at=orders[-1].created_at if orders else None,
            last_order_at=orders[0].created_at if orders else None,
            orders=lines,
        )

    async def mark_paid(
        self, phone: str, user: User, customer_name: str | None = None
    ) -> MarkCustomerPaidResponse:
        """Deprecated: use POST /orders/{order_id}/mark-paid for per-order payment."""
        raise ValidationError(
            "Mark payment per order from Admin → Orders. Each order is paid separately."
        )
