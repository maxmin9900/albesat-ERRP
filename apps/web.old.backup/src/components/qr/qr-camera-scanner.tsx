"use client";

import { useEffect, useId, useRef, useState } from "react";

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  active?: boolean;
}

type Html5QrcodeInstance = {
  start: (
    constraints: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decoded: string) => void,
    onError: () => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => Promise<void>;
  getState: () => number;
};

/** html5-qrcode Html5QrcodeScannerState values */
const SCANNING = 2;
const PAUSED = 3;

async function safeStopScanner(scanner: Html5QrcodeInstance | null): Promise<void> {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    if (state === SCANNING || state === PAUSED) {
      await scanner.stop();
      await scanner.clear();
    }
  } catch {
    // Scanner may not have finished starting — ignore stop errors
  }
}

export function QrCameraScanner({ onScan, active = true }: QrCameraScannerProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const onScanRef = useRef(onScan);
  const lastCode = useRef("");
  const [error, setError] = useState<string | null>(null);

  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) {
      void safeStopScanner(scannerRef.current);
      scannerRef.current = null;
      return;
    }

    let cancelled = false;
    let scanner: Html5QrcodeInstance | null = null;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        scanner = new Html5Qrcode(regionId) as unknown as Html5QrcodeInstance;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (cancelled || !decoded || decoded === lastCode.current) return;
            lastCode.current = decoded;
            onScanRef.current(decoded);
          },
          () => {},
        );

        if (cancelled) {
          await safeStopScanner(scanner);
          scannerRef.current = null;
        }
      } catch {
        if (!cancelled) {
          setError("Camera unavailable. Use manual entry or allow camera permission.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      const instance = scanner ?? scannerRef.current;
      scannerRef.current = null;
      void safeStopScanner(instance);
    };
  }, [active, regionId]);

  if (error) {
    return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>;
  }

  return <div id={regionId} className="min-h-[240px] w-full overflow-hidden rounded-xl bg-black" />;
}
