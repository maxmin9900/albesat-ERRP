"use client";

import { QrScannerViewport } from "@/components/driver/qr-scanner-viewport";
import { Button } from "@/components/ui/button";
import { useScanQr } from "@/lib/api/hooks";
import { Box, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DriverScanPage() {
  const router = useRouter();
  const scanQr = useScanQr();

  const handleScan = async (code: string) => {
    const res = await scanQr.mutateAsync(code);
    if (res.valid && res.carpet) {
      router.push(`/driver/pickup/${res.carpet.order_id}`);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold text-navy">Scan QR Code</h1>
        <p className="text-sm text-muted">Point camera at the carpet tag or enter code manually.</p>
      </div>
      <QrScannerViewport
        placeholder="Scanning for QR code..."
        onScan={handleScan}
        loading={scanQr.isPending}
      />
      {scanQr.isError && (
        <p className="text-center text-sm text-danger">Carpet not found. Try a valid code.</p>
      )}
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Quick lookup</p>
        <p className="mt-2 text-sm text-muted">
          Use the Pickup / Delivery flows in the Orders tab for guided scanning with step-by-step
          confirmation.
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
