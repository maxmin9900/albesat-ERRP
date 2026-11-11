"use client";

import { QrScannerViewport } from "@/components/driver/qr-scanner-viewport";
import { Button } from "@/components/ui/button";
import {
  useCompleteDelivery,
  useDriverOrder,
  useScanDelivery,
  useStartDelivery,
} from "@/lib/api/driver-hooks";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", desc: "Collect physical payment", icon: Banknote },
  { id: "card_transfer", label: "Card Transfer", desc: "Bank or digital transfer", icon: Building2 },
  { id: "pos", label: "POS Terminal", desc: "Card machine at customer", icon: CreditCard },
] as const;

export default function DeliveryFlowPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { data: order, refetch } = useDriverOrder(orderId);
  const startDelivery = useStartDelivery(orderId);
  const scanDelivery = useScanDelivery(orderId);
  const completeDelivery = useCompleteDelivery(orderId);

  const [step, setStep] = useState<1 | 2>(1);
  const [payment, setPayment] = useState<string>("cash");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (order && order.delivery_workflow !== "in_progress") {
      startDelivery.mutate(undefined, { onSuccess: () => refetch() });
    }
  }, [order?.id]);

  const handleScan = async (code: string) => {
    await scanDelivery.mutateAsync({ code });
    setStep(2);
  };

  const handleComplete = async () => {
    await completeDelivery.mutateAsync({ payment_method: payment });
    setDone(true);
  };

  if (!order) return <p className="p-8 text-center text-muted">Loading...</p>;

  if (done) {
    return (
      <div className="min-h-screen bg-white p-6 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-navy">Delivered Successfully ✓</h2>
        <p className="mt-1 text-muted">{order.customer_name}</p>
        <span className="mt-3 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          • Delivered
        </span>
        <div className="mt-8 space-y-2 rounded-2xl bg-surface-alt p-4 text-sm text-left">
          <div className="flex justify-between"><span className="text-muted">Order</span><span className="font-bold text-primary">#{order.tracking_code}</span></div>
          <div className="flex justify-between"><span className="text-muted">Amount</span><span className="font-bold text-primary">{formatCurrency(Number(order.total))}</span></div>
          <div className="flex justify-between"><span className="text-muted">Payment</span><span className="font-bold capitalize">{payment.replace("_", " ")}</span></div>
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
          <Link href="/driver" className="rounded-lg p-2 hover:bg-surface-alt"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex-1">
            <h1 className="font-bold text-navy">Delivery — #{order.tracking_code}</h1>
            <div className="mt-2 flex gap-1">
              <span className={`h-1 flex-1 rounded ${step >= 1 ? "bg-primary" : "bg-slate-200"}`} />
              <span className={`h-1 flex-1 rounded ${step >= 2 ? "bg-primary" : "bg-slate-200"}`} />
            </div>
            <p className="mt-1 text-xs text-muted">Step {step} of 2</p>
          </div>
        </div>
      </header>

      <div className="space-y-6 p-4">
        {step === 1 ? (
          <>
            <div>
              <h2 className="text-lg font-bold text-navy">Step 1 — Scan Customer / Carpet QR</h2>
              <p className="text-sm text-muted">Scan the QR at the customer&apos;s door or enter the order code.</p>
            </div>
            <QrScannerViewport onScan={handleScan} loading={scanDelivery.isPending} />
            <div className="rounded-xl bg-surface-alt p-4">
              <p className="text-sm font-semibold text-navy">Delivering to:</p>
              <p className="font-bold text-navy">{order.customer_name}</p>
              <p className="text-sm text-muted">{order.pickup_address}</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-navy">Step 2 — Delivery Summary</h2>
              <p className="text-sm text-muted">Review and collect payment.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <span className="h-12 w-12 rounded-xl bg-rose-200" />
                <div>
                  <p className="font-bold text-navy">{order.customer_name}</p>
                  <p className="text-sm text-muted">{order.pickup_address}</p>
                </div>
              </div>
              <hr className="my-4 border-border" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Carpet QR</span><span className="font-bold text-primary">#{order.tracking_code}</span></div>
                <div className="flex justify-between"><span className="text-muted">Service</span><span className="font-bold">{order.service_label}</span></div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-semibold">Amount to Collect</span>
                  <span className="text-lg font-bold text-navy">{formatCurrency(Number(order.total))}</span>
                </div>
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Payment method</p>
            <div className="space-y-3">
              {PAYMENT_METHODS.map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPayment(id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors",
                    payment === id ? "border-primary bg-primary/5" : "border-border bg-white",
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-alt">
                    <Icon className="h-5 w-5 text-muted" />
                  </span>
                  <div>
                    <p className="font-bold text-navy">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <Button className="w-full bg-success hover:bg-success/90" size="lg" onClick={handleComplete} loading={completeDelivery.isPending}>
              Complete Delivery
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
