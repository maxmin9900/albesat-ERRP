from decimal import Decimal
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StatTrend(BaseModel):
    value: str
    trend: str | None = None
    trend_up: bool | None = None
    subtext: str


class DashboardStatsResponse(BaseModel):
    todays_orders: StatTrend
    monthly_revenue: StatTrend
    in_washing: StatTrend
    ready_for_delivery: StatTrend


class VolumeDataPoint(BaseModel):
    day: str
    count: int
    is_today: bool = False


class OrderVolumeResponse(BaseModel):
    range: str
    data: list[VolumeDataPoint]


class SourceBreakdownItem(BaseModel):
    source: str
    label: str
    count: int
    percentage: float
    color: str


class OrderSourcesResponse(BaseModel):
    total: int
    sources: list[SourceBreakdownItem]


class DailyReportStat(BaseModel):
    label: str
    value: str
    subtext: str | None = None
    trend: str | None = None


class DailyReportResponse(BaseModel):
    date: str
    stats: list[DailyReportStat]
    highlights: list[str]


class WashStageSummary(BaseModel):
    key: str
    label: str
    count: int


class WashCarpetOverviewItem(BaseModel):
    id: UUID
    carpet_code: str
    tracking_code: str
    customer_name: str
    status: str
    status_label: str
    stage: str
    service_label: str
    received_at: datetime | None
    qr_code: str | None


class WashOperationsOverviewResponse(BaseModel):
    stages: list[WashStageSummary]
    received: list[WashCarpetOverviewItem]
    in_operation: list[WashCarpetOverviewItem]
    drying: list[WashCarpetOverviewItem]
    ready: list[WashCarpetOverviewItem]
