"use client";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { useCustomerDetail } from "@/lib/api/customers-hooks";
import { paymentStatusLabel } from "@/lib/api/payments-hooks";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, MapPin, Phone as PhoneIcon, ShoppingBag, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const TIER_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  VIP: "bg-amber-100 text-amber-800",
  NEW: "bg-blue-100 text-blue-800",
};

const PAY_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  partially_paid: "bg-amber-100 text-amber-800",
  unpaid: "bg-slate-100 text-slate-700",
};

// Edit doc section 4 — Customer Detail: profile, order history, financial summary.
export default function CustomerDetailPage() {
  const params = useParams<{ phone: string }>();
  const router = useRouter();
  const phone = params?.phone ? decodeURIComponent(params.phone) : null;
  const { data, isLoading, error } = useCustomerDetail(phone);

  if (isLoading) {
    return <p className="text-muted">Loading customer...</p>;
  }
  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold text-navy">Customer not found</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/admin/customers")}>
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </Button>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Orders",
      value: String(data.order_count),
      icon: ShoppingBag,
      color: "text-primary",
    },
    {
      label: "Total Amount",
      value: formatCurrency(Number(data.total_amount)),
      icon: Wallet,
      color: "text-navy",
    },
    {
      label: "Paid",
      value: formatCurrency(Number(data.paid_amount)),
      icon: Wallet,
      color: "text-green-700",
    },
    {
      label: "Remaining",
      value: formatCurrency(Number(data.remaining_amount)),
      icon: Wallet,
      color: Number(data.remaining_amount) > 0 ? "text-amber-700" : "text-muted",
    },
  ];

  return (
    <div>
      <p className="text-sm text-muted">
        <Link href="/admin" className="hover:text-primary">
          Admin Panel
        </Link>
        {" / "}
        <Link href="/admin/customers" className="hover:text-primary">
          Customers
        </Link>
        {" / "}
        <span className="text-navy">{data.name || data.phone}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy">{data.name || "Unnamed customer"}</h1>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-bold",
                TIER_STYLES[data.tier] ?? TIER_STYLES.NEW,
              )}
            >
              {data.tier}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5" dir="ltr">
              <PhoneIcon className="h-4 w-4" /> {data.phone}
            </span>
            {data.address && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {data.address}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/customers")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={() => router.push("/admin/orders/new")}>New Order</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className={cn("mt-2 text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {data.notes && (
        <div className="mt-6 rounded-2xl border border-border bg-surface-alt p-4 text-sm text-muted">
          <span className="font-semibold text-navy">Notes: </span>
          {data.notes}
        </div>
      )}

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-navy">Order History</h2>
          <p className="text-sm text-muted">
            {data.total_carpets} carpet{data.total_carpets === 1 ? "" : "s"} serviced ·{" "}
            {data.last_order_at ? `last order ${formatDate(data.last_order_at)}` : "no orders yet"}
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
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
                    No orders yet for this customer.
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr key={o.order_id} className="border-b border-border/60">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs font-semibold text-navy" dir="ltr">
                        {o.order_number}
                      </p>
                      <p className="font-mono text-[10px] text-muted" dir="ltr">
                        {o.tracking_code}
                      </p>
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
    </div>
  );
}
