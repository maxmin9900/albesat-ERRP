import re
import secrets
import uuid
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.modules.auth.infrastructure.models import User
from src.modules.notifications.whatsapp import (
    send_draft_invoice_sync,
    send_payment_reminder_sync,
    send_sms_reminder_sync,
)
from src.modules.orders.infrastructure.models import Order, OrderPaymentRecord, OrderStatus
from src.modules.payments.application.schemas import (
    ConfirmDriverPaymentRequest,
    ConfirmOrderPaymentRequest,
    DraftInvoiceItemResponse,
    DraftInvoiceResponse,
    DriverPaymentRequest,
    FinalInvoiceResponse,
    InvoiceItemService,
    GenerateSettlementRequest,
    InvoiceCrmDetailResponse,
    InvoiceResponse,
    InvoiceServiceLine,
    OrderPaymentInfo,
    PartnerCreate,
    PartnerDetailResponse,
    PartnerFinanceReport,
    PartnerOrderLine,
    PartnerResponse,
    PartnerStatementResponse,
    PartnerUpdate,
    PaymentHistoryItem,
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
from src.modules.payments.infrastructure.models import (
    CustomerPaymentStatus,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InvoiceType,
    Partner,
    PartnerSettlement,
    PaymentReminderLog,
    PaymentStatus,
    PaymentTransaction,
    SettlementStatus,
)
from src.modules.qr_tracking.infrastructure.models import Carpet
from src.modules.repair.infrastructure.models import RepairRequest, RepairWorkflowStatus
from src.modules.sessions.infrastructure.models import ServiceSession

settings = get_settings()

PAYMENT_STATUS_LABELS = {
    "unpaid": "Unpaid",
    "partially_paid": "Partially Paid",
    "paid": "Paid",
    "failed_payment": "Failed Payment",
    "overdue": "Overdue",
}

ALLOWED_PAYMENT_METHODS = frozenset({"cash", "card_transfer", "pos", "online"})

# Backward-compat aliases from older UI payloads.
PAYMENT_METHOD_ALIASES = {
    "card": "card_transfer",
    "pos_terminal": "pos",
    "online_payment": "online",
}


def normalize_payment_method(method: str) -> str:
    cleaned = method.strip().lower()
    cleaned = PAYMENT_METHOD_ALIASES.get(cleaned, cleaned)
    if cleaned not in ALLOWED_PAYMENT_METHODS:
        raise ValidationError(
            "Invalid payment method. Allowed: cash, card_transfer, pos, online"
        )
    return cleaned


class PaymentsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _require(self, user: User, perm: str) -> None:
        if not user.check_permission(perm):
            raise ForbiddenError(f"Missing {perm}")

    async def dashboard(self, user: User) -> PaymentsDashboardResponse:
        self._require(user, "payments:read")
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        rev_result = await self.db.execute(
            select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(
                PaymentTransaction.status == PaymentStatus.SUCCESS,
                PaymentTransaction.created_at >= today_start,
            )
        )
        today_revenue = rev_result.scalar() or Decimal("0")

        pending_result = await self.db.execute(
            select(func.count()).select_from(Invoice).where(Invoice.status == InvoiceStatus.ISSUED)
        )
        pending_count = pending_result.scalar() or 0

        settle_result = await self.db.execute(
            select(func.coalesce(func.sum(PartnerSettlement.net_payable), 0)).where(
                PartnerSettlement.status == SettlementStatus.PENDING
            )
        )
        settlement_pending = settle_result.scalar() or Decimal("0")

        tx_result = await self.db.execute(
            select(PaymentTransaction, Order.customer_name)
            .join(Order, Order.id == PaymentTransaction.order_id)
            .order_by(PaymentTransaction.created_at.desc())
            .limit(20)
        )
        transactions = [
            PaymentTransactionResponse(
                id=tx.id,
                transaction_number=tx.transaction_number,
                order_id=tx.order_id,
                amount=tx.amount,
                currency=tx.currency,
                method=tx.method,
                status=tx.status.value,
                driver_confirmed=tx.driver_confirmed,
                confirmation_reference=tx.confirmation_reference,
                note=tx.note,
                created_at=tx.created_at,
                customer_name=name,
            )
            for tx, name in tx_result.all()
        ]

        inv_result = await self.db.execute(
            select(Invoice, Order.customer_name)
            .join(Order, Order.id == Invoice.order_id)
            .order_by(Invoice.created_at.desc())
            .limit(10)
        )
        invoices = [
            await self._invoice_response(inv, name)
            for inv, name in inv_result.all()
        ]

        set_result = await self.db.execute(
            select(PartnerSettlement, Partner.name)
            .join(Partner, Partner.id == PartnerSettlement.partner_id)
            .order_by(PartnerSettlement.created_at.desc())
            .limit(10)
        )
        settlements = [
            SettlementResponse(
                id=s.id,
                partner_id=s.partner_id,
                partner_name=name,
                period_start=s.period_start,
                period_end=s.period_end,
                total_orders=s.total_orders,
                gross_amount=s.gross_amount,
                commission_amount=s.commission_amount,
                net_payable=s.net_payable,
                status=s.status.value,
                paid_at=s.paid_at,
            )
            for s, name in set_result.all()
        ]

        return PaymentsDashboardResponse(
            today_revenue=today_revenue,
            pending_count=pending_count,
            partner_settlement_pending=settlement_pending,
            transactions=transactions,
            invoices=invoices,
            settlements=settlements,
        )

    @staticmethod
    def _slugify(name: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "partner"
        return base[:72]

    async def _partner_response(self, partner: Partner) -> PartnerResponse:
        cnt = await self.db.execute(
            select(func.count()).select_from(Order).where(Order.partner_id == partner.id)
        )
        return PartnerResponse(
            id=partner.id,
            name=partner.name,
            slug=partner.slug,
            contact_phone=partner.contact_phone,
            contact_email=partner.contact_email,
            address=partner.address,
            latitude=partner.latitude,
            longitude=partner.longitude,
            notes=partner.notes,
            commission_rate=partner.commission_rate,
            is_active=partner.is_active,
            order_count=cnt.scalar() or 0,
        )

    async def list_partners(self, user: User, include_inactive: bool = False) -> list[PartnerResponse]:
        self._require(user, "partners:read")
        q = select(Partner).order_by(Partner.name)
        if not include_inactive:
            q = q.where(Partner.is_active.is_(True))
        result = await self.db.execute(q)
        out: list[PartnerResponse] = []
        for p in result.scalars().all():
            out.append(await self._partner_response(p))
        return out

    async def create_partner(self, data: PartnerCreate, user: User) -> PartnerResponse:
        self._require(user, "partners:manage")
        slug = self._slugify(data.name)
        existing = await self.db.execute(select(Partner).where(Partner.slug == slug))
        if existing.scalar_one_or_none():
            slug = f"{slug}-{secrets.token_hex(2)}"
        partner = Partner(
            name=data.name,
            slug=slug,
            contact_phone=data.contact_phone,
            contact_email=data.contact_email,
            address=data.address,
            latitude=data.latitude,
            longitude=data.longitude,
            notes=data.notes,
            commission_rate=data.commission_rate,
            is_active=data.is_active,
        )
        self.db.add(partner)
        await self.db.flush()
        return await self._partner_response(partner)

    async def update_partner(
        self, partner_id: uuid.UUID, data: PartnerUpdate, user: User
    ) -> PartnerResponse:
        self._require(user, "partners:manage")
        result = await self.db.execute(select(Partner).where(Partner.id == partner_id))
        partner = result.scalar_one_or_none()
        if not partner:
            raise NotFoundError("Partner not found")
        for field in ("name", "contact_phone", "contact_email", "address", "latitude", "longitude", "notes", "commission_rate", "is_active"):
            value = getattr(data, field)
            if value is not None:
                setattr(partner, field, value)
        await self.db.flush()
        return await self._partner_response(partner)

    async def record_payment(self, data: RecordPaymentRequest, user: User) -> PaymentTransactionResponse:
        self._require(user, "payments:create")
        order = await self._get_order(data.order_id)
        method = normalize_payment_method(data.method)

        # US-P-05: a fully paid order is locked — no further payment records.
        # _effective_paid also honours the legacy admin "mark as paid" flag.
        paid_map, marked = await self._order_payment_maps([order.id])
        paid_so_far, current_status = self._effective_paid(order, paid_map, marked)
        if current_status == "paid":
            raise ValidationError("Order is already fully paid — payment record is locked")
        remaining = max(Decimal("0"), (order.total or Decimal("0")) - paid_so_far)
        if remaining <= 0:
            raise ValidationError("Order is already fully paid — payment record is locked")
        if data.amount > remaining:
            raise ValidationError(f"Amount exceeds remaining balance ({remaining} {order.currency})")

        inv = await self._ensure_final_invoice(order)
        txn_num = f"TXN-{secrets.token_hex(4).upper()[:8]}"
        tx = PaymentTransaction(
            transaction_number=txn_num,
            order_id=order.id,
            invoice_id=inv.id if inv else None,
            partner_id=order.partner_id,
            amount=data.amount,
            currency=order.currency,
            method=method,
            status=PaymentStatus.SUCCESS,
            recorded_by_id=user.id,
            driver_confirmed=True,
            note=data.note,
        )
        self.db.add(tx)
        if inv:
            await self.db.flush()
            await self._sync_invoice_payment_status(inv)
        order.payment_method = method
        if paid_so_far + data.amount >= (order.total or Decimal("0")):
            await self._upsert_order_paid_record(order.id, user.id)
        await self.db.flush()
        return PaymentTransactionResponse(
            id=tx.id,
            transaction_number=tx.transaction_number,
            order_id=tx.order_id,
            amount=tx.amount,
            currency=tx.currency,
            method=tx.method,
            status=tx.status.value,
            driver_confirmed=tx.driver_confirmed,
            confirmation_reference=tx.confirmation_reference,
            note=tx.note,
            created_at=tx.created_at,
            customer_name=order.customer_name,
        )

    async def record_delivery_payment(
        self,
        order: Order,
        method: str,
        user_id: uuid.UUID | None,
        invoice: Invoice | None = None,
        *,
        amount: Decimal | None = None,
        confirmation_reference: str | None = None,
    ) -> CustomerPaymentStatus:
        """US-22/23/24: record payment at delivery and refresh invoice payment_status."""
        inv = invoice or await self._get_final_invoice_for_order(order.id)
        if not inv:
            return CustomerPaymentStatus.UNPAID

        paid_so_far = await self._paid_amount(inv.id)
        remaining = max(Decimal("0"), inv.total - paid_so_far)
        if remaining <= 0:
            return inv.payment_status

        pay_amount = amount if amount is not None else remaining
        if pay_amount <= 0 or pay_amount > remaining:
            raise ValidationError("Invalid payment amount")

        needs_confirm = method in ("card_transfer", "pos") and not confirmation_reference
        txn_status = PaymentStatus.PENDING if needs_confirm else PaymentStatus.SUCCESS

        txn_num = f"TXN-{secrets.token_hex(4).upper()[:8]}"
        self.db.add(
            PaymentTransaction(
                transaction_number=txn_num,
                order_id=order.id,
                invoice_id=inv.id,
                partner_id=order.partner_id,
                amount=pay_amount,
                currency=order.currency,
                method=method,
                status=txn_status,
                recorded_by_id=user_id,
                driver_confirmed=not needs_confirm,
                confirmation_reference=confirmation_reference,
                note="Delivery payment",
            )
        )
        order.payment_method = method
        await self.db.flush()
        if txn_status == PaymentStatus.SUCCESS:
            await self._sync_invoice_payment_status(inv)
        await self.db.flush()
        return inv.payment_status

    async def issue_final_invoice(
        self,
        order: Order,
        carpet: Carpet | None,
        *,
        delivered_at: datetime | None = None,
    ) -> FinalInvoiceResponse:
        """US-21 / US-20A: convert proforma or issue final invoice after successful delivery."""
        sess_result = await self.db.execute(
            select(ServiceSession).where(ServiceSession.order_id == order.id)
        )
        session = sess_result.scalar_one_or_none()

        repair_amount = await self._repair_total_for_order(order.id, carpet.id if carpet else None)
        service_amount = order.subtotal
        if repair_amount > 0:
            service_amount = max(Decimal("0"), order.subtotal - repair_amount)

        svc = order.service_type.value if hasattr(order.service_type, "value") else str(order.service_type)
        service_area = None
        if carpet and carpet.dimensions:
            service_area = carpet.dimensions
        elif order.carpet_dimensions:
            service_area = order.carpet_dimensions

        now = delivered_at or datetime.now(timezone.utc)
        due = (now + timedelta(days=settings.invoice_payment_due_days)).date()

        inv = await self._get_final_invoice_for_order(order.id)
        proforma = await self._get_proforma_for_order(order.id)

        if inv and inv.invoice_type == InvoiceType.INVOICE and inv.issued_at:
            await self._populate_invoice_fields(
                inv, order, carpet, repair_amount, service_amount, svc, service_area, now
            )
            if not inv.due_date:
                inv.due_date = due
            await self._sync_invoice_payment_status(inv)
            await self.db.flush()
            return await self._final_invoice_response(inv)

        if proforma and not inv:
            inv = proforma
            if inv.invoice_number.startswith("PRO-") or inv.status == InvoiceStatus.DRAFT:
                inv.invoice_number = f"INV-{now.year}-{secrets.token_hex(3).upper()}"
        elif not inv:
            inv_num = f"INV-{now.year}-{secrets.token_hex(3).upper()}"
            inv = Invoice(
                invoice_number=inv_num,
                order_id=order.id,
                service_session_id=session.id if session else None,
                partner_id=order.partner_id,
                invoice_type=InvoiceType.INVOICE,
                status=InvoiceStatus.ISSUED,
                subtotal=order.subtotal,
                tax=order.tax,
                total=order.total,
                currency=order.currency,
                issued_at=now,
                delivered_at=now,
                due_date=due,
                payment_status=CustomerPaymentStatus.UNPAID,
            )
            self.db.add(inv)
            await self.db.flush()

        await self._populate_invoice_fields(
            inv, order, carpet, repair_amount, service_amount, svc, service_area, now
        )
        if not inv.due_date:
            inv.due_date = due
        await self._sync_invoice_payment_status(inv)
        await self.db.flush()
        return await self._final_invoice_response(inv)

    async def get_invoice_for_order(self, order_id: uuid.UUID, user: User) -> InvoiceResponse:
        self._require(user, "payments:read")
        inv = await self.get_invoice_for_order_public(order_id)
        if not inv:
            raise NotFoundError("Invoice not found for this order")
        return inv

    async def get_invoice_for_order_public(self, order_id: uuid.UUID) -> InvoiceResponse | None:
        inv = await self._get_final_invoice_for_order(order_id)
        if not inv:
            return None
        order = await self._get_order(order_id)
        await self._sync_invoice_payment_status(inv)
        return await self._invoice_response(inv, order.customer_name)

    async def issue_proforma(self, order_id: uuid.UUID, user: User) -> InvoiceResponse:
        self._require(user, "payments:create")
        order = await self._get_order(order_id)
        inv = await self._ensure_invoice(order, as_proforma_first=True)
        return await self._invoice_response(inv, order.customer_name)

    async def convert_to_invoice(self, invoice_id: uuid.UUID, user: User) -> InvoiceResponse:
        self._require(user, "payments:create")
        inv = await self._get_invoice(invoice_id)
        if inv.invoice_type != InvoiceType.PROFORMA:
            raise ValidationError("Only proforma invoices can be converted")
        inv.invoice_type = InvoiceType.INVOICE
        inv.status = InvoiceStatus.ISSUED
        inv.issued_at = datetime.now(timezone.utc)
        inv.due_date = (datetime.now(timezone.utc) + timedelta(days=settings.invoice_payment_due_days)).date()
        await self._sync_invoice_payment_status(inv)
        order = await self._get_order(inv.order_id)
        return await self._invoice_response(inv, order.customer_name)

    # ------------------------------------------------------------------
    # Draft invoice (پیش‌فاکتور) workflow — EPIC Draft Invoice Management
    # ------------------------------------------------------------------

    async def sync_draft_invoice_from_pickup(
        self, order: Order, carpets: list[Carpet], entries: list
    ) -> Invoice | None:
        """US-DI-01: create/refresh the draft invoice when the driver records carpets."""
        if await self._get_final_invoice_for_order(order.id):
            return None  # financials are locked once the final invoice exists
        inv = await self._get_proforma_for_order(order.id)
        now = datetime.now(timezone.utc)
        if inv is None:
            sess_result = await self.db.execute(
                select(ServiceSession).where(ServiceSession.order_id == order.id)
            )
            session = sess_result.scalar_one_or_none()
            inv = Invoice(
                invoice_number=f"PRO-{now.year}-{secrets.token_hex(3).upper()}",
                order_id=order.id,
                service_session_id=session.id if session else None,
                partner_id=order.partner_id,
                invoice_type=InvoiceType.PROFORMA,
                status=InvoiceStatus.DRAFT,
                subtotal=Decimal("0"),
                tax=Decimal("0"),
                total=Decimal("0"),
                currency=order.currency,
                payment_status=CustomerPaymentStatus.UNPAID,
            )
            self.db.add(inv)
            await self.db.flush()
        else:
            # Carpet data changed — the driver must confirm the invoice again.
            inv.status = InvoiceStatus.DRAFT
            inv.confirmed_at = None
            inv.confirmed_by_id = None

        inv.customer_name = order.customer_name
        inv.customer_phone = order.customer_phone
        inv.customer_address = order.pickup_address
        inv.carpet_count = len(carpets)
        inv.service_type = (
            order.service_type.value
            if hasattr(order.service_type, "value")
            else str(order.service_type)
        )

        await self.db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
        total = Decimal("0")
        for idx, (carpet, entry) in enumerate(zip(carpets, entries)):
            price = entry.price if entry.price is not None else Decimal("0")
            services = [{"name": "Washing", "amount": str(price)}]
            if entry.needs_repair:
                services.append({"name": "Repair", "amount": "0"})
            self.db.add(
                InvoiceItem(
                    invoice_id=inv.id,
                    carpet_id=carpet.id,
                    position=idx,
                    carpet_type=carpet.carpet_type,
                    services=services,
                    amount=price,
                )
            )
            total += price
        inv.subtotal = total
        inv.tax = Decimal("0")
        inv.total = total
        await self.db.flush()
        return inv

    async def get_draft_invoice(self, order_id: uuid.UUID, user: User) -> DraftInvoiceResponse:
        """US-DI-02: admin views the draft invoice of a session/order."""
        self._require(user, "payments:read")
        return await self.build_draft_invoice_response(order_id)

    async def build_draft_invoice_response(self, order_id: uuid.UUID) -> DraftInvoiceResponse:
        order = await self._get_order(order_id)
        inv = await self._get_final_invoice_for_order(order_id) or await self._get_proforma_for_order(order_id)
        if inv is None:
            raise NotFoundError("No invoice for this order yet — carpets have not been recorded")

        items_result = await self.db.execute(
            select(InvoiceItem, Carpet.carpet_code)
            .outerjoin(Carpet, Carpet.id == InvoiceItem.carpet_id)
            .where(InvoiceItem.invoice_id == inv.id)
            .order_by(InvoiceItem.position)
        )
        items = [
            DraftInvoiceItemResponse(
                id=item.id,
                carpet_id=item.carpet_id,
                carpet_code=code,
                position=item.position,
                carpet_type=item.carpet_type,
                services=[
                    InvoiceItemService(
                        name=str(s.get("name", "")),
                        amount=Decimal(str(s.get("amount", 0))),
                    )
                    for s in (item.services or [])
                ],
                amount=item.amount,
            )
            for item, code in items_result.all()
        ]

        session_code = None
        session_id = inv.service_session_id
        sess_result = await self.db.execute(
            select(ServiceSession).where(ServiceSession.order_id == order.id)
        )
        session = sess_result.scalar_one_or_none()
        if session:
            session_code = session.session_code
            if session_id is None:
                session_id = session.id
                inv.service_session_id = session.id

        confirmed_by_name = None
        if inv.confirmed_by_id:
            name_result = await self.db.execute(
                select(User.full_name).where(User.id == inv.confirmed_by_id)
            )
            confirmed_by_name = name_result.scalar_one_or_none()

        is_final = inv.invoice_type == InvoiceType.INVOICE
        ps = inv.payment_status.value if inv.payment_status else "unpaid"
        if is_final:
            status_val = "final"
        else:
            status_val = inv.status.value if inv.status else "draft"
            if status_val not in ("draft", "confirmed", "sent"):
                status_val = "draft"

        return DraftInvoiceResponse(
            id=inv.id,
            invoice_number=inv.invoice_number,
            order_id=order.id,
            order_number=order.order_number,
            tracking_code=order.tracking_code,
            service_session_id=session_id,
            session_code=session_code,
            customer_name=inv.customer_name or order.customer_name,
            customer_phone=inv.customer_phone or order.customer_phone,
            customer_address=inv.customer_address or order.pickup_address,
            order_date=order.created_at,
            pickup_date=order.pickup_started_at,
            carpet_count=inv.carpet_count or order.carpet_count or len(items),
            items=items,
            subtotal=inv.subtotal,
            tax=inv.tax,
            total=inv.total,
            currency=inv.currency,
            payment_status=ps,
            payment_status_label=PAYMENT_STATUS_LABELS.get(ps, ps),
            invoice_status=status_val,
            editable=not is_final,
            confirmed_at=inv.confirmed_at,
            confirmed_by_name=confirmed_by_name,
            sent_at=inv.sent_at,
            sent_to_phone=inv.sent_to_phone,
            sent_status=inv.sent_status,
        )

    async def update_draft_invoice(
        self, invoice_id: uuid.UUID, data: UpdateDraftInvoiceRequest, user: User
    ) -> DraftInvoiceResponse:
        """US-DI-03: admin edits items/services/amounts before finalization."""
        self._require(user, "payments:create")
        inv = await self._get_invoice(invoice_id)
        if inv.invoice_type != InvoiceType.PROFORMA:
            raise ValidationError("Draft invoice is locked — the final invoice has been issued")
        order = await self._get_order(inv.order_id)

        await self.db.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
        total = Decimal("0")
        for idx, item in enumerate(data.items):
            amount = sum((s.amount for s in item.services), Decimal("0"))
            self.db.add(
                InvoiceItem(
                    invoice_id=inv.id,
                    carpet_id=item.carpet_id,
                    position=idx,
                    carpet_type=item.carpet_type,
                    services=[{"name": s.name, "amount": str(s.amount)} for s in item.services],
                    amount=amount,
                )
            )
            if item.carpet_id:
                carpet_result = await self.db.execute(
                    select(Carpet).where(Carpet.id == item.carpet_id)
                )
                carpet = carpet_result.scalar_one_or_none()
                if carpet and carpet.order_id == order.id:
                    if item.carpet_type:
                        carpet.carpet_type = item.carpet_type
                    carpet.price = amount
            total += amount

        inv.subtotal = total
        inv.total = total + (inv.tax or Decimal("0"))
        inv.carpet_count = len(data.items)
        order.subtotal = total
        order.total = inv.total
        order.carpet_count = len(data.items)
        await self.db.flush()
        return await self.build_draft_invoice_response(order.id)

    async def confirm_draft_invoice(self, order: Order, user: User) -> DraftInvoiceResponse:
        """US-DI-04/05: driver confirms; the system sends it to the customer via WhatsApp."""
        if await self._get_final_invoice_for_order(order.id):
            raise ValidationError("Invoice is already final")
        inv = await self._get_proforma_for_order(order.id)
        if inv is None:
            raise NotFoundError("No draft invoice for this order — record carpets first")
        now = datetime.now(timezone.utc)
        if inv.status not in (InvoiceStatus.CONFIRMED, InvoiceStatus.SENT):
            inv.status = InvoiceStatus.CONFIRMED
            inv.confirmed_at = now
            inv.confirmed_by_id = user.id
        # US-DI-05: the phone always comes from the customer linked to the
        # session — it is never re-entered by the driver or admin.
        if inv.status == InvoiceStatus.CONFIRMED:
            phone = inv.customer_phone or order.customer_phone
            message = await self._draft_invoice_message(inv, order)
            ok = send_draft_invoice_sync(
                phone,
                message,
                customer_name=inv.customer_name or order.customer_name,
                invoice_number=inv.invoice_number,
                total=f"{inv.total:.3f} {inv.currency}",
                tracking_code=order.tracking_code,
            )
            inv.sent_at = now
            inv.sent_to_phone = phone
            inv.sent_status = "sent" if ok else "failed"
            if ok:
                inv.status = InvoiceStatus.SENT
        await self.db.flush()
        return await self.build_draft_invoice_response(order.id)

    async def _draft_invoice_message(self, inv: Invoice, order: Order) -> str:
        items_result = await self.db.execute(
            select(InvoiceItem)
            .where(InvoiceItem.invoice_id == inv.id)
            .order_by(InvoiceItem.position)
        )
        lines = [
            f"Albesat Carpet Cleaning — Draft Invoice {inv.invoice_number}",
            f"Order {order.order_number} ({order.tracking_code})",
            "",
        ]
        for item in items_result.scalars().all():
            svc = ", ".join(
                f"{s.get('name')}: {Decimal(str(s.get('amount', 0))):.2f}"
                for s in (item.services or [])
            )
            label = item.carpet_type or "Carpet"
            lines.append(
                f"- {label} #{item.position + 1}: {svc} = {item.amount:.2f} {inv.currency}"
            )
        lines.append("")
        lines.append(f"Total: {inv.total:.2f} {inv.currency}")
        lines.append("Payment: Pending")
        base = settings.public_web_url.rstrip("/")
        lines.append(f"View your invoice: {base}/invoice/{order.tracking_code}")
        return "\n".join(lines)

    async def get_public_invoice(self, tracking_code: str) -> DraftInvoiceResponse:
        """Public customer-facing invoice view — looked up by tracking code."""
        clean = tracking_code.strip().lstrip("#")
        result = await self.db.execute(
            select(Order).where(
                or_(Order.tracking_code == clean, Order.order_number == clean)
            )
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found. Check your tracking code.")
        return await self.build_draft_invoice_response(order.id)

    async def mark_settlement_paid(self, settlement_id: uuid.UUID, user: User) -> SettlementResponse:
        self._require(user, "payments:create")
        result = await self.db.execute(
            select(PartnerSettlement, Partner.name)
            .join(Partner, Partner.id == PartnerSettlement.partner_id)
            .where(PartnerSettlement.id == settlement_id)
        )
        row = result.one_or_none()
        if not row:
            raise NotFoundError("Settlement not found")
        s, name = row
        s.status = SettlementStatus.PAID
        s.paid_at = datetime.now(timezone.utc)
        await self.db.flush()
        return SettlementResponse(
            id=s.id,
            partner_id=s.partner_id,
            partner_name=name,
            period_start=s.period_start,
            period_end=s.period_end,
            total_orders=s.total_orders,
            gross_amount=s.gross_amount,
            commission_amount=s.commission_amount,
            net_payable=s.net_payable,
            status=s.status.value,
            paid_at=s.paid_at,
        )

    async def _ensure_invoice(
        self, order: Order, *, as_proforma_first: bool = False
    ) -> Invoice | None:
        result = await self.db.execute(select(Invoice).where(Invoice.order_id == order.id))
        inv = result.scalar_one_or_none()
        if inv:
            return inv
        sess_result = await self.db.execute(
            select(ServiceSession).where(ServiceSession.order_id == order.id)
        )
        session = sess_result.scalar_one_or_none()
        inv_type = InvoiceType.PROFORMA if as_proforma_first else InvoiceType.INVOICE
        inv_status = InvoiceStatus.DRAFT if as_proforma_first else InvoiceStatus.ISSUED
        inv = Invoice(
            invoice_number=f"INV-{secrets.token_hex(4).upper()[:8]}",
            order_id=order.id,
            service_session_id=session.id if session else None,
            partner_id=order.partner_id,
            invoice_type=inv_type,
            status=inv_status,
            subtotal=order.subtotal,
            tax=order.tax,
            total=order.total,
            currency=order.currency,
            issued_at=None if as_proforma_first else datetime.now(timezone.utc),
        )
        self.db.add(inv)
        await self.db.flush()
        return inv

    async def _get_order(self, order_id: uuid.UUID) -> Order:
        result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError("Order not found")
        return order

    async def _get_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        result = await self.db.execute(select(Invoice).where(Invoice.id == invoice_id))
        inv = result.scalar_one_or_none()
        if not inv:
            raise NotFoundError("Invoice not found")
        return inv

    async def _invoice_response(self, inv: Invoice, customer_name: str | None) -> InvoiceResponse:
        paid = await self._paid_amount(inv.id)
        remaining = max(Decimal("0"), inv.total - paid)
        ps = inv.payment_status.value if inv.payment_status else "unpaid"
        return InvoiceResponse(
            id=inv.id,
            invoice_number=inv.invoice_number,
            order_id=inv.order_id,
            service_session_id=inv.service_session_id,
            invoice_type=inv.invoice_type.value,
            status=inv.status.value,
            subtotal=inv.subtotal,
            tax=inv.tax,
            total=inv.total,
            currency=inv.currency,
            issued_at=inv.issued_at,
            paid_at=inv.paid_at,
            delivered_at=inv.delivered_at,
            due_date=inv.due_date,
            amount_paid=paid,
            remaining_amount=remaining,
            customer_name=inv.customer_name or customer_name,
            customer_phone=inv.customer_phone,
            customer_address=inv.customer_address,
            carpet_count=inv.carpet_count,
            service_type=inv.service_type,
            service_area=inv.service_area,
            service_amount=inv.service_amount,
            repair_amount=inv.repair_amount,
            payment_status=ps,
            payment_status_label=PAYMENT_STATUS_LABELS.get(ps, ps),
        )

    async def _final_invoice_response(self, inv: Invoice) -> FinalInvoiceResponse:
        paid = await self._paid_amount(inv.id)
        remaining = max(Decimal("0"), inv.total - paid)
        ps = inv.payment_status.value if inv.payment_status else "unpaid"
        return FinalInvoiceResponse(
            id=inv.id,
            invoice_number=inv.invoice_number,
            order_id=inv.order_id,
            service_session_id=inv.service_session_id,
            customer_name=inv.customer_name or "",
            customer_phone=inv.customer_phone or "",
            customer_address=inv.customer_address,
            carpet_count=inv.carpet_count or 1,
            service_type=inv.service_type or "standard",
            service_area=inv.service_area,
            service_amount=inv.service_amount or inv.subtotal,
            repair_amount=inv.repair_amount or Decimal("0"),
            subtotal=inv.subtotal,
            tax=inv.tax,
            total=inv.total,
            currency=inv.currency,
            payment_status=ps,
            payment_status_label=PAYMENT_STATUS_LABELS.get(ps, ps),
            amount_paid=paid,
            remaining_amount=remaining,
            due_date=inv.due_date,
            issued_at=inv.issued_at or datetime.now(timezone.utc),
            paid_at=inv.paid_at,
            delivered_at=inv.delivered_at,
        )

    async def list_receivables(self, user: User, limit: int = 50) -> list[InvoiceResponse]:
        """US-21A: unpaid / partial / overdue final invoices for debt tracking."""
        self._require(user, "payments:read")
        result = await self.db.execute(
            select(Invoice, Order.customer_name)
            .join(Order, Order.id == Invoice.order_id)
            .where(
                Invoice.invoice_type == InvoiceType.INVOICE,
                Invoice.payment_status.in_(
                    [
                        CustomerPaymentStatus.UNPAID,
                        CustomerPaymentStatus.PARTIALLY_PAID,
                        CustomerPaymentStatus.FAILED_PAYMENT,
                        CustomerPaymentStatus.OVERDUE,
                    ]
                ),
            )
            .order_by(Invoice.due_date.asc().nullslast(), Invoice.issued_at.desc().nullslast())
            .limit(limit)
        )
        out: list[InvoiceResponse] = []
        for inv, name in result.all():
            await self._sync_invoice_payment_status(inv)
            if inv.payment_status == CustomerPaymentStatus.PAID:
                continue
            out.append(await self._invoice_response(inv, name))
        return out

    async def _populate_invoice_fields(
        self,
        inv: Invoice,
        order: Order,
        carpet: Carpet | None,
        repair_amount: Decimal,
        service_amount: Decimal,
        service_type: str,
        service_area: str | None,
        delivered_at: datetime,
    ) -> None:
        inv.customer_name = order.customer_name
        inv.customer_phone = order.customer_phone
        inv.customer_address = order.pickup_address
        inv.carpet_count = order.carpet_count or 1
        inv.service_type = service_type
        inv.service_area = service_area
        inv.service_amount = service_amount
        inv.repair_amount = repair_amount
        inv.subtotal = order.subtotal
        inv.tax = order.tax
        inv.total = order.total
        inv.delivered_at = delivered_at
        inv.invoice_type = InvoiceType.INVOICE
        inv.status = InvoiceStatus.ISSUED
        if not inv.issued_at:
            inv.issued_at = delivered_at

    async def _repair_total_for_order(
        self, order_id: uuid.UUID, carpet_id: uuid.UUID | None
    ) -> Decimal:
        q = select(func.coalesce(func.sum(RepairRequest.quoted_price), 0)).where(
            RepairRequest.order_id == order_id,
            RepairRequest.status.in_(
                [
                    RepairWorkflowStatus.CUSTOMER_APPROVED,
                    RepairWorkflowStatus.IN_REPAIR,
                    RepairWorkflowStatus.REPAIR_COMPLETED,
                ]
            ),
        )
        if carpet_id:
            q = q.where(RepairRequest.carpet_id == carpet_id)
        result = await self.db.execute(q)
        return Decimal(str(result.scalar() or 0))

    async def _get_final_invoice_for_order(self, order_id: uuid.UUID) -> Invoice | None:
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.order_id == order_id, Invoice.invoice_type == InvoiceType.INVOICE)
            .order_by(Invoice.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _get_proforma_for_order(self, order_id: uuid.UUID) -> Invoice | None:
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.order_id == order_id, Invoice.invoice_type == InvoiceType.PROFORMA)
            .order_by(Invoice.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _ensure_final_invoice(self, order: Order) -> Invoice | None:
        inv = await self._get_final_invoice_for_order(order.id)
        if inv:
            return inv
        return await self._ensure_invoice(order)

    async def _paid_amount(self, invoice_id: uuid.UUID) -> Decimal:
        result = await self.db.execute(
            select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(
                PaymentTransaction.invoice_id == invoice_id,
                PaymentTransaction.status == PaymentStatus.SUCCESS,
            )
        )
        return Decimal(str(result.scalar() or 0))

    async def _sync_invoice_payment_status(self, inv: Invoice) -> CustomerPaymentStatus:
        """US-21A: derive Unpaid / Partial / Paid / Overdue from successful payments."""
        paid = await self._paid_amount(inv.id)
        remaining = max(Decimal("0"), inv.total - paid)
        today = datetime.now(timezone.utc).date()

        # Only final invoices mirror payment progress into InvoiceStatus —
        # proformas keep their draft/confirmed/sent workflow status.
        is_final = inv.invoice_type == InvoiceType.INVOICE
        if paid >= inv.total:
            inv.payment_status = CustomerPaymentStatus.PAID
            if is_final:
                inv.status = InvoiceStatus.PAID
            if not inv.paid_at:
                inv.paid_at = datetime.now(timezone.utc)
        elif paid > 0:
            inv.payment_status = CustomerPaymentStatus.PARTIALLY_PAID
            if is_final:
                inv.status = InvoiceStatus.ISSUED
            inv.paid_at = None
        else:
            inv.payment_status = CustomerPaymentStatus.UNPAID
            if is_final:
                inv.status = InvoiceStatus.ISSUED
            inv.paid_at = None

        if remaining > 0 and inv.due_date and today > inv.due_date:
            inv.payment_status = CustomerPaymentStatus.OVERDUE

        return inv.payment_status

    async def get_invoice_crm_detail(
        self, invoice_id: uuid.UUID, user: User
    ) -> InvoiceCrmDetailResponse:
        """US-21B: CRM invoice detail with services and payment history."""
        self._require(user, "payments:read")
        inv = await self._get_invoice(invoice_id)
        if inv.invoice_type != InvoiceType.INVOICE:
            raise ValidationError("CRM view is available for final invoices only")
        order = await self._get_order(inv.order_id)
        await self._sync_invoice_payment_status(inv)

        tx_result = await self.db.execute(
            select(PaymentTransaction)
            .where(PaymentTransaction.invoice_id == inv.id)
            .order_by(PaymentTransaction.created_at.desc())
        )
        payment_history = [
            PaymentTransactionResponse(
                id=tx.id,
                transaction_number=tx.transaction_number,
                order_id=tx.order_id,
                amount=tx.amount,
                currency=tx.currency,
                method=tx.method,
                status=tx.status.value,
                driver_confirmed=tx.driver_confirmed,
                confirmation_reference=tx.confirmation_reference,
                note=tx.note,
                created_at=tx.created_at,
                customer_name=order.customer_name,
            )
            for tx in tx_result.scalars().all()
        ]

        log_result = await self.db.execute(
            select(PaymentReminderLog)
            .where(PaymentReminderLog.invoice_id == inv.id)
            .order_by(PaymentReminderLog.created_at.desc())
        )
        reminder_logs = [
            PaymentReminderLogResponse(
                id=log.id,
                invoice_id=log.invoice_id,
                channel=log.channel,
                status=log.status,
                message=log.message,
                created_at=log.created_at,
            )
            for log in log_result.scalars().all()
        ]

        services: list[InvoiceServiceLine] = []
        if inv.service_amount and inv.service_amount > 0:
            services.append(
                InvoiceServiceLine(
                    label=f"{inv.service_type or 'Service'} wash",
                    amount=inv.service_amount,
                )
            )
        if inv.repair_amount and inv.repair_amount > 0:
            services.append(InvoiceServiceLine(label="Repair services", amount=inv.repair_amount))
        if inv.tax and inv.tax > 0:
            services.append(InvoiceServiceLine(label="Tax", amount=inv.tax))

        return InvoiceCrmDetailResponse(
            invoice=await self._invoice_response(inv, order.customer_name),
            services_done=services,
            payment_history=payment_history,
            reminder_logs=reminder_logs,
        )

    async def send_payment_reminder(
        self,
        invoice_id: uuid.UUID,
        user: User,
        data: PaymentReminderRequest | None = None,
    ) -> list[PaymentReminderLogResponse]:
        """US-21C: SMS / WhatsApp reminder with audit log (manual admin send)."""
        self._require(user, "payments:create")
        inv = await self._get_invoice(invoice_id)
        order = await self._get_order(inv.order_id)
        await self._sync_invoice_payment_status(inv)
        if inv.payment_status == CustomerPaymentStatus.PAID:
            raise ValidationError("Invoice is already paid")

        phone = inv.customer_phone or order.customer_phone
        if not phone:
            raise ValidationError("Customer phone is required to send reminders")

        req = data or PaymentReminderRequest()
        channels = [c.lower() for c in req.channels if c.lower() in ("sms", "whatsapp")]
        if not channels:
            channels = ["sms"]

        paid = await self._paid_amount(inv.id)
        remaining = max(Decimal("0"), inv.total - paid)
        default_msg = (
            f"Payment reminder: invoice {inv.invoice_number} — "
            f"remaining {remaining} {inv.currency}. Due: {inv.due_date or 'ASAP'}."
        )
        message = req.message or default_msg

        logs: list[PaymentReminderLogResponse] = []
        for channel in channels:
            sent = False
            if channel == "sms":
                sent = send_sms_reminder_sync(phone, message)
            elif channel == "whatsapp":
                sent = send_payment_reminder_sync(phone, message)

            log = PaymentReminderLog(
                invoice_id=inv.id,
                channel=channel,
                status="sent" if sent else "failed",
                message=message,
                sent_by_id=user.id,
            )
            self.db.add(log)
            await self.db.flush()
            logs.append(
                PaymentReminderLogResponse(
                    id=log.id,
                    invoice_id=log.invoice_id,
                    channel=log.channel,
                    status=log.status,
                    message=log.message,
                    created_at=log.created_at,
                )
            )
        return logs

    async def record_driver_payment(
        self, order_id: uuid.UUID, data: DriverPaymentRequest, user: User
    ) -> PaymentTransactionResponse:
        """US-22/23/24: driver records cash, card transfer, or POS payment."""
        if not user.check_permission("logistics:deliver"):
            raise ForbiddenError("Missing logistics:deliver")
        order = await self._get_order(order_id)
        inv = await self._get_final_invoice_for_order(order.id)
        if not inv:
            raise ValidationError("Final invoice not issued yet")

        await self.record_delivery_payment(
            order,
            data.method,
            user.id,
            invoice=inv,
            amount=data.amount,
            confirmation_reference=data.confirmation_reference,
        )

        tx_result = await self.db.execute(
            select(PaymentTransaction)
            .where(PaymentTransaction.order_id == order.id)
            .order_by(PaymentTransaction.created_at.desc())
            .limit(1)
        )
        tx = tx_result.scalar_one()
        return PaymentTransactionResponse(
            id=tx.id,
            transaction_number=tx.transaction_number,
            order_id=tx.order_id,
            amount=tx.amount,
            currency=tx.currency,
            method=tx.method,
            status=tx.status.value,
            driver_confirmed=tx.driver_confirmed,
            confirmation_reference=tx.confirmation_reference,
            note=tx.note or data.note,
            created_at=tx.created_at,
            customer_name=order.customer_name,
        )

    async def confirm_driver_payment(
        self,
        order_id: uuid.UUID,
        transaction_id: uuid.UUID,
        data: ConfirmDriverPaymentRequest,
        user: User,
    ) -> PaymentTransactionResponse:
        """US-23/24: driver confirms card transfer or POS payment."""
        if not user.check_permission("logistics:deliver"):
            raise ForbiddenError("Missing logistics:deliver")
        order = await self._get_order(order_id)
        result = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.id == transaction_id,
                PaymentTransaction.order_id == order.id,
            )
        )
        tx = result.scalar_one_or_none()
        if not tx:
            raise NotFoundError("Payment transaction not found")
        if tx.status != PaymentStatus.PENDING:
            raise ValidationError("Payment is already confirmed")

        tx.status = PaymentStatus.SUCCESS
        tx.driver_confirmed = True
        tx.confirmation_reference = data.confirmation_reference or tx.confirmation_reference
        if data.note:
            tx.note = data.note

        inv = await self._get_final_invoice_for_order(order.id)
        if inv:
            await self._sync_invoice_payment_status(inv)
        await self.db.flush()

        return PaymentTransactionResponse(
            id=tx.id,
            transaction_number=tx.transaction_number,
            order_id=tx.order_id,
            amount=tx.amount,
            currency=tx.currency,
            method=tx.method,
            status=tx.status.value,
            driver_confirmed=tx.driver_confirmed,
            confirmation_reference=tx.confirmation_reference,
            note=tx.note,
            created_at=tx.created_at,
            customer_name=order.customer_name,
        )

    async def _order_paid_amount(self, order_id: uuid.UUID) -> Decimal:
        """Total successful payments recorded against an order (order-scoped)."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(
                PaymentTransaction.order_id == order_id,
                PaymentTransaction.status == PaymentStatus.SUCCESS,
            )
        )
        return Decimal(str(result.scalar() or 0))

    async def _upsert_order_paid_record(self, order_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Keep the legacy per-order paid flag in sync with the payment ledger."""
        existing = await self.db.execute(
            select(OrderPaymentRecord).where(OrderPaymentRecord.order_id == order_id)
        )
        record = existing.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if record:
            if not record.is_paid:
                record.is_paid = True
                record.paid_at = now
                record.marked_by_id = user_id
        else:
            self.db.add(
                OrderPaymentRecord(
                    order_id=order_id, is_paid=True, paid_at=now, marked_by_id=user_id
                )
            )

    async def _order_payment_maps(
        self, order_ids: list[uuid.UUID]
    ) -> tuple[dict[uuid.UUID, Decimal], set[uuid.UUID]]:
        """Paid-amount per order + set of orders flagged paid by an admin."""
        if not order_ids:
            return {}, set()
        tx_result = await self.db.execute(
            select(
                PaymentTransaction.order_id,
                func.coalesce(func.sum(PaymentTransaction.amount), 0),
            )
            .where(
                PaymentTransaction.order_id.in_(order_ids),
                PaymentTransaction.status == PaymentStatus.SUCCESS,
            )
            .group_by(PaymentTransaction.order_id)
        )
        paid_map = {oid: Decimal(str(total)) for oid, total in tx_result.all()}
        marked_result = await self.db.execute(
            select(OrderPaymentRecord.order_id).where(
                OrderPaymentRecord.order_id.in_(order_ids),
                OrderPaymentRecord.is_paid.is_(True),
            )
        )
        return paid_map, set(marked_result.scalars().all())

    @staticmethod
    def _effective_paid(
        order: Order,
        paid_map: dict[uuid.UUID, Decimal],
        marked_ids: set[uuid.UUID],
    ) -> tuple[Decimal, str]:
        """Resolve (paid_amount, payment_status) honouring the legacy mark-paid flag."""
        total = order.total or Decimal("0")
        paid = paid_map.get(order.id, Decimal("0"))
        if order.id in marked_ids and paid < total:
            paid = total
        if total > 0 and paid >= total:
            status = "paid"
        elif paid > 0:
            status = "partially_paid"
        else:
            status = "unpaid"
        return paid, status

    def _order_payment_info(
        self,
        order: Order,
        paid_map: dict[uuid.UUID, Decimal],
        marked_ids: set[uuid.UUID],
        paid_at: datetime | None = None,
    ) -> OrderPaymentInfo:
        paid, status = self._effective_paid(order, paid_map, marked_ids)
        return OrderPaymentInfo(
            order_id=order.id,
            order_number=order.order_number,
            tracking_code=order.tracking_code,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            order_status=order.status.value,
            total=order.total or Decimal("0"),
            currency=order.currency,
            paid_amount=paid,
            payment_status=status,
            payment_method=order.payment_method,
            paid_at=paid_at,
            is_locked=status == "paid",
        )

    async def search_order_payment(self, query: str, user: User) -> OrderPaymentInfo:
        """US-P-02: search an order by Order ID / tracking code → payment status."""
        self._require(user, "payments:read")
        clean = query.strip().lstrip("#")
        if not clean:
            raise ValidationError("Enter an Order ID to search")
        result = await self.db.execute(
            select(Order).where(
                or_(
                    func.lower(Order.order_number) == clean.lower(),
                    func.lower(Order.tracking_code) == clean.lower(),
                )
            ).limit(1)
        )
        order = result.scalar_one_or_none()
        if not order:
            # Escape LIKE metacharacters so "%"/"_" input cannot match everything.
            escaped = clean.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            result = await self.db.execute(
                select(Order)
                .where(
                    or_(
                        Order.order_number.ilike(f"%{escaped}%", escape="\\"),
                        Order.tracking_code.ilike(f"%{escaped}%", escape="\\"),
                    )
                )
                .order_by(Order.created_at.desc())
                .limit(1)
            )
            order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError("No order found for this Order ID")
        paid_map, marked = await self._order_payment_maps([order.id])
        paid_at = await self._order_paid_at(order.id)
        return self._order_payment_info(order, paid_map, marked, paid_at)

    async def _order_paid_at(self, order_id: uuid.UUID) -> datetime | None:
        result = await self.db.execute(
            select(func.max(PaymentTransaction.created_at)).where(
                PaymentTransaction.order_id == order_id,
                PaymentTransaction.status == PaymentStatus.SUCCESS,
            )
        )
        ts = result.scalar()
        if ts:
            return ts
        marked = await self.db.execute(
            select(OrderPaymentRecord.paid_at).where(
                OrderPaymentRecord.order_id == order_id,
                OrderPaymentRecord.is_paid.is_(True),
            )
        )
        return marked.scalar_one_or_none()

    async def confirm_order_payment(
        self, order_id: uuid.UUID, data: ConfirmOrderPaymentRequest, user: User
    ) -> OrderPaymentInfo:
        """US-P-04: confirm payment received — records remaining amount as paid.

        After confirmation the order is locked (US-P-05): status cannot go back
        to unpaid, method and amount are final.
        """
        self._require(user, "payments:create")
        order = await self._get_order(order_id)
        method = normalize_payment_method(data.method)

        paid_map, marked = await self._order_payment_maps([order.id])
        paid, status = self._effective_paid(order, paid_map, marked)
        if status == "paid":
            raise ValidationError("Payment is already confirmed — Paid status is locked")

        remaining = max(Decimal("0"), (order.total or Decimal("0")) - paid)
        if remaining <= 0:
            raise ValidationError("Nothing left to pay for this order")

        inv = await self._ensure_final_invoice(order)
        tx = PaymentTransaction(
            transaction_number=f"TXN-{secrets.token_hex(4).upper()[:8]}",
            order_id=order.id,
            invoice_id=inv.id if inv else None,
            partner_id=order.partner_id,
            amount=remaining,
            currency=order.currency,
            method=method,
            status=PaymentStatus.SUCCESS,
            recorded_by_id=user.id,
            driver_confirmed=True,
            note=data.note or "Payment confirmed by admin",
        )
        self.db.add(tx)
        await self.db.flush()
        if inv:
            await self._sync_invoice_payment_status(inv)
        order.payment_method = method
        await self._upsert_order_paid_record(order.id, user.id)
        await self.db.flush()

        paid_map, marked = await self._order_payment_maps([order.id])
        return self._order_payment_info(order, paid_map, marked, tx.created_at)

    def _pending_orders_query(self):
        """Delivered orders that are neither admin-marked paid nor fully paid by
        successful transactions (US-P-01)."""
        marked_paid = select(OrderPaymentRecord.order_id).where(
            OrderPaymentRecord.is_paid.is_(True)
        )
        tx_sums = (
            select(
                PaymentTransaction.order_id.label("order_id"),
                func.coalesce(func.sum(PaymentTransaction.amount), 0).label("paid"),
            )
            .where(PaymentTransaction.status == PaymentStatus.SUCCESS)
            .group_by(PaymentTransaction.order_id)
            .subquery()
        )
        return (
            select(Order)
            .outerjoin(tx_sums, tx_sums.c.order_id == Order.id)
            .where(
                Order.status == OrderStatus.DELIVERED,
                Order.id.not_in(marked_paid),
                func.coalesce(tx_sums.c.paid, 0) < Order.total,
            )
        )

    async def _pending_payments_count(self) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(self._pending_orders_query().subquery())
        )
        return int(result.scalar() or 0)

    async def pending_payments(self, user: User, limit: int = 100) -> PendingPaymentsResponse:
        """US-P-01: delivered orders whose payment is not settled yet."""
        self._require(user, "payments:read")
        total = await self._pending_payments_count()
        result = await self.db.execute(
            self._pending_orders_query().order_by(Order.updated_at.desc()).limit(limit)
        )
        orders = list(result.scalars().all())
        paid_map, marked = await self._order_payment_maps([o.id for o in orders])
        items = [self._order_payment_info(o, paid_map, marked) for o in orders]
        return PendingPaymentsResponse(items=items, total=total)

    async def payment_history(
        self, user: User, page: int = 1, page_size: int = 20
    ) -> PaymentHistoryResponse:
        """US-P-06: all recorded payments, newest first."""
        self._require(user, "payments:read")
        count_result = await self.db.execute(
            select(func.count()).select_from(PaymentTransaction)
        )
        total = count_result.scalar() or 0
        result = await self.db.execute(
            select(PaymentTransaction, Order.order_number, Order.customer_name)
            .join(Order, Order.id == PaymentTransaction.order_id)
            .order_by(PaymentTransaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = [
            PaymentHistoryItem(
                id=tx.id,
                transaction_number=tx.transaction_number,
                order_id=tx.order_id,
                order_number=order_number,
                customer_name=customer_name,
                amount=tx.amount,
                currency=tx.currency,
                method=tx.method,
                status=tx.status.value,
                created_at=tx.created_at,
            )
            for tx, order_number, customer_name in result.all()
        ]
        return PaymentHistoryResponse(items=items, total=total, page=page, page_size=page_size)

    async def revenue_dashboard(self, user: User, period: str = "all") -> RevenueDashboardResponse:
        """US-P-07..10: collected revenue split by customer / partner orders."""
        self._require(user, "payments:read")
        period = period.lower()
        now = datetime.now(timezone.utc)
        since: datetime | None
        if period == "daily":
            since = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "weekly":
            since = now - timedelta(days=7)
        elif period == "monthly":
            since = now - timedelta(days=30)
        elif period == "yearly":
            since = now - timedelta(days=365)
        elif period in ("all", "all_time"):
            period = "all"
            since = None
        else:
            raise ValidationError("Invalid period. Allowed: daily, weekly, monthly, yearly, all")

        base = select(
            func.coalesce(func.sum(PaymentTransaction.amount), 0),
        ).where(PaymentTransaction.status == PaymentStatus.SUCCESS)
        if since:
            base = base.where(PaymentTransaction.created_at >= since)

        total_result = await self.db.execute(base)
        total_revenue = Decimal(str(total_result.scalar() or 0))

        partner_result = await self.db.execute(
            base.where(PaymentTransaction.partner_id.is_not(None))
        )
        partner_revenue = Decimal(str(partner_result.scalar() or 0))

        pending_count = await self._pending_payments_count()

        return RevenueDashboardResponse(
            period=period,
            total_revenue=total_revenue,
            customer_revenue=total_revenue - partner_revenue,
            partner_revenue=partner_revenue,
            pending_payments_count=pending_count,
        )

    async def _partner_order_lines(
        self, orders: list[Order]
    ) -> tuple[list[PartnerOrderLine], Decimal, Decimal, int]:
        """Build order lines + (total, paid, carpets) for partner detail/statement."""
        paid_map, marked = await self._order_payment_maps([o.id for o in orders])
        lines: list[PartnerOrderLine] = []
        total_amount = Decimal("0")
        paid_amount = Decimal("0")
        total_carpets = 0
        for o in orders:
            order_total = o.total or Decimal("0")
            paid, status = self._effective_paid(o, paid_map, marked)
            total_amount += order_total
            paid_amount += min(paid, order_total)
            total_carpets += o.carpet_count or 1
            lines.append(
                PartnerOrderLine(
                    order_id=o.id,
                    order_number=o.order_number,
                    created_at=o.created_at,
                    carpet_count=o.carpet_count or 1,
                    service_type=o.service_type.value,
                    status=o.status.value,
                    total=order_total,
                    paid_amount=paid,
                    payment_status=status,
                )
            )
        return lines, total_amount, paid_amount, total_carpets

    async def get_partner_detail(self, partner_id: uuid.UUID, user: User) -> PartnerDetailResponse:
        """US-P-04: partner info + orders + financial summary."""
        self._require(user, "partners:read")
        result = await self.db.execute(select(Partner).where(Partner.id == partner_id))
        partner = result.scalar_one_or_none()
        if not partner:
            raise NotFoundError("Partner not found")

        orders_result = await self.db.execute(
            select(Order)
            .where(Order.partner_id == partner_id)
            .order_by(Order.created_at.desc())
        )
        orders = list(orders_result.scalars().all())
        lines, total_amount, paid_amount, total_carpets = await self._partner_order_lines(orders)

        return PartnerDetailResponse(
            partner=await self._partner_response(partner),
            total_orders=len(orders),
            total_carpets=total_carpets,
            total_amount=total_amount,
            paid_amount=paid_amount,
            remaining_amount=max(Decimal("0"), total_amount - paid_amount),
            orders=lines,
        )

    async def partner_statement(
        self, partner_id: uuid.UUID, year: int, month: int, user: User
    ) -> PartnerStatementResponse:
        """US-P-05: monthly statement — orders + summary for a period."""
        self._require(user, "payments:read")
        result = await self.db.execute(select(Partner).where(Partner.id == partner_id))
        partner = result.scalar_one_or_none()
        if not partner:
            raise NotFoundError("Partner not found")

        period_start = date(year, month, 1)
        period_end = date(year, month, monthrange(year, month)[1])

        orders_result = await self.db.execute(
            select(Order)
            .where(
                Order.partner_id == partner_id,
                func.date(Order.created_at) >= period_start,
                func.date(Order.created_at) <= period_end,
            )
            .order_by(Order.created_at.asc())
        )
        orders = list(orders_result.scalars().all())
        lines, total_amount, paid_amount, total_carpets = await self._partner_order_lines(orders)

        return PartnerStatementResponse(
            partner_id=partner.id,
            partner_name=partner.name,
            period_start=period_start,
            period_end=period_end,
            total_orders=len(orders),
            total_carpets=total_carpets,
            total_amount=total_amount,
            paid_amount=paid_amount,
            remaining_amount=max(Decimal("0"), total_amount - paid_amount),
            orders=lines,
        )

    async def delete_partner(self, partner_id: uuid.UUID, user: User) -> PartnerResponse:
        """US-P-03: soft delete — deactivate so orders and finance history remain."""
        self._require(user, "partners:manage")
        result = await self.db.execute(select(Partner).where(Partner.id == partner_id))
        partner = result.scalar_one_or_none()
        if not partner:
            raise NotFoundError("Partner not found")
        partner.is_active = False
        await self.db.flush()
        return await self._partner_response(partner)

    async def partner_finance_report(
        self, partner_id: uuid.UUID, user: User
    ) -> PartnerFinanceReport:
        """EPIC 7 / US-25: partner orders, amounts, payment status, settlements."""
        self._require(user, "payments:read")
        partner = await self.db.execute(select(Partner).where(Partner.id == partner_id))
        p = partner.scalar_one_or_none()
        if not p:
            raise NotFoundError("Partner not found")

        orders_result = await self.db.execute(
            select(Order).where(
                Order.partner_id == partner_id,
                Order.status == OrderStatus.DELIVERED,
            )
        )
        orders = orders_result.scalars().all()
        order_ids = [o.id for o in orders]

        gross = sum((o.total for o in orders), Decimal("0"))
        paid_total = Decimal("0")
        unpaid_total = Decimal("0")
        status_counts: dict[str, int] = {}

        if order_ids:
            inv_result = await self.db.execute(
                select(Invoice).where(
                    Invoice.order_id.in_(order_ids),
                    Invoice.invoice_type == InvoiceType.INVOICE,
                )
            )
            for inv in inv_result.scalars().all():
                await self._sync_invoice_payment_status(inv)
                paid = await self._paid_amount(inv.id)
                remaining = max(Decimal("0"), inv.total - paid)
                paid_total += paid
                unpaid_total += remaining
                key = inv.payment_status.value
                status_counts[key] = status_counts.get(key, 0) + 1

        revenue = (gross * p.commission_rate / Decimal("100")).quantize(Decimal("0.01"))

        debt_result = await self.db.execute(
            select(func.coalesce(func.sum(PartnerSettlement.net_payable), 0)).where(
                PartnerSettlement.partner_id == partner_id,
                PartnerSettlement.status == SettlementStatus.PENDING,
            )
        )
        partner_debt = Decimal(str(debt_result.scalar() or 0))

        set_result = await self.db.execute(
            select(PartnerSettlement, Partner.name)
            .join(Partner, Partner.id == PartnerSettlement.partner_id)
            .where(PartnerSettlement.partner_id == partner_id)
            .order_by(PartnerSettlement.period_start.desc())
            .limit(12)
        )
        settlements = [
            SettlementResponse(
                id=s.id,
                partner_id=s.partner_id,
                partner_name=name,
                period_start=s.period_start,
                period_end=s.period_end,
                total_orders=s.total_orders,
                gross_amount=s.gross_amount,
                commission_amount=s.commission_amount,
                net_payable=s.net_payable,
                status=s.status.value,
                paid_at=s.paid_at,
            )
            for s, name in set_result.all()
        ]

        return PartnerFinanceReport(
            partner_id=p.id,
            partner_name=p.name,
            order_count=len(orders),
            gross_order_amount=gross,
            paid_amount=paid_total,
            unpaid_amount=unpaid_total,
            revenue_from_partner=revenue,
            partner_debt=partner_debt,
            payment_status_counts=status_counts,
            settlements=settlements,
        )

    async def generate_monthly_settlement(
        self, partner_id: uuid.UUID, data: GenerateSettlementRequest, user: User
    ) -> SettlementResponse:
        """US-25: monthly partner settlement report."""
        self._require(user, "payments:create")
        partner_result = await self.db.execute(select(Partner).where(Partner.id == partner_id))
        partner = partner_result.scalar_one_or_none()
        if not partner:
            raise NotFoundError("Partner not found")

        period_start = date(data.year, data.month, 1)
        period_end = date(data.year, data.month, monthrange(data.year, data.month)[1])

        existing = await self.db.execute(
            select(PartnerSettlement).where(
                PartnerSettlement.partner_id == partner_id,
                PartnerSettlement.period_start == period_start,
                PartnerSettlement.period_end == period_end,
            )
        )
        found = existing.scalar_one_or_none()
        if found:
            return SettlementResponse(
                id=found.id,
                partner_id=found.partner_id,
                partner_name=partner.name,
                period_start=found.period_start,
                period_end=found.period_end,
                total_orders=found.total_orders,
                gross_amount=found.gross_amount,
                commission_amount=found.commission_amount,
                net_payable=found.net_payable,
                status=found.status.value,
                paid_at=found.paid_at,
            )

        orders_result = await self.db.execute(
            select(Order).where(
                Order.partner_id == partner_id,
                Order.status == OrderStatus.DELIVERED,
                func.date(Order.updated_at) >= period_start,
                func.date(Order.updated_at) <= period_end,
            )
        )
        orders = orders_result.scalars().all()
        gross = sum((o.total for o in orders), Decimal("0"))
        commission = (gross * partner.commission_rate / Decimal("100")).quantize(Decimal("0.01"))
        net = gross - commission

        settlement = PartnerSettlement(
            partner_id=partner_id,
            period_start=period_start,
            period_end=period_end,
            total_orders=len(orders),
            gross_amount=gross,
            commission_amount=commission,
            net_payable=net,
            status=SettlementStatus.PENDING,
            note=f"Auto-generated {data.year}-{data.month:02d}",
        )
        self.db.add(settlement)
        await self.db.flush()

        return SettlementResponse(
            id=settlement.id,
            partner_id=settlement.partner_id,
            partner_name=partner.name,
            period_start=settlement.period_start,
            period_end=settlement.period_end,
            total_orders=settlement.total_orders,
            gross_amount=settlement.gross_amount,
            commission_amount=settlement.commission_amount,
            net_payable=settlement.net_payable,
            status=settlement.status.value,
            paid_at=settlement.paid_at,
        )
