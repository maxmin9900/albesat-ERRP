"use client";

import { apiFetch } from "@/lib/api/client";
import type { DraftInvoice } from "@/lib/api/payments-hooks";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// Public customer-facing invoice — this is the page linked in the WhatsApp
// message the customer receives after the driver confirms the draft invoice.

const STATUS_LABELS: Record<DraftInvoice["invoice_status"], string> = {
  draft: "Draft Invoice",
  confirmed: "Draft Invoice — Confirmed",
  sent: "Draft Invoice",
  final: "Invoice",
};

export default function PublicInvoicePage() {
  const params = useParams();
  const code = decodeURIComponent((params.code as string) ?? "");
  const [invoice, setInvoice] = useState<DraftInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    apiFetch<DraftInvoice>(`/orders/track/invoice?code=${encodeURIComponent(code)}`)
      .then(setInvoice)
      .catch((e) => setError(e instanceof Error ? e.message : "Invoice not found"));
  }, [code]);

  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo />
          {invoice && (
            <Link
              href={`/track?code=${encodeURIComponent(invoice.tracking_code)}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Track order →
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {error ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-bold text-navy">Invoice not found</p>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </div>
        ) : !invoice ? (
          <p className="p-10 text-center text-muted">Loading invoice…</p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 bg-navy px-6 py-6 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  {STATUS_LABELS[invoice.invoice_status]}
                </p>
                <p className="mt-1 text-2xl font-bold">{invoice.invoice_number}</p>
                <p className="mt-1 text-sm text-white/70">
                  Order {invoice.order_number} · #{invoice.tracking_code}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold">Albesat Carpet Cleaning</p>
                <p className="mt-0.5 text-white/70">Sultanate of Oman</p>
              </div>
            </div>

            <div className="grid gap-4 border-b border-border px-6 py-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Billed to</p>
                <p className="mt-1 font-bold text-navy">{invoice.customer_name}</p>
                <p className="text-muted" dir="ltr">
                  {invoice.customer_phone}
                </p>
                {invoice.customer_address && (
                  <p className="mt-1 text-muted">{invoice.customer_address}</p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase text-muted">Dates</p>
                <p className="mt-1 text-muted">
                  Order placed: <span className="font-medium text-navy">{formatDate(invoice.order_date)}</span>
                </p>
                {invoice.pickup_date && (
                  <p className="text-muted">
                    Carpets received:{" "}
                    <span className="font-medium text-navy">{formatDate(invoice.pickup_date)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="pb-2">Item</th>
                    <th className="pb-2">Services</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-border/60 align-top">
                      <td className="py-3">
                        <p className="font-semibold text-navy">
                          {item.carpet_type || "Carpet"} #{item.position + 1}
                        </p>
                        {item.carpet_code && (
                          <p className="text-xs text-muted">{item.carpet_code}</p>
                        )}
                      </td>
                      <td className="py-3 text-muted">
                        {item.services.map((s, si) => (
                          <p key={si}>
                            {s.name} — {formatCurrency(Number(s.amount), invoice.currency)}
                          </p>
                        ))}
                      </td>
                      <td className="py-3 text-right font-bold text-navy">
                        {formatCurrency(Number(item.amount), invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex justify-end">
                <div className="w-full max-w-xs space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal</span>
                    <span>{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
                  </div>
                  {Number(invoice.tax) > 0 && (
                    <div className="flex justify-between text-muted">
                      <span>Tax</span>
                      <span>{formatCurrency(Number(invoice.tax), invoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-navy">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatCurrency(Number(invoice.total), invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-alt px-6 py-4 text-sm">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  invoice.payment_status === "paid"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {invoice.payment_status === "paid" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                {invoice.payment_status_label}
              </span>
              <p className="text-xs text-muted">
                {invoice.invoice_status === "final"
                  ? "Thank you for choosing Albesat."
                  : "Amounts may be adjusted until final delivery."}
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-muted">
        © 2024 البساط — All rights reserved.
      </footer>
    </div>
  );
}
