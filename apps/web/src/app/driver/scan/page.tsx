"use client";

import { QrScannerViewport } from "@/components/driver/qr-scanner-viewport";
import { Button } from "@/components/ui/button";
import { DriverOrderCard, useDriverQuickScan } from "@/lib/api/driver-hooks";
import { Box, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DriverScanPage() {
  const router = useRouter();
  const quickScan = useDriverQuickScan();
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DriverOrderCard[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const handleResult = (res: {
    action: string;
    message: string;
    order_id: string | null;
  }) => {
    setSuccess(null);
    setCandidates([]);
    setPendingCode(null);

    if (res.action === "pickup_confirmed") {
      setSuccess(res.message);
      if (res.order_id) {
        setTimeout(() => router.push(`/driver/handoff/${res.order_id}`), 1200);
      }
      return;
    }
    if (res.action === "handoff" && res.order_id) {
      router.push(`/driver/handoff/${res.order_id}`);
      return;
    }
    if (res.action === "choose_order") {
      setPendingCode(null);
      return;
    }
  };

  const handleScan = async (code: string, orderId?: string) => {
    setSuccess(null);
    try {
      const res = await quickScan.mutateAsync({
        code,
        order_id: orderId,
      });
      if (res.action === "choose_order") {
        setPendingCode(code);
        setCandidates(res.candidate_orders);
        return;
      }
      handleResult(res);
    } catch {
      /* error shown via quickScan.isError */
    }
  };

  const pickOrder = (orderId: string) => {
    if (!pendingCode) return;
    void handleScan(pendingCode, orderId);
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold text-navy">Scan QR Code</h1>
        <p className="text-sm text-muted">
          Stick the physical tag on the carpet, then scan it. Tag must be pre-registered in Admin.
          Start Pickup on the order first (Orders tab).
        </p>
      </div>
      <QrScannerViewport
        placeholder="Physical tag or QC-2026-… tracking code"
        onScan={(code) => handleScan(code)}
        loading={quickScan.isPending}
      />
      {quickScan.isError && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {quickScan.error instanceof Error ? quickScan.error.message : "Scan failed"}
        </p>
      )}
      {success && (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{success}</p>
      )}
      {candidates.length > 0 && pendingCode && (
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm font-semibold text-navy">Which pickup is this tag for?</p>
          <div className="mt-3 space-y-2">
            {candidates.map((o) => (
              <Button
                key={o.id}
                type="button"
                variant="secondary"
                className="h-auto w-full justify-start py-3 text-left"
                loading={quickScan.isPending}
                onClick={() => pickOrder(o.id)}
              >
                <span className="block font-bold">{o.tracking_code}</span>
                <span className="block text-xs text-muted">{o.customer_name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Quick lookup</p>
        <p className="mt-2 text-sm text-muted">
          For step-by-step pickup with navigation, use the Orders tab.
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/driver" className="flex-1">
            <Button className="w-full">
              <Box className="h-4 w-4" /> Pickup Flow
            </Button>
          </Link>
          <Link href="/driver?tab=deliveries" className="flex-1">
            <Button className="w-full" variant="navy">
              <Truck className="h-4 w-4" /> Delivery Flow
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
