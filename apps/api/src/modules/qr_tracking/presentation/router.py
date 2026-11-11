from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.qr_tracking.application.schemas import (
    BulkCreatePhysicalQrRequest,
    BulkCreatePhysicalQrResponse,
    CarpetDetailResponse,
    CreatePhysicalQrRequest,
    GenerateQrRequest,
    PaginatedCarpetsResponse,
    PaginatedPhysicalQrResponse,
    PhysicalQrTagItem,
    QrGenerateResponse,
    QrScanRequest,
    QrScanResponse,
)
from src.modules.qr_tracking.application.service import QrTrackingService
from src.shared.database.session import get_db

router = APIRouter(prefix="/qr", tags=["QR Tracking"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/generate", response_model=QrGenerateResponse)
async def generate_qr(
    data: GenerateQrRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QrGenerateResponse:
    return await QrTrackingService(db).generate_qr(data, user)


@router.post("/scan", response_model=QrScanResponse)
async def scan_qr(
    data: QrScanRequest,
    request: Request,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QrScanResponse:
    return await QrTrackingService(db).scan(
        data.code, user, ip=_client_ip(request), method="manual"
    )


@router.get("/carpets", response_model=PaginatedCarpetsResponse)
async def list_carpets(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query()] = None,
) -> PaginatedCarpetsResponse:
    return await QrTrackingService(db).list_carpets(user, page, page_size, search)


@router.get("/carpets/{carpet_id}", response_model=CarpetDetailResponse)
async def get_carpet(
    carpet_id: UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CarpetDetailResponse:
    return await QrTrackingService(db).get_carpet(carpet_id, user)


@router.get("/registry", response_model=PaginatedPhysicalQrResponse)
async def list_physical_qr_tags(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query()] = None,
) -> PaginatedPhysicalQrResponse:
    return await QrTrackingService(db).list_physical_qr_tags(user, page, page_size, search)


@router.post("/registry", response_model=PhysicalQrTagItem)
async def create_physical_qr_tag(
    data: CreatePhysicalQrRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PhysicalQrTagItem:
    return await QrTrackingService(db).create_physical_qr_tag(data, user)


@router.post("/registry/bulk", response_model=BulkCreatePhysicalQrResponse)
async def bulk_create_physical_qr_tags(
    data: BulkCreatePhysicalQrRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BulkCreatePhysicalQrResponse:
    return await QrTrackingService(db).bulk_create_physical_qr_tags(data, user)


@router.patch("/registry/{tag_id}/active", response_model=PhysicalQrTagItem)
async def set_physical_qr_active(
    tag_id: UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    active: Annotated[bool, Query()] = True,
) -> PhysicalQrTagItem:
    return await QrTrackingService(db).set_physical_qr_active(tag_id, active, user)
