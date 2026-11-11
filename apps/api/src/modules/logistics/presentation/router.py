from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.logistics.application.schemas import (
    AcceptPickupResponse,
    AttachQrRequest,
    AttachQrResponse,
    CompleteDeliveryRequest,
    CompleteDeliveryResponse,
    DeliveryScanResponse,
    DriverDashboardResponse,
    DriverOrderCard,
    DriverOrdersListResponse,
    DriverQuickScanRequest,
    DriverQuickScanResponse,
    PickupCarpetsRequest,
    PickupDetailsRequest,
    PickupQrResponse,
    RouteMapResponse,
    ScanHandoffRequest,
)
from src.modules.payments.application.schemas import (
    ConfirmDriverPaymentRequest,
    DraftInvoiceResponse,
    DriverPaymentRequest,
    PaymentTransactionResponse,
)
from src.modules.payments.application.service import PaymentsService
from src.modules.repair.application.schemas import DriverFlagRepairRequest, RepairRequestResponse
from src.modules.repair.application.service import RepairService
from src.modules.logistics.application.service import LogisticsService, OPERATIONS_ADDRESS, OPERATIONS_CENTER
from src.shared.database.session import get_db

router = APIRouter(prefix="/driver", tags=["Driver Logistics"])


@router.get("/dashboard", response_model=DriverDashboardResponse)
async def driver_dashboard(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    return await LogisticsService(db).dashboard(user)


@router.get("/orders", response_model=DriverOrdersListResponse)
async def list_driver_orders(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    return await LogisticsService(db).list_orders(user)


@router.get("/orders/{order_id}", response_model=DriverOrderCard)
async def get_driver_order(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    return await LogisticsService(db).get_order(order_id, user)


@router.get("/route", response_model=RouteMapResponse)
async def route_map(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    return await LogisticsService(db).route_map(user)


@router.post("/quick-scan", response_model=DriverQuickScanResponse)
async def driver_quick_scan(
    data: DriverQuickScanRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DriverQuickScanResponse:
    """Attach physical tag + confirm pickup from the Scan QR tab, or route to handoff."""
    return await LogisticsService(db).quick_scan(data.code, user, order_id=data.order_id)


@router.post("/route/create")
async def create_route_session(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    from src.modules.sessions.application.service import SessionService

    return await SessionService(db).create_route_for_driver(user)


@router.get("/operations-center")
async def operations_center() -> dict[str, str]:
    return {"name": OPERATIONS_CENTER, "address": OPERATIONS_ADDRESS}


@router.post("/pickups/{order_id}/accept", response_model=AcceptPickupResponse)
async def accept_pickup(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    return await LogisticsService(db).accept_pickup(order_id, user)


@router.post("/pickups/{order_id}/start", response_model=DriverOrderCard)
async def start_pickup(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    return await LogisticsService(db).start_pickup(order_id, user)


@router.post("/pickups/{order_id}/generate-qr", response_model=PickupQrResponse)
async def generate_pickup_qr(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    return await LogisticsService(db).generate_pickup_qr(order_id, user)


@router.post("/pickups/{order_id}/attach-qr", response_model=AttachQrResponse)
async def attach_pickup_qr(
    order_id: UUID,
    data: AttachQrRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await LogisticsService(db).attach_qr(order_id, data, user)


@router.post("/pickups/{order_id}/confirm", response_model=DriverOrderCard)
async def confirm_pickup(
    order_id: UUID,
    data: ScanHandoffRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await LogisticsService(db).confirm_pickup(order_id, data, user)


@router.post("/pickups/{order_id}/details", response_model=DriverOrderCard)
async def save_pickup_details(
    order_id: UUID,
    data: PickupDetailsRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Driver records carpet count, area and price at the customer's location."""
    return await LogisticsService(db).save_pickup_details(order_id, data, user)


@router.post("/pickups/{order_id}/carpets", response_model=DriverOrderCard)
async def save_pickup_carpets(
    order_id: UUID,
    data: PickupCarpetsRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Driver records each carpet separately: barcode, dimensions, price, repair flag."""
    return await LogisticsService(db).save_pickup_carpets(order_id, data, user)


@router.get("/pickups/{order_id}/invoice", response_model=DraftInvoiceResponse)
async def get_pickup_invoice(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    """US-DI-04: draft-invoice summary shown to the driver for confirmation."""
    return await LogisticsService(db).get_pickup_invoice(order_id, user)


@router.post("/pickups/{order_id}/invoice/confirm", response_model=DraftInvoiceResponse)
async def confirm_pickup_invoice(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    """US-DI-04/05: driver confirms the draft invoice; system sends it via WhatsApp."""
    return await LogisticsService(db).confirm_pickup_invoice(order_id, user)


@router.post("/pickups/{order_id}/flag-repair", response_model=RepairRequestResponse)
async def flag_repair_at_pickup(
    order_id: UUID,
    data: DriverFlagRepairRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """US-26: driver flags carpet repair need during pickup."""
    return await RepairService(db).flag_at_pickup(order_id, data, user)


@router.post("/pickups/{order_id}/handoff/scan", response_model=DriverOrderCard)
async def scan_handoff(
    order_id: UUID,
    data: ScanHandoffRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await LogisticsService(db).scan_handoff(order_id, data, user)


@router.post("/pickups/{order_id}/handoff/confirm", response_model=DriverOrderCard)
async def confirm_handoff(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    return await LogisticsService(db).confirm_handoff(order_id, user)


@router.post("/deliveries/{order_id}/start", response_model=DriverOrderCard)
async def start_delivery(
    order_id: UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]
):
    return await LogisticsService(db).start_delivery(order_id, user)


@router.post("/deliveries/{order_id}/scan", response_model=DeliveryScanResponse)
async def scan_delivery(
    order_id: UUID,
    data: ScanHandoffRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await LogisticsService(db).scan_delivery(order_id, data, user)


@router.post("/deliveries/{order_id}/complete", response_model=CompleteDeliveryResponse)
async def complete_delivery(
    order_id: UUID,
    data: CompleteDeliveryRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await LogisticsService(db).complete_delivery(order_id, data, user)


@router.post("/deliveries/{order_id}/payment", response_model=PaymentTransactionResponse)
async def record_delivery_payment(
    order_id: UUID,
    data: DriverPaymentRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """US-22/23/24: record cash, card transfer, or POS payment at delivery."""
    return await PaymentsService(db).record_driver_payment(order_id, data, user)


@router.post(
    "/deliveries/{order_id}/payment/{transaction_id}/confirm",
    response_model=PaymentTransactionResponse,
)
async def confirm_delivery_payment(
    order_id: UUID,
    transaction_id: UUID,
    data: ConfirmDriverPaymentRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """US-23/24: driver confirms card transfer or POS payment."""
    return await PaymentsService(db).confirm_driver_payment(
        order_id, transaction_id, data, user
    )
