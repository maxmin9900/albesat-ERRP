"use client";

import { Button } from "@/components/ui/button";
import {
  useCompleteDelivery,
  useDriverOrder,
  type CompleteDeliveryResult,
} from "@/lib/api/driver-hooks";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, MapPin, Smartphone } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Same methods as the admin Payment Management section, minus "online"
// (drivers can only collect cash / card transfer / POS at the door).
const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card_transfer", label: "Card Transfer", icon: Smartphone },
  { id: "pos", label: "POS Terminal", icon: CreditCard },
] as const;

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export default function DeliveryFlowPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { data: order } = useDriverOrder(orderId);
  const completeDelivery = useCompleteDelivery(orderId);

  const [done, setDone] = useState<CompleteDeliveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(true);
  const [method, setMethod] = useState<PaymentMethodId>("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");

  // Amount to collect defaults to the order total (driver can adjust it).
  useEffect(() => {
    if (!order) return;
    setAmount((prev) => prev || String(order.invoice_total ?? order.total ?? ""));
  }, [order]);

  const handleConfirm = async () => {
    setError(null);
    if (collecting) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        setError("Enter the amount collected from the customer.");
        return;
      }
    }
    try {
      const result = await completeDelivery.mutateAsync(
        collecting
          ? {
              payment_method: method,
              payment_amount: Number(amount),
              confirmation_reference: reference.trim() || null,
            }
          : {},
      );
      setDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delivery failed");
    }
  };

  if (!order) return <p className="p-8 text-center text-muted">Loading...</p>;

  if (done) {
    const inv = done.invoice ?? {};
    return (
      <div className="min-h-screen bg-white p-6 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-navy">Delivered Successfully</h2>
        <p className="mt-1 text-muted">{order.customer_name}</p>
        <span className="mt-3 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          Delivered
        </span>

        <div className="mt-8 space-y-3 rounded-2xl bg-surface-alt p-4 text-left text-sm">
          {inv.invoice_number && (
            <div className="flex justify-between">
              <span className="text-muted">Invoice</span>
              <span className="font-bold text-navy">{inv.invoice_number}</span>
            </div>
          )}
          {inv.total != null && (
            <div className="flex justify-between">
              <span className="text-muted">Total</span>
              <span className="font-bold text-navy">
                {formatCurrency(Number(inv.total), order.currency)}
              </span>
            </div>
          )}
          {collecting && (
            <>
              <div className="flex justify-between">
                <span className="text-muted">Collected</span>
                <span className="font-bold text-primary">
                  {formatCurrency(Number(amount), order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Method</span>
                <span className="font-medium text-navy">
                  {PAYMENT_METHODS.find((m) => m.id === method)?.label}
                </span>
              </div>
            </>
          )}
          {inv.payment_status_label && (
            <div className="flex justify-between border-t border-border/60 pt-2">
              <span className="text-muted">Payment status</span>
              <span className="font-semibold text-navy">{inv.payment_status_label}</span>
            </div>
          )}
        </div>

        <Button className="mt-8 w-full" variant="navy" onClick={() => router.push("/driver")}>
          Back to Deliveries
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/driver" className="rounded-lg p-2 hover:bg-surface-alt">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-navy">Delivery — #{order.tracking_code}</h1>
            <p className="mt-1 text-xs text-muted">Collect payment and confirm handover</p>
          </div>
        </div>
      </header>

      <div className="space-y-6 p-4 pb-8">
        {error && (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="rounded-xl bg-surface-alt p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Delivering to</p>
          <p className="mt-2 text-lg font-bold text-navy">{order.customer_name}</p>
          {order.pickup_address && (
            <p className="mt-2 flex items-start gap-2 text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {order.pickup_address}
            </p>
          )}
          <p className="mt-3 text-muted">
            {order.carpet_count} carpet(s) · {formatCurrency(Number(order.total), order.currency)}
          </p>
          {order.invoice_number && (
            <p className="mt-1 text-xs text-muted">
              Invoice {order.invoice_number} · {order.payment_status_label}
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-primary/20 shadow-sm">
          <div className="flex items-center justify-between bg-navy px-4 py-3">
            <span className="font-semibold text-white">Payment</span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
              Due: {formatCurrency(Number(order.invoice_total ?? order.total), order.currency)}
            </span>
          </div>
          <div className="space-y-4 p-4">
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={collecting}
                onChange={(e) => setCollecting(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Customer is paying now
            </label>

            {collecting && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted">
                    Amount collected ({order.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted">Payment method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const Icon = m.icon;
                      const active = method === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMethod(m.id)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-white text-muted hover:border-primary/40"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {method !== "cash" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted">
                      Confirmation reference (optional)
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
                      placeholder="Transfer / POS receipt number"
                    />
                    <p className="mt-1 text-xs text-muted">
                      Without a reference, the payment stays pending until confirmed.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          loading={completeDelivery.isPending}
          onClick={() => void handleConfirm()}
        >
          {collecting ? "Collect payment & confirm delivery" : "Confirm delivery"}
        </Button>
      </div>
    </div>
  );
}
