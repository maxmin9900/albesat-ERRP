"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  paymentStatusLabel,
  useConfirmOrderPayment,
  useInvoiceCrm,
  useOrderPaymentSearch,
  usePaymentHistory,
  usePendingPayments,
  useReceivables,
  useRevenueDashboard,
  useSendPaymentReminder,
  type OrderPaymentInfo,
} from "@/lib/api/payments-hooks";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Link2,
  Lock,
  Monitor,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Edit doc US-P-04: exactly four payment methods.
const METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card_transfer", label: "Card Transfer", icon: CreditCard },
  { id: "pos", label: "POS Terminal", icon: Monitor },
  { id: "online", label: "Online Payment", icon: Link2 },
];

const PERIODS = [
  { id: "daily", label: "Day" },
  { id: "weekly", label: "Week" },
  { id: "monthly", label: "Month" },
  { id: "yearly", label: "Year" },
  { id: "all", label: "All" },
];

const PAY_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  partially_paid: "bg-amber-100 text-amber-800",
  unpaid: "bg-slate-100 text-slate-700",
};

const TX_STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

function methodLabel(method: string | null): string {
  return METHODS.find((m) => m.id === method)?.label ?? method ?? "—";
}

function PaymentStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        PAY_STYLES[status] ?? PAY_STYLES.unpaid,
      )}
    >
      {paymentStatusLabel(status)}
    </span>
  );
}

// Edit doc — final Payment page structure: 1) Revenue Dashboard,
// 2) Payment Management (search + confirm + pending list), 3) Payment History.
export default function PaymentsPage() {
  const [period, setPeriod] = useState("all");
  const { data: revenue } = useRevenueDashboard(period);
  const { data: pending } = usePendingPayments();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const {
    data: searched,
    isFetching: searching,
    error: searchError,
  } = useOrderPaymentSearch(searchQuery);
  const confirmPayment = useConfirmOrderPayment();
  const [confirmTarget, setConfirmTarget] = useState<OrderPaymentInfo | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmedInfo, setConfirmedInfo] = useState<OrderPaymentInfo | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const { data: history } = usePaymentHistory(historyPage);
  const { data: receivables = [] } = useReceivables();
  const [crmInvoiceId, setCrmInvoiceId] = useState<string | null>(null);
  const { data: crmDetail } = useInvoiceCrm(crmInvoiceId);
  const sendReminder = useSendPaymentReminder();

  const runSearch = () => {
    const q = searchInput.trim();
    setConfirmedInfo(null);
    setSearchQuery(q || null);
  };

  const openConfirm = (info: OrderPaymentInfo) => {
    setConfirmTarget(info);
    setMethod(null);
    setConfirmError(null);
  };

  const doConfirm = async () => {
    if (!confirmTarget || !method) return;
    setConfirmError(null);
    try {
      const result = await confirmPayment.mutateAsync({
        orderId: confirmTarget.order_id,
        method,
      });
      setConfirmTarget(null);
      setConfirmedInfo(result);
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Could not confirm payment");
    }
  };

  const searchResult = confirmedInfo ?? searched;
  const historyPages = history ? Math.max(1, Math.ceil(history.total / history.page_size)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Payment System</h1>
          <p className="mt-1 text-muted">
            Revenue overview, payment confirmation and payment history.
          </p>
        </div>
        <Link href="/admin/partners">
          <Button variant="outline">
            <Users className="h-4 w-4" /> Partner Settlement
          </Button>
        </Link>
      </div>

      {/* 1 — Revenue Dashboard (US-P-07..10) */}
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-bold text-navy">Revenue Dashboard</h2>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium",
                  period === p.id ? "bg-primary text-white" : "bg-surface-alt text-muted",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Wallet className="h-4 w-4" /> Total Revenue
            </div>
            <p className="mt-2 text-2xl font-bold text-primary">
              {formatCurrency(Number(revenue?.total_revenue ?? 0))}
            </p>
          </div>
          <div className="rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Wallet className="h-4 w-4" /> Customer Revenue
            </div>
            <p className="mt-2 text-2xl font-bold text-navy">
              {formatCurrency(Number(revenue?.customer_revenue ?? 0))}
            </p>
          </div>
          <div className="rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Users className="h-4 w-4" /> Partner Revenue
            </div>
            <p className="mt-2 text-2xl font-bold text-navy">
              {formatCurrency(Number(revenue?.partner_revenue ?? 0))}
            </p>
          </div>
          <div className="rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Clock className="h-4 w-4" /> Pending Payments
            </div>
            <p className="mt-2 text-2xl font-bold text-warning">
              {revenue?.pending_payments_count ?? 0}
            </p>
            <p className="text-xs text-muted">delivered, not paid yet</p>
          </div>
        </div>
      </div>

      {/* 2 — Payment Management (US-P-01..05) */}
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-navy">Payment Management</h2>
        <p className="mt-1 text-sm text-muted">
          Search an order by Order ID to view and confirm its payment.
        </p>
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by Order ID (e.g. ORD-1A2B3C4D5) or tracking code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="w-full rounded-xl border border-border bg-surface-alt py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              dir="ltr"
            />
          </div>
          <Button onClick={runSearch} loading={searching}>
            Search
          </Button>
        </div>

        {searchQuery && searchError && !searching && !searchResult && (
          <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            No order found for &quot;{searchQuery}&quot;.
          </p>
        )}

        {searchResult && (
          <div className="mt-4 rounded-2xl border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-sm font-bold text-navy" dir="ltr">
                  {searchResult.order_number}
                </p>
                <p className="mt-1 text-sm text-navy">{searchResult.customer_name}</p>
                <p className="text-xs text-muted" dir="ltr">
                  {searchResult.customer_phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(Number(searchResult.total))}
                </p>
                <div className="mt-1 flex items-center justify-end gap-2">
                  <PaymentStatusPill status={searchResult.payment_status} />
                  {searchResult.is_locked && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Lock className="h-3 w-3" /> locked
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted">Order Status</p>
                <p className="font-semibold capitalize text-navy">
                  {searchResult.order_status.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Paid Amount</p>
                <p className="font-semibold text-navy">
                  {formatCurrency(Number(searchResult.paid_amount))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Payment Method</p>
                <p className="font-semibold text-navy">{methodLabel(searchResult.payment_method)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Payment Date</p>
                <p className="font-semibold text-navy">
                  {searchResult.paid_at ? formatDate(searchResult.paid_at) : "—"}
                </p>
              </div>
            </div>
            {searchResult.is_locked ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                Payment confirmed and locked — the record is final and cannot be changed.
              </p>
            ) : (
              <div className="mt-4">
                <Button onClick={() => openConfirm(searchResult)}>Confirm Payment</Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Orders Awaiting Payment
          </h3>
          <p className="mt-1 text-xs text-muted">
            Delivered orders whose payment has not been settled yet.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="pb-3 pr-4">Order ID</th>
                  <th className="pb-3 pr-4">Customer</th>
                  <th className="pb-3 pr-4">Amount Due</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {(pending?.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted">
                      No delivered orders awaiting payment. 🎉
                    </td>
                  </tr>
                ) : (
                  (pending?.items ?? []).map((o) => (
                    <tr key={o.order_id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-navy" dir="ltr">
                        {o.order_number}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-navy">{o.customer_name}</p>
                        <p className="text-xs text-muted" dir="ltr">
                          {o.customer_phone}
                        </p>
                      </td>
                      <td className="py-3 pr-4 font-bold text-primary">
                        {formatCurrency(Number(o.total) - Number(o.paid_amount))}
                      </td>
                      <td className="py-3 pr-4">
                        <PaymentStatusPill status={o.payment_status} />
                      </td>
                      <td className="py-3 pr-4">
                        <Button size="sm" variant="outline" onClick={() => openConfirm(o)}>
                          Confirm Payment
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirm payment dialog (US-P-04) */}
      <Modal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Confirm Payment"
        dialogClassName="max-w-lg"
      >
        {confirmTarget && (
          <div>
            <p className="text-sm text-muted">
              <span className="font-mono" dir="ltr">
                {confirmTarget.order_number}
              </span>{" "}
              · {confirmTarget.customer_name}
            </p>
            <p className="mt-4 rounded-xl bg-surface-alt px-4 py-3 text-sm">
              Amount to collect:{" "}
              <strong className="text-primary">
                {formatCurrency(Number(confirmTarget.total) - Number(confirmTarget.paid_amount))}
              </strong>
            </p>
            <p className="mt-4 text-sm font-semibold text-navy">Payment Method</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                      method === m.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <Icon className="h-5 w-5 text-muted" />
                    <span className="text-xs font-medium text-navy">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
              After confirmation the payment becomes <strong>final and locked</strong> — the
              status, method and amount cannot be changed.
            </p>
            {confirmError && (
              <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                {confirmError}
              </p>
            )}
            <div className="mt-5 flex gap-2 border-t border-border pt-4">
              <Button onClick={doConfirm} disabled={!method} loading={confirmPayment.isPending}>
                <CheckCircle2 className="h-4 w-4" /> Confirm Payment
              </Button>
              <Button variant="outline" onClick={() => setConfirmTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Outstanding receivables + reminders (kept from previous flow) */}
      {receivables.length > 0 && (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
          <h2 className="font-bold text-navy">Outstanding Receivables</h2>
          <p className="mt-1 text-sm text-muted">
            Customer debt tracking — unpaid or partial invoices.
          </p>
          <div className="mt-4 space-y-3">
            {receivables.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4"
              >
                <div>
                  <p className="font-semibold text-navy">{inv.customer_name}</p>
                  <p className="text-xs text-muted" dir="ltr">
                    {inv.invoice_number} · {inv.customer_phone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">
                    {formatCurrency(Number(inv.remaining_amount ?? inv.total))}
                  </p>
                  <p className="text-xs font-semibold text-amber-800">
                    {paymentStatusLabel(inv.payment_status)}
                  </p>
                  {inv.due_date && <p className="text-xs text-muted">Due {formatDate(inv.due_date)}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCrmInvoiceId(inv.id)}>
                    Detail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendReminder.mutate(inv.id)}
                    loading={sendReminder.isPending}
                  >
                    Remind
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CRM invoice modal (kept from previous flow) */}
      {crmDetail && crmInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-navy">Invoice CRM</h2>
                <p className="text-sm text-muted">{crmDetail.invoice.invoice_number}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCrmInvoiceId(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted">Customer</p>
                <p className="font-semibold">{crmDetail.invoice.customer_name}</p>
                <p dir="ltr" className="text-sm text-muted">
                  {crmDetail.invoice.customer_phone}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Payment</p>
                <p className="font-semibold">{paymentStatusLabel(crmDetail.invoice.payment_status)}</p>
                <p className="text-sm text-primary">
                  Debt:{" "}
                  {formatCurrency(Number(crmDetail.invoice.remaining_amount ?? crmDetail.invoice.total))}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-semibold text-navy">Payment history</h3>
              {crmDetail.payment_history.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No payments recorded.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {crmDetail.payment_history.map((p) => (
                    <li key={p.id} className="rounded-lg border border-border p-3">
                      <div className="flex justify-between">
                        <span>{methodLabel(p.method)}</span>
                        <span className="font-semibold">{formatCurrency(Number(p.amount))}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {p.transaction_number} · {p.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {crmDetail.invoice.payment_status !== "paid" && (
              <div className="mt-6">
                <Button onClick={() => sendReminder.mutate(crmInvoiceId)} loading={sendReminder.isPending}>
                  Send payment reminder
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3 — Payment History (US-P-06) */}
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-bold text-navy">Payment History</h2>
          <p className="text-sm text-muted">{history?.total ?? 0} payments recorded</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-3 pr-4">Order ID</th>
                <th className="pb-3 pr-4">Customer</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3 pr-4">Method</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(history?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                (history?.items ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs font-semibold text-navy" dir="ltr">
                        {t.order_number}
                      </p>
                      <p className="font-mono text-[10px] text-muted" dir="ltr">
                        {t.transaction_number}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{t.customer_name ?? "—"}</td>
                    <td className="py-3 pr-4 font-semibold text-navy">
                      {formatCurrency(Number(t.amount))}
                    </td>
                    <td className="py-3 pr-4">{methodLabel(t.method)}</td>
                    <td className="py-3 pr-4 text-muted">{formatDate(t.created_at)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold uppercase",
                          TX_STATUS_STYLES[t.status] ?? "bg-surface-alt",
                        )}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {historyPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={historyPage <= 1}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <p className="text-sm text-muted">
              Page {historyPage} of {historyPages}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={historyPage >= historyPages}
              onClick={() => setHistoryPage((p) => Math.min(historyPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
