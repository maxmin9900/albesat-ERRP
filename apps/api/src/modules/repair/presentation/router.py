import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser, get_db
from src.modules.repair.application.schemas import (
    CustomerContactUpdate,
    DriverFlagRepairRequest,
    OperationsFlagRepairRequest,
    RepairAssessmentUpdate,
    RepairListResponse,
    RepairRequestCreate,
    RepairRequestResponse,
    RepairWorkUpdate,
)
from src.modules.repair.application.service import RepairService

router = APIRouter(prefix="/repairs", tags=["repairs"])


@router.post("", response_model=RepairRequestResponse)
async def create_repair_request(
    data: RepairRequestCreate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairRequestResponse:
    return await RepairService(db).create_request(data, user)


@router.get("/approval-queue", response_model=RepairListResponse)
async def approval_queue(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairListResponse:
    """US-30: admin customer approval queue."""
    return await RepairService(db).list_approval_queue(user)


@router.get("/work-queue", response_model=RepairListResponse)
async def work_queue(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairListResponse:
    """US-28: repair specialist queue."""
    return await RepairService(db).list_repair_queue(user)


@router.get("/photos/{photo_id}/view")
async def view_repair_photo(
    photo_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> Response:
    content, media_type = await RepairService(db).get_photo(photo_id, user)
    return Response(content=content, media_type=media_type)


@router.patch("/{repair_id}/assessment", response_model=RepairRequestResponse)
async def record_assessment(
    repair_id: uuid.UUID,
    data: RepairAssessmentUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairRequestResponse:
    """US-29: repair specialist assessment proposal."""
    return await RepairService(db).record_assessment(repair_id, data, user)


@router.patch("/{repair_id}/customer-contact", response_model=RepairRequestResponse)
async def record_customer_contact(
    repair_id: uuid.UUID,
    data: CustomerContactUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairRequestResponse:
    """US-30: admin records customer approval or rejection."""
    return await RepairService(db).record_customer_contact(repair_id, data, user)


@router.post("/{repair_id}/approve-start", response_model=RepairRequestResponse)
async def approve_start_repair(
    repair_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairRequestResponse:
    return await RepairService(db).approve_start_repair(repair_id, user)


@router.post("/{repair_id}/reject", response_model=RepairRequestResponse)
async def reject_repair(
    repair_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairRequestResponse:
    return await RepairService(db).reject_repair(repair_id, user)


@router.patch("/{repair_id}/work", response_model=RepairRequestResponse)
async def update_repair_work(
    repair_id: uuid.UUID,
    data: RepairWorkUpdate,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> RepairRequestResponse:
    """US-31 / US-32: start repair (QR) or complete with notes."""
    return await RepairService(db).update_repair_work(repair_id, data, user)
