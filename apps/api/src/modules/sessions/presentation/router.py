import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.sessions.application.schemas import CreateRouteRequest, DeliveryRouteResponse, ServiceSessionResponse
from src.modules.sessions.application.service import SessionService
from src.shared.database.session import get_db

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("/service", response_model=list[ServiceSessionResponse])
async def list_service_sessions(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ServiceSessionResponse]:
    return await SessionService(db).list_sessions(user)


@router.get("/service/order/{order_id}", response_model=ServiceSessionResponse | None)
async def get_service_session(
    order_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ServiceSessionResponse | None:
    if not user.check_permission("sessions:read") and not user.check_permission("logistics:read"):
        from src.core.exceptions import ForbiddenError
        raise ForbiddenError("Access denied")
    return await SessionService(db).get_by_order(order_id)


@router.post("/routes", response_model=DeliveryRouteResponse)
async def create_route(
    data: CreateRouteRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeliveryRouteResponse:
    return await SessionService(db).create_route_for_driver(user, data.order_ids)


@router.get("/routes/active", response_model=DeliveryRouteResponse | None)
async def get_active_route(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeliveryRouteResponse | None:
    return await SessionService(db).get_active_route(user)


@router.post("/routes/{route_id}/start", response_model=DeliveryRouteResponse)
async def start_route(
    route_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeliveryRouteResponse:
    return await SessionService(db).start_route(route_id, user)
