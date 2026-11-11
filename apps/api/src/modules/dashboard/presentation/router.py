from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser, require_any_permission
from src.modules.dashboard.application.schemas import (
    DailyReportResponse,
    DashboardStatsResponse,
    OrderSourcesResponse,
    OrderVolumeResponse,
    WashOperationsOverviewResponse,
)
from src.modules.dashboard.application.service import DashboardService
from src.shared.database.session import get_db

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[object, Depends(require_any_permission("reports:read", "orders:read"))],
) -> DashboardStatsResponse:
    return await DashboardService(db).get_stats()


@router.get("/order-volume", response_model=OrderVolumeResponse)
async def order_volume(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[object, Depends(require_any_permission("reports:read", "orders:read"))],
    range: Annotated[str, Query(alias="range")] = "7d",
) -> OrderVolumeResponse:
    return await DashboardService(db).get_order_volume(range)


@router.get("/order-sources", response_model=OrderSourcesResponse)
async def order_sources(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[object, Depends(require_any_permission("reports:read", "orders:read"))],
) -> OrderSourcesResponse:
    return await DashboardService(db).get_order_sources()


@router.get("/wash-operations", response_model=WashOperationsOverviewResponse)
async def wash_operations_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[object, Depends(require_any_permission("reports:read", "orders:read"))],
) -> WashOperationsOverviewResponse:
    return await DashboardService(db).get_wash_operations_overview()


@router.get("/daily-report", response_model=DailyReportResponse)
async def daily_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[object, Depends(require_any_permission("reports:read", "orders:read"))],
) -> DailyReportResponse:
    return await DashboardService(db).get_daily_report()
