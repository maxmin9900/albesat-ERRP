"use client";

import { QrCodeDisplay } from "@/components/dashboard/qr-code-display";
import { QrPrintLabel } from "@/components/qr/qr-print-label";
import { WorkflowStepper } from "@/components/driver/workflow-stepper";
import { Button } from "@/components/ui/button";
import {
  useConfirmPickup,
  useDriverOrder,
  useGeneratePickupQr,
  useStartPickup,
} from "@/lib/api/driver-hooks";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Clock, Package, Printer, Zap } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = [
  { id: "accept", label: "Accept" },
  { id: "in_progress", label: "In Progress" },
  { id: "generate_qr", label: "Generate QR" },
  { id: "attach_qr", label: "Attach QR" },
  { id: "collected", label: "Collected" },
];

export default function PickupFlowPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { data: order, refetch } = useDriverOrder(orderId);
  const startPickup = useStartPickup(orderId);
  const generateQr = useGeneratePickupQr(orderId);
  const confirmPickup = useConfirmPickup(orderId);

  const [qrData, setQrData] = useState<{
    qr_code: string;
    carpet_code: string;
    session_code: string;
    issued_at: string;
  } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (order?.pickup_workflow === "accepted") {
      startPickup.mutate(undefined, { onSuccess: () => refetch() });
    }
  }, [order?.pickup_workflow]);

  const currentStep =
    done || order?.pickup_workflow === "collected"
      ? "collected"
      : order?.pickup_workflow === "qr_generated" || qrData
        ? "attach_qr"
        : order?.pickup_workflow === "in_progress"
          ? "generate_qr"
          : "in_progress";

  const handleGenerate = async () => {
    try {
      const res = await generateQr.mutateAsync(undefined);
      setQrData(res);
      refetch();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message.includes("fetch")
            ? "Cannot reach API server. Check that Docker API is running on port 8010."
            : e.message
          : "Failed to generate QR";
      window.alert(msg);
    }
  };

  const handleConfirm = async () => {
    await confirmPickup.mutateAsync(undefined);
    setDone(true);
    refetch();
  };

  if (!order) {
    return <p className="p-8 text-center text-muted">Loading...</p>;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/driver" className="rounded-lg p-2 hover:bg-surface-alt">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-bold text-navy">Pickup — #{order.tracking_code}</h1>
            <WorkflowStepper steps={STEPS} currentStep={currentStep} />
          </div>
        </div>
      </header>

      <div className="space-y-6 p-4 pb-8">
        {currentStep === "collected" ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-navy">Pickup Confirmed ✓</h2>
            <p className="mt-1 text-muted">#{order.tracking_code}</p>
            <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              • Collected ✓
            </span>
            <div className="mt-8 space-y-3 rounded-2xl bg-surface-alt p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Customer</span>
                <span className="font-bold">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Carpet ID</span>
                <span className="font-bold text-primary">{qrData?.carpet_code ?? order.carpet_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Session</span>
                <span className="font-bold">{order.session_code}</span>
              </div>
            </div>
            <Button className="mt-8 w-full" variant="navy" onClick={() => router.push("/driver")}>
              Back to List
            </Button>
          </div>
        ) : currentStep === "attach_qr" ? (
          <>
            <div>
              <h2 className="text-xl font-bold text-navy">Attach QR & Confirm Pickup</h2>
              <p className="mt-1 text-sm text-muted">
                Attach the printed QR label to the carpet, then confirm collection.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-primary/30 shadow-sm">
              <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
                <span className="flex items-center gap-2 font-semibold">
                  <Package className="h-5 w-5" /> Carpet Details
                </span>
                <span className="text-sm">#{order.tracking_code}</span>
              </div>
              <div className="space-y-4 p-4">
                <div className="flex gap-4 rounded-xl bg-surface-alt p-3">
                  {qrData && <QrCodeDisplay value={qrData.qr_code} size={80} />}
                  <div>
                    <p className="font-bold text-navy">{qrData?.carpet_code}</p>
                    <p className="text-sm text-primary">{order.session_code}</p>
                    <p className="text-xs text-muted">Generated {new Date(qrData?.issued_at ?? "").toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted">Customer</p><p className="font-bold">{order.customer_name}</p></div>
                  <div><p className="text-muted">Carpets</p><p className="font-bold">{order.carpet_count} carpet</p></div>
                  <div><p className="text-muted">Service</p><p className="font-bold">{order.service_label}</p></div>
                  <div><p className="text-muted">Size</p><p className="font-bold">{order.carpet_dimensions}</p></div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-surface-alt px-3 py-2 text-sm">
                  <Clock className="h-4 w-4 text-muted" />
                  Pickup time: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            <Button className="w-full bg-success hover:bg-success/90" size="lg" onClick={handleConfirm} loading={confirmPickup.isPending}>
              <CheckCircle2 className="h-5 w-5" /> Confirm Pickup
            </Button>
          </>
        ) : qrData ? (
          <>
            <div className="overflow-hidden rounded-2xl border-2 border-primary shadow-lg">
              <div className="bg-primary px-4 py-2 text-center text-sm font-semibold text-white">
                QR Code Generated
              </div>
              <div className="flex flex-col items-center p-6">
                <QrCodeDisplay value={qrData.qr_code} size={200} />
                <p className="mt-4 font-bold text-navy">{qrData.carpet_code}</p>
                <p className="text-sm text-muted">Linked: {qrData.session_code}</p>
                <span className="mt-3 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  ● QR Connected to Session ✓
                </span>
              </div>
            </div>
            <QrPrintLabel
              qrCode={qrData.qr_code}
              carpetCode={qrData.carpet_code}
              sessionCode={qrData.session_code}
              customerName={order.customer_name}
              trackingCode={order.tracking_code}
            />
            <Button className="w-full" onClick={() => refetch()}>
              <CheckCircle2 className="h-4 w-4" /> Attach to Carpet & Continue
            </Button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-navy">Generate Carpet QR Code</h2>
              <p className="mt-1 text-sm text-muted">
                Create a unique QR for this carpet to track it throughout the system.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-surface-alt p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-white">
                <Package className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Session ID Linked</p>
                <p className="font-bold text-navy">{order.session_code}</p>
                <p className="text-sm text-muted">{order.customer_name} · #{order.tracking_code}</p>
              </div>
            </div>
            <Button className="w-full shadow-lg shadow-primary/30" size="lg" onClick={handleGenerate} loading={generateQr.isPending}>
              <Zap className="h-5 w-5" /> Generate QR Code
            </Button>
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs font-semibold uppercase text-muted">Collecting from</p>
              <div className="mt-2 flex gap-3">
                <span className="h-10 w-10 rounded-xl bg-rose-200" />
                <div>
                  <p className="font-bold text-navy">{order.customer_name}</p>
                  <p className="text-sm text-muted">{order.pickup_address}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
