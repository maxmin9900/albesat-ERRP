from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.core.exceptions import ValidationError
from src.core.map_links import resolve_map_location
from src.modules.orders.application.schemas import (
    AdminCreateOrderSchema,
    AdminUpdateOrderSchema,
    BookingResponse,
    CustomerLookupResponse,
    MapLinkResolveResponse,
    MarkOrderPaidResponse,
    OrderResponse,
    OrderStatusUpdateSchema,
    PaginatedOrdersResponse,
    PublicBookingSchema,
    TrackOrderResponse,
)
from src.modules.orders.application.service import OrderService
from src.modules.payments.application.schemas import DraftInvoiceResponse
from src.modules.payments.application.service import PaymentsService
from src.shared.database.session import get_db

router = APIRouter(tags=["Orders"])


@router.post("/orders/public/booking", response_model=BookingResponse)
async def public_booking(
    data: PublicBookingSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BookingResponse:
    service = OrderService(db)
    return await service.create_public_booking(data)


@router.get("/orders/track", response_model=TrackOrderResponse)
async def track_order(
    code: Annotated[str, Query(min_length=3, max_length=50)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TrackOrderResponse:
    service = OrderService(db)
    return await service.track_order(code.strip())


@router.get("/orders/track/invoice", response_model=DraftInvoiceResponse)
async def track_order_invoice(
    code: Annotated[str, Query(min_length=3, max_length=50)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DraftInvoiceResponse:
    """US-DI-05: public invoice view — the page linked in the customer's WhatsApp."""
    return await PaymentsService(db).get_public_invoice(code)


@router.get("/orders", response_model=PaginatedOrdersResponse)
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: Annotated[str | None, Query()] = None,
    source: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
) -> PaginatedOrdersResponse:
    service = OrderService(db)
    return await service.list_orders(
        page=page, page_size=page_size, status=status, source=source, search=search, user=user
    )


@router.get("/orders/customers/lookup", response_model=CustomerLookupResponse)
async def lookup_customer(
    phone: Annotated[str, Query(min_length=8, max_length=20)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
) -> CustomerLookupResponse:
    service = OrderService(db)
    return await service.lookup_customer_by_phone(phone, user)


@router.get("/orders/geo/resolve-link", response_model=MapLinkResolveResponse)
async def resolve_map_link(
    url: Annotated[str, Query(min_length=3, max_length=2000)],
    user: CurrentUser,
) -> MapLinkResolveResponse:
    """Coordinates from a pasted map location; expands Google short links."""
    coords = await resolve_map_location(url)
    if coords is None:
        raise ValidationError(
            "Could not read a location from this link. Open it and pin the point on the map."
        )
    return MapLinkResolveResponse(latitude=coords[0], longitude=coords[1])


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
) -> OrderResponse:
    service = OrderService(db)
    return await service.get_order(order_id, user)


@router.post("/orders", response_model=OrderResponse, status_code=201)
async def create_order(
    data: AdminCreateOrderSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
) -> OrderResponse:
    service = OrderService(db)
    return await service.create_admin_order(data, user)


@router.patch("/orders/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: UUID,
    data: AdminUpdateOrderSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
) -> OrderResponse:
    service = OrderService(db)
    return await service.update_order(order_id, data, user)


@router.post("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdateSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
) -> OrderResponse:
    service = OrderService(db)
    return await service.update_status(order_id, data, user)


@router.delete("/orders/{order_id}", status_code=204)
async def cancel_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
) -> None:
    service = OrderService(db)
    await service.delete_order(order_id, user)


@router.post("/orders/{order_id}/mark-paid", response_model=MarkOrderPaidResponse)
async def mark_order_paid(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: CurrentUser,
) -> MarkOrderPaidResponse:
    return await OrderService(db).mark_order_paid(order_id, user)

