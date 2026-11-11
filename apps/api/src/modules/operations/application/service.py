import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.modules.auth.infrastructure.models import Role, User, UserRole
from src.modules.operations.application.schemas import (
    DriverOption,
    OperationCarpetDetail,
    OperationCarpetItem,
    OperationsQueueResponse,
    RecordStepRequest,
    ReceiveCarpetRequest,
    LoadForDeliveryRequest,
    ScanOperationRequest,
)
from src.modules.orders.application.service import OrderService, STATUS_LABELS
from src.modules.orders.infrastructure.models import Order, OrderStatus
from src.modules.qr_tracking.application.service import QrTrackingService
from src.modules.qr_tracking.infrastructure.models import Carpet, CarpetOperationLog, CarpetStatus
from src.modules.repair.infrastructure.models import RepairRequest, RepairWorkflowStatus

CARPET_STATUS_LABELS = {
    "registered": "Registered",
    "in_transit": "Collected",
    "received_by_operation": "Received By Operation",
    "in_washing": "In Operation",
    "drying": "In Operation",
    "ready": "Ready For Delivery",
    "delivered": "Delivered",
}

SERVICE_LABELS = {
    "standard": "Standard Wash",
    "premium": "Premium Specialist Wash",
    "antique": "Antique Carpet Wash",
}

STEP_TO_CARPET_STATUS = {
    "washing": CarpetStatus.IN_WASHING,
    "drying": CarpetStatus.DRYING,
}

STEP_TO_ORDER_STATUS = {
    "washing": OrderStatus.IN_WASHING,
    "drying": OrderStatus.DRYING,
}

REPAIR_BLOCKED_STATUSES = {
    RepairWorkflowStatus.PENDING_APPROVAL,
    RepairWorkflowStatus.IN_REPAIR,
}


class OperationsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _require_ops(self, user: User) -> None:
        if not user.check_permission("operations:read"):
            raise ForbiddenError("Operations access required")

    def _require_ops_update(self, user: User) -> None:
        if not user.check_permission("operations:update"):
            raise ForbiddenError("Missing operations:update")

    async def queue(self, user: User) -> OperationsQueueResponse:
        self._require_ops(user)
        result = await self.db.execute(
            select(Carpet, Order)
            .join(Order, Carpet.order_id == Order.id)
            .where(
                Carpet.status.in_(
                    [
                        CarpetStatus.RECEIVED_BY_OPERATION,
                        CarpetStatus.IN_WASHING,
                        CarpetStatus.DRYING,
                        CarpetStatus.READY,
                    ]
                ),
                # US-17A: loaded carpets leave the ops queue (driver owns delivery now).
                Carpet.loaded_for_delivery_at.is_(None),
            )
            .options(selectinload(Carpet.qr_codes))
            .order_by(Carpet.updated_at.desc())
        )

        received: list[OperationCarpetItem] = []
        in_operation: list[OperationCarpetItem] = []
        ready: list[OperationCarpetItem] = []

        for carpet, order in result.all():
            item = await self._build_item(carpet, order)
            if carpet.status == CarpetStatus.READY:
                ready.append(item)
            elif carpet.status in (CarpetStatus.IN_WASHING, CarpetStatus.DRYING):
                in_operation.append(item)
            elif carpet.status == CarpetStatus.RECEIVED_BY_OPERATION:
                received.append(item)

        return OperationsQueueResponse(
            received=received,
            in_operation=in_operation,
            drying=[],
            ready=ready,
        )

    async def list_drivers(self, user: User) -> list[DriverOption]:
        self._require_ops(user)
        result = await self.db.execute(
            select(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.slug == "driver", User.is_active.is_(True))
            .order_by(User.full_name)
        )
        return [
            DriverOption(id=u.id, full_name=u.full_name, phone=u.phone)
            for u in result.scalars().unique().all()
        ]

    async def receive_from_driver(
        self, data: ReceiveCarpetRequest, user: User
    ) -> OperationCarpetDetail:
        """US-13: operator scans the carpet QR to accept it into operations."""
        self._require_ops_update(user)
        qr_svc = QrTrackingService(self.db)
        carpet = await qr_svc.find_carpet_by_active_code(data.code)
        if carpet is None:
            carpet = await self._find_carpet_by_identifier(data.code)
        if carpet is None:
            await qr_svc._log_scan(
                carpet_id=None,
                user_id=user.id,
                code=data.code.strip(),
                ip=None,
                method="operations_receive",
                is_valid=False,
            )
            raise ValidationError(await qr_svc.explain_receive_code_failure(data.code))

        order = await self._get_order(carpet.order_id)

        from src.modules.sessions.application.service import SessionService

        sess_svc = SessionService(self.db)
        session = await sess_svc.get_by_order(order.id)
        if session is None:
            await sess_svc.create_for_order(order)

        if order.status != OrderStatus.PICKED_UP:
            raise ValidationError("Carpet must be in Collected status to be received")
        if carpet.status != CarpetStatus.IN_TRANSIT:
            raise ValidationError("Carpet must be in Collected status to be received")

        if carpet.received_by_ops_at is not None or carpet.status in (
            CarpetStatus.RECEIVED_BY_OPERATION,
            CarpetStatus.IN_WASHING,
            CarpetStatus.DRYING,
            CarpetStatus.READY,
            CarpetStatus.DELIVERED,
        ):
            raise ValidationError("This QR has already been received by operations")

        now = datetime.now(timezone.utc)
        old_status = carpet.status.value
        carpet.status = CarpetStatus.RECEIVED_BY_OPERATION
        carpet.received_by_ops_at = now
        carpet.received_by_ops_user_id = user.id

        await qr_svc._log_scan(
            carpet_id=carpet.id,
            user_id=user.id,
            code=data.code.strip(),
            ip=None,
            method="operations_receive",
            is_valid=True,
        )
        await qr_svc._record_status_event(
            carpet,
            from_status=old_status,
            to_status="received_by_operation",
            user_id=user.id,
            note="Received by operation",
        )
        await qr_svc._record_delivery(
            carpet,
            event_type="received_by_operation",
            user_id=user.id,
            driver_name=None,
            note="Handed from driver to operations",
        )
        await qr_svc._record_operation(
            carpet,
            operation="received_by_operation",
            user_id=user.id,
            note="Operator confirmed receipt",
        )
        await self.db.flush()
        return await self.detail(carpet.id, user)

    async def start_operation(
        self, data: ScanOperationRequest, user: User
    ) -> OperationCarpetDetail:
        """US-15: scan QR to start wash operation (must be Received By Operation)."""
        self._require_ops_update(user)
        qr_svc = QrTrackingService(self.db)
        carpet = await self._resolve_active_carpet(qr_svc, data.code, user, "operations_start")
        order = await self._get_order(carpet.order_id)

        if carpet.status in (CarpetStatus.IN_WASHING, CarpetStatus.DRYING):
            return await self.detail(carpet.id, user)

        if carpet.status == CarpetStatus.READY:
            raise ValidationError(
                f"{order.tracking_code} is already Ready For Delivery — use Load for delivery below."
            )
        if carpet.status == CarpetStatus.IN_TRANSIT:
            raise ValidationError(
                f"{order.tracking_code} must be received from driver first (scan in Receive panel)."
            )
        if carpet.status != CarpetStatus.RECEIVED_BY_OPERATION:
            raise ValidationError(
                f"{order.tracking_code} cannot start operation from status: "
                f"{CARPET_STATUS_LABELS.get(carpet.status.value, carpet.status.value)}"
            )

        await self._assert_not_blocked_by_repair(carpet.id)

        now = datetime.now(timezone.utc)
        old_status = carpet.status.value
        carpet.status = CarpetStatus.IN_WASHING
        carpet.operation_started_at = now
        carpet.operation_started_by_user_id = user.id

        await qr_svc._record_status_event(
            carpet,
            from_status=old_status,
            to_status="in_washing",
            user_id=user.id,
            note="Operation started (QR scanned)",
        )
        await qr_svc._record_operation(
            carpet,
            operation="operation_started",
            user_id=user.id,
            note="Wash operation started",
        )
        await OrderService(self.db)._change_status(
            order, OrderStatus.IN_WASHING, user.id, note="Wash operation started"
        )
        from src.modules.sessions.application.service import SessionService

        await SessionService(self.db).sync_status_for_order(order)
        await self.db.flush()
        return await self.detail(carpet.id, user)

    async def scan(self, data: ScanOperationRequest, user: User) -> OperationCarpetDetail:
        """Backward-compatible alias for US-15 start operation."""
        return await self.start_operation(data, user)

    async def record_step(
        self, carpet_id: uuid.UUID, data: RecordStepRequest, user: User
    ) -> OperationCarpetDetail:
        """US-16: record washing / drying / packaging steps."""
        self._require_ops_update(user)
        carpet = await self._get_carpet(carpet_id)
        order = await self._get_order(carpet.order_id)
        qr_svc = QrTrackingService(self.db)

        await self._assert_not_blocked_by_repair(carpet.id)

        if data.step == "washing":
            if carpet.status != CarpetStatus.IN_WASHING:
                raise ValidationError("Washing step requires carpet to be In Operation")
        elif data.step == "drying":
            if carpet.status != CarpetStatus.IN_WASHING:
                raise ValidationError("Drying step requires carpet to be In Operation (washing)")
            if not await self._has_operation_log(carpet.id, "washing"):
                raise ValidationError("Record the washing step before drying")
        elif data.step == "packaging":
            if carpet.status != CarpetStatus.DRYING:
                raise ValidationError("Packaging step requires carpet to be in drying")
            if not await self._has_operation_log(carpet.id, "drying"):
                raise ValidationError("Record the drying step before packaging")

        old = carpet.status.value
        new_carpet_status = STEP_TO_CARPET_STATUS.get(data.step)
        if new_carpet_status and new_carpet_status != carpet.status:
            carpet.status = new_carpet_status
            await qr_svc._record_status_event(
                carpet,
                from_status=old,
                to_status=new_carpet_status.value,
                user_id=user.id,
                note=data.note or f"Step: {data.step}",
            )

        await qr_svc._record_operation(
            carpet,
            operation=data.step,
            user_id=user.id,
            note=data.note or f"Operations step: {data.step}",
        )

        new_order_status = STEP_TO_ORDER_STATUS.get(data.step)
        if new_order_status and order.status != new_order_status:
            await OrderService(self.db)._change_status(
                order, new_order_status, user.id, note=f"Operations: {data.step}"
            )
            from src.modules.sessions.application.service import SessionService

            await SessionService(self.db).sync_status_for_order(order)

        await self.db.flush()
        return await self.detail(carpet_id, user)

    async def complete(self, carpet_id: uuid.UUID, user: User) -> OperationCarpetDetail:
        """US-17: mark carpet ready for delivery after wash pipeline."""
        self._require_ops_update(user)
        carpet = await self._get_carpet(carpet_id)
        order = await self._get_order(carpet.order_id)
        qr_svc = QrTrackingService(self.db)

        await self._assert_not_blocked_by_repair(carpet.id)

        if carpet.status not in (CarpetStatus.IN_WASHING, CarpetStatus.DRYING):
            if carpet.status == CarpetStatus.RECEIVED_BY_OPERATION:
                raise ValidationError("Start operation first — scan in the Start operation panel.")
            raise ValidationError("Carpet must be In Operation to mark ready")

        if carpet.operation_completed_at is not None or carpet.status == CarpetStatus.READY:
            raise ValidationError("Operation already completed for this carpet")

        now = datetime.now(timezone.utc)
        old = carpet.status.value
        carpet.status = CarpetStatus.READY
        carpet.operation_completed_at = now
        carpet.operation_completed_by_user_id = user.id

        await qr_svc._record_status_event(
            carpet,
            from_status=old,
            to_status="ready",
            user_id=user.id,
            note="Ready for delivery",
        )
        await qr_svc._record_operation(
            carpet,
            operation="operation_complete",
            user_id=user.id,
            note="Wash operation complete — ready for delivery",
        )
        await OrderService(self.db)._change_status(
            order, OrderStatus.READY_FOR_DELIVERY, user.id, note="Ready for delivery"
        )
        if order.delivery_workflow is None:
            order.delivery_workflow = "pending"

        from src.modules.sessions.application.service import SessionService

        await SessionService(self.db).sync_status_for_order(order)
        await self.db.flush()
        return await self.detail(carpet_id, user)

    async def load_for_delivery(
        self, data: LoadForDeliveryRequest, user: User
    ) -> OperationCarpetDetail:
        """US-17A: scan QR when loading carpet onto driver vehicle."""
        self._require_ops_update(user)
        qr_svc = QrTrackingService(self.db)
        carpet = await self._resolve_active_carpet(
            qr_svc, data.code, user, "operations_load"
        )
        order = await self._get_order(carpet.order_id)

        driver = await self._get_driver(data.driver_id)

        await self._assert_not_blocked_by_repair(carpet.id)

        if carpet.status != CarpetStatus.READY:
            if carpet.status in (
                CarpetStatus.RECEIVED_BY_OPERATION,
                CarpetStatus.IN_WASHING,
                CarpetStatus.DRYING,
            ):
                raise ValidationError(
                    f"{order.tracking_code} is still In Operation — mark Ready For Delivery in the queue first."
                )
            raise ValidationError(
                f"{order.tracking_code} must be Ready For Delivery to load (current: "
                f"{CARPET_STATUS_LABELS.get(carpet.status.value, carpet.status.value)})."
            )
        if order.status != OrderStatus.READY_FOR_DELIVERY:
            raise ValidationError("Order must be Ready for Delivery to load")
        if carpet.loaded_for_delivery_at is not None:
            raise ValidationError("Carpet has already been loaded for delivery")
        if order.status == OrderStatus.DELIVERED or carpet.status == CarpetStatus.DELIVERED:
            raise ValidationError("Carpet has already been delivered")

        now = datetime.now(timezone.utc)
        carpet.loaded_for_delivery_at = now
        carpet.loaded_for_delivery_by_user_id = user.id
        carpet.loaded_for_driver_id = driver.id

        order.assigned_driver_id = driver.id
        order.delivery_workflow = "loaded"
        await OrderService(self.db)._change_status(
            order,
            OrderStatus.OUT_FOR_DELIVERY,
            user.id,
            note=f"Loaded for delivery — driver {driver.full_name}",
        )

        await qr_svc._record_delivery(
            carpet,
            event_type="loaded_for_delivery",
            user_id=user.id,
            driver_name=driver.full_name,
            note="Loaded onto driver vehicle (QR scanned)",
        )
        await qr_svc._record_operation(
            carpet,
            operation="loaded_for_delivery",
            user_id=user.id,
            note=f"Assigned to driver {driver.full_name}",
        )

        from src.modules.sessions.application.service import SessionService

        await SessionService(self.db).sync_status_for_order(order)
        await self.db.flush()
        return await self.detail(carpet.id, user)

    async def detail(self, carpet_id: uuid.UUID, user: User) -> OperationCarpetDetail:
        self._require_ops(user)
        carpet = await self._get_carpet(carpet_id)
        order = await self._get_order(carpet.order_id)
        qr_detail = await QrTrackingService(self.db).get_carpet(carpet_id, user)
        item = await self._build_item(carpet, order)
        data = item.model_dump()
        data["qr_code"] = qr_detail.qr_code or item.qr_code
        return OperationCarpetDetail(
            **data,
            operation_logs=[o.model_dump() for o in qr_detail.operation_logs],
            status_timeline=[s.model_dump() for s in qr_detail.status_timeline],
        )

    async def _resolve_active_carpet(
        self, qr_svc: QrTrackingService, code: str, user: User, method: str
    ) -> Carpet:
        carpet = await qr_svc.find_carpet_by_active_code(code)
        if carpet is None:
            carpet = await self._find_carpet_by_identifier(code)
        if carpet is None:
            await qr_svc._log_scan(
                carpet_id=None,
                user_id=user.id,
                code=code.strip(),
                ip=None,
                method=method,
                is_valid=False,
            )
            raise ValidationError(
                "Carpet not found. Scan the QR tag or enter tracking code (e.g. QC-2026-…)."
            )
        await qr_svc._log_scan(
            carpet_id=carpet.id,
            user_id=user.id,
            code=code.strip(),
            ip=None,
            method=method,
            is_valid=True,
        )
        return carpet

    async def _find_carpet_by_identifier(self, code: str) -> Carpet | None:
        from src.core.qr_security import normalize_qr_scan_code

        clean = normalize_qr_scan_code(code) or code.strip()
        legacy = clean.lstrip("#").strip()
        if len(legacy) < 3:
            return None
        result = await self.db.execute(
            select(Carpet)
            .join(Order, Carpet.order_id == Order.id)
            .where(
                (Carpet.carpet_code == legacy)
                | (Order.tracking_code == legacy)
                | (Order.tracking_code == f"#{legacy}")
                | (Order.order_number == legacy)
            )
            .options(selectinload(Carpet.qr_codes))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _has_operation_log(self, carpet_id: uuid.UUID, operation: str) -> bool:
        result = await self.db.execute(
            select(CarpetOperationLog.id)
            .where(CarpetOperationLog.carpet_id == carpet_id, CarpetOperationLog.operation == operation)
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _assert_not_blocked_by_repair(self, carpet_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(RepairRequest.status)
            .where(RepairRequest.carpet_id == carpet_id)
            .order_by(RepairRequest.created_at.desc())
            .limit(1)
        )
        status = result.scalar_one_or_none()
        if status in REPAIR_BLOCKED_STATUSES:
            label = status.value if hasattr(status, "value") else str(status)
            if status == RepairWorkflowStatus.PENDING_APPROVAL:
                raise ValidationError("Carpet has repair pending approval")
            raise ValidationError("Carpet is in repair")

    async def _get_driver(self, driver_id: uuid.UUID) -> User:
        result = await self.db.execute(
            select(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(User.id == driver_id, Role.slug == "driver", User.is_active.is_(True))
        )
        driver = result.scalar_one_or_none()
        if not driver:
            raise ValidationError("Invalid driver — select an active driver")
        return driver

    async def _build_item(self, carpet: Carpet, order: Order) -> OperationCarpetItem:
        st = carpet.status.value if hasattr(carpet.status, "value") else str(carpet.status)
        svc = order.service_type.value if hasattr(order.service_type, "value") else str(order.service_type)
        current_step = None
        if st == "in_washing":
            current_step = "washing"
        elif st == "drying":
            current_step = "drying"
        elif st == "ready":
            current_step = "packaging"

        active_qr = next((q for q in carpet.qr_codes if q.revoked_at is None), None)
        display_qr = order.tracking_code
        if active_qr and len(active_qr.code) <= 40:
            display_qr = active_qr.code

        repair_result = await self.db.execute(
            select(RepairRequest.id, RepairRequest.status)
            .where(RepairRequest.carpet_id == carpet.id)
            .order_by(RepairRequest.created_at.desc())
            .limit(1)
        )
        repair_row = repair_result.first()
        repair_id = repair_row[0] if repair_row else None
        repair_status_val = repair_row[1] if repair_row else None
        repair_status = (
            repair_status_val.value if hasattr(repair_status_val, "value") else repair_status_val
        )

        loaded_driver_name: str | None = None
        if carpet.loaded_for_driver_id:
            driver = await self.db.get(User, carpet.loaded_for_driver_id)
            if driver:
                loaded_driver_name = driver.full_name

        return OperationCarpetItem(
            id=carpet.id,
            carpet_code=carpet.carpet_code,
            description=carpet.description,
            carpet_type=carpet.carpet_type,
            dimensions=carpet.dimensions,
            status=st,
            status_label=CARPET_STATUS_LABELS.get(st, STATUS_LABELS.get(order.status, st)),
            order_id=order.id,
            order_number=order.order_number,
            tracking_code=order.tracking_code,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            service_type=svc,
            service_label=SERVICE_LABELS.get(svc, svc),
            current_step=current_step,
            received_at=carpet.received_by_ops_at or carpet.updated_at,
            qr_code=display_qr,
            repair_status=repair_status,
            repair_id=repair_id,
            operation_started_at=carpet.operation_started_at,
            operation_completed_at=carpet.operation_completed_at,
            loaded_for_delivery_at=carpet.loaded_for_delivery_at,
            loaded_for_driver_id=carpet.loaded_for_driver_id,
            loaded_for_driver_name=loaded_driver_name,
        )

    async def _get_carpet(self, carpet_id: uuid.UUID) -> Carpet:
        result = await self.db.execute(
            select(Carpet).where(Carpet.id == carpet_id).options(selectinload(Carpet.qr_codes))
        )
        carpet = result.scalar_one_or_none()
        if not carpet:
            raise NotFoundError("Carpet not found")
        return carpet

    async def _get_order(self, order_id: uuid.UUID) -> Order:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found")
        return order
