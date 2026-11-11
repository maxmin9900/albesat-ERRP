from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.infrastructure.models import User
from src.modules.notifications.application.schemas import NotificationItem, NotificationsResponse
from src.modules.orders.infrastructure.models import Order, OrderStatus
from src.modules.payments.infrastructure.models import CustomerPaymentStatus, Invoice
from src.modules.repair.infrastructure.models import RepairRequest, RepairWorkflowStatus


class NotificationsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(self, user: User) -> NotificationsResponse:
        now = datetime.now(timezone.utc)
        items: list[NotificationItem] = []

        if user.check_permission("orders:read"):
            items.extend(await self._order_notifications(now))

        if user.check_permission("repair:approve"):
            items.extend(await self._repair_notifications(now))

        if user.check_permission("payments:read"):
            items.extend(await self._payment_notifications(now))

        if user.check_permission("logistics:read"):
            items.extend(await self._driver_notifications(user, now))

        items.sort(key=lambda n: n.created_at, reverse=True)
        return NotificationsResponse(items=items[:30], total=len(items))

    async def _order_notifications(self, now: datetime) -> list[NotificationItem]:
        items: list[NotificationItem] = []
        for status, label, href in (
            (OrderStatus.PENDING_PICKUP, "Pending pickup", "/admin/orders?status=pending_pickup"),
            (OrderStatus.READY_FOR_DELIVERY, "Ready for delivery", "/admin/orders?status=ready_for_delivery"),
            (OrderStatus.IN_WASHING, "In washing", "/admin/operations"),
        ):
            count = await self._count_orders(status)
            if count <= 0:
                continue
            items.append(
                NotificationItem(
                    id=f"orders:{status.value}",
                    title=f"{count} order{'s' if count != 1 else ''} — {label}",
                    message=f"Review and action {label.lower()} orders.",
                    href=href,
                    category="orders",
                    created_at=now,
                )
            )
        return items

    async def _repair_notifications(self, now: datetime) -> list[NotificationItem]:
        result = await self.db.execute(
            select(RepairRequest)
            .where(
                RepairRequest.status.in_(
                    [
                        RepairWorkflowStatus.PENDING_APPROVAL,
                        RepairWorkflowStatus.WAITING_CUSTOMER_RESPONSE,
                        RepairWorkflowStatus.CUSTOMER_APPROVED,
                    ]
                )
            )
            .order_by(RepairRequest.created_at.desc())
            .limit(10)
        )
        repairs = list(result.scalars().all())
        if not repairs:
            return []

        items: list[NotificationItem] = []
        for rr in repairs:
            status_label = rr.status.value.replace("_", " ").title()
            items.append(
                NotificationItem(
                    id=f"repair:{rr.id}",
                    title=f"Repair — {status_label}",
                    message=f"{rr.damage_type or 'Repair request'} needs attention.",
                    href="/admin/repairs",
                    category="repair",
                    created_at=rr.created_at or now,
                )
            )
        return items

    async def _payment_notifications(self, now: datetime) -> list[NotificationItem]:
        result = await self.db.execute(
            select(func.count())
            .select_from(Invoice)
            .where(
                Invoice.payment_status.in_(
                    [CustomerPaymentStatus.UNPAID, CustomerPaymentStatus.PARTIALLY_PAID, CustomerPaymentStatus.OVERDUE]
                )
            )
        )
        count = int(result.scalar_one() or 0)
        if count <= 0:
            return []
        return [
            NotificationItem(
                id="payments:receivables",
                title=f"{count} unpaid invoice{'s' if count != 1 else ''}",
                message="Review receivables and payment follow-ups.",
                href="/admin/payments",
                category="payments",
                created_at=now,
            )
        ]

    async def _driver_notifications(self, user: User, now: datetime) -> list[NotificationItem]:
        from src.modules.logistics.application.service import LogisticsService

        lists = await LogisticsService(self.db).list_orders(user)
        items: list[NotificationItem] = []
        if lists.pending_pickup:
            n = len(lists.pending_pickup)
            items.append(
                NotificationItem(
                    id="driver:pending_pickup",
                    title=f"{n} pickup{'s' if n != 1 else ''} waiting",
                    message="New pickups are available on your route.",
                    href="/driver",
                    category="logistics",
                    created_at=now,
                )
            )
        if lists.pickup_in_progress:
            n = len(lists.pickup_in_progress)
            items.append(
                NotificationItem(
                    id="driver:pickup_in_progress",
                    title=f"{n} pickup{'s' if n != 1 else ''} in progress",
                    message="Complete QR scan and handoff.",
                    href="/driver",
                    category="logistics",
                    created_at=now,
                )
            )
        if lists.deliveries:
            n = len(lists.deliveries)
            items.append(
                NotificationItem(
                    id="driver:deliveries",
                    title=f"{n} deliver{'ies' if n != 1 else 'y'} pending",
                    message="Deliver carpets and collect payment if needed.",
                    href="/driver",
                    category="logistics",
                    created_at=now,
                )
            )
        return items

    async def _count_orders(self, status: OrderStatus) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Order).where(Order.status == status)
        )
        return int(result.scalar_one() or 0)
