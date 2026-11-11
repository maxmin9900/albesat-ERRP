import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.modules.auth.infrastructure.models import User
from src.modules.logistics.application.schemas import (
    AcceptPickupResponse,
    AttachQrResponse,
    CompleteDeliveryRequest,
    CompleteDeliveryResponse,
    DeliveryScanResponse,
    AttachQrRequest,
    CarpetSummary,
    DriverDashboardResponse,
    DriverOrderCard,
    DriverOrdersListResponse,
    DriverQuickScanResponse,
    PickupDetailsRequest,
    PickupQrResponse,
    RouteMapResponse,
    RouteStop,
    ScanHandoffRequest,
)
from src.modules.orders.application.service import STATUS_LABELS, OrderService
from src.modules.orders.infrastructure.models import Order, OrderStatus
from src.modules.payments.application.service import PaymentsService
from src.modules.payments.infrastructure.models import CustomerPaymentStatus, Invoice, InvoiceType
from src.modules.qr_tracking.application.schemas import GenerateQrRequest
from src.core.qr_security import normalize_qr_scan_code
from src.modules.qr_tracking.application.service import QrTrackingService
from src.modules.qr_tracking.infrastructure.models import Carpet, CarpetStatus, PhysicalQrTag, QrCode
from src.modules.repair.application.service import TERMINAL_STATUSES
from src.modules.repair.infrastructure.models import RepairRequest, RepairWorkflowStatus

SERVICE_LABELS = {
    "standard": "Standard Wash",
    "premium": "Premium Specialist Wash",
    "antique": "Antique Carpet Wash",
}

PAYMENT_STATUS_LABELS = {
    "unpaid": "Unpaid",
    "partially_paid": "Partially Paid",
    "paid": "Paid",
    "failed_payment": "Failed Payment",
    "overdue": "Overdue",
}

REPAIR_BLOCKED = {
    RepairWorkflowStatus.PENDING_APPROVAL,
    RepairWorkflowStatus.IN_REPAIR,
}

OPERATIONS_CENTER = "Albesat Operations Center"
OPERATIONS_ADDRESS = "12 Industrial Blvd, Unit 4, Brooklyn, NY"


class LogisticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _require_driver(self, user: User) -> None:
        if not user.check_permission("logistics:read"):
            raise ForbiddenError("Driver access required")

    async def dashboard(self, user: User) -> DriverDashboardResponse:
        self._require_driver(user)
        lists = await self.list_orders(user)
        collectible = sum(Decimal(d.total) for d in lists.deliveries)
        return DriverDashboardResponse(
            done_today=len(lists.history),
            pickups_pending=len(lists.pending_pickup),
            pickups_in_progress=len(lists.pickup_in_progress),
            pickups_collected=len(lists.collected_pending_handoff),
            deliveries_pending=len(lists.deliveries),
            route_distance_km=lists.route_summary.get("distance_km", "0"),
            route_stops=int(lists.route_summary.get("stops", 0)),
            route_est_minutes=int(lists.route_summary.get("est_minutes", 0)),
            collectible_total=str(collectible),
            carpets_ready=sum(d.carpet_count for d in lists.deliveries),
        )

    async def list_orders(self, user: User) -> DriverOrdersListResponse:
        self._require_driver(user)
        result = await self.db.execute(
            select(Order)
            .where(
                or_(
                    Order.status == OrderStatus.PENDING_PICKUP,
                    Order.status == OrderStatus.PICKED_UP,
                    Order.status.in_([OrderStatus.READY_FOR_DELIVERY, OrderStatus.OUT_FOR_DELIVERY]),
                    Order.status == OrderStatus.DELIVERED,
                )
            )
            .order_by(Order.created_at.desc())
        )
        orders = result.scalars().all()

        pending: list[DriverOrderCard] = []
        in_progress: list[DriverOrderCard] = []
        collected: list[DriverOrderCard] = []
        deliveries: list[DriverOrderCard] = []
        history: list[DriverOrderCard] = []

        for order in orders:
            card = await self._to_card(order, user)
            if order.status == OrderStatus.DELIVERED:
                if order.assigned_driver_id == user.id:
                    history.append(card)
                continue
            if order.status in (OrderStatus.READY_FOR_DELIVERY, OrderStatus.OUT_FOR_DELIVERY):
                if not await self._in_driver_delivery_session(order, user):
                    continue
                if order.delivery_workflow == "completed":
                    continue
                deliveries.append(card)
                continue
            if order.status == OrderStatus.PICKED_UP:
                if order.assigned_driver_id != user.id:
                    continue
                if order.pickup_workflow == "collected":
                    collected.append(card)
                elif order.pickup_workflow == "handed_to_ops":
                    history.append(card)
                continue
            if order.status != OrderStatus.PENDING_PICKUP:
                continue
            if order.assigned_driver_id not in (None, user.id):
                continue
            if order.assigned_driver_id == user.id and order.pickup_workflow in (
                "in_progress",
                "accepted",
                "qr_attached",
                "qr_generated",
            ):
                in_progress.append(card)
            elif order.assigned_driver_id is None or order.assigned_driver_id == user.id:
                pending.append(card)

        route_stops = pending + in_progress + deliveries
        total_km = sum(float(o.distance_km or 0) for o in route_stops if o.distance_km)

        return DriverOrdersListResponse(
            pending_pickup=pending,
            pickup_in_progress=in_progress,
            collected_pending_handoff=collected,
            deliveries=deliveries,
            history=history[:10],
            route_summary={
                "distance_km": f"{total_km:.1f}",
                "stops": len(route_stops),
                "est_minutes": len(route_stops) * 12,
            },
        )

    async def get_order(self, order_id: uuid.UUID, user: User) -> DriverOrderCard:
        self._require_driver(user)
        order = await self._get_order(order_id)
        return await self._to_card(order, user)

    async def accept_pickup(self, order_id: uuid.UUID, user: User) -> AcceptPickupResponse:
        if not user.check_permission("logistics:pickup"):
            raise ForbiddenError("Missing logistics:pickup")
        order = await self._get_order(order_id)
        if order.status != OrderStatus.PENDING_PICKUP:
            raise ValidationError("Order is not available for pickup")
        # US-10: assign the driver and move the order into "Pickup In Progress".
        order.assigned_driver_id = user.id
        order.pickup_workflow = "in_progress"
        order.pickup_started_at = datetime.now(timezone.utc)
        await self.db.flush()
        card = await self._to_card(order, user)
        return AcceptPickupResponse(order=card, message="Pickup assigned to you — Pickup In Progress")

    async def start_pickup(self, order_id: uuid.UUID, user: User) -> DriverOrderCard:
        if not user.check_permission("logistics:pickup"):
            raise ForbiddenError("Missing logistics:pickup")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        order.pickup_workflow = "in_progress"
        order.pickup_started_at = datetime.now(timezone.utc)
        await self.db.flush()
        return await self._to_card(order, user)

    async def quick_scan(
        self, code: str, user: User, *, order_id: uuid.UUID | None = None
    ) -> DriverQuickScanResponse:
        """Driver Scan QR tab: attach tag + confirm pickup, or route to handoff."""
        self._require_driver(user)
        if not user.check_permission("qr:scan"):
            raise ForbiddenError("Missing qr:scan")

        clean = normalize_qr_scan_code(code) or code.strip()
        if len(clean) < 3:
            raise ValidationError("Enter a valid QR code or tracking code (QC-2026-…).")

        qr_svc = QrTrackingService(self.db)
        carpet = await qr_svc.find_carpet_by_active_code(code)
        if carpet is not None:
            return await self._quick_scan_existing_carpet(carpet, clean, user)

        if order_id is not None:
            order = await self._get_order(order_id)
            return await self._quick_scan_attach_and_confirm(order, clean, user)

        matched = await qr_svc._find_order_by_identifier(clean)
        if matched is not None and matched.status == OrderStatus.PENDING_PICKUP:
            if matched.assigned_driver_id != user.id:
                raise ValidationError(
                    f"Order {matched.tracking_code} is not on your route. "
                    "Open Orders → Start Pickup to claim it first."
                )
            return await self._quick_scan_attach_and_confirm(matched, clean, user)

        tag_result = await self.db.execute(
            select(PhysicalQrTag).where(PhysicalQrTag.code == clean)
        )
        tag = tag_result.scalar_one_or_none()
        if tag is not None:
            if not tag.is_active:
                raise ValidationError("This QR tag is disabled. Ask admin to re-enable it.")
            active_qr = await self.db.execute(
                select(QrCode).where(QrCode.code == clean, QrCode.revoked_at.is_(None))
            )
            if active_qr.scalar_one_or_none() is not None:
                raise ValidationError(
                    "This tag is already active on another pickup. Scan the tag on the carpet."
                )
            targets = await self._pickup_target_orders(user)
            if not targets:
                raise ValidationError(
                    "No pickup assigned to you. Open Orders → Start Pickup on the order, "
                    "then scan the tag again."
                )
            if len(targets) == 1:
                return await self._quick_scan_attach_and_confirm(targets[0], clean, user)
            cards = [await self._to_card(o, user) for o in targets]
            return DriverQuickScanResponse(
                action="choose_order",
                message="Multiple pickups open — select the order for this tag.",
                candidate_orders=cards,
            )

        raise ValidationError(
            "Code not recognized. Scan a registered leather tag or order tracking code (QC-2026-…)."
        )

    async def _quick_scan_existing_carpet(
        self, carpet: Carpet, clean: str, user: User
    ) -> DriverQuickScanResponse:
        order = await self._get_order(carpet.order_id)
        card = await self._to_card(order, user)

        if order.status == OrderStatus.PICKED_UP and order.assigned_driver_id == user.id:
            if order.pickup_workflow == "collected":
                return DriverQuickScanResponse(
                    action="handoff",
                    message=f"{order.tracking_code} collected — hand to operations.",
                    order_id=order.id,
                    tracking_code=order.tracking_code,
                    order=card,
                )
            if order.pickup_workflow in ("qr_attached", "in_progress", "accepted", "qr_generated"):
                if await QrTrackingService(self.db).verify_scanned_active(carpet.id, clean):
                    card = await self.confirm_pickup(
                        order.id, ScanHandoffRequest(code=clean), user
                    )
                    return DriverQuickScanResponse(
                        action="pickup_confirmed",
                        message=f"Pickup confirmed for {order.tracking_code}.",
                        order_id=order.id,
                        tracking_code=order.tracking_code,
                        order=card,
                    )

        if order.status == OrderStatus.PENDING_PICKUP:
            if order.assigned_driver_id != user.id:
                raise ValidationError(
                    f"Order {order.tracking_code} is not assigned to you. "
                    "Open Orders → Start Pickup first."
                )
            if await QrTrackingService(self.db).verify_scanned_active(carpet.id, clean):
                card = await self.confirm_pickup(
                    order.id, ScanHandoffRequest(code=clean), user
                )
                return DriverQuickScanResponse(
                    action="pickup_confirmed",
                    message=f"Pickup confirmed for {order.tracking_code}.",
                    order_id=order.id,
                    tracking_code=order.tracking_code,
                    order=card,
                )

        raise ValidationError(
            f"Tag belongs to {order.tracking_code} but pickup cannot be confirmed from here. "
            "Use Orders → Pickup flow."
        )

    async def _quick_scan_attach_and_confirm(
        self, order: Order, clean: str, user: User
    ) -> DriverQuickScanResponse:
        if order.status != OrderStatus.PENDING_PICKUP:
            raise ValidationError("This order is not awaiting pickup.")
        if order.assigned_driver_id != user.id:
            raise ValidationError(
                "This order is not assigned to you. Open Orders → Start Pickup first."
            )
        await self.db.flush()
        await self.attach_qr(order.id, AttachQrRequest(code=clean), user)
        card = await self.confirm_pickup(order.id, ScanHandoffRequest(code=clean), user)
        return DriverQuickScanResponse(
            action="pickup_confirmed",
            message=f"QR attached and pickup confirmed for {order.tracking_code}.",
            order_id=order.id,
            tracking_code=order.tracking_code,
            order=card,
        )

    async def _pickup_target_orders(self, user: User) -> list[Order]:
        """Only pickups already claimed by this driver (Start Pickup pressed)."""
        result = await self.db.execute(
            select(Order).where(
                Order.status == OrderStatus.PENDING_PICKUP,
                Order.assigned_driver_id == user.id,
                Order.pickup_workflow.in_(
                    ("in_progress", "accepted", "qr_attached", "qr_generated")
                ),
            ).order_by(Order.created_at.desc())
        )
        return list(result.scalars().all())

    def _ensure_driver_assigned(self, order: Order, user: User) -> None:
        if order.assigned_driver_id and order.assigned_driver_id != user.id:
            raise ForbiddenError("Order assigned to another driver")
        if order.assigned_driver_id is None:
            order.assigned_driver_id = user.id
        if order.pickup_workflow in (None, "", "pending"):
            order.pickup_workflow = "in_progress"
        if order.pickup_started_at is None:
            order.pickup_started_at = datetime.now(timezone.utc)
        # flush deferred to caller before attach_qr reads assignment

    async def generate_pickup_qr(self, order_id: uuid.UUID, user: User) -> PickupQrResponse:
        if not user.check_permission("qr:generate"):
            raise ForbiddenError("Missing qr:generate")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        qr_svc = QrTrackingService(self.db)
        carpet = await qr_svc.ensure_carpet_for_order(order, user=user)
        qr_codes = await qr_svc._fetch_qr_codes(carpet.id)
        active = next((qr for qr in qr_codes if qr.revoked_at is None), None)
        if not active:
            raise ValidationError(
                "No physical QR on this carpet yet. Scan the punched tag at pickup first."
            )
        full_code, issued_at = active.code, active.issued_at
        order.pickup_workflow = "qr_generated"
        await self.db.flush()
        from src.modules.sessions.application.service import SessionService

        sess = await SessionService(self.db).get_by_order(order.id)
        session_code = sess.session_code if sess else f"SES-{order.tracking_code.replace('QC-', '')[:12]}"
        return PickupQrResponse(
            order_id=order.id,
            tracking_code=order.tracking_code,
            carpet_id=carpet.id,
            carpet_code=carpet.carpet_code,
            session_code=session_code,
            qr_code=full_code,
            issued_at=issued_at,
        )

    async def attach_qr(self, order_id: uuid.UUID, data, user: User) -> AttachQrResponse:
        """US-11: attach a scanned physical QR to the order's carpet instance."""
        if not user.check_permission("qr:generate"):
            raise ForbiddenError("Missing qr:generate")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        if order.status != OrderStatus.PENDING_PICKUP:
            raise ValidationError("QR can only be attached during pickup")

        qr_svc = QrTrackingService(self.db)
        carpet = await qr_svc.ensure_carpet_for_order(order, user=user)
        qr = await qr_svc.attach_physical_qr(
            carpet,
            data.code,
            user,
            order=order,
            carpet_type=data.carpet_type,
            dimensions=data.dimensions,
        )
        order.pickup_workflow = "qr_attached"
        await self.db.flush()

        from src.modules.sessions.application.service import SessionService

        sess = await SessionService(self.db).get_by_order(order.id)
        return AttachQrResponse(
            order_id=order.id,
            carpet_id=carpet.id,
            carpet_code=carpet.carpet_code,
            carpet_type=carpet.carpet_type,
            qr_code=qr.code,
            session_code=sess.session_code if sess else None,
            message="QR attached to carpet",
        )

    async def confirm_pickup(
        self, order_id: uuid.UUID, data: ScanHandoffRequest, user: User
    ) -> DriverOrderCard:
        """US-12: receipt is recorded ONLY after a mandatory scan of an ACTIVE QR."""
        if not user.check_permission("qr:scan"):
            raise ForbiddenError("Missing qr:scan")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)

        qr_svc = QrTrackingService(self.db)
        carpet_result = await self.db.execute(select(Carpet).where(Carpet.order_id == order.id))
        carpets = list(carpet_result.scalars().all())
        if not carpets:
            raise ValidationError("No carpet/QR registered. Attach a QR before pickup.")

        # Scan is mandatory: the code must match an ACTIVE QR on one of this order's carpets.
        target = None
        for carpet in carpets:
            if await qr_svc.verify_scanned_active(carpet.id, data.code):
                target = carpet
                break
        if target is None:
            raise ValidationError(
                "Scan a valid, active QR for a carpet in this order to confirm pickup"
            )

        await qr_svc._log_scan(
            carpet_id=target.id,
            user_id=user.id,
            code=data.code.strip(),
            ip=None,
            method="pickup",
            is_valid=True,
        )
        await qr_svc._record_operation(
            target, operation="pickup_received", user_id=user.id, note="Carpet collected (QR scanned)"
        )
        if target.status != CarpetStatus.IN_TRANSIT:
            old_carpet_status = (
                target.status.value if hasattr(target.status, "value") else str(target.status)
            )
            target.status = CarpetStatus.IN_TRANSIT
            await qr_svc._record_status_event(
                target,
                from_status=old_carpet_status,
                to_status="in_transit",
                user_id=user.id,
                note="Carpet collected by driver",
            )

        # The order is only collected once every carpet has been scanned in.
        if all(c.status == CarpetStatus.IN_TRANSIT for c in carpets):
            if order.status != OrderStatus.PICKED_UP:
                await OrderService(self.db)._change_status(
                    order, OrderStatus.PICKED_UP, user.id, note="Pickup confirmed by driver (QR scanned)"
                )
            order.pickup_workflow = "collected"
            if order.pickup_started_at is None:
                order.pickup_started_at = datetime.now(timezone.utc)
            from src.modules.sessions.application.service import SessionService

            await SessionService(self.db).sync_status_for_order(order)
        await self.db.flush()
        return await self._to_card(order, user)

    async def save_pickup_details(
        self, order_id: uuid.UUID, data: PickupDetailsRequest, user: User
    ) -> DriverOrderCard:
        """Driver records carpet count, area (متراژ) and price (قیمت) at pickup."""
        if not user.check_permission("logistics:pickup"):
            raise ForbiddenError("Missing logistics:pickup")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)

        order.carpet_count = data.carpet_count
        if data.dimensions is not None:
            order.carpet_dimensions = data.dimensions.strip() or None
        if data.price is not None:
            order.subtotal = data.price
            order.tax = Decimal("0")
            order.total = data.price
        await self.db.flush()
        return await self._to_card(order, user)

    async def save_pickup_carpets(
        self, order_id: uuid.UUID, data, user: User
    ) -> DriverOrderCard:
        """Record each carpet separately at pickup: barcode, dimensions, price, repair flag.

        Attaching a registered, active barcode to every carpet is the proof of
        collection, so this also confirms the pickup (sets the order PICKED_UP).
        """
        if not user.check_permission("logistics:pickup"):
            raise ForbiddenError("Missing logistics:pickup")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        if order.status not in (OrderStatus.PENDING_PICKUP, OrderStatus.PICKED_UP):
            raise ValidationError("Carpets can only be recorded during pickup")

        # Barcodes must be unique within a single submission.
        codes = [entry.code.strip() for entry in data.carpets]
        if len(set(codes)) != len(codes):
            raise ValidationError("Each carpet needs a different barcode")

        qr_svc = QrTrackingService(self.db)
        existing_result = await self.db.execute(
            select(Carpet).where(Carpet.order_id == order.id).order_by(Carpet.created_at)
        )
        existing = list(existing_result.scalars().all())
        base_code = order.tracking_code.replace("#", "")

        carpets: list[Carpet] = []
        total = Decimal("0")
        for idx, entry in enumerate(data.carpets):
            if idx < len(existing):
                carpet = existing[idx]
            else:
                carpet = Carpet(
                    order_id=order.id,
                    carpet_code=f"{base_code}-{idx + 1}",
                    description=order.carpet_description,
                    status=CarpetStatus.REGISTERED,
                )
                self.db.add(carpet)
                await self.db.flush()
                await qr_svc._record_status_event(
                    carpet,
                    from_status=None,
                    to_status="registered",
                    user_id=user.id,
                    note="Carpet registered at pickup",
                )

            dims = self._format_dimensions(entry.length, entry.width)
            if dims:
                carpet.dimensions = dims
            if entry.carpet_type:
                carpet.carpet_type = entry.carpet_type
            if entry.price is not None:
                carpet.price = entry.price
                total += entry.price

            # Attach the scanned physical barcode (validates tag is registered/active/free).
            await qr_svc.attach_physical_qr(
                carpet, entry.code, user, order=order, dimensions=dims
            )

            if entry.needs_repair:
                await self._flag_carpet_repair(
                    carpet, order, user, entry.damage_description
                )

            carpets.append(carpet)

        order.carpet_count = len(carpets)
        if any(entry.price is not None for entry in data.carpets):
            order.subtotal = total
            order.tax = Decimal("0")
            order.total = total

        # US-DI-01: auto-create/refresh the draft invoice (پیش‌فاکتور) from the
        # carpets the driver just recorded.
        await PaymentsService(self.db).sync_draft_invoice_from_pickup(
            order, carpets, list(data.carpets)
        )

        await self._mark_collected(order, carpets, user)
        await self.db.flush()
        return await self._to_card(order, user)

    async def get_pickup_invoice(self, order_id: uuid.UUID, user: User):
        """US-DI-04: driver views the draft-invoice summary before confirming."""
        if not user.check_permission("logistics:read"):
            raise ForbiddenError("Missing logistics:read")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        return await PaymentsService(self.db).build_draft_invoice_response(order.id)

    async def confirm_pickup_invoice(self, order_id: uuid.UUID, user: User):
        """US-DI-04/05: driver confirms the draft invoice; system sends it to the customer."""
        if not user.check_permission("logistics:pickup"):
            raise ForbiddenError("Missing logistics:pickup")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        return await PaymentsService(self.db).confirm_draft_invoice(order, user)

    @staticmethod
    def _format_dimensions(length, width) -> str | None:
        l = f"{length:g}" if length is not None else ""
        w = f"{width:g}" if width is not None else ""
        if l and w:
            return f"{l}×{w} m"
        if l or w:
            return f"{l or w} m"
        return None

    async def _flag_carpet_repair(
        self, carpet: Carpet, order: Order, user: User, damage_description: str | None
    ) -> None:
        """Record a per-carpet repair request without altering the pickup status."""
        if not user.check_permission("repair:create"):
            raise ForbiddenError("Missing repair:create")
        existing = await self.db.execute(
            select(RepairRequest).where(
                RepairRequest.carpet_id == carpet.id,
                RepairRequest.status.notin_(list(TERMINAL_STATUSES)),
            )
        )
        if existing.scalars().first() is not None:
            return
        self.db.add(
            RepairRequest(
                order_id=order.id,
                carpet_id=carpet.id,
                status=RepairWorkflowStatus.PENDING_APPROVAL,
                damage_description=damage_description,
                flagged_source="driver",
                created_by_user_id=user.id,
            )
        )

    async def _mark_collected(
        self, order: Order, carpets: list[Carpet], user: User
    ) -> None:
        """Mirror confirm_pickup for a set of carpets: status -> picked up / in transit."""
        qr_svc = QrTrackingService(self.db)
        if order.status != OrderStatus.PICKED_UP:
            await OrderService(self.db)._change_status(
                order,
                OrderStatus.PICKED_UP,
                user.id,
                note="Pickup confirmed by driver (carpets recorded)",
            )
        for carpet in carpets:
            await qr_svc._record_operation(
                carpet,
                operation="pickup_received",
                user_id=user.id,
                note="Carpet collected (barcode attached)",
            )
            if carpet.status != CarpetStatus.IN_TRANSIT:
                old_status = (
                    carpet.status.value if hasattr(carpet.status, "value") else str(carpet.status)
                )
                carpet.status = CarpetStatus.IN_TRANSIT
                await qr_svc._record_status_event(
                    carpet,
                    from_status=old_status,
                    to_status="in_transit",
                    user_id=user.id,
                    note="Carpet collected by driver",
                )
        order.pickup_workflow = "collected"
        if order.pickup_started_at is None:
            order.pickup_started_at = datetime.now(timezone.utc)
        from src.modules.sessions.application.service import SessionService

        await SessionService(self.db).sync_status_for_order(order)

    async def scan_handoff(self, order_id: uuid.UUID, data: ScanHandoffRequest, user: User) -> DriverOrderCard:
        if not user.check_permission("qr:scan"):
            raise ForbiddenError("Missing qr:scan")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        await QrTrackingService(self.db).scan(data.code, user, method="handoff")
        return await self._to_card(order, user)

    async def confirm_handoff(self, order_id: uuid.UUID, user: User) -> DriverOrderCard:
        if not user.check_permission("logistics:pickup"):
            raise ForbiddenError("Missing logistics:pickup")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        if order.pickup_workflow not in ("collected", "qr_generated"):
            raise ValidationError("Complete pickup before handoff")
        if order.status != OrderStatus.PICKED_UP:
            raise ValidationError("Order must be collected before handoff to operations")
        order.pickup_workflow = "handed_to_ops"
        qr_svc = QrTrackingService(self.db)
        carpet_result = await self.db.execute(select(Carpet).where(Carpet.order_id == order.id))
        for carpet in carpet_result.scalars().all():
            await qr_svc._record_delivery(
                carpet,
                event_type="handed_to_operations",
                user_id=user.id,
                location=OPERATIONS_ADDRESS,
                driver_name=user.full_name,
                note=f"Received by {OPERATIONS_CENTER}",
            )
        await self.db.flush()
        return await self._to_card(order, user)

    async def start_delivery(self, order_id: uuid.UUID, user: User) -> DriverOrderCard:
        if not user.check_permission("logistics:deliver"):
            raise ForbiddenError("Missing logistics:deliver")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        if order.status == OrderStatus.OUT_FOR_DELIVERY:
            return await self._to_card(order, user)
        if order.status != OrderStatus.READY_FOR_DELIVERY:
            raise ValidationError("Order not ready for delivery")
        await OrderService(self.db)._change_status(
            order, OrderStatus.OUT_FOR_DELIVERY, user.id, note="Out for delivery"
        )
        order.delivery_workflow = "in_progress"
        await self.db.flush()
        return await self._to_card(order, user)

    async def scan_delivery(
        self, order_id: uuid.UUID, data: ScanHandoffRequest, user: User
    ) -> DeliveryScanResponse:
        """US-20: mandatory QR scan — validate delivery session and show carpet info."""
        if not user.check_permission("qr:scan"):
            raise ForbiddenError("Missing qr:scan")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)
        carpet = await self._validate_delivery_scan(order, user, data.code)

        order.delivery_workflow = "qr_verified"
        await self.db.flush()

        card = await self._to_card(order, user)
        active_qr = next((q for q in carpet.qr_codes if q.revoked_at is None), None)
        inv_preview = await self._invoice_preview(order)

        return DeliveryScanResponse(
            order=card,
            carpet_id=carpet.id,
            qr_code=active_qr.code if active_qr else data.code.strip(),
            carpet_type=carpet.carpet_type,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            service_label=card.service_label,
            invoice_number=inv_preview.get("invoice_number"),
            invoice_total=str(order.total),
            payment_status=inv_preview.get("payment_status", "unpaid"),
            payment_status_label=inv_preview.get("payment_status_label", "Unpaid"),
            message="QR verified — ready to complete delivery",
        )

    async def complete_delivery(
        self, order_id: uuid.UUID, data: CompleteDeliveryRequest, user: User
    ) -> CompleteDeliveryResponse:
        """US-20 / US-20A: complete delivery, issue final invoice, record payment."""
        if not user.check_permission("logistics:deliver"):
            raise ForbiddenError("Missing logistics:deliver")
        order = await self._get_order(order_id)
        self._assert_assigned(order, user)

        if order.status != OrderStatus.OUT_FOR_DELIVERY:
            raise ValidationError("Order must be Out for Delivery")

        carpet_result = await self.db.execute(
            select(Carpet).where(Carpet.order_id == order.id).options(selectinload(Carpet.qr_codes))
        )
        carpets = list(carpet_result.scalars().all())
        if not carpets:
            raise ValidationError("Carpet not found for this order")

        # Deliver every carpet this driver loaded for the order that is still pending.
        deliverable = [
            c
            for c in carpets
            if c.loaded_for_driver_id == user.id
            and c.delivered_at is None
            and c.status != CarpetStatus.DELIVERED
        ]
        if not deliverable:
            raise ValidationError("No carpet in your delivery session is awaiting delivery")
        for c in deliverable:
            await self._assert_not_blocked_by_repair(c.id)

        now = datetime.now(timezone.utc)
        qr_svc = QrTrackingService(self.db)
        for carpet in deliverable:
            old_status = carpet.status.value if hasattr(carpet.status, "value") else str(carpet.status)
            carpet.status = CarpetStatus.DELIVERED
            carpet.delivered_at = now
            carpet.delivered_by_user_id = user.id

            await qr_svc._record_status_event(
                carpet,
                from_status=old_status,
                to_status="delivered",
                user_id=user.id,
                note="Delivered to customer",
            )
            await qr_svc._record_delivery(
                carpet,
                event_type="delivered_to_customer",
                user_id=user.id,
                driver_name=user.full_name,
                location=order.pickup_address,
                note=data.note or "Delivery completed",
            )
            await qr_svc._record_operation(
                carpet,
                operation="delivered",
                user_id=user.id,
                note="Customer delivery confirmed",
            )
        carpet = deliverable[0]

        if data.payment_method:
            order.payment_method = data.payment_method
        await OrderService(self.db)._change_status(
            order,
            OrderStatus.DELIVERED,
            user.id,
            note=data.note or (f"Delivered — {data.payment_method}" if data.payment_method else "Delivered"),
        )
        order.delivery_workflow = "completed"

        from src.modules.sessions.application.service import SessionService

        invoice = await PaymentsService(self.db).issue_final_invoice(order, carpet, delivered_at=now)
        inv_orm = await PaymentsService(self.db)._get_final_invoice_for_order(order.id)
        if data.payment_method:
            payment_status = await PaymentsService(self.db).record_delivery_payment(
                order,
                data.payment_method,
                user.id,
                invoice=inv_orm,
                amount=data.payment_amount,
                confirmation_reference=data.confirmation_reference,
            )
        else:
            payment_status = inv_orm.payment_status if inv_orm else CustomerPaymentStatus.UNPAID
        invoice_data = invoice.model_dump(mode="json")
        ps_val = payment_status.value if hasattr(payment_status, "value") else str(payment_status)
        invoice_data["payment_status"] = ps_val
        invoice_data["payment_status_label"] = PAYMENT_STATUS_LABELS.get(ps_val, ps_val)

        for c in deliverable:
            active_qr = await qr_svc.get_active_qr(c.id)
            if active_qr:
                active_qr.revoked_at = now
        await SessionService(self.db).sync_status_for_order(order)
        await self.db.flush()

        card = await self._to_card(order, user)
        return CompleteDeliveryResponse(
            order=card,
            invoice=invoice_data,
            message="Delivery completed and final invoice issued",
        )

    async def route_map(self, user: User) -> RouteMapResponse:
        self._require_driver(user)
        lists = await self.list_orders(user)
        stops: list[RouteStop] = []
        all_orders = lists.pending_pickup + lists.pickup_in_progress + lists.deliveries
        for i, card in enumerate(all_orders[:6], start=1):
            stops.append(
                RouteStop(
                    stop_number=i,
                    order_id=card.id,
                    customer_name=card.customer_name,
                    address=card.pickup_address or "",
                    latitude=card.latitude,
                    longitude=card.longitude,
                    tracking_code=card.tracking_code,
                    distance_km=card.distance_km,
                )
            )
        total_km = sum(float(s.distance_km or 0) for s in stops)
        return RouteMapResponse(
            total_distance_km=f"{total_km:.1f}",
            stops_count=len(stops),
            est_minutes=len(stops) * 12,
            stops=stops,
        )

    async def _to_card(self, order: Order, user: User) -> DriverOrderCard:
        carpet_code = None
        carpet_type = None
        has_qr = False
        qr_code = None
        loaded_at = None
        carpet_result = await self.db.execute(
            select(Carpet)
            .where(Carpet.order_id == order.id)
            .order_by(Carpet.created_at)
            .options(selectinload(Carpet.qr_codes))
        )
        carpets = list(carpet_result.scalars().all())

        repair_carpet_ids: set[uuid.UUID] = set()
        if carpets:
            repair_result = await self.db.execute(
                select(RepairRequest.carpet_id).where(
                    RepairRequest.carpet_id.in_([c.id for c in carpets]),
                    RepairRequest.status.notin_(list(TERMINAL_STATUSES)),
                )
            )
            repair_carpet_ids = set(repair_result.scalars().all())

        carpet_summaries: list[CarpetSummary] = []
        for carpet in carpets:
            active = next((q for q in carpet.qr_codes if q.revoked_at is None), None)
            carpet_summaries.append(
                CarpetSummary(
                    id=carpet.id,
                    carpet_code=carpet.carpet_code,
                    dimensions=carpet.dimensions,
                    price=str(carpet.price) if carpet.price is not None else None,
                    carpet_type=carpet.carpet_type,
                    qr_code=active.code if active else None,
                    has_qr=active is not None,
                    needs_repair=carpet.id in repair_carpet_ids,
                )
            )

        if carpets:
            first = carpets[0]
            carpet_code = first.carpet_code
            carpet_type = first.carpet_type
            active = next((q for q in first.qr_codes if q.revoked_at is None), None)
            has_qr = active is not None
            qr_code = active.code if active else None
            loaded_at = first.loaded_for_delivery_at

        inv_preview = await self._invoice_preview(order)
        svc = order.service_type.value if hasattr(order.service_type, "value") else str(order.service_type)
        src = order.source.value if hasattr(order.source, "value") else str(order.source)
        st = order.status.value if hasattr(order.status, "value") else str(order.status)

        return DriverOrderCard(
            id=order.id,
            order_number=order.order_number,
            tracking_code=order.tracking_code,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            pickup_address=order.pickup_address,
            house_number=order.house_number,
            latitude=str(order.latitude) if order.latitude is not None else None,
            longitude=str(order.longitude) if order.longitude is not None else None,
            carpet_description=order.carpet_description,
            carpet_count=order.carpet_count or 1,
            carpet_dimensions=order.carpet_dimensions,
            source=src,
            service_type=svc,
            service_label=SERVICE_LABELS.get(svc, svc),
            status=st,
            status_label=STATUS_LABELS.get(order.status, st),
            pickup_workflow=order.pickup_workflow,
            delivery_workflow=order.delivery_workflow,
            total=str(order.total),
            currency=order.currency,
            distance_km=str(order.distance_km) if order.distance_km else None,
            pickup_started_at=order.pickup_started_at,
            assigned_to_me=order.assigned_driver_id == user.id,
            has_qr=has_qr,
            carpet_code=carpet_code,
            carpet_type=carpet_type,
            session_code=await self._session_code(order),
            qr_code=qr_code,
            loaded_at=loaded_at,
            invoice_number=inv_preview.get("invoice_number"),
            invoice_total=inv_preview.get("invoice_total") or str(order.total),
            payment_status=inv_preview.get("payment_status", "unpaid"),
            payment_status_label=inv_preview.get("payment_status_label", "Unpaid"),
            carpets=carpet_summaries,
        )

    async def _in_driver_delivery_session(self, order: Order, user: User) -> bool:
        """US-18: only loaded, assigned, out-for-delivery orders."""
        if order.status != OrderStatus.OUT_FOR_DELIVERY:
            return False
        if order.assigned_driver_id != user.id:
            return False
        carpet_result = await self.db.execute(select(Carpet).where(Carpet.order_id == order.id))
        carpets = list(carpet_result.scalars().all())
        if not carpets:
            return False
        # True if ANY carpet is loaded onto this driver and still awaiting delivery.
        return any(
            carpet.loaded_for_driver_id == user.id
            and carpet.loaded_for_delivery_at is not None
            and carpet.delivered_at is None
            and carpet.status != CarpetStatus.DELIVERED
            for carpet in carpets
        )

    async def _validate_delivery_scan(
        self, order: Order, user: User, code: str
    ) -> Carpet:
        qr_svc = QrTrackingService(self.db)
        carpet = await qr_svc.find_carpet_by_active_code(code)
        if carpet is None:
            await qr_svc._log_scan(
                carpet_id=None,
                user_id=user.id,
                code=code.strip(),
                ip=None,
                method="delivery",
                is_valid=False,
            )
            raise ValidationError("Scan a valid, active QR code")

        if carpet.order_id != order.id:
            raise ValidationError("QR does not belong to this delivery order")

        if order.status != OrderStatus.OUT_FOR_DELIVERY:
            raise ValidationError("Order must be Out for Delivery")

        if not await self._in_driver_delivery_session(order, user):
            raise ValidationError("Carpet is not in your delivery session")

        if carpet.status not in (CarpetStatus.READY,):
            if carpet.delivered_at or carpet.status == CarpetStatus.DELIVERED:
                raise ValidationError("Carpet has already been delivered")
            raise ValidationError("Carpet is not ready for delivery")

        scan_code = normalize_qr_scan_code(code)
        if not await qr_svc.verify_scanned_active(carpet.id, scan_code):
            raise ValidationError("Scan the active QR for this carpet")

        await self._assert_not_blocked_by_repair(carpet.id)

        active_qr = await qr_svc.get_active_qr(carpet.id)
        logged_code = active_qr.code if active_qr else scan_code
        await qr_svc._log_scan(
            carpet_id=carpet.id,
            user_id=user.id,
            code=logged_code,
            ip=None,
            method="delivery",
            is_valid=True,
        )
        return carpet

    async def _assert_not_blocked_by_repair(self, carpet_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(RepairRequest.status)
            .where(RepairRequest.carpet_id == carpet_id)
            .order_by(RepairRequest.created_at.desc())
            .limit(1)
        )
        status = result.scalar_one_or_none()
        if status in REPAIR_BLOCKED:
            if status == RepairWorkflowStatus.PENDING_APPROVAL:
                raise ValidationError("Carpet has repair pending approval")
            raise ValidationError("Carpet is in repair")

    async def _invoice_preview(self, order: Order) -> dict[str, str | None]:
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.order_id == order.id, Invoice.invoice_type == InvoiceType.INVOICE)
            .order_by(Invoice.created_at.desc())
            .limit(1)
        )
        inv = result.scalar_one_or_none()
        if inv:
            ps = inv.payment_status.value if inv.payment_status else "unpaid"
            return {
                "invoice_number": inv.invoice_number,
                "invoice_total": str(inv.total),
                "payment_status": ps,
                "payment_status_label": PAYMENT_STATUS_LABELS.get(ps, ps),
            }
        return {
            "invoice_number": None,
            "invoice_total": str(order.total),
            "payment_status": "unpaid",
            "payment_status_label": "Unpaid",
        }

    async def _session_code(self, order: Order) -> str | None:
        from src.modules.sessions.application.service import SessionService

        sess = await SessionService(self.db).get_by_order(order.id)
        if sess:
            return sess.session_code
        if order.tracking_code:
            return f"SES-{order.tracking_code.replace('QC-', '')}"
        return None

    async def _get_order(self, order_id: uuid.UUID) -> Order:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found")
        return order

    def _assert_assigned(self, order: Order, user: User) -> None:
        if order.assigned_driver_id and order.assigned_driver_id != user.id:
            raise ForbiddenError("Order assigned to another driver")
