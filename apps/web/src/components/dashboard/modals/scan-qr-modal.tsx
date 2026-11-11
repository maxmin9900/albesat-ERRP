"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CarpetDetailDrawer } from "@/components/dashboard/carpet-detail-drawer";
import { useScanQr } from "@/lib/api/hooks";
import { QrCameraScanner } from "@/components/qr/qr-camera-scanner";
import { useState } from "react";

interface ScanQrModalProps {
  open: boolean;
  onClose: () => void;
}

export function ScanQrModal({ open, onClose }: ScanQrModalProps) {
  const [code, setCode] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scanQr = useScanQr();

  const handleIdentify = async () => {
    if (!code.trim()) return;
    const result = await scanQr.mutateAsync(code.trim());
    if (result.valid && result.carpet) {
      setDrawerOpen(true);
    }
  };

  const handleClose = () => {
    setCode("");
    setDrawerOpen(false);
    scanQr.reset();
    onClose();
  };

  const carpet = scanQr.data?.carpet ?? null;

  return (
    <>
      <Modal open={open && !drawerOpen} onClose={handleClose} title="Scan QR Code" className="max-w-md">
        <QrCameraScanner
          onScan={async (decoded) => {
            setCode(decoded);
            const result = await scanQr.mutateAsync(decoded);
            if (result.valid && result.carpet) setDrawerOpen(true);
          }}
          active={open && !drawerOpen}
        />

        <div className="relative my-6">
          <hr className="border-border" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-muted">
            or enter manually
          </span>
        </div>

        <Input
          label="Carpet Code"
          placeholder="e.g. QC-1402-0042 or signed FZ code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleIdentify()}
        />

        {scanQr.isError && (
          <p className="mt-2 text-sm text-danger">Carpet not found. Check the code and try again.</p>
        )}
        {scanQr.data && !scanQr.data.valid && (
          <p className="mt-2 text-sm text-danger">
            {scanQr.data.message ?? "Invalid or revoked QR code."}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={handleIdentify} loading={scanQr.isPending}>
            Identify Carpet
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </Modal>

      <CarpetDetailDrawer
        carpet={carpet}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          handleClose();
        }}
      />
    </>
  );
}
