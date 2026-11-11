import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.core.qr_security import decode_and_verify, generate_signed_code, normalize_qr_scan_code
from src.modules.auth.infrastructure.models import User
from src.modules.orders.application.service import STATUS_LABELS
from src.modules.orders.infrastructure.models import Order, OrderStatus
from src.modules.qr_tracking.application.schemas import (
    CarpetDetailResponse,
    CarpetListItem,
    BulkCreatePhysicalQrRequest,
    BulkCreatePhysicalQrResponse,
    CreatePhysicalQrRequest,
    DeliveryLogItem,
    GenerateQrRequest,
    OperationLogItem,
    PaginatedCarpetsResponse,
    PaginatedPhysicalQrResponse,
    PhysicalQrTagItem,
    QrGenerateResponse,
    QrScanResponse,
    ScanLogItem,
    StatusEventItem,
    TrackingHistoryItem,
)
from src.modules.qr_tracking.infrastructure.models import (
    Carpet,
    CarpetDeliveryLog,
    CarpetOperationLog,
    CarpetStatus,
    CarpetStatusEvent,
    PhysicalQrTag,
    QrCode,
    QrScanLog,
)

ORDER_TO_CARPET_STATUS = {
    OrderStatus.PENDING_PICKUP: CarpetStatus.REGISTERED,
    OrderStatus.PICKED_UP: CarpetStatus.IN_TRANSIT,
    OrderStatus.IN_WASHING: CarpetStatus.IN_WASHING,
    OrderStatus.DRYING: CarpetStatus.DRYING,
    OrderStatus.REPAIRING: CarpetStatus.IN_WASHING,
    OrderStatus.READY_FOR_DELIVERY: CarpetStatus.READY,
    OrderStatus.OUT_FOR_DELIVERY: CarpetStatus.IN_TRANSIT,
    OrderStatus.DELIVERED: CarpetStatus.DELIVERED,
    OrderStatus.CANCELLED: CarpetStatus.REGISTERED,
}

DELIVERY_EVENT_BY_STATUS = {
    CarpetStatus.IN_TRANSIT: "in_transit",
    CarpetStatus.READY: "ready_for_pickup",
    CarpetStatus.DELIVERED: "delivered",
}


class QrTrackingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_carpet_for_order(self, order: Order, *, user: User | None = None) -> Carpet:
        result = await self.db.execute(
            select(Carpet).where(Carpet.order_id == order.id).order_by(Carpet.created_at)
        )
        carpet = result.scalars().first()
        if carpet:
            return carpet

        carpet_code = order.tracking_code.replace("#", "")
        status = ORDER_TO_CARPET_STATUS.get(order.status, CarpetStatus.REGISTERED)
        carpet = Carpet(
            order_id=order.id,
            carpet_code=carpet_code,
            description=order.carpet_description,
            status=status,
        )
        self.db.add(carpet)
        await self.db.flush()

        await self._record_status_event(
            carpet,
            from_status=None,
            to_status=status.value if hasattr(status, "value") else str(status),
            user_id=user.id if user else None,
            note="Carpet registered with order",
        )
        # Physical QR is attached later by the driver — not generated at order registration.
        return carpet

    async def generate_qr(
        self, data: GenerateQrRequest, user: User
    ) -> QrGenerateResponse:
        if not user.check_permission("qr:generate"):
            raise ForbiddenError("Missing qr:generate permission")

        carpet = await self._resolve_carpet(data)
        order = await self._get_order(carpet.order_id)
        full_code, issued_at = await self._ensure_unique_qr(carpet, user, force_new=True)

        await self._record_operation(
            carpet,
            operation="qr_generated",
            user_id=user.id,
            note="New signed QR code issued",
        )

        return QrGenerateResponse(
            carpet_id=carpet.id,
            carpet_code=carpet.carpet_code,
            qr_code=full_code,
            qr_image_svg=_minimal_qr_svg(full_code),
            issued_at=issued_at,
            order_number=order.order_number,
            tracking_code=order.tracking_code,
        )

    async def scan(
        self, code: str, user: User, ip: str | None = None, method: str = "manual"
    ) -> QrScanResponse:
        if not user.check_permission("qr:scan"):
            raise ForbiddenError("Missing qr:scan permission")

        clean = normalize_qr_scan_code(code)
        carpet: Carpet | None = None
        is_valid = False

        decoded = decode_and_verify(clean)
        if decoded:
            carpet = await self._get_carpet_by_id(decoded["carpet_id"])
            qr_result = await self.db.execute(
                select(QrCode).where(
                    QrCode.carpet_id == carpet.id,
                    QrCode.code == clean,
                    QrCode.revoked_at.is_(None),
                )
            )
            active_qr = qr_result.scalar_one_or_none()
            is_valid = active_qr is not None
        else:
            legacy_code = clean.lstrip("#")
            result = await self.db.execute(
                select(Carpet)
                .join(Order, Carpet.order_id == Order.id)
                .where(
                    or_(
                        Carpet.carpet_code == legacy_code,
                        Order.tracking_code == legacy_code,
                        Order.order_number == legacy_code,
                    )
                )
                .options(selectinload(Carpet.qr_codes))
            )
            carpet = result.scalar_one_or_none()
            is_valid = carpet is not None

        await self._log_scan(
            carpet_id=carpet.id if carpet else None,
            user_id=user.id,
            code=clean,
            ip=ip,
            method=method,
            is_valid=is_valid and carpet is not None,
        )

        if carpet and is_valid:
            await self._record_operation(
                carpet,
                operation="qr_scan",
                user_id=user.id,
                note=f"Scanned via {method}",
            )

        if not carpet or not is_valid:
            return QrScanResponse(
                valid=False,
                carpet=None,
                message="Invalid or revoked QR code. Carpet not found.",
            )

        detail = await self._carpet_detail(carpet)
        return QrScanResponse(valid=True, carpet=detail, message=None)

    async def get_carpet(self, carpet_id: uuid.UUID, user: User) -> CarpetDetailResponse:
        if not user.check_permission("qr:scan") and not user.check_permission("orders:read"):
            raise ForbiddenError("Missing permission")
        carpet = await self._get_carpet_by_id(carpet_id, with_history=True)
        return await self._carpet_detail(carpet)

    async def list_carpets(
        self,
        user: User,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
    ) -> PaginatedCarpetsResponse:
        if not user.check_permission("orders:read"):
            raise ForbiddenError("Missing orders:read permission")

        q = (
            select(Carpet, Order)
            .join(Order, Carpet.order_id == Order.id)
            .options(selectinload(Carpet.qr_codes))
        )
        count_q = select(func.count(Carpet.id))

        if search:
            term = f"%{search}%"
            filt = or_(
                Carpet.carpet_code.ilike(term),
                Order.customer_name.ilike(term),
                Order.tracking_code.ilike(term),
            )
            q = q.where(filt)
            count_q = count_q.join(Order, Carpet.order_id == Order.id).where(filt)

        total = (await self.db.execute(count_q)).scalar() or 0
        result = await self.db.execute(
            q.order_by(Carpet.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        items = []
        for carpet, order in result.all():
            active_qr = next((qr for qr in carpet.qr_codes if qr.revoked_at is None), None)
            items.append(
                CarpetListItem(
                    id=carpet.id,
                    carpet_code=carpet.carpet_code,
                    description=carpet.description,
                    status=carpet.status.value if hasattr(carpet.status, "value") else str(carpet.status),
                    order_number=order.order_number,
                    tracking_code=order.tracking_code,
                    customer_name=order.customer_name,
                    has_qr=active_qr is not None,
                    created_at=carpet.created_at,
                )
            )

        return PaginatedCarpetsResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    async def _fetch_qr_codes(self, carpet_id: uuid.UUID) -> list[QrCode]:
        result = await self.db.execute(
            select(QrCode).where(QrCode.carpet_id == carpet_id).order_by(QrCode.issued_at.desc())
        )
        return list(result.scalars().all())

    async def _ensure_unique_qr(
        self,
        carpet: Carpet,
        user: User | None,
        *,
        force_new: bool = False,
    ) -> tuple[str, datetime]:
        qr_codes = await self._fetch_qr_codes(carpet.id)
        active = next((qr for qr in qr_codes if qr.revoked_at is None), None)
        if active and not force_new:
            return active.code, active.issued_at

        now = datetime.now(timezone.utc)
        for qr in qr_codes:
            if qr.revoked_at is None:
                qr.revoked_at = now

        full_code: str | None = None
        sig_hash: str | None = None
        for _ in range(10):
            candidate_code, candidate_hash = generate_signed_code(
                carpet.id,
                carpet.carpet_code,
                nonce=secrets.token_hex(4),
            )
            dup = await self.db.execute(
                select(QrCode.id).where(QrCode.code == candidate_code).limit(1)
            )
            if dup.scalar_one_or_none() is None:
                full_code, sig_hash = candidate_code, candidate_hash
                break
        if not full_code or not sig_hash:
            raise ValidationError("Could not generate a unique QR code. Please try again.")

        issued_at = datetime.now(timezone.utc)
        qr_record = QrCode(
            carpet_id=carpet.id,
            code=full_code,
            signature_hash=sig_hash,
            issued_at=issued_at,
            issued_by_id=user.id if user else None,
        )
        self.db.add(qr_record)
        await self.db.flush()
        return full_code, issued_at

    async def get_active_qr(self, carpet_id: uuid.UUID) -> QrCode | None:
        result = await self.db.execute(
            select(QrCode)
            .where(QrCode.carpet_id == carpet_id, QrCode.revoked_at.is_(None))
            .order_by(QrCode.issued_at.desc())
        )
        return result.scalars().first()

    async def attach_physical_qr(
        self,
        carpet: Carpet,
        code: str,
        user: User,
        *,
        order: Order | None = None,
        carpet_type: str | None = None,
        dimensions: str | None = None,
    ) -> QrCode:
        """US-11: bind QR at pickup — order tracking code or pre-registered physical tag."""
        if not user.check_permission("qr:generate"):
            raise ForbiddenError("Missing qr:generate permission")

        clean = normalize_qr_scan_code(code) or code.strip()
        if len(clean) < 3:
            raise ValidationError("Invalid QR code")

        if order is None:
            order = await self._get_order(carpet.order_id)

        if self._code_matches_order(clean, carpet, order):
            return await self._attach_order_identifiers(
                carpet,
                user,
                carpet_type=carpet_type,
                dimensions=dimensions,
                note=clean[:60],
            )

        tag_result = await self.db.execute(
            select(PhysicalQrTag).where(PhysicalQrTag.code == clean)
        )
        tag = tag_result.scalar_one_or_none()
        if tag is None:
            raise ValidationError(
                "QR is not registered in the system. Ask admin to add this tag in QR Code Management."
            )
        if not tag.is_active:
            raise ValidationError("This QR tag is disabled")

        active_existing = await self.db.execute(
            select(QrCode).where(QrCode.code == clean, QrCode.revoked_at.is_(None))
        )
        existing = active_existing.scalar_one_or_none()
        if existing is not None:
            if existing.carpet_id == carpet.id:
                return await self._finalize_attach(
                    carpet, existing, user, carpet_type=carpet_type, dimensions=dimensions, note=clean[:60]
                )
            raise ValidationError("QR is not available — it is active on another carpet")

        now = datetime.now(timezone.utc)
        for qr in await self._fetch_qr_codes(carpet.id):
            if qr.revoked_at is None:
                qr.revoked_at = now

        qr_record = QrCode(
            carpet_id=carpet.id,
            code=clean,
            signature_hash=hashlib.sha256(clean.encode()).hexdigest(),
            issued_at=now,
            issued_by_id=user.id,
        )
        self.db.add(qr_record)
        tag.last_used_at = now
        return await self._finalize_attach(
            carpet, qr_record, user, carpet_type=carpet_type, dimensions=dimensions, note=clean[:60]
        )

    @staticmethod
    def _code_matches_order(clean: str, carpet: Carpet, order: Order) -> bool:
        legacy = clean.lstrip("#").strip()
        tracking = order.tracking_code.lstrip("#").strip()
        return legacy in (carpet.carpet_code, tracking, order.order_number)

    async def _find_order_by_identifier(self, clean: str) -> Order | None:
        legacy = clean.lstrip("#").strip()
        result = await self.db.execute(
            select(Order).where(
                or_(
                    Order.tracking_code == legacy,
                    Order.tracking_code == f"#{legacy}",
                    Order.order_number == legacy,
                )
            ).limit(1)
        )
        return result.scalar_one_or_none()

    async def _attach_order_identifiers(
        self,
        carpet: Carpet,
        user: User,
        *,
        carpet_type: str | None = None,
        dimensions: str | None = None,
        note: str,
    ) -> QrCode:
        await self._ensure_unique_qr(carpet, user)
        active = await self.get_active_qr(carpet.id)
        if active is None:
            raise ValidationError("Could not activate QR for this carpet")
        return await self._finalize_attach(
            carpet, active, user, carpet_type=carpet_type, dimensions=dimensions, note=note
        )

    async def _finalize_attach(
        self,
        carpet: Carpet,
        qr_record: QrCode,
        user: User,
        *,
        carpet_type: str | None = None,
        dimensions: str | None = None,
        note: str,
    ) -> QrCode:
        if carpet_type:
            carpet.carpet_type = carpet_type[:120]
        if dimensions:
            carpet.dimensions = dimensions[:50]
        await self._record_operation(
            carpet, operation="qr_attached", user_id=user.id, note=f"Physical QR attached: {note}"
        )
        await self.db.flush()
        return qr_record

    async def list_physical_qr_tags(
        self,
        user: User,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
    ) -> PaginatedPhysicalQrResponse:
        if not user.check_permission("orders:read"):
            raise ForbiddenError("Missing orders:read permission")

        q = select(PhysicalQrTag)
        count_q = select(func.count(PhysicalQrTag.id))
        if search:
            term = f"%{search}%"
            filt = or_(PhysicalQrTag.code.ilike(term), PhysicalQrTag.label.ilike(term))
            q = q.where(filt)
            count_q = count_q.where(filt)

        total = (await self.db.execute(count_q)).scalar() or 0
        # code ASC is a stable tiebreaker: a whole batch is imported with the
        # same created_at, so created_at alone makes OFFSET/LIMIT paging skip
        # or repeat rows. Ordering by the unique code keeps pages deterministic
        # and sequential (CARPET-0001 → CARPET-0500).
        result = await self.db.execute(
            q.order_by(PhysicalQrTag.created_at.desc(), PhysicalQrTag.code.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        tags = result.scalars().all()

        items: list[PhysicalQrTagItem] = []
        for tag in tags:
            in_use_result = await self.db.execute(
                select(QrCode.id).where(
                    QrCode.code == tag.code,
                    QrCode.revoked_at.is_(None),
                ).limit(1)
            )
            items.append(
                PhysicalQrTagItem(
                    id=tag.id,
                    code=tag.code,
                    label=tag.label,
                    is_active=tag.is_active,
                    in_use=in_use_result.scalar_one_or_none() is not None,
                    created_at=tag.created_at,
                    last_used_at=tag.last_used_at,
                )
            )

        return PaginatedPhysicalQrResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    async def create_physical_qr_tag(
        self, data: CreatePhysicalQrRequest, user: User
    ) -> PhysicalQrTagItem:
        if not user.check_permission("qr:generate"):
            raise ForbiddenError("Missing qr:generate permission")

        clean = normalize_qr_scan_code(data.code) or data.code.strip()
        if len(clean) < 3:
            raise ValidationError("Invalid QR code")

        dup = await self.db.execute(
            select(PhysicalQrTag.id).where(PhysicalQrTag.code == clean).limit(1)
        )
        if dup.scalar_one_or_none():
            raise ValidationError("This QR code is already registered")

        tag = PhysicalQrTag(
            code=clean,
            label=data.label,
            is_active=True,
            created_by_id=user.id,
        )
        self.db.add(tag)
        await self.db.flush()

        return PhysicalQrTagItem(
            id=tag.id,
            code=tag.code,
            label=tag.label,
            is_active=tag.is_active,
            in_use=False,
            created_at=tag.created_at,
            last_used_at=tag.last_used_at,
        )

    async def bulk_create_physical_qr_tags(
        self, data: BulkCreatePhysicalQrRequest, user: User
    ) -> BulkCreatePhysicalQrResponse:
        if not user.check_permission("qr:generate"):
            raise ForbiddenError("Missing qr:generate permission")

        seen: set[str] = set()
        duplicates: list[str] = []
        to_create: list[str] = []

        for raw in data.codes:
            clean = normalize_qr_scan_code(raw) or raw.strip()
            if len(clean) < 3:
                continue
            if clean in seen:
                duplicates.append(clean)
                continue
            seen.add(clean)
            existing = await self.db.execute(
                select(PhysicalQrTag.id).where(PhysicalQrTag.code == clean).limit(1)
            )
            if existing.scalar_one_or_none():
                duplicates.append(clean)
                continue
            to_create.append(clean)

        prefix = (data.label_prefix or "").strip()
        for i, clean in enumerate(to_create, start=1):
            label = f"{prefix} #{i}" if prefix else None
            self.db.add(
                PhysicalQrTag(
                    code=clean,
                    label=label,
                    is_active=True,
                    created_by_id=user.id,
                )
            )
        if to_create:
            await self.db.flush()

        return BulkCreatePhysicalQrResponse(
            created=len(to_create),
            skipped=len(duplicates),
            duplicates=duplicates[:50],
        )

    async def set_physical_qr_active(
        self, tag_id: uuid.UUID, is_active: bool, user: User
    ) -> PhysicalQrTagItem:
        if not user.check_permission("qr:generate"):
            raise ForbiddenError("Missing qr:generate permission")

        result = await self.db.execute(select(PhysicalQrTag).where(PhysicalQrTag.id == tag_id))
        tag = result.scalar_one_or_none()
        if not tag:
            raise NotFoundError("QR tag not found")

        tag.is_active = is_active
        await self.db.flush()

        in_use_result = await self.db.execute(
            select(QrCode.id).where(
                QrCode.code == tag.code,
                QrCode.revoked_at.is_(None),
            ).limit(1)
        )

        return PhysicalQrTagItem(
            id=tag.id,
            code=tag.code,
            label=tag.label,
            is_active=tag.is_active,
            in_use=in_use_result.scalar_one_or_none() is not None,
            created_at=tag.created_at,
            last_used_at=tag.last_used_at,
        )

    async def find_carpet_by_active_code(self, code: str) -> Carpet | None:
        """Resolve the carpet that currently has this code as an ACTIVE QR."""
        clean = normalize_qr_scan_code(code)
        if not clean:
            return None

        result = await self.db.execute(
            select(QrCode).where(QrCode.code == clean, QrCode.revoked_at.is_(None))
        )
        qr = result.scalar_one_or_none()
        if qr is not None:
            return await self._get_carpet_by_id(qr.carpet_id)

        decoded = decode_and_verify(clean)
        if decoded:
            carpet = await self._get_carpet_by_id(decoded["carpet_id"])
            if await self.get_active_qr(carpet.id) is not None:
                return carpet

        legacy = clean.lstrip("#")
        legacy_result = await self.db.execute(
            select(Carpet)
            .join(Order, Carpet.order_id == Order.id)
            .where(
                or_(
                    Carpet.carpet_code == legacy,
                    Order.tracking_code == legacy,
                    Order.order_number == legacy,
                )
            )
        )
        carpet = legacy_result.scalar_one_or_none()
        if carpet and await self.get_active_qr(carpet.id) is not None:
            return carpet
        return None

    async def explain_receive_code_failure(self, code: str) -> str:
        """Actionable message when operations receive cannot resolve a scanned code."""
        clean = normalize_qr_scan_code(code) or code.strip()
        if len(clean) < 3:
            return "Code too short. Scan the QR tag or enter tracking code (QC-2026-…)."

        tag_result = await self.db.execute(
            select(PhysicalQrTag).where(PhysicalQrTag.code == clean)
        )
        tag = tag_result.scalar_one_or_none()
        if tag is not None:
            if not tag.is_active:
                return "This QR tag is disabled. Ask admin to re-enable it in QR Code Management."
            active_qr = await self.db.execute(
                select(QrCode).where(QrCode.code == clean, QrCode.revoked_at.is_(None))
            )
            qr = active_qr.scalar_one_or_none()
            if qr is None:
                return (
                    "This tag is registered but not on a pickup yet. "
                    "The driver must attach it during pickup before operations can receive."
                )
            carpet = await self._get_carpet_by_id(qr.carpet_id)
            order = await self._get_order(carpet.order_id)
            if carpet.received_by_ops_at is not None:
                return "This carpet was already received by operations."
            if order.status != OrderStatus.PICKED_UP:
                return (
                    f"Order {order.tracking_code} is not collected yet. "
                    "Driver must confirm pickup before operations receipt."
                )
            if carpet.status != CarpetStatus.IN_TRANSIT:
                return "Carpet is not in transit. Driver pickup may be incomplete."

        order = await self._find_order_by_identifier(clean)
        if order is not None:
            carpet_result = await self.db.execute(
                select(Carpet).where(Carpet.order_id == order.id)
            )
            carpet = carpet_result.scalar_one_or_none()
            if carpet and carpet.received_by_ops_at is not None:
                return "This carpet was already received by operations."
            if order.status != OrderStatus.PICKED_UP:
                return (
                    f"Order {order.tracking_code} must be collected by the driver "
                    "before operations can receive it."
                )
            if carpet and await self.get_active_qr(carpet.id) is None:
                return (
                    "No QR attached to this order. "
                    "Driver must attach a physical tag at pickup first."
                )

        return (
            "Carpet not found. Scan the active QR tag on the carpet "
            "or enter the order tracking code (QC-2026-…)."
        )

    async def verify_scanned_active(self, carpet_id: uuid.UUID, code: str) -> bool:
        """US-12: confirm a scanned code matches an ACTIVE QR on the carpet."""
        clean = normalize_qr_scan_code(code)
        if not clean:
            return False

        result = await self.db.execute(
            select(QrCode.id).where(
                QrCode.carpet_id == carpet_id,
                QrCode.code == clean,
                QrCode.revoked_at.is_(None),
            )
        )
        if result.scalar_one_or_none() is not None:
            return True

        active = await self.get_active_qr(carpet_id)
        if active is None:
            return False

        carpet = await self._get_carpet_by_id(carpet_id)
        order = await self._get_order(carpet.order_id)
        legacy = clean.lstrip("#")
        return legacy in (carpet.carpet_code, order.tracking_code, order.order_number)

    async def _carpet_detail(self, carpet: Carpet) -> CarpetDetailResponse:
        order = await self._get_order(carpet.order_id)
        qr_codes = await self._fetch_qr_codes(carpet.id)
        active_qr = next((qr for qr in qr_codes if qr.revoked_at is None), None)

        scan_result = await self.db.execute(
            select(QrScanLog)
            .where(QrScanLog.carpet_id == carpet.id)
            .order_by(QrScanLog.created_at.desc())
            .limit(50)
        )
        scans = scan_result.scalars().all()

        status_result = await self.db.execute(
            select(CarpetStatusEvent)
            .where(CarpetStatusEvent.carpet_id == carpet.id)
            .order_by(CarpetStatusEvent.created_at.desc())
            .limit(50)
        )
        status_events = status_result.scalars().all()

        delivery_result = await self.db.execute(
            select(CarpetDeliveryLog)
            .where(CarpetDeliveryLog.carpet_id == carpet.id)
            .order_by(CarpetDeliveryLog.created_at.desc())
            .limit(50)
        )
        deliveries = delivery_result.scalars().all()

        op_result = await self.db.execute(
            select(CarpetOperationLog)
            .where(CarpetOperationLog.carpet_id == carpet.id)
            .order_by(CarpetOperationLog.created_at.desc())
            .limit(50)
        )
        operations = op_result.scalars().all()

        user_ids = set()
        for s in scans:
            if s.scanned_by_id:
                user_ids.add(s.scanned_by_id)
        for e in status_events:
            if e.changed_by_id:
                user_ids.add(e.changed_by_id)
        for d in deliveries:
            if d.performed_by_id:
                user_ids.add(d.performed_by_id)
        for o in operations:
            if o.performed_by_id:
                user_ids.add(o.performed_by_id)

        names: dict[uuid.UUID, str] = {}
        if user_ids:
            users_result = await self.db.execute(select(User).where(User.id.in_(user_ids)))
            for u in users_result.scalars().all():
                names[u.id] = u.full_name

        scan_items = [
            ScanLogItem(
                id=s.id,
                scan_method=s.scan_method,
                is_valid=s.is_valid,
                note=s.note,
                scanned_by_name=names.get(s.scanned_by_id) if s.scanned_by_id else None,
                created_at=s.created_at,
            )
            for s in scans
        ]
        status_items = [
            StatusEventItem(
                id=e.id,
                from_status=e.from_status,
                to_status=e.to_status,
                changed_by_name=names.get(e.changed_by_id) if e.changed_by_id else None,
                note=e.note,
                created_at=e.created_at,
            )
            for e in status_events
        ]
        delivery_items = [
            DeliveryLogItem(
                id=d.id,
                event_type=d.event_type,
                location=d.location,
                driver_name=d.driver_name,
                note=d.note,
                performed_by_name=names.get(d.performed_by_id) if d.performed_by_id else None,
                created_at=d.created_at,
            )
            for d in deliveries
        ]
        operation_items = [
            OperationLogItem(
                id=o.id,
                operation=o.operation,
                note=o.note,
                performed_by_name=names.get(o.performed_by_id) if o.performed_by_id else None,
                created_at=o.created_at,
            )
            for o in operations
        ]

        tracking_history = _build_tracking_history(
            scan_items, status_items, delivery_items, operation_items
        )

        last_valid = next((s for s in scans if s.is_valid), None)
        status_val = carpet.status.value if hasattr(carpet.status, "value") else str(carpet.status)

        return CarpetDetailResponse(
            id=carpet.id,
            carpet_code=carpet.carpet_code,
            description=carpet.description,
            dimensions=carpet.dimensions,
            status=status_val,
            location_note=carpet.location_note,
            order_id=order.id,
            order_number=order.order_number,
            tracking_code=order.tracking_code,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            order_status=order.status.value,
            order_status_label=STATUS_LABELS.get(order.status, order.status.value),
            service_type=order.service_type.value,
            total=str(order.total),
            currency=order.currency,
            qr_code=active_qr.code if active_qr else None,
            qr_issued_at=active_qr.issued_at if active_qr else None,
            last_scanned_at=last_valid.created_at if last_valid else None,
            created_at=carpet.created_at,
            scan_logs=scan_items,
            status_timeline=status_items,
            delivery_logs=delivery_items,
            operation_logs=operation_items,
            tracking_history=tracking_history,
        )

    async def _record_status_event(
        self,
        carpet: Carpet,
        *,
        from_status: str | None,
        to_status: str,
        user_id: uuid.UUID | None,
        note: str | None = None,
    ) -> None:
        self.db.add(
            CarpetStatusEvent(
                carpet_id=carpet.id,
                from_status=from_status,
                to_status=to_status,
                changed_by_id=user_id,
                note=note,
            )
        )
        event_type = None
        try:
            event_type = DELIVERY_EVENT_BY_STATUS.get(CarpetStatus(to_status))
        except ValueError:
            pass
        if event_type:
            await self._record_delivery(
                carpet,
                event_type=event_type,
                user_id=user_id,
                note=note,
            )

    async def _record_delivery(
        self,
        carpet: Carpet,
        *,
        event_type: str,
        user_id: uuid.UUID | None,
        location: str | None = None,
        driver_name: str | None = None,
        note: str | None = None,
    ) -> None:
        self.db.add(
            CarpetDeliveryLog(
                carpet_id=carpet.id,
                event_type=event_type,
                location=location or carpet.location_note,
                driver_name=driver_name,
                note=note,
                performed_by_id=user_id,
            )
        )

    async def _record_operation(
        self,
        carpet: Carpet,
        *,
        operation: str,
        user_id: uuid.UUID | None,
        note: str | None = None,
    ) -> None:
        self.db.add(
            CarpetOperationLog(
                carpet_id=carpet.id,
                operation=operation,
                note=note,
                performed_by_id=user_id,
            )
        )

    async def _resolve_carpet(self, data: GenerateQrRequest) -> Carpet:
        if data.carpet_id:
            return await self._get_carpet_by_id(data.carpet_id)
        if data.order_id:
            order = await self._get_order(data.order_id)
            return await self.ensure_carpet_for_order(order)
        raise ValidationError("order_id or carpet_id required")

    async def _get_carpet_by_id(self, carpet_id: uuid.UUID, with_history: bool = False) -> Carpet:
        opts = [selectinload(Carpet.qr_codes)]
        result = await self.db.execute(
            select(Carpet).where(Carpet.id == carpet_id).options(*opts)
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

    async def _log_scan(
        self,
        *,
        carpet_id: uuid.UUID | None,
        user_id: uuid.UUID,
        code: str,
        ip: str | None,
        method: str,
        is_valid: bool,
    ) -> None:
        if carpet_id is None:
            return
        self.db.add(
            QrScanLog(
                carpet_id=carpet_id,
                scanned_by_id=user_id,
                scan_method=method,
                code_presented=code[:512],
                ip_address=ip,
                is_valid=is_valid,
            )
        )


def _build_tracking_history(
    scans: list[ScanLogItem],
    status_events: list[StatusEventItem],
    deliveries: list[DeliveryLogItem],
    operations: list[OperationLogItem],
) -> list[TrackingHistoryItem]:
    items: list[TrackingHistoryItem] = []

    for s in scans:
        items.append(
            TrackingHistoryItem(
                event_type="scan",
                title="QR Scan" if s.is_valid else "Invalid Scan Attempt",
                description=s.note,
                actor_name=s.scanned_by_name,
                created_at=s.created_at,
            )
        )
    for e in status_events:
        label = e.to_status.replace("_", " ").title()
        desc = f"{e.from_status or 'new'} → {e.to_status}" if e.from_status else label
        items.append(
            TrackingHistoryItem(
                event_type="status",
                title=f"Status: {label}",
                description=e.note or desc,
                actor_name=e.changed_by_name,
                created_at=e.created_at,
            )
        )
    for d in deliveries:
        items.append(
            TrackingHistoryItem(
                event_type="delivery",
                title=d.event_type.replace("_", " ").title(),
                description=d.note or d.location,
                actor_name=d.performed_by_name or d.driver_name,
                created_at=d.created_at,
            )
        )
    for o in operations:
        items.append(
            TrackingHistoryItem(
                event_type="operation",
                title=o.operation.replace("_", " ").title(),
                description=o.note,
                actor_name=o.performed_by_name,
                created_at=o.created_at,
            )
        )

    items.sort(key=lambda x: x.created_at, reverse=True)
    return items[:100]


def _minimal_qr_svg(data: str) -> str:
    safe = data[:40].replace("&", "&amp;").replace("<", "&lt;")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">'
        f'<rect width="200" height="200" fill="white"/>'
        f'<text x="100" y="100" text-anchor="middle" font-size="8" fill="#0F172A">{safe}…</text>'
        f"</svg>"
    )
