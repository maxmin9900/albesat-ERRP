"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePaymentsDashboard, usePaySettlement, useRecordPayment } from "@/lib/api/payments-hooks";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Banknote, CreditCard, Eye, Link2, Monitor } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card Transfer", icon: CreditCard },
  { id: "pos", label: "POS Terminal", icon: Monitor },
  { id: "online", label: "Online Payment", icon: Link2 },
];

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

export default function PaymentsPage() {
  const { data, isLoading } = usePaymentsDashboard();
  const recordPayment = useRecordPayment();
  const paySettlement = usePaySettlement();
  const [method, setMethod] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");

  const transactions = data?.transactions ?? [];
  const filtered = transactions.filter((t) => filter === "all" || t.method === filter);

  const handleRecord = async () => {
    if (!method || !orderId || !amount) return;
    await recordPayment.mutateAsync({
      order_id: orderId,
      amount: parseFloat(amount),
      method,
    });
    setOrderId("");
    setAmount("");
    setMethod(null);
  };

  if (isLoading) {
    return <p className="text-muted">Loading payments...</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Payment System</h1>
          <p className="mt-1 text-muted">Manage invoices, transactions and partner settlements</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/partners">
            <Button variant="outline">Partners</Button>
          </Link>
          <Button onClick={handleRecord} disabled={!method || !orderId || !amount} loading={recordPayment.isPending}>
            Record Payment
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {[
          { label: "Today's Revenue", value: formatCurrency(Number(data?.today_revenue ?? 0)), color: "text-primary" },
          { label: "Pending Invoices", value: `${data?.pending_count ?? 0} items`, color: "text-warning" },
          {
            label: "Partner Settlement Due",
            value: formatCurrency(Number(data?.partner_settlement_pending ?? 0)),
            color: "text-primary",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={cn("mt-2 text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-navy">Record Payment</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Order ID (UUID)" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                  method === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                <Icon className="h-6 w-6 text-muted" />
                <span className="text-sm font-medium text-navy">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-bold text-navy">Recent Transactions</h2>
          <div className="flex flex-wrap gap-2">
            {["all", "cash", "card", "pos", "online"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium capitalize",
                  filter === f ? "bg-primary text-white" : "bg-surface-alt text-muted",
                )}
              >
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Customer</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Method</th>
                <th className="pb-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="py-4 pr-4 font-semibold">{t.transaction_number}</td>
                  <td className="py-4 pr-4">{t.customer_name ?? "—"}</td>
                  <td className="py-4 pr-4">{formatCurrency(Number(t.amount))}</td>
                  <td className="py-4 pr-4 text-muted">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-4 pr-4 capitalize">{t.method}</td>
                  <td className="py-4 pr-4">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold uppercase",
                        STATUS_STYLES[t.status] ?? "bg-surface-alt",
                      )}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data?.settlements && data.settlements.length > 0 && (
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-bold text-navy">Partner Settlements</h2>
          <div className="mt-4 space-y-3">
            {data.settlements.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-semibold text-navy">{s.partner_name}</p>
                  <p className="text-sm text-muted">
                    {s.period_start} — {s.period_end} · {s.total_orders} orders
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-primary">{formatCurrency(Number(s.net_payable))}</p>
                  {s.status === "pending" ? (
                    <Button size="sm" onClick={() => paySettlement.mutate(s.id)} loading={paySettlement.isPending}>
                      Mark paid
                    </Button>
                  ) : (
                    <span className="text-sm text-green-700">Paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
