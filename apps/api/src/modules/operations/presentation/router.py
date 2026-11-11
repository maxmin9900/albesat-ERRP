from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.operations.application.schemas import (
    DriverOption,
    LoadForDeliveryRequest,
    OperationCarpetDetail,
    OperationsQueueResponse,
    RecordStepRequest,
    ReceiveCarpetRequest,
    ScanOperationRequest,
)
from src.modules.operations.application.service import OperationsService
from src.modules.repair.application.schemas import OperationsFlagRepairRequest, RepairRequestResponse
from src.modules.repair.application.service import RepairService
from src.shared.database.session import get_db

router = APIRouter(prefix="/operations", tags=["Wash Operations"])


@router.get("/queue", response_model=OperationsQueueResponse)
async def operations_queue(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationsQueueResponse:
    return await OperationsService(db).queue(user)


@router.get("/drivers", response_model=list[DriverOption])
async def list_delivery_drivers(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DriverOption]:
    return await OperationsService(db).list_drivers(user)


@router.post("/receive", response_model=OperationCarpetDetail)
async def receive_carpet(
    data: ReceiveCarpetRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationCarpetDetail:
    return await OperationsService(db).receive_from_driver(data, user)


@router.post("/start", response_model=OperationCarpetDetail)
async def start_operation(
    data: ScanOperationRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationCarpetDetail:
    """US-15: scan QR to start wash operation."""
    return await OperationsService(db).start_operation(data, user)


@router.post("/scan", response_model=OperationCarpetDetail)
async def scan_carpet(
    data: ScanOperationRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationCarpetDetail:
    """Alias for US-15 start operation."""
    return await OperationsService(db).scan(data, user)


@router.post("/load", response_model=OperationCarpetDetail)
async def load_for_delivery(
    data: LoadForDeliveryRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationCarpetDetail:
    """US-17A: scan QR when loading carpet onto driver vehicle."""
    return await OperationsService(db).load_for_delivery(data, user)


@router.get("/carpets/{carpet_id}", response_model=OperationCarpetDetail)
async def get_carpet(
    carpet_id: UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationCarpetDetail:
    return await OperationsService(db).detail(carpet_id, user)


@router.post("/carpets/{carpet_id}/step", response_model=OperationCarpetDetail)
async def record_step(
    carpet_id: UUID,
    data: RecordStepRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationCarpetDetail:
    return await OperationsService(db).record_step(carpet_id, data, user)


@router.post("/carpets/{carpet_id}/complete", response_model=OperationCarpetDetail)
async def complete_operation(
    carpet_id: UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OperationCarpetDetail:
    return await OperationsService(db).complete(carpet_id, user)


@router.post("/flag-repair", response_model=RepairRequestResponse)
async def flag_repair_at_operations(
    data: OperationsFlagRepairRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RepairRequestResponse:
    """US-27: operations flags repair need during carpet inspection."""
    return await RepairService(db).flag_at_operations(data, user)
