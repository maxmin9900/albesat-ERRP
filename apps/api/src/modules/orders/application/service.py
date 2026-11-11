import secrets
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.modules.auth.infrastructure.models import User
from src.core.phone import normalize_customer_phone
from src.modules.orders.application.schemas import (
    AdminCreateOrderSchema,
    AdminUpdateOrderSchema,
    BookingResponse,
    CustomerLookupResponse,
    OrderResponse,
    OrderStatusUpdateSchema,
    MarkOrderPaidResponse,
    PaginatedOrdersResponse,
    PublicBookingSchema,
    QrScanResponse,
    TimelineStep,
    TrackOrderResponse,
)
from src.modules.orders.infrastructure.models import (
    Order,
    OrderPaymentRecord,
    OrderSource,
    OrderStatus,
    OrderStatusHistory,
    ServiceType,
)

STATUS_LABELS = {
    OrderStatus.PENDING_PICKUP: "Pickup In Progress",
    OrderStatus.PICKED_UP: "Collected",
    OrderStatus.IN_WASHING: "In Operation",
    OrderStatus.DRYING: "Drying",
    OrderStatus.REPAIRING: "Repairing",
    OrderStatus.READY_FOR_DELIVERY: "Ready for Delivery",
    OrderStatus.OUT_FOR_DELIVERY: "Out for Delivery",
    OrderStatus.DELIVERED: "Delivered",
    OrderStatus.CANCELLED: "Cancelled",
}

TIMELINE_ORDER = [
    OrderStatus.PENDING_PICKUP,
    OrderStatus.PICKED_UP,
    OrderStatus.IN_WASHING,
    OrderStatus.READY_FOR_DELIVERY,
    OrderStatus.DELIVERED,
]

# Maps an Orders-table filter tab to the order statuses it should show, so every
# in-progress status has a home tab and a picked-up order never "disappears".
STATUS_FILTER_GROUPS: dict[str, list[OrderStatus]] = {
    "pending_pickup": [OrderStatus.PENDING_PICKUP],
    "picked_up": [OrderStatus.PICKED_UP],
    "in_washing": [
        OrderStatus.IN_WASHING,
        OrderStatus.DRYING,
        OrderStatus.REPAIRING,
    ],
    "ready_for_delivery": [
        OrderStatus.READY_FOR_DELIVERY,
        OrderStatus.OUT_FOR_DELIVERY,
    ],
    "delivered": [OrderStatus.DELIVERED],
    "cancelled": [OrderStatus.CANCELLED],
}

PRICING = {
    ServiceType.STANDARD: (Decimal("30"), Decimal("50")),
    ServiceType.PREMIUM: (Decimal("60"), Decimal("80")),
    ServiceType.ANTIQUE: (Decimal("100"), Decimal("200")),
}


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_orders(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        source: str | None = None,
        search: str | None = None,
        user: User | None = None,
    ) -> PaginatedOrdersResponse:
        q = select(Order)
        count_q = select(func.count(Order.id))

        if status and status != "all":
            statuses = STATUS_FILTER_GROUPS.get(status)
            if statuses is None:
                try:
                    statuses = [OrderStatus(status)]
                except ValueError:
                    raise ValidationError(f"Invalid status: {status}") from None
            q = q.where(Order.status.in_(statuses))
            count_q = count_q.where(Order.status.in_(statuses))

        if source:
            try:
                source_enum = OrderSource(source)
                q = q.where(Order.source == source_enum)
                count_q = count_q.where(Order.source == source_enum)
            except ValueError:
                raise ValidationError(f"Invalid source: {source}") from None

        if search:
            term = f"%{search.strip()}%"
            filt = or_(
                Order.customer_name.ilike(term),
                Order.tracking_code.ilike(term),
                Order.order_number.ilike(term),
                Order.customer_phone.ilike(term),
            )
            q = q.where(filt)
            count_q = count_q.where(filt)

        if user and not user.check_permission("orders:read"):
            raise ForbiddenError("Missing orders:read permission")

        total_result = await self.db.execute(count_q)
        total = total_result.scalar() or 0

        q = q.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(q)
        orders = result.scalars().all()

        items = []
        order_ids = [o.id for o in orders]
        paid_order_ids = await self._paid_order_ids(order_ids)
        for o in orders:
            items.append(await self._to_response(o, paid_order_ids=paid_order_ids))
        return PaginatedOrdersResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_order(self, order_id: uuid.UUID, user: User | None = None) -> OrderResponse:
        order = await self._get_order_or_404(order_id)
        if user and not user.check_permission("orders:read"):
            raise ForbiddenError("Missing orders:read permission")
        return await self._to_response(order)

    async def mark_order_paid(self, order_id: uuid.UUID, user: User):
        from src.modules.orders.application.schemas import MarkOrderPaidResponse

        if not user.check_permission("orders:update") and not user.check_permission("payments:create"):
            raise ForbiddenError("Missing permission")

        order = await self._get_order_or_404(order_id)
        existing = await self.db.execute(
            select(OrderPaymentRecord).where(OrderPaymentRecord.order_id == order_id)
        )
        record = existing.scalar_one_or_none()
        if record and record.is_paid:
            raise ValidationError("This order is already marked as paid")

        now = datetime.now(timezone.utc)
        if record:
            record.is_paid = True
            record.paid_at = now
            record.marked_by_id = user.id
        else:
            self.db.add(
                OrderPaymentRecord(
                    order_id=order_id,
                    is_paid=True,
                    paid_at=now,
                    marked_by_id=user.id,
                )
            )
        await self.db.flush()
        return MarkOrderPaidResponse(
            order_id=order_id,
            is_paid=True,
            paid_at=now,
            message=f"Order {order.tracking_code} marked as paid",
        )

    async def lookup_customer_by_phone(self, phone: str, user: User) -> CustomerLookupResponse:
        """Return the latest profile for a phone number — does not open or link prior sessions."""
        if not user.check_permission("orders:read"):
            raise ForbiddenError("Missing orders:read permission")

        try:
            normalized = normalize_customer_phone(phone)
        except ValueError:
            return CustomerLookupResponse(found=False, phone=phone.strip())

        latest_result = await self.db.execute(
            select(Order)
            .where(Order.customer_phone == normalized)
            .order_by(Order.created_at.desc())
            .limit(1)
        )
        latest = latest_result.scalar_one_or_none()
        count_result = await self.db.execute(
            select(func.count(Order.id)).where(Order.customer_phone == normalized)
        )
        previous_orders = int(count_result.scalar() or 0)

        if latest is None:
            return CustomerLookupResponse(found=False, phone=normalized, previous_orders=0)

        return CustomerLookupResponse(
            found=True,
            customer_name=latest.customer_name,
            phone=normalized,
            customer_email=latest.customer_email,
            pickup_address=latest.pickup_address,
            latitude=latest.latitude,
            longitude=latest.longitude,
            previous_orders=previous_orders,
        )

    async def create_admin_order(
        self, data: AdminCreateOrderSchema, created_by: User
    ) -> OrderResponse:
        if not created_by.check_permission("orders:create"):
            raise ForbiddenError("Missing orders:create permission")

        notes = data.notes
        if data.partner_reference:
            ref_line = f"Partner ref: {data.partner_reference}"
            notes = f"{notes}\n{ref_line}".strip() if notes else ref_line

        source = OrderSource(data.source)
        pickup_address = data.pickup_address
        latitude = data.latitude
        longitude = data.longitude

        # US-7: order placed for a partner laundry.
        if data.partner_id or source == OrderSource.PARTNER:
            if not data.partner_id:
                raise ValidationError("partner_id required when source is partner")
            from src.modules.payments.infrastructure.models import Partner

            partner = await self.db.get(Partner, data.partner_id)
            if not partner:
                raise NotFoundError("Partner not found")
            # Validation: Partner must be Active.
            if not partner.is_active:
                raise ValidationError("Selected partner is not active")

            # Partner Label: any partner order is flagged as source=partner.
            source = OrderSource.PARTNER

            # Auto-fill from partner when the operator did not override.
            if not pickup_address:
                pickup_address = partner.address
            if latitude is None:
                latitude = partner.latitude
            if longitude is None:
                longitude = partner.longitude
            partner_line = f"Partner: {partner.name} ({partner.contact_phone or 'n/a'})"
            notes = f"{notes}\n{partner_line}".strip() if notes else partner_line

        order = await self._build_order(
            customer_name=data.customer_name,
            phone=data.phone,
            service_type=ServiceType(data.service_type),
            source=source,
            notes=notes,
            pickup_address=pickup_address,
            latitude=latitude,
            longitude=longitude,
            carpet_description=data.carpet_description,
            customer_email=data.customer_email,
            partner_id=data.partner_id,
            created_by_id=created_by.id,
        )
        return await self._to_response(order)

    async def update_order(
        self, order_id: uuid.UUID, data: AdminUpdateOrderSchema, user: User
    ) -> OrderResponse:
        if not user.check_permission("orders:update"):
            raise ForbiddenError("Missing orders:update permission")

        order = await self._get_order_or_404(order_id)

        if data.customer_name is not None:
            order.customer_name = data.customer_name
        if data.customer_phone is not None:
            order.customer_phone = data.customer_phone
        if data.customer_email is not None:
            order.customer_email = data.customer_email or None
        if data.carpet_description is not None:
            order.carpet_description = data.carpet_description
        if data.notes is not None:
            order.notes = data.notes
        if data.pickup_address is not None:
            order.pickup_address = data.pickup_address
        if data.house_number is not None:
            order.house_number = data.house_number.strip() or None
        if data.service_type is not None:
            service_type = ServiceType(data.service_type)
            order.service_type = service_type
            low, high = PRICING[service_type]
            subtotal = (low + high) / 2
            order.subtotal = subtotal
            order.total = subtotal + order.tax
        if data.status is not None:
            await self._change_status(order, OrderStatus(data.status), user.id, "Updated via admin")

        await self.db.flush()
        await self.db.refresh(order)
        return await self._to_response(order)

    async def update_status(
        self, order_id: uuid.UUID, data: OrderStatusUpdateSchema, user: User
    ) -> OrderResponse:
        if not user.check_permission("orders:update"):
            raise ForbiddenError("Missing orders:update permission")
        order = await self._get_order_or_404(order_id)
        await self._change_status(order, OrderStatus(data.status), user.id, data.note)
        return await self._to_response(order)

    async def delete_order(self, order_id: uuid.UUID, user: User) -> None:
        is_super = "super_admin" in user.get_role_slugs()
        if not (is_super or user.check_permission("orders:delete")):
            raise ForbiddenError("Missing orders:delete permission")
        # Ensure the order exists (raises 404 otherwise) before we start deleting.
        await self._get_order_or_404(order_id)
        await self._hard_delete_order(order_id)

    async def _hard_delete_order(self, order_id: uuid.UUID) -> None:
        """Permanently remove an order and every row that depends on it.

        Statements run child-first so foreign keys are satisfied without relying
        on ON DELETE CASCADE (most FKs here have none). Deleting the carpets'
        qr_codes frees the physical QR tags automatically, since a tag's
        "in use" state is derived from an active qr_codes row.
        """
        carpet_scoped = (
            "qr_scan_logs",
            "carpet_status_events",
            "carpet_delivery_logs",
            "carpet_operation_logs",
            "qr_codes",
        )
        statements = [
            "DELETE FROM payment_reminder_logs WHERE invoice_id IN "
            "(SELECT id FROM invoices WHERE order_id = :oid)",
            "DELETE FROM payment_transactions WHERE order_id = :oid",
            "DELETE FROM invoices WHERE order_id = :oid",
            "DELETE FROM repair_requests WHERE order_id = :oid",
            *[
                f"DELETE FROM {t} WHERE carpet_id IN "
                "(SELECT id FROM carpets WHERE order_id = :oid)"
                for t in carpet_scoped
            ],
            "DELETE FROM carpets WHERE order_id = :oid",
            "DELETE FROM delivery_route_stops WHERE order_id = :oid",
            "DELETE FROM service_sessions WHERE order_id = :oid",
            "DELETE FROM order_status_history WHERE order_id = :oid",
            "DELETE FROM order_payment_records WHERE order_id = :oid",
            "DELETE FROM orders WHERE id = :oid",
        ]
        for stmt in statements:
            await self.db.execute(text(stmt), {"oid": str(order_id)})

    async def scan_qr(self, code: str, user: User) -> QrScanResponse:
        if not user.check_permission("qr:scan"):
            raise ForbiddenError("Missing qr:scan permission")

        clean = code.strip().lstrip("#")
        result = await self.db.execute(
            select(Order).where(
                or_(
                    Order.tracking_code == clean,
                    Order.order_number == clean,
                    Order.tracking_code == f"#{clean}",
                )
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError(f"No carpet found for code: {code}")

        return QrScanResponse(
            tracking_code=order.tracking_code,
            order_number=order.order_number,
            customer_name=order.customer_name,
            carpet_description=order.carpet_description or self._default_carpet_desc(order.service_type),
            status=order.status.value,
            status_label=STATUS_LABELS.get(order.status, order.status.value),
            total=order.total,
            currency=order.currency,
        )

    async def create_public_booking(self, data: PublicBookingSchema) -> BookingResponse:
        order = await self._build_order(
            customer_name=data.full_name,
            phone=data.phone,
            service_type=ServiceType(data.service_type),
            source=OrderSource.WEBSITE,
            notes=data.notes,
            pickup_address=data.pickup_address,
            house_number=data.house_number,
            latitude=data.latitude,
            longitude=data.longitude,
            customer_email=data.customer_email,
        )
        return BookingResponse(
            order_id=order.id,
            tracking_code=order.tracking_code,
            message="Booking request received. We will contact you within 30 minutes.",
        )

    async def track_order(self, code: str) -> TrackOrderResponse:
        clean = code.strip().lstrip("#")
        result = await self.db.execute(
            select(Order).where(
                or_(Order.tracking_code == clean, Order.order_number == clean)
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found. Check your tracking code.")

        history_result = await self.db.execute(
            select(OrderStatusHistory)
            .where(OrderStatusHistory.order_id == order.id)
            .order_by(OrderStatusHistory.created_at)
        )
        history = {h.to_status: h.created_at for h in history_result.scalars().all()}

        timeline: list[TimelineStep] = []
        current_idx = TIMELINE_ORDER.index(order.status) if order.status in TIMELINE_ORDER else 0

        for idx, status in enumerate(TIMELINE_ORDER):
            status_val = status.value
            ts = history.get(status_val)
            timeline.append(
                TimelineStep(
                    status=status_val,
                    label=STATUS_LABELS.get(status, status_val),
                    timestamp=ts,
                    is_completed=idx < current_idx
                    or (idx == current_idx and order.status == OrderStatus.DELIVERED),
                    is_current=status == order.status,
                )
            )

        return TrackOrderResponse(
            tracking_code=order.tracking_code,
            order_number=order.order_number,
            customer_name=order.customer_name,
            carpet_description=order.carpet_description or self._default_carpet_desc(order.service_type),
            current_status=order.status.value,
            current_status_label=STATUS_LABELS.get(order.status, order.status.value),
            estimated_delivery_at=order.estimated_delivery_at,
            timeline=timeline,
            total=order.total,
            currency=order.currency,
        )

    async def _unique_code(self, column, prefix: str, body: str) -> str:
        """Generate a code guaranteed unique against the given Order column."""
        for _ in range(20):
            candidate = f"{prefix}{body()}" if callable(body) else f"{prefix}{body}"
            existing = await self.db.execute(select(column).where(column == candidate))
            if existing.scalar_one_or_none() is None:
                return candidate
        # Extremely unlikely; fall back to a full uuid hex.
        return f"{prefix}{uuid.uuid4().hex.upper()[:10]}"

    async def _build_order(
        self,
        *,
        customer_name: str,
        phone: str,
        service_type: ServiceType,
        source: OrderSource,
        notes: str | None = None,
        pickup_address: str | None = None,
        house_number: str | None = None,
        latitude: Decimal | None = None,
        longitude: Decimal | None = None,
        carpet_description: str | None = None,
        customer_email: str | None = None,
        partner_id: uuid.UUID | None = None,
        created_by_id: uuid.UUID | None = None,
    ) -> Order:
        year = datetime.now().year
        tracking_code = await self._unique_code(
            Order.tracking_code, f"QC-{year}-", lambda: secrets.token_hex(3).upper()[:5]
        )
        order_number = await self._unique_code(
            Order.order_number, "ORD-", lambda: secrets.token_hex(5).upper()[:9]
        )
        low, high = PRICING[service_type]
        subtotal = (low + high) / 2

        order = Order(
            order_number=order_number,
            tracking_code=tracking_code,
            customer_name=customer_name,
            customer_phone=phone,
            customer_email=customer_email,
            pickup_address=pickup_address,
            house_number=house_number,
            latitude=latitude,
            longitude=longitude,
            carpet_description=carpet_description,
            source=source,
            service_type=service_type,
            partner_id=partner_id,
            status=OrderStatus.PENDING_PICKUP,
            pickup_workflow="pending",
            subtotal=subtotal,
            tax=Decimal("0"),
            total=subtotal,
            notes=notes,
            estimated_delivery_at=datetime.now(timezone.utc) + timedelta(days=2),
            created_by_id=created_by_id,
        )
        self.db.add(order)
        await self.db.flush()

        self.db.add(
            OrderStatusHistory(
                order_id=order.id,
                from_status=None,
                to_status=OrderStatus.PENDING_PICKUP.value,
                note="Order registered",
                changed_by_id=created_by_id,
            )
        )
        from src.modules.qr_tracking.application.service import QrTrackingService

        from src.modules.sessions.application.service import SessionService

        await SessionService(self.db).create_for_order(order, partner_id=partner_id)
        await QrTrackingService(self.db).ensure_carpet_for_order(order, user=None)
        return order

    async def _change_status(
        self,
        order: Order,
        new_status: OrderStatus,
        user_id: uuid.UUID | None,
        note: str | None,
    ) -> None:
        if order.status == new_status:
            return
        old = order.status.value
        order.status = new_status
        self.db.add(
            OrderStatusHistory(
                order_id=order.id,
                from_status=old,
                to_status=new_status.value,
                note=note,
                changed_by_id=user_id,
            )
        )

    async def _get_order_or_404(self, order_id: uuid.UUID) -> Order:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found")
        return order

    async def _paid_order_ids(self, order_ids: list[uuid.UUID]) -> set[uuid.UUID]:
        if not order_ids:
            return set()
        result = await self.db.execute(
            select(OrderPaymentRecord.order_id).where(
                OrderPaymentRecord.order_id.in_(order_ids),
                OrderPaymentRecord.is_paid.is_(True),
            )
        )
        return set(result.scalars().all())

    async def _to_response(
        self, order: Order, *, paid_order_ids: set[uuid.UUID] | None = None
    ) -> OrderResponse:
        partner_name: str | None = None
        if order.partner_id:
            from src.modules.payments.infrastructure.models import Partner

            partner_row = await self.db.get(Partner, order.partner_id)
            if partner_row:
                partner_name = partner_row.name

        # Resolve session code via explicit async query (avoid touching the lazy
        # `order.service_session` relationship on freshly-created objects, which
        # raises MissingGreenlet under async SQLAlchemy).
        from src.modules.sessions.infrastructure.models import ServiceSession

        sess_result = await self.db.execute(
            select(ServiceSession.session_code).where(ServiceSession.order_id == order.id)
        )
        session_code: str | None = sess_result.scalar_one_or_none()

        is_paid = False
        if paid_order_ids is not None:
            is_paid = order.id in paid_order_ids
        else:
            paid_set = await self._paid_order_ids([order.id])
            is_paid = order.id in paid_set

        return OrderResponse(
            id=order.id,
            order_number=order.order_number,
            tracking_code=order.tracking_code,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            customer_email=order.customer_email,
            carpet_description=order.carpet_description,
            carpet_count=order.carpet_count or 1,
            carpet_dimensions=order.carpet_dimensions,
            source=order.source.value,
            service_type=order.service_type.value,
            status=order.status.value,
            subtotal=order.subtotal,
            tax=order.tax,
            total=order.total,
            currency=order.currency,
            notes=order.notes,
            pickup_address=order.pickup_address,
            house_number=order.house_number,
            latitude=order.latitude,
            longitude=order.longitude,
            partner_id=order.partner_id,
            partner_name=partner_name,
            is_partner_order=order.source == OrderSource.PARTNER or order.partner_id is not None,
            session_code=session_code,
            estimated_delivery_at=order.estimated_delivery_at,
            created_at=order.created_at,
            updated_at=order.updated_at,
            is_paid=is_paid,
        )

    def _default_carpet_desc(self, service_type: ServiceType) -> str:
        labels = {
            ServiceType.STANDARD: "Machine-made carpet",
            ServiceType.PREMIUM: "Handwoven wool rug",
            ServiceType.ANTIQUE: "Antique heirloom carpet",
        }
        return labels.get(service_type, "Carpet")
