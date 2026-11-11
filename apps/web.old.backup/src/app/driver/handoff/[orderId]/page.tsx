"use client";

import { QrScannerViewport } from "@/components/driver/qr-scanner-viewport";
import { Button } from "@/components/ui/button";
import { useConfirmHandoff, useDriverOrder, useScanHandoff } from "@/lib/api/driver-hooks";
import { ArrowLeft, ArrowRight, CheckCircle2, Handshake } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function HandoffFlowPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { data: order } = useDriverOrder(orderId);
  const scanHandoff = useScanHandoff(orderId);
  const confirmHandoff = useConfirmHandoff(orderId);
  const [step, setStep] = useState<1 | 2>(1);
  const [done, setDone] = useState(false);

  const handleScan = async (code: string) => {
    await scanHandoff.mutateAsync({ code });
    setStep(2);
  };

  const handleConfirm = async () => {
    await confirmHandoff.mutateAsync(undefined);
    setDone(true);
  };

  if (!order) return <p className="p-8 text-center text-muted">Loading...</p>;

  if (done) {
    return (
      <div className="min-h-screen bg-white p-6 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-navy">Handed Over ✓</h2>
        <p className="mt-1 text-muted">Received by Firoozeh Operations</p>
        <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          • At Operations
        </span>
        <div className="mt-8 space-y-2 rounded-2xl bg-surface-alt p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">Order</span><span className="font-bold text-primary">#{order.tracking_code}</span></div>
          <div className="flex justify-between"><span className="text-muted">Operations</span><span className="font-bold">Firoozeh Center</span></div>
        </div>
        <Button className="mt-8 w-full" onClick={() => router.push("/driver")}>Done</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/driver" className="rounded-lg p-2 hover:bg-surface-alt"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex-1">
            <h1 className="font-bold text-navy">Hand to Operations — #{order.tracking_code}</h1>
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
              <h2 className="text-lg font-bold text-navy">Step 1 — Scan QR at Operations Center</h2>
              <p className="text-sm text-muted">Scan the carpet QR at Firoozeh Operations Center intake desk.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"><Handshake className="h-5 w-5" /></span>
              <div>
                <p className="font-bold text-navy">Firoozeh Operations Center</p>
                <p className="text-sm text-muted">12 Industrial Blvd, Unit 4, Brooklyn, NY</p>
              </div>
            </div>
            <QrScannerViewport placeholder="Scan at operations desk..." onScan={handleScan} loading={scanHandoff.isPending} />
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-navy">Step 2 — Confirm Delivery to Operations</h2>
              <p className="text-sm text-muted">Confirm handover at Firoozeh Operations Center.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-primary/20 shadow-sm">
              <div className="bg-navy px-4 py-3 text-white font-semibold flex items-center gap-2">
                <Handshake className="h-5 w-5" /> Handover Confirmation
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted">Customer</span><span className="font-bold">{order.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-muted">Order</span><span className="font-bold text-primary">#{order.tracking_code}</span></div>
                <div className="flex justify-between"><span className="text-muted">Destination</span><span className="font-bold">Firoozeh Operations Center</span></div>
              </div>
            </div>
            <Button variant="navy" className="w-full" size="lg" onClick={handleConfirm} loading={confirmHandoff.isPending}>
              <ArrowRight className="h-5 w-5" /> Confirm Delivery to Operations
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
