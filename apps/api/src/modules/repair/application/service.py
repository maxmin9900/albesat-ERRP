import uuid
from datetime import datetime, timezone
import base64

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.modules.auth.infrastructure.models import User
from src.modules.orders.infrastructure.models import Order, OrderStatus
from src.modules.qr_tracking.application.service import QrTrackingService
from src.modules.qr_tracking.infrastructure.models import Carpet, CarpetStatus, QrCode
from src.modules.repair.application.schemas import (
    CustomerContactUpdate,
    DriverFlagRepairRequest,
    OperationsFlagRepairRequest,
    RepairAssessmentUpdate,
    RepairListResponse,
    RepairPhotoInput,
    RepairPhotoResponse,
    RepairRequestCreate,
    RepairRequestResponse,
    RepairWorkUpdate,
)
from src.modules.repair.infrastructure.models import (
    RepairRequest,
    RepairRequestPhoto,
    RepairWorkflowStatus,
)
from src.modules.sessions.infrastructure.models import ServiceSession

TERMINAL_STATUSES = {
    RepairWorkflowStatus.REPAIR_COMPLETED,
    RepairWorkflowStatus.REPAIR_CANCELLED,
    RepairWorkflowStatus.CUSTOMER_REJECTED,
}

# When a repair is cancelled/rejected, restore order status based on where the
# carpet physically is. Without this, operations cannot receive a carpet that was
# flagged by the driver at pickup (receive_from_driver requires PICKED_UP).
_CARPET_TO_ORDER_STATUS: dict[CarpetStatus, OrderStatus] = {
    CarpetStatus.IN_TRANSIT: OrderStatus.PICKED_UP,
    CarpetStatus.RECEIVED_BY_OPERATION: OrderStatus.PICKED_UP,
    CarpetStatus.IN_WASHING: OrderStatus.IN_WASHING,
    CarpetStatus.DRYING: OrderStatus.DRYING,
    CarpetStatus.READY: OrderStatus.READY_FOR_DELIVERY,
}


class RepairService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _require(self, user: User, perm: str) -> None:
        if not user.check_permission(perm):
            raise ForbiddenError(f"Missing {perm}")

    async def _active_qr_code(self, carpet_id: uuid.UUID) -> str | None:
        result = await self.db.execute(
            select(QrCode.code)
            .where(QrCode.carpet_id == carpet_id, QrCode.revoked_at.is_(None))
            .order_by(QrCode.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _load_photos(self, repair_id: uuid.UUID) -> list[RepairPhotoResponse]:
        result = await self.db.execute(
            select(RepairRequestPhoto)
            .where(RepairRequestPhoto.repair_request_id == repair_id)
            .order_by(RepairRequestPhoto.created_at.asc())
        )
        return [
            RepairPhotoResponse(
                id=p.id,
                caption=p.caption,
                created_at=p.created_at,
                view_url=f"/api/v1/repairs/photos/{p.id}/view",
                data_url=p.photo_data,
            )
            for p in result.scalars().all()
        ]

    async def _to_response(
        self,
        rr: RepairRequest,
        order: Order,
        carpet: Carpet,
        session_code: str | None,
        contacted_name: str | None,
    ) -> RepairRequestResponse:
        qr_code = await self._active_qr_code(carpet.id)
        return RepairRequestResponse(
            id=rr.id,
            order_id=rr.order_id,
            carpet_id=rr.carpet_id,
            service_session_id=rr.service_session_id,
            status=rr.status.value,
            flagged_source=rr.flagged_source,
            damage_type=rr.damage_type,
            damage_description=rr.damage_description,
            repair_type=rr.repair_type,
            quoted_price=rr.quoted_price,
            repair_deadline=rr.repair_deadline,
            assessment_notes=rr.assessment_notes,
            assessed_at=rr.assessed_at,
            completion_notes=rr.completion_notes,
            repair_started_at=rr.repair_started_at,
            repair_completed_at=rr.repair_completed_at,
            customer_contact_notes=rr.customer_contact_notes,
            contacted_at=rr.contacted_at,
            contacted_by_name=contacted_name,
            admin_approved_at=rr.admin_approved_at,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            customer_address=order.pickup_address,
            tracking_code=order.tracking_code,
            carpet_code=carpet.carpet_code,
            qr_code=qr_code,
            carpet_description=carpet.description,
            carpet_dimensions=carpet.dimensions,
            session_code=session_code,
            photos=await self._load_photos(rr.id),
            created_at=rr.created_at,
        )

    async def _load_context(
        self, repair_id: uuid.UUID
    ) -> tuple[RepairRequest, Order, Carpet, str | None, str | None]:
        result = await self.db.execute(
            select(RepairRequest).where(RepairRequest.id == repair_id)
        )
        rr = result.scalar_one_or_none()
        if not rr:
            raise NotFoundError("Repair request not found")
        order_result = await self.db.execute(select(Order).where(Order.id == rr.order_id))
        order = order_result.scalar_one()
        carpet_result = await self.db.execute(select(Carpet).where(Carpet.id == rr.carpet_id))
        carpet = carpet_result.scalar_one()
        session_code = None
        if rr.service_session_id:
            sess = await self.db.execute(
                select(ServiceSession.session_code).where(ServiceSession.id == rr.service_session_id)
            )
            session_code = sess.scalar_one_or_none()
        contacted_name = None
        if rr.contacted_by_user_id:
            u = await self.db.execute(select(User.full_name).where(User.id == rr.contacted_by_user_id))
            contacted_name = u.scalar_one_or_none()
        return rr, order, carpet, session_code, contacted_name

    async def _assert_no_active_repair(self, carpet_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(RepairRequest.id).where(
                RepairRequest.carpet_id == carpet_id,
                RepairRequest.status.notin_(list(TERMINAL_STATUSES)),
            )
        )
        if result.scalar_one_or_none():
            raise ValidationError("An active repair request already exists for this carpet")

    async def _attach_photos(
        self,
        repair_id: uuid.UUID,
        photos: list[RepairPhotoInput],
        user_id: uuid.UUID | None,
    ) -> None:
        for photo in photos:
            self.db.add(
                RepairRequestPhoto(
                    repair_request_id=repair_id,
                    photo_data=photo.data_url,
                    caption=photo.caption,
                    uploaded_by_id=user_id,
                )
            )

    async def _create_repair_core(
        self,
        *,
        carpet: Carpet,
        order: Order,
        user: User,
        damage_description: str,
        damage_type: str | None,
        flagged_source: str,
        photos: list[RepairPhotoInput],
    ) -> RepairRequestResponse:
        await self._assert_no_active_repair(carpet.id)
        sess_result = await self.db.execute(
            select(ServiceSession).where(ServiceSession.order_id == order.id)
        )
        session = sess_result.scalar_one_or_none()
        rr = RepairRequest(
            order_id=order.id,
            carpet_id=carpet.id,
            service_session_id=session.id if session else None,
            status=RepairWorkflowStatus.PENDING_APPROVAL,
            damage_description=damage_description,
            damage_type=damage_type,
            flagged_source=flagged_source,
            created_by_user_id=user.id,
        )
        self.db.add(rr)
        await self.db.flush()
        await self._attach_photos(rr.id, photos, user.id)
        order.status = OrderStatus.REPAIRING
        await self.db.flush()
        return await self._to_response(
            rr, order, carpet, session.session_code if session else None, None
        )

    async def create_request(self, data: RepairRequestCreate, user: User) -> RepairRequestResponse:
        self._require(user, "repair:create")
        carpet_result = await self.db.execute(select(Carpet).where(Carpet.id == data.carpet_id))
        carpet = carpet_result.scalar_one_or_none()
        if not carpet:
            raise NotFoundError("Carpet not found")
        order_result = await self.db.execute(select(Order).where(Order.id == carpet.order_id))
        order = order_result.scalar_one()
        return await self._create_repair_core(
            carpet=carpet,
            order=order,
            user=user,
            damage_description=data.damage_description,
            damage_type=data.damage_type or data.repair_type,
            flagged_source="operations",
            photos=data.photos,
        )

    async def flag_at_pickup(
        self, order_id: uuid.UUID, data: DriverFlagRepairRequest, user: User
    ) -> RepairRequestResponse:
        """US-26: driver flags repair need during pickup."""
        self._require(user, "repair:create")
        if not data.need_repair:
            raise ValidationError("need_repair must be true")
        order_result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = order_result.scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found")
        if order.assigned_driver_id != user.id:
            raise ForbiddenError("Order is not assigned to you")
        carpet_result = await self.db.execute(select(Carpet).where(Carpet.order_id == order.id))
        carpet = carpet_result.scalar_one_or_none()
        if not carpet:
            raise ValidationError("Attach a QR to the carpet before flagging repair")
        return await self._create_repair_core(
            carpet=carpet,
            order=order,
            user=user,
            damage_description=data.damage_description,
            damage_type=None,
            flagged_source="driver",
            photos=data.photos,
        )

    async def flag_at_operations(
        self, data: OperationsFlagRepairRequest, user: User
    ) -> RepairRequestResponse:
        """US-27: operations flags repair need after receiving carpet."""
        self._require(user, "repair:create")
        qr_svc = QrTrackingService(self.db)
        carpet = await qr_svc.find_carpet_by_active_code(data.code.strip())
        if not carpet:
            raise NotFoundError("Carpet not found for QR code")
        order_result = await self.db.execute(select(Order).where(Order.id == carpet.order_id))
        order = order_result.scalar_one()
        return await self._create_repair_core(
            carpet=carpet,
            order=order,
            user=user,
            damage_description=data.damage_description,
            damage_type=data.damage_type,
            flagged_source="operations",
            photos=data.photos,
        )

    async def get_photo(self, photo_id: uuid.UUID, user: User) -> tuple[bytes, str]:
        self._require(user, "repair:read")

        result = await self.db.execute(
            select(RepairRequestPhoto).where(RepairRequestPhoto.id == photo_id)
        )
        photo = result.scalar_one_or_none()
        if not photo:
            raise NotFoundError("Photo not found")
        raw = photo.photo_data
        if not raw.startswith("data:"):
            raise ValidationError("Invalid photo data")
        header, _, payload = raw.partition(",")
        media_type = header.replace("data:", "").split(";")[0] or "image/jpeg"
        return base64.b64decode(payload), media_type

    async def list_approval_queue(self, user: User) -> RepairListResponse:
        """US-30: admin sees repairs flagged by operations and approves/rejects.

        Includes freshly flagged (pending_approval) carpets so the admin can act
        as soon as operations flag a carpet — not only after a specialist quote.
        """
        self._require(user, "repair:approve")
        return await self._list_by_statuses(
            user,
            [
                RepairWorkflowStatus.PENDING_APPROVAL,
                RepairWorkflowStatus.WAITING_CUSTOMER_RESPONSE,
                RepairWorkflowStatus.CUSTOMER_APPROVED,
            ],
        )

    async def list_repair_queue(self, user: User) -> RepairListResponse:
        """US-28: repair specialist work queue."""
        self._require(user, "repair:read")
        return await self._list_by_statuses(
            user,
            [
                RepairWorkflowStatus.PENDING_APPROVAL,
                RepairWorkflowStatus.CUSTOMER_APPROVED,
                RepairWorkflowStatus.IN_REPAIR,
            ],
        )

    async def record_assessment(
        self, repair_id: uuid.UUID, data: RepairAssessmentUpdate, user: User
    ) -> RepairRequestResponse:
        """US-29: specialist records repair proposal → waiting customer approval."""
        self._require(user, "repair:update")
        rr, order, carpet, session_code, contacted_name = await self._load_context(repair_id)
        if rr.status != RepairWorkflowStatus.PENDING_APPROVAL:
            raise ValidationError("Assessment can only be recorded for newly flagged repairs")
        rr.repair_type = data.repair_type
        rr.quoted_price = data.quoted_price
        rr.repair_deadline = data.repair_deadline
        rr.assessment_notes = data.assessment_notes
        rr.assessed_at = datetime.now(timezone.utc)
        rr.assessed_by_user_id = user.id
        rr.status = RepairWorkflowStatus.WAITING_CUSTOMER_RESPONSE
        await self.db.flush()
        return await self._to_response(rr, order, carpet, session_code, contacted_name)

    async def _list_by_statuses(
        self, user: User, statuses: list[RepairWorkflowStatus]
    ) -> RepairListResponse:
        result = await self.db.execute(
            select(RepairRequest)
            .where(RepairRequest.status.in_(statuses))
            .order_by(RepairRequest.created_at.desc())
        )
        repairs = result.scalars().all()
        items: list[RepairRequestResponse] = []
        for rr in repairs:
            order_result = await self.db.execute(select(Order).where(Order.id == rr.order_id))
            order = order_result.scalar_one()
            carpet_result = await self.db.execute(select(Carpet).where(Carpet.id == rr.carpet_id))
            carpet = carpet_result.scalar_one()
            session_code = None
            if rr.service_session_id:
                s = await self.db.execute(
                    select(ServiceSession.session_code).where(ServiceSession.id == rr.service_session_id)
                )
                session_code = s.scalar_one_or_none()
            contacted_name = None
            if rr.contacted_by_user_id:
                u = await self.db.execute(
                    select(User.full_name).where(User.id == rr.contacted_by_user_id)
                )
                contacted_name = u.scalar_one_or_none()
            items.append(
                await self._to_response(rr, order, carpet, session_code, contacted_name)
            )
        return RepairListResponse(items=items, total=len(items))

    async def record_customer_contact(
        self, repair_id: uuid.UUID, data: CustomerContactUpdate, user: User
    ) -> RepairRequestResponse:
        """US-30: admin records customer approval or rejection."""
        self._require(user, "repair:approve")
        rr, order, carpet, session_code, _ = await self._load_context(repair_id)
        if rr.status not in (
            RepairWorkflowStatus.PENDING_APPROVAL,
            RepairWorkflowStatus.WAITING_CUSTOMER_RESPONSE,
        ):
            raise ValidationError("Repair is not awaiting approval")
        now = datetime.now(timezone.utc)
        rr.contacted_at = now
        rr.contacted_by_user_id = user.id
        rr.customer_contact_notes = data.notes
        if data.outcome == "waiting":
            rr.status = RepairWorkflowStatus.WAITING_CUSTOMER_RESPONSE
        elif data.outcome == "approved":
            rr.status = RepairWorkflowStatus.CUSTOMER_APPROVED
        else:
            rr.status = RepairWorkflowStatus.CUSTOMER_REJECTED
            order.status = _CARPET_TO_ORDER_STATUS.get(carpet.status, OrderStatus.READY_FOR_DELIVERY)
        await self.db.flush()
        return await self._to_response(rr, order, carpet, session_code, user.full_name)

    async def approve_start_repair(
        self, repair_id: uuid.UUID, user: User
    ) -> RepairRequestResponse:
        self._require(user, "repair:approve")
        rr, order, carpet, session_code, contacted_name = await self._load_context(repair_id)
        if rr.status != RepairWorkflowStatus.CUSTOMER_APPROVED:
            raise ValidationError("Customer must approve repair before starting")
        now = datetime.now(timezone.utc)
        rr.status = RepairWorkflowStatus.IN_REPAIR
        rr.repair_started_at = now
        rr.admin_approved_at = now
        rr.admin_approved_by_user_id = user.id
        order.status = OrderStatus.REPAIRING
        await self.db.flush()
        return await self._to_response(rr, order, carpet, session_code, contacted_name)

    async def reject_repair(self, repair_id: uuid.UUID, user: User) -> RepairRequestResponse:
        self._require(user, "repair:approve")
        rr, order, carpet, session_code, contacted_name = await self._load_context(repair_id)
        if rr.status not in (
            RepairWorkflowStatus.PENDING_APPROVAL,
            RepairWorkflowStatus.WAITING_CUSTOMER_RESPONSE,
            RepairWorkflowStatus.CUSTOMER_REJECTED,
        ):
            raise ValidationError("Cannot cancel repair in current status")
        rr.status = RepairWorkflowStatus.REPAIR_CANCELLED
        order.status = _CARPET_TO_ORDER_STATUS.get(carpet.status, OrderStatus.READY_FOR_DELIVERY)
        await self.db.flush()
        return await self._to_response(rr, order, carpet, session_code, contacted_name)

    async def update_repair_work(
        self, repair_id: uuid.UUID, data: RepairWorkUpdate, user: User
    ) -> RepairRequestResponse:
        """US-31 / US-32: start repair with QR scan or complete with notes."""
        self._require(user, "repair:update")
        rr, order, carpet, session_code, contacted_name = await self._load_context(repair_id)
        now = datetime.now(timezone.utc)

        if data.status == "in_repair":
            if rr.status not in (
                RepairWorkflowStatus.CUSTOMER_APPROVED,
                RepairWorkflowStatus.IN_REPAIR,
            ):
                raise ValidationError("Repair not approved for work")
            if not data.qr_code:
                raise ValidationError("Scan carpet QR to start repair")
            qr_svc = QrTrackingService(self.db)
            if not await qr_svc.verify_scanned_active(carpet.id, data.qr_code):
                raise ValidationError("Scanned QR does not match this carpet")
            await qr_svc._log_scan(
                carpet_id=carpet.id,
                user_id=user.id,
                code=data.qr_code.strip(),
                ip=None,
                method="repair_start",
                is_valid=True,
            )
            rr.status = RepairWorkflowStatus.IN_REPAIR
            rr.repair_started_at = rr.repair_started_at or now
            order.status = OrderStatus.REPAIRING
        else:
            if rr.status != RepairWorkflowStatus.IN_REPAIR:
                raise ValidationError("Repair must be in progress to complete")
            rr.status = RepairWorkflowStatus.REPAIR_COMPLETED
            rr.repair_completed_at = now
            rr.completion_notes = data.completion_notes
            order.status = OrderStatus.READY_FOR_DELIVERY

        await self.db.flush()
        return await self._to_response(rr, order, carpet, session_code, contacted_name)
