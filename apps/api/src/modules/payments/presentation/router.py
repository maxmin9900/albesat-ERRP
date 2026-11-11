import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.payments.application.schemas import (
    ConfirmDriverPaymentRequest,
    ConfirmOrderPaymentRequest,
    ConvertInvoiceRequest,
    DraftInvoiceResponse,
    DriverPaymentRequest,
    GenerateSettlementRequest,
    InvoiceCrmDetailResponse,
    InvoiceResponse,
    OrderPaymentInfo,
    PartnerCreate,
    PartnerDetailResponse,
    PartnerFinanceReport,
    PartnerResponse,
    PartnerStatementResponse,
    PartnerUpdate,
    PaymentHistoryResponse,
    PaymentReminderLogResponse,
    PaymentReminderRequest,
    PaymentTransactionResponse,
    PaymentsDashboardResponse,
    PendingPaymentsResponse,
    RecordPaymentRequest,
    RevenueDashboardResponse,
    SettlementResponse,
    UpdateDraftInvoiceRequest,
)
from src.modules.payments.application.service import PaymentsService
from src.shared.database.session import get_db

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/dashboard", response_model=PaymentsDashboardResponse)
async def payments_dashboard(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PaymentsDashboardResponse:
    return await PaymentsService(db).dashboard(user)


@router.get("/invoices/order/{order_id}", response_model=InvoiceResponse)
async def get_invoice_by_order(
    order_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvoiceResponse:
    """US-21B: view final invoice linked to order/session (CRM)."""
    return await PaymentsService(db).get_invoice_for_order(order_id, user)


@router.get("/orders/{order_id}/draft-invoice", response_model=DraftInvoiceResponse)
async def get_draft_invoice(
    order_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DraftInvoiceResponse:
    """US-DI-02: view the draft invoice (پیش‌فاکتور) of an order/session."""
    return await PaymentsService(db).get_draft_invoice(order_id, user)


@router.put("/invoices/{invoice_id}/draft", response_model=DraftInvoiceResponse)
async def update_draft_invoice(
    invoice_id: uuid.UUID,
    data: UpdateDraftInvoiceRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DraftInvoiceResponse:
    """US-DI-03: edit draft-invoice items before the final invoice is issued."""
    return await PaymentsService(db).update_draft_invoice(invoice_id, data, user)


@router.get("/invoices/{invoice_id}/crm", response_model=InvoiceCrmDetailResponse)
async def get_invoice_crm_detail(
    invoice_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> InvoiceCrmDetailResponse:
    """US-21B: CRM invoice detail with payment history."""
    return await PaymentsService(db).get_invoice_crm_detail(invoice_id, user)


@router.post("/invoices/{invoice_id}/remind", response_model=list[PaymentReminderLogResponse])
async def send_payment_reminder(
    invoice_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    data: PaymentReminderRequest | None = None,
) -> list[PaymentReminderLogResponse]:
    """US-21C: manual payment reminder (SMS / WhatsApp) with audit log."""
    return await PaymentsService(db).send_payment_reminder(invoice_id, user, data)


@router.get("/receivables", response_model=list[InvoiceResponse])
async def list_receivables(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
) -> list[InvoiceResponse]:
    """US-21A: unpaid / partial / overdue invoices for debt tracking."""
    return await PaymentsService(db).list_receivables(user, limit=limit)


@router.get("/pending", response_model=PendingPaymentsResponse)
async def pending_payments(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
) -> PendingPaymentsResponse:
    """Edit doc US-P-01: delivered orders awaiting payment."""
    return await PaymentsService(db).pending_payments(user, limit=limit)


@router.get("/history", response_model=PaymentHistoryResponse)
async def payment_history(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 20,
) -> PaymentHistoryResponse:
    """Edit doc US-P-06: all recorded payments, newest first."""
    return await PaymentsService(db).payment_history(user, page=page, page_size=page_size)


@router.get("/revenue", response_model=RevenueDashboardResponse)
async def revenue_dashboard(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    period: str = "all",
) -> RevenueDashboardResponse:
    """Edit doc US-P-07..10: revenue dashboard with period filter."""
    return await PaymentsService(db).revenue_dashboard(user, period=period)


@router.get("/orders/search", response_model=OrderPaymentInfo)
async def search_order_payment(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    query: str,
) -> OrderPaymentInfo:
    """Edit doc US-P-02: search an order by Order ID → payment status."""
    return await PaymentsService(db).search_order_payment(query, user)


@router.post("/orders/{order_id}/confirm", response_model=OrderPaymentInfo)
async def confirm_order_payment(
    order_id: uuid.UUID,
    data: ConfirmOrderPaymentRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrderPaymentInfo:
    """Edit doc US-P-04/05: confirm payment with method; Paid becomes final."""
    return await PaymentsService(db).confirm_order_payment(order_id, data, user)


@router.get("/partners", response_model=list[PartnerResponse])
async def list_partners(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = False,
) -> list[PartnerResponse]:
    return await PaymentsService(db).list_partners(user, include_inactive=include_inactive)


@router.get("/partners/{partner_id}", response_model=PartnerDetailResponse)
async def get_partner_detail(
    partner_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PartnerDetailResponse:
    """Edit doc US-P-04: partner detail with orders and financial summary."""
    return await PaymentsService(db).get_partner_detail(partner_id, user)


@router.delete("/partners/{partner_id}", response_model=PartnerResponse)
async def delete_partner(
    partner_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PartnerResponse:
    """Edit doc US-P-03: soft delete (deactivate) — history is preserved."""
    return await PaymentsService(db).delete_partner(partner_id, user)


@router.get("/partners/{partner_id}/statement", response_model=PartnerStatementResponse)
async def partner_statement(
    partner_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    year: Annotated[int, Query(ge=2020, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> PartnerStatementResponse:
    """Edit doc US-P-05: monthly partner statement."""
    return await PaymentsService(db).partner_statement(partner_id, year, month, user)


@router.get("/partners/{partner_id}/finance", response_model=PartnerFinanceReport)
async def partner_finance_report(
    partner_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PartnerFinanceReport:
    """EPIC 7 / US-25: partner settlement and revenue report."""
    return await PaymentsService(db).partner_finance_report(partner_id, user)


@router.post("/partners", response_model=PartnerResponse)
async def create_partner(
    data: PartnerCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PartnerResponse:
    return await PaymentsService(db).create_partner(data, user)


@router.patch("/partners/{partner_id}", response_model=PartnerResponse)
async def update_partner(
    partner_id: uuid.UUID,
    data: PartnerUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PartnerResponse:
    return await PaymentsService(db).update_partner(partner_id, data, user)


@router.post("/partners/{partner_id}/settlements/generate", response_model=SettlementResponse)
async def generate_monthly_settlement(
    partner_id: uuid.UUID,
    data: GenerateSettlementRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SettlementResponse:
    """US-25: generate monthly partner settlement."""
    return await PaymentsService(db).generate_monthly_settlement(partner_id, data, user)


@router.post("/record", response_model=PaymentTransactionResponse)
async def record_payment(
    data: RecordPaymentRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PaymentTransactionResponse:
    return await PaymentsService(db).record_payment(data, user)


@router.post("/proforma/{order_id}")
async def issue_proforma(
    order_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await PaymentsService(db).issue_proforma(order_id, user)


@router.post("/invoices/convert")
async def convert_invoice(
    data: ConvertInvoiceRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await PaymentsService(db).convert_to_invoice(data.invoice_id, user)


@router.post("/settlements/{settlement_id}/pay", response_model=SettlementResponse)
async def pay_settlement(
    settlement_id: uuid.UUID,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SettlementResponse:
    return await PaymentsService(db).mark_settlement_paid(settlement_id, user)
