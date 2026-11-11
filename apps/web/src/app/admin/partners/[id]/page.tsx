"use client";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import {
  paymentStatusLabel,
  useGenerateSettlement,
  usePartnerDetail,
  usePartnerFinance,
  usePartnerStatement,
  usePaySettlement,
} from "@/lib/api/payments-hooks";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, FileText, MapPin, Phone as PhoneIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const PAY_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  partially_paid: "bg-amber-100 text-amber-800",
  unpaid: "bg-slate-100 text-slate-700",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Edit doc US-P-04/05/06 — Partner Detail: orders, monthly statement, settlement.
export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const partnerId = params?.id ?? null;
  const { data, isLoading, error } = usePartnerDetail(partnerId);
  const { data: finance } = usePartnerFinance(partnerId);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data: statement, isFetching: statementLoading } = usePartnerStatement(
    partnerId,
    year,
    month,
  );
  const generateSettlement = useGenerateSettlement();
  const paySettlement = usePaySettlement();

  if (isLoading) {
    return <p className="text-muted">Loading partner...</p>;
  }
  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold text-navy">Partner not found</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/admin/partners")}>
          <ArrowLeft className="h-4 w-4" /> Back to Partners
        </Button>
      </div>
    );
  }

  const p = data.partner;
  const stats = [
    { label: "Total Orders", value: String(data.total_orders) },
    { label: "Carpets Serviced", value: String(data.total_carpets) },
    { label: "Total Amount", value: formatCurrency(Number(data.total_amount)) },
    { label: "Paid", value: formatCurrency(Number(data.paid_amount)) },
    { label: "Remaining", value: formatCurrency(Number(data.remaining_amount)) },
  ];

  const yearOptions = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()];

  return (
    <div>
      <p className="text-sm text-muted">
        <Link href="/admin" className="hover:text-primary">
          Admin Panel
        </Link>
        {" / "}
        <Link href="/admin/partners" className="hover:text-primary">
          Partners
        </Link>
        {" / "}
        <span className="text-navy">{p.name}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy">{p.name}</h1>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                p.is_active ? "bg-green-100 text-green-800" : "bg-surface-alt text-muted",
              )}
            >
              {p.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted">
            {p.contact_phone && (
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <PhoneIcon className="h-4 w-4" /> {p.contact_phone}
              </span>
            )}
            {p.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {p.address}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/admin/partners")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-2 text-xl font-bold text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-navy">Partner Orders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-3 pr-4">Order ID</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Carpets</th>
                <th className="pb-3 pr-4">Service</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3 pr-4">Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No orders from this partner yet.
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr key={o.order_id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-mono text-xs font-semibold text-navy" dir="ltr">
                      {o.order_number}
                    </td>
                    <td className="py-3 pr-4 text-muted">{formatDate(o.created_at)}</td>
                    <td className="py-3 pr-4">{o.carpet_count}</td>
                    <td className="py-3 pr-4 capitalize">{o.service_type}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-3 pr-4 font-semibold text-navy">
                      {formatCurrency(Number(o.total))}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          PAY_STYLES[o.payment_status] ?? PAY_STYLES.unpaid,
                        )}
                      >
                        {paymentStatusLabel(o.payment_status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="inline-flex items-center gap-2 font-bold text-navy">
              <FileText className="h-4 w-4" /> Monthly Statement
            </h2>
            <p className="mt-1 text-sm text-muted">
              Invoice / statement of partner orders for the selected period.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-border bg-surface-alt px-3 py-2 text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {statementLoading ? (
          <p className="mt-6 text-muted">Loading statement...</p>
        ) : statement ? (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted">
                    <th className="pb-3 pr-4">Order ID</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Carpets</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3 pr-4">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted">
                        No orders in {MONTHS[month - 1]} {year}.
                      </td>
                    </tr>
                  ) : (
                    statement.orders.map((o) => (
                      <tr key={o.order_id} className="border-b border-border/60">
                        <td className="py-3 pr-4 font-mono text-xs" dir="ltr">
                          {o.order_number}
                        </td>
                        <td className="py-3 pr-4 text-muted">{formatDate(o.created_at)}</td>
                        <td className="py-3 pr-4">{o.carpet_count}</td>
                        <td className="py-3 pr-4 font-semibold">{formatCurrency(Number(o.total))}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              PAY_STYLES[o.payment_status] ?? PAY_STYLES.unpaid,
                            )}
                          >
                            {paymentStatusLabel(o.payment_status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 rounded-xl bg-surface-alt p-4 text-sm sm:grid-cols-5">
              <div>
                <p className="text-muted">Orders</p>
                <p className="font-bold text-navy">{statement.total_orders}</p>
              </div>
              <div>
                <p className="text-muted">Carpets</p>
                <p className="font-bold text-navy">{statement.total_carpets}</p>
              </div>
              <div>
                <p className="text-muted">Total Services</p>
                <p className="font-bold text-navy">{formatCurrency(Number(statement.total_amount))}</p>
              </div>
              <div>
                <p className="text-muted">Paid</p>
                <p className="font-bold text-green-700">
                  {formatCurrency(Number(statement.paid_amount))}
                </p>
              </div>
              <div>
                <p className="text-muted">Remaining</p>
                <p className="font-bold text-amber-700">
                  {formatCurrency(Number(statement.remaining_amount))}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                onClick={() =>
                  generateSettlement.mutate({ partnerId: partnerId!, year, month })
                }
                loading={generateSettlement.isPending}
              >
                Generate Settlement for {MONTHS[month - 1]} {year}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {finance && finance.settlements.length > 0 && (
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-bold text-navy">Settlements</h2>
          <p className="mt-1 text-sm text-muted">
            Partner settlement records — mark as paid once the partner is settled.
          </p>
          <div className="mt-4 space-y-3">
            {finance.settlements.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-semibold text-navy">
                    {s.period_start} — {s.period_end}
                  </p>
                  <p className="text-sm text-muted">
                    {s.total_orders} orders · gross {formatCurrency(Number(s.gross_amount))} ·
                    commission {formatCurrency(Number(s.commission_amount))}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-primary">{formatCurrency(Number(s.net_payable))}</p>
                  {s.status === "pending" ? (
                    <Button
                      size="sm"
                      onClick={() => paySettlement.mutate(s.id)}
                      loading={paySettlement.isPending}
                    >
                      Mark Settled
                    </Button>
                  ) : (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                      Settled {s.paid_at ? formatDate(s.paid_at) : ""}
                    </span>
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
