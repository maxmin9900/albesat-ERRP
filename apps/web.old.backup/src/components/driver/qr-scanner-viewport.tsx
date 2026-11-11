"use client";

import { QrCameraScanner } from "@/components/qr/qr-camera-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine } from "lucide-react";
import { useCallback, useState } from "react";

interface QrScannerViewportProps {
  placeholder?: string;
  manualLabel?: string;
  onScan: (code: string) => void;
  loading?: boolean;
  enableCamera?: boolean;
}

export function QrScannerViewport({
  placeholder = "e.g. QC-2024-0041",
  manualLabel = "MANUAL ENTRY",
  onScan,
  loading,
  enableCamera = true,
}: QrScannerViewportProps) {
  const [code, setCode] = useState("");
  const [cameraOn, setCameraOn] = useState(enableCamera);

  const handleCameraScan = useCallback(
    (decoded: string) => {
      onScan(decoded);
    },
    [onScan],
  );

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-navy">
        {cameraOn && enableCamera ? (
          <QrCameraScanner onScan={handleCameraScan} active={!loading} />
        ) : (
          <div className="relative aspect-[4/3]">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="absolute inset-8 border-2 border-transparent">
              <span className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-primary" />
              <span className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-primary" />
              <span className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-primary" />
              <span className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-primary" />
            </div>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs text-white">
              <ScanLine className="h-4 w-4 text-primary" />
              Camera off
            </div>
          </div>
        )}
        {enableCamera && (
          <div className="absolute right-3 top-3 z-10">
            <Button type="button" size="sm" variant="secondary" onClick={() => setCameraOn((v) => !v)}>
              {cameraOn ? "Turn off camera" : "Turn on camera"}
            </Button>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{manualLabel}</p>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder={placeholder}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && code.trim() && onScan(code.trim())}
            className="flex-1"
          />
          <Button onClick={() => code.trim() && onScan(code.trim())} loading={loading}>
            Find
          </Button>
        </div>
      </div>
    </div>
  );
}
