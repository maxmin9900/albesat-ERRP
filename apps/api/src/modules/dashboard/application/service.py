from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modules.dashboard.application.schemas import (
    DailyReportResponse,
    DailyReportStat,
    DashboardStatsResponse,
    OrderSourcesResponse,
    OrderVolumeResponse,
    SourceBreakdownItem,
    StatTrend,
    VolumeDataPoint,
    WashCarpetOverviewItem,
    WashOperationsOverviewResponse,
    WashStageSummary,
)
from src.modules.orders.infrastructure.models import Order, OrderSource, OrderStatus
from src.modules.qr_tracking.infrastructure.models import Carpet, CarpetStatus

SOURCE_COLORS = {
    OrderSource.WEBSITE: "#00B5AD",
    OrderSource.WHATSAPP: "#7C3AED",
    OrderSource.PHONE: "#EAB308",
    OrderSource.PARTNER: "#3B82F6",
    OrderSource.OTHER: "#64748B",
}

SOURCE_LABELS = {
    OrderSource.WEBSITE: "Website",
    OrderSource.WHATSAPP: "WhatsApp",
    OrderSource.PHONE: "Phone",
    OrderSource.PARTNER: "Partner",
    OrderSource.OTHER: "Other",
}

DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

WASH_STAGE_LABELS = {
    "received": "Intake",
    "in_operation": "Washing",
    "drying": "Drying",
    "ready": "Packaging",
}

SERVICE_LABELS = {
    "standard": "Standard Wash",
    "premium": "Premium Specialist Wash",
    "antique": "Antique Carpet Wash",
}


def _resolve_wash_stage(carpet: Carpet, order: Order) -> str | None:
    """Map carpet + order to wash pipeline stage; None = exclude from overview."""
    if carpet.loaded_for_delivery_at is not None:
        return None
    if order.status in (
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.PENDING_PICKUP,
    ):
        return None

    if carpet.status == CarpetStatus.READY:
        return "ready"
    if carpet.status == CarpetStatus.DRYING:
        return "drying"
    if carpet.status == CarpetStatus.IN_WASHING:
        return "in_operation"
    if carpet.status == CarpetStatus.RECEIVED_BY_OPERATION:
        return "received"

    if order.status == OrderStatus.DRYING:
        return "drying"
    if order.status in (OrderStatus.IN_WASHING, OrderStatus.REPAIRING):
        return "in_operation"
    if order.status in (OrderStatus.READY_FOR_DELIVERY, OrderStatus.OUT_FOR_DELIVERY):
        return "ready"
    if order.status == OrderStatus.PICKED_UP:
        return "received"
    if carpet.status in (CarpetStatus.IN_TRANSIT, CarpetStatus.REGISTERED):
        return "received"
    return "received"


def _utc_date(dt: datetime) -> date:
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(timezone.utc).date()


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> DashboardStatsResponse:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        month_start = today_start.replace(day=1)

        today_count = await self._count_orders_since(today_start)
        yesterday_count = await self._count_orders_since(yesterday_start, before=today_start)
        in_washing = await self._count_by_status(OrderStatus.IN_WASHING)
        ready = await self._count_by_status(OrderStatus.READY_FOR_DELIVERY)
        yesterday_ready = await self._count_by_status(
            OrderStatus.READY_FOR_DELIVERY,
            before=today_start,
        )

        revenue = await self._sum_revenue_since(month_start)
        order_trend = self._pct_change(today_count, yesterday_count)
        ready_trend = self._pct_change(ready, yesterday_ready)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
        prev_month_revenue = await self._sum_revenue_between(prev_month_start, month_start)
        revenue_trend = self._pct_change(
            int(revenue),
            int(prev_month_revenue),
        )

        return DashboardStatsResponse(
            todays_orders=StatTrend(
                value=str(today_count),
                trend=f"{order_trend:+.1f}%" if order_trend is not None else None,
                trend_up=order_trend >= 0 if order_trend is not None else None,
                subtext="Increase compared to yesterday" if (order_trend or 0) >= 0 else "Decrease compared to yesterday",
            ),
            monthly_revenue=StatTrend(
                value=f"{revenue:,.0f} OMR",
                trend=f"{revenue_trend:+.1f}%" if revenue_trend is not None else None,
                trend_up=revenue_trend >= 0 if revenue_trend is not None else None,
                subtext=f"{await self._count_orders_since(month_start)} orders this month",
            ),
            in_washing=StatTrend(
                value=str(in_washing),
                subtext="Awaiting exit from wash hall",
            ),
            ready_for_delivery=StatTrend(
                value=str(ready),
                trend=f"{ready_trend:+.1f}%" if ready_trend is not None else None,
                trend_up=ready_trend >= 0 if ready_trend is not None else None,
                subtext="Awaiting logistics coordination",
            ),
        )

    async def get_order_volume(self, range_key: str = "7d") -> OrderVolumeResponse:
        days = {"7d": 7, "30d": 30, "1y": 365}.get(range_key, 7)
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)

        result = await self.db.execute(
            select(Order.created_at).where(Order.created_at >= start)
        )
        counts: dict[date, int] = {}
        for (created_at,) in result.all():
            day = _utc_date(created_at)
            counts[day] = counts.get(day, 0) + 1

        data: list[VolumeDataPoint] = []
        for i in range(days):
            d = (start + timedelta(days=i)).date()
            label = DAY_LABELS[d.weekday()] if days <= 7 else d.strftime("%m/%d")
            data.append(
                VolumeDataPoint(
                    day=label,
                    count=counts.get(d, 0),
                    is_today=d == _utc_date(now),
                )
            )
        if days > 7:
            data = data[-7:]

        return OrderVolumeResponse(range=range_key, data=data[-7:] if days > 7 else data)

    async def get_wash_operations_overview(self) -> WashOperationsOverviewResponse:
        result = await self.db.execute(
            select(Carpet, Order)
            .join(Order, Carpet.order_id == Order.id)
            .where(
                Order.status.notin_(
                    [
                        OrderStatus.DELIVERED,
                        OrderStatus.CANCELLED,
                        OrderStatus.PENDING_PICKUP,
                    ]
                ),
                Carpet.loaded_for_delivery_at.is_(None),
            )
            .options(selectinload(Carpet.qr_codes))
            .order_by(Carpet.updated_at.desc())
        )

        received: list[WashCarpetOverviewItem] = []
        in_operation: list[WashCarpetOverviewItem] = []
        drying: list[WashCarpetOverviewItem] = []
        ready: list[WashCarpetOverviewItem] = []

        for carpet, order in result.all():
            stage = _resolve_wash_stage(carpet, order)
            if stage is None:
                continue

            active_qr = next((q for q in carpet.qr_codes if q.revoked_at is None), None)
            svc = order.service_type.value if hasattr(order.service_type, "value") else str(order.service_type)
            item = WashCarpetOverviewItem(
                id=carpet.id,
                carpet_code=carpet.carpet_code,
                tracking_code=order.tracking_code,
                customer_name=order.customer_name,
                status=carpet.status.value if hasattr(carpet.status, "value") else str(carpet.status),
                status_label=WASH_STAGE_LABELS.get(stage, stage),
                stage=stage,
                service_label=SERVICE_LABELS.get(svc, svc),
                received_at=carpet.received_by_ops_at or order.pickup_started_at or carpet.updated_at,
                qr_code=active_qr.code if active_qr else None,
            )
            if stage == "ready":
                ready.append(item)
            elif stage == "drying":
                drying.append(item)
            elif stage == "in_operation":
                in_operation.append(item)
            else:
                received.append(item)

        stages = [
            WashStageSummary(key="received", label=WASH_STAGE_LABELS["received"], count=len(received)),
            WashStageSummary(
                key="in_operation", label=WASH_STAGE_LABELS["in_operation"], count=len(in_operation)
            ),
            WashStageSummary(key="drying", label=WASH_STAGE_LABELS["drying"], count=len(drying)),
            WashStageSummary(key="ready", label=WASH_STAGE_LABELS["ready"], count=len(ready)),
        ]

        return WashOperationsOverviewResponse(
            stages=stages,
            received=received,
            in_operation=in_operation,
            drying=drying,
            ready=ready,
        )

    async def get_order_sources(self) -> OrderSourcesResponse:
        result = await self.db.execute(
            select(Order.source, func.count(Order.id)).group_by(Order.source)
        )
        rows = result.all()
        total = sum(r[1] for r in rows) or 1

        sources = [
            SourceBreakdownItem(
                source=src.value,
                label=SOURCE_LABELS.get(src, src.value),
                count=cnt,
                percentage=round(cnt / total * 100, 1),
                color=SOURCE_COLORS.get(src, "#64748B"),
            )
            for src, cnt in rows
        ]
        if not sources:
            for src in OrderSource:
                sources.append(
                    SourceBreakdownItem(
                        source=src.value,
                        label=SOURCE_LABELS.get(src, src.value),
                        count=0,
                        percentage=0,
                        color=SOURCE_COLORS.get(src, "#64748B"),
                    )
                )

        return OrderSourcesResponse(total=sum(r[1] for r in rows), sources=sources)

    async def get_daily_report(self, report_date: datetime | None = None) -> DailyReportResponse:
        now = report_date or datetime.now(timezone.utc)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        yesterday_start = day_start - timedelta(days=1)

        orders_today = await self._count_orders_since(day_start, before=day_end)
        orders_yesterday = await self._count_orders_since(yesterday_start, before=day_start)
        trend = self._pct_change(orders_today, orders_yesterday)

        revenue = await self._sum_revenue_between(day_start, day_end)
        washed = await self._count_by_status(OrderStatus.IN_WASHING)
        delivered = await self._count_by_status(OrderStatus.DELIVERED)

        return DailyReportResponse(
            date=day_start.strftime("%b %d, %Y"),
            stats=[
                DailyReportStat(
                    label="ORDERS RECEIVED",
                    value=str(orders_today),
                    subtext=f"{trend:+.1f}% vs yesterday" if trend is not None else None,
                    trend="up" if (trend or 0) >= 0 else "down",
                ),
                DailyReportStat(
                    label="REVENUE COLLECTED",
                    value=f"{revenue:,.0f} OMR",
                    subtext=f"{orders_today} orders recorded",
                ),
                DailyReportStat(
                    label="CARPETS WASHED",
                    value=str(washed),
                    subtext="Active in wash hall",
                ),
                DailyReportStat(
                    label="DELIVERIES MADE",
                    value=str(delivered),
                    subtext="Delivered all-time count",
                ),
            ],
            highlights=[
                f"{orders_today} new orders received today",
                f"{revenue:,.0f} OMR revenue recorded today" if revenue else "No revenue recorded today",
                f"{delivered} orders delivered (all-time)" if delivered else "No deliveries recorded yet",
            ],
        )

    async def _count_orders_since(
        self, since: datetime, before: datetime | None = None
    ) -> int:
        q = select(func.count(Order.id)).where(Order.created_at >= since)
        if before:
            q = q.where(Order.created_at < before)
        result = await self.db.execute(q)
        return result.scalar() or 0

    async def _count_by_status(
        self, status: OrderStatus, before: datetime | None = None
    ) -> int:
        q = select(func.count(Order.id)).where(Order.status == status)
        if before:
            q = q.where(Order.created_at < before)
        result = await self.db.execute(q)
        return result.scalar() or 0

    async def _sum_revenue_since(self, since: datetime) -> Decimal:
        result = await self.db.execute(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.created_at >= since,
                Order.status != OrderStatus.CANCELLED,
            )
        )
        return Decimal(str(result.scalar() or 0))

    async def _sum_revenue_between(self, start: datetime, end: datetime) -> Decimal:
        result = await self.db.execute(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.created_at >= start,
                Order.created_at < end,
                Order.status != OrderStatus.CANCELLED,
            )
        )
        return Decimal(str(result.scalar() or 0))

    def _pct_change(self, current: int, previous: int) -> float | None:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round((current - previous) / previous * 100, 1)
