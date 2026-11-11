"use client";

import { QrScannerViewport } from "@/components/driver/qr-scanner-viewport";
import { Button } from "@/components/ui/button";
import { useConfirmHandoff, useDriverOrder, useScanHandoff } from "@/lib/api/driver-hooks";
import { ArrowLeft, CheckCircle2, Handshake } from "lucide-react";
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
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (code: string) => {
    setError(null);
    try {
      await scanHandoff.mutateAsync({ code });
      await confirmHandoff.mutateAsync(undefined);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Handoff failed");
    }
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
        <h2 className="text-2xl font-bold text-navy">Handed Over</h2>
        <p className="mt-1 text-muted">Received by Albesat Operations</p>
        <Button className="mt-8 w-full" onClick={() => router.push("/driver")}>
          Done
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
          <div>
            <h1 className="font-bold text-navy">Hand to Operations — #{order.tracking_code}</h1>
            <p className="mt-1 text-xs text-muted">Scan QR at operations desk to confirm handoff</p>
          </div>
        </div>
      </header>

      <div className="space-y-6 p-4">
        {error && (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
        )}
        <div className="flex items-center gap-3 rounded-xl bg-primary/10 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <Handshake className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-navy">Albesat Operations Center</p>
            <p className="text-sm text-muted">Scan carpet QR to complete handoff</p>
          </div>
        </div>
        <QrScannerViewport
          placeholder="Scan at operations desk..."
          onScan={handleScan}
          loading={scanHandoff.isPending || confirmHandoff.isPending}
        />
      </div>
    </div>
  );
}
