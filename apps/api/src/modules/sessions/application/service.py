import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.exceptions import ForbiddenError, NotFoundError
from src.modules.auth.infrastructure.models import User
from src.modules.orders.infrastructure.models import Order, OrderStatus
from src.modules.sessions.application.schemas import (
    DeliveryRouteResponse,
    RouteStopResponse,
    ServiceSessionResponse,
)
from src.modules.sessions.infrastructure.models import (
    DeliveryRouteSession,
    DeliveryRouteStop,
    RouteSessionStatus,
    ServiceSession,
    ServiceSessionStatus,
)


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _unique_session_code(self) -> str:
        """US-8: guarantee a unique Service Session ID."""
        for _ in range(20):
            candidate = f"SES-{datetime.now(timezone.utc).year}-{secrets.token_hex(5).upper()[:9]}"
            existing = await self.db.execute(
                select(ServiceSession.id).where(ServiceSession.session_code == candidate)
            )
            if existing.scalar_one_or_none() is None:
                return candidate
        return f"SES-{uuid.uuid4().hex.upper()[:12]}"

    async def create_for_order(self, order: Order, partner_id: uuid.UUID | None = None) -> ServiceSession:
        # Idempotent: one session per order (order_id is unique-constrained).
        existing = await self.db.execute(
            select(ServiceSession).where(ServiceSession.order_id == order.id)
        )
        already = existing.scalar_one_or_none()
        if already:
            return already

        code = await self._unique_session_code()
        session = ServiceSession(
            session_code=code,
            order_id=order.id,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            # New order enters the logistics queue (awaiting pickup).
            status=ServiceSessionStatus.OPEN,
            partner_id=partner_id,
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def sync_status_for_order(self, order: Order) -> None:
        result = await self.db.execute(select(ServiceSession).where(ServiceSession.order_id == order.id))
        session = result.scalar_one_or_none()
        if not session:
            return
        mapping = {
            OrderStatus.PENDING_PICKUP: ServiceSessionStatus.OPEN,
            OrderStatus.PICKED_UP: ServiceSessionStatus.IN_LOGISTICS,
            OrderStatus.IN_WASHING: ServiceSessionStatus.IN_OPERATIONS,
            OrderStatus.DRYING: ServiceSessionStatus.IN_OPERATIONS,
            OrderStatus.REPAIRING: ServiceSessionStatus.IN_OPERATIONS,
            OrderStatus.READY_FOR_DELIVERY: ServiceSessionStatus.READY,
            OrderStatus.OUT_FOR_DELIVERY: ServiceSessionStatus.READY,
            OrderStatus.DELIVERED: ServiceSessionStatus.DELIVERED,
        }
        session.status = mapping.get(order.status, session.status)
        if order.status == OrderStatus.DELIVERED:
            session.closed_at = datetime.now(timezone.utc)

    async def get_by_order(self, order_id: uuid.UUID) -> ServiceSessionResponse | None:
        result = await self.db.execute(select(ServiceSession).where(ServiceSession.order_id == order_id))
        session = result.scalar_one_or_none()
        return self._session_to_response(session) if session else None

    async def list_sessions(self, user: User, limit: int = 50) -> list[ServiceSessionResponse]:
        if not user.check_permission("sessions:read"):
            raise ForbiddenError("Missing sessions:read")
        result = await self.db.execute(
            select(ServiceSession).order_by(ServiceSession.created_at.desc()).limit(limit)
        )
        return [self._session_to_response(s) for s in result.scalars().all()]

    async def create_route_for_driver(self, user: User, order_ids: list[uuid.UUID] | None = None) -> DeliveryRouteResponse:
        if not user.check_permission("logistics:read"):
            raise ForbiddenError("Driver access required")
        route_code = f"RT-{secrets.token_hex(3).upper()}"
        route = DeliveryRouteSession(
            route_code=route_code,
            driver_id=user.id,
            status=RouteSessionStatus.PLANNED,
        )
        self.db.add(route)
        await self.db.flush()

        q = select(Order).where(
            Order.status.in_([OrderStatus.PENDING_PICKUP, OrderStatus.READY_FOR_DELIVERY, OrderStatus.OUT_FOR_DELIVERY])
        )
        if order_ids:
            q = q.where(Order.id.in_(order_ids))
        result = await self.db.execute(q.order_by(Order.created_at).limit(8))
        orders = result.scalars().all()

        stops: list[DeliveryRouteStop] = []
        for i, order in enumerate(orders, start=1):
            stop = DeliveryRouteStop(
                route_session_id=route.id,
                order_id=order.id,
                stop_number=i,
                customer_name=order.customer_name,
                address=order.pickup_address,
                distance_km=order.distance_km,
            )
            self.db.add(stop)
            stops.append(stop)
        route.total_stops = len(stops)
        route.total_distance_km = sum(Decimal(str(s.distance_km or 0)) for s in stops) or None
        route.est_minutes = len(stops) * 12
        await self.db.flush()
        return self._route_to_response(route, stops)

    async def get_active_route(self, user: User) -> DeliveryRouteResponse | None:
        if not user.check_permission("logistics:read"):
            raise ForbiddenError("Driver access required")
        result = await self.db.execute(
            select(DeliveryRouteSession)
            .where(
                DeliveryRouteSession.driver_id == user.id,
                DeliveryRouteSession.status.in_([RouteSessionStatus.PLANNED, RouteSessionStatus.ACTIVE]),
            )
            .options(selectinload(DeliveryRouteSession.stops))
            .order_by(DeliveryRouteSession.created_at.desc())
            .limit(1)
        )
        route = result.scalar_one_or_none()
        if not route:
            return None
        return self._route_to_response(route, list(route.stops))

    async def start_route(self, route_id: uuid.UUID, user: User) -> DeliveryRouteResponse:
        route = await self._get_route(route_id)
        if route.driver_id != user.id:
            raise ForbiddenError("Not your route")
        route.status = RouteSessionStatus.ACTIVE
        route.started_at = datetime.now(timezone.utc)
        await self.db.flush()
        return self._route_to_response(route, list(route.stops))

    async def _get_route(self, route_id: uuid.UUID) -> DeliveryRouteSession:
        result = await self.db.execute(
            select(DeliveryRouteSession)
            .where(DeliveryRouteSession.id == route_id)
            .options(selectinload(DeliveryRouteSession.stops))
        )
        route = result.scalar_one_or_none()
        if not route:
            raise NotFoundError("Route session not found")
        return route

    def _session_to_response(self, s: ServiceSession) -> ServiceSessionResponse:
        return ServiceSessionResponse(
            id=s.id,
            session_code=s.session_code,
            order_id=s.order_id,
            customer_name=s.customer_name,
            customer_phone=s.customer_phone,
            status=s.status.value,
            partner_id=s.partner_id,
            created_at=s.created_at,
            closed_at=s.closed_at,
        )

    def _route_to_response(
        self, route: DeliveryRouteSession, stops: list[DeliveryRouteStop]
    ) -> DeliveryRouteResponse:
        return DeliveryRouteResponse(
            id=route.id,
            route_code=route.route_code,
            status=route.status.value,
            total_stops=route.total_stops,
            total_distance_km=str(route.total_distance_km) if route.total_distance_km else None,
            est_minutes=route.est_minutes,
            started_at=route.started_at,
            stops=[
                RouteStopResponse(
                    stop_number=s.stop_number,
                    order_id=s.order_id,
                    customer_name=s.customer_name,
                    address=s.address,
                    distance_km=str(s.distance_km) if s.distance_km else None,
                    is_completed=s.is_completed,
                )
                for s in sorted(stops, key=lambda x: x.stop_number)
            ],
        )
