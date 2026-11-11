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
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState(false);

  const handleCameraScan = useCallback(
    (decoded: string) => {
      if (loading) return;
      onScan(decoded);
    },
    [onScan, loading],
  );

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-navy">
        {enableCamera && cameraActive ? (
          <QrCameraScanner
            active={cameraActive}
            onSuggestCode={(suggested) => setCode(suggested)}
            onScan={handleCameraScan}
            onError={(msg) => setCameraError(!!msg)}
          />
        ) : (
          <div className="relative aspect-[4/3] min-h-[280px]">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
              <ScanLine className="h-10 w-10 text-primary" />
              <p className="text-center text-sm text-white/80">Camera is off</p>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setCameraActive(true);
                  setCameraError(false);
                }}
              >
                Turn on camera
              </Button>
            </div>
          </div>
        )}
        {enableCamera && cameraActive && !cameraError && (
          <div className="absolute right-3 top-3 z-10">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="bg-white/90 text-xs"
              onClick={() => setCameraActive(false)}
            >
              Turn off camera
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
            onKeyDown={(e) => e.key === "Enter" && code.trim() && !loading && onScan(code.trim())}
            className="flex-1"
          />
          <Button onClick={() => code.trim() && !loading && onScan(code.trim())} loading={loading}>
            Find
          </Button>
        </div>
      </div>
    </div>
  );
}
