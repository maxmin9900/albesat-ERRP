import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from src.core.phone import normalize_oman_phone


class PartnerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    # Same Oman mobile rules as customer phones (normalized to +968XXXXXXXX).
    contact_phone: str = Field(min_length=7, max_length=20)
    address: str = Field(min_length=5, max_length=500)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    notes: str | None = Field(default=None, max_length=2000)
    contact_email: str | None = None
    commission_rate: Decimal = Field(default=Decimal("15.00"), ge=0, le=100)
    is_active: bool = True

    @field_validator("contact_phone")
    @classmethod
    def _check_phone(cls, v: str) -> str:
        return normalize_oman_phone(v)


class PartnerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    contact_phone: str | None = Field(default=None, min_length=7, max_length=20)
    address: str | None = Field(default=None, min_length=5, max_length=500)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    notes: str | None = None
    contact_email: str | None = None
    commission_rate: Decimal | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None

    @field_validator("contact_phone")
    @classmethod
    def _check_phone(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return v
        return normalize_oman_phone(v)


class PartnerResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    contact_phone: str | None
    contact_email: str | None
    address: str | None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    notes: str | None = None
    commission_rate: Decimal
    is_active: bool
    order_count: int = 0

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    order_id: uuid.UUID
    service_session_id: uuid.UUID | None = None
    invoice_type: str
    status: str
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    issued_at: datetime | None
    paid_at: datetime | None
    delivered_at: datetime | None = None
    due_date: date | None = None
    amount_paid: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    carpet_count: int | None = None
    service_type: str | None = None
    service_area: str | None = None
    service_amount: Decimal | None = None
    repair_amount: Decimal | None = None
    payment_status: str = "unpaid"
    payment_status_label: str = "Unpaid"

    model_config = {"from_attributes": True}


class FinalInvoiceResponse(BaseModel):
    """US-20A / US-21: final invoice issued at delivery."""
    id: uuid.UUID
    invoice_number: str
    order_id: uuid.UUID
    service_session_id: uuid.UUID | None
    customer_name: str
    customer_phone: str
    customer_address: str | None
    carpet_count: int
    service_type: str
    service_area: str | None
    service_amount: Decimal
    repair_amount: Decimal
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    payment_status: str
    payment_status_label: str = "Unpaid"
    amount_paid: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    due_date: date | None = None
    issued_at: datetime
    paid_at: datetime | None = None
    delivered_at: datetime | None = None


class PaymentTransactionResponse(BaseModel):
    id: uuid.UUID
    transaction_number: str
    order_id: uuid.UUID
    amount: Decimal
    currency: str
    method: str
    status: str
    driver_confirmed: bool = True
    confirmation_reference: str | None = None
    note: str | None
    created_at: datetime
    customer_name: str | None = None

    model_config = {"from_attributes": True}


class SettlementResponse(BaseModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    partner_name: str
    period_start: date
    period_end: date
    total_orders: int
    gross_amount: Decimal
    commission_amount: Decimal
    net_payable: Decimal
    status: str
    paid_at: datetime | None

    model_config = {"from_attributes": True}


class PaymentsDashboardResponse(BaseModel):
    today_revenue: Decimal
    pending_count: int
    partner_settlement_pending: Decimal
    transactions: list[PaymentTransactionResponse]
    invoices: list[InvoiceResponse]
    settlements: list[SettlementResponse]


class RecordPaymentRequest(BaseModel):
    order_id: uuid.UUID
    amount: Decimal = Field(gt=0)
    method: str
    note: str | None = None


class ConvertInvoiceRequest(BaseModel):
    invoice_id: uuid.UUID


class DriverPaymentRequest(BaseModel):
    """US-22 / US-23 / US-24: record payment at delivery."""
    method: str = Field(..., pattern="^(cash|card_transfer|pos)$")
    amount: Decimal | None = Field(default=None, gt=0)
    confirmation_reference: str | None = Field(default=None, max_length=120)
    note: str | None = None


class ConfirmDriverPaymentRequest(BaseModel):
    confirmation_reference: str | None = Field(default=None, max_length=120)
    note: str | None = None


class PaymentReminderRequest(BaseModel):
    channels: list[str] = Field(default_factory=lambda: ["sms", "whatsapp"])
    message: str | None = Field(default=None, max_length=500)


class PaymentReminderLogResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    channel: str
    status: str
    message: str | None
    created_at: datetime


class InvoiceServiceLine(BaseModel):
    label: str
    amount: Decimal


class InvoiceCrmDetailResponse(BaseModel):
    """US-21B: CRM invoice view for finance team."""
    invoice: InvoiceResponse
    services_done: list[InvoiceServiceLine]
    payment_history: list[PaymentTransactionResponse]
    reminder_logs: list[PaymentReminderLogResponse]


class PartnerFinanceReport(BaseModel):
    """US-25 / EPIC 7 partner settlement overview."""
    partner_id: uuid.UUID
    partner_name: str
    order_count: int
    gross_order_amount: Decimal
    paid_amount: Decimal
    unpaid_amount: Decimal
    revenue_from_partner: Decimal
    partner_debt: Decimal
    payment_status_counts: dict[str, int]
    settlements: list[SettlementResponse]


class GenerateSettlementRequest(BaseModel):
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=1, le=12)


class PartnerOrderLine(BaseModel):
    """One order row inside Partner Detail / Statement (edit doc US-P-04/05)."""

    order_id: uuid.UUID
    order_number: str
    created_at: datetime
    carpet_count: int
    service_type: str
    status: str
    total: Decimal
    paid_amount: Decimal
    payment_status: str  # paid | partially_paid | unpaid


class PartnerDetailResponse(BaseModel):
    """Partner Detail (edit doc US-P-04): info + order & financial summary."""

    partner: PartnerResponse
    total_orders: int
    total_carpets: int
    total_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    orders: list[PartnerOrderLine]


class PartnerStatementResponse(BaseModel):
    """Partner monthly statement (edit doc US-P-05)."""

    partner_id: uuid.UUID
    partner_name: str
    period_start: date
    period_end: date
    total_orders: int
    total_carpets: int
    total_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    orders: list[PartnerOrderLine]


class OrderPaymentInfo(BaseModel):
    """Payment status of one order (edit doc payment section US-P-02/03)."""

    order_id: uuid.UUID
    order_number: str
    tracking_code: str
    customer_name: str
    customer_phone: str
    order_status: str
    total: Decimal
    currency: str
    paid_amount: Decimal
    payment_status: str  # paid | partially_paid | unpaid
    payment_method: str | None = None
    paid_at: datetime | None = None
    is_locked: bool = False  # Paid orders are final (US-P-05)


class ConfirmOrderPaymentRequest(BaseModel):
    """Confirm Payment (edit doc US-P-04): admin received the money."""

    method: str = Field(..., pattern="^(cash|card_transfer|pos|online)$")
    note: str | None = Field(default=None, max_length=500)


class PendingPaymentsResponse(BaseModel):
    """Delivered orders awaiting payment (edit doc US-P-01)."""

    items: list[OrderPaymentInfo]
    total: int


class PaymentHistoryItem(BaseModel):
    id: uuid.UUID
    transaction_number: str
    order_id: uuid.UUID
    order_number: str
    customer_name: str | None = None
    amount: Decimal
    currency: str
    method: str
    status: str
    created_at: datetime


class PaymentHistoryResponse(BaseModel):
    """Payment History (edit doc US-P-06): newest first, all payments."""

    items: list[PaymentHistoryItem]
    total: int
    page: int
    page_size: int


class RevenueDashboardResponse(BaseModel):
    """Revenue Dashboard (edit doc US-P-07..10)."""

    period: str  # daily | weekly | monthly | yearly | all
    total_revenue: Decimal
    customer_revenue: Decimal
    partner_revenue: Decimal
    pending_payments_count: int


class InvoiceItemService(BaseModel):
    """One billed service on a carpet line (e.g. Washing, Repair)."""

    name: str = Field(..., min_length=1, max_length=120)
    amount: Decimal = Field(..., ge=0)


class DraftInvoiceItemResponse(BaseModel):
    id: uuid.UUID
    carpet_id: uuid.UUID | None = None
    carpet_code: str | None = None
    position: int
    carpet_type: str | None = None
    services: list[InvoiceItemService] = []
    amount: Decimal


class DraftInvoiceResponse(BaseModel):
    """US-DI-02: full draft-invoice view (پیش‌فاکتور)."""

    id: uuid.UUID
    invoice_number: str
    order_id: uuid.UUID
    order_number: str
    tracking_code: str
    service_session_id: uuid.UUID | None = None
    session_code: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    order_date: datetime
    pickup_date: datetime | None = None
    carpet_count: int
    items: list[DraftInvoiceItemResponse] = []
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    payment_status: str
    payment_status_label: str
    invoice_status: str  # draft | confirmed | sent | final
    editable: bool
    confirmed_at: datetime | None = None
    confirmed_by_name: str | None = None
    sent_at: datetime | None = None
    sent_to_phone: str | None = None
    sent_status: str | None = None


class DraftInvoiceItemUpdate(BaseModel):
    """US-DI-03: one edited carpet line; amount = sum of service amounts."""

    carpet_id: uuid.UUID | None = None
    carpet_type: str | None = Field(default=None, max_length=120)
    services: list[InvoiceItemService] = Field(default_factory=list, max_length=50)


class UpdateDraftInvoiceRequest(BaseModel):
    """US-DI-03: admin edits the draft invoice before finalization."""

    items: list[DraftInvoiceItemUpdate] = Field(..., min_length=1, max_length=999)
