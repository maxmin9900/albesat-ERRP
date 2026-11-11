"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";

import { QrCameraScanner } from "@/components/qr/qr-camera-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReceiveCarpet } from "@/lib/api/operations-hooks";

type Props = {
  onReceived: () => void;
};

export function ReceiveScanPanel({ onReceived }: Props) {
  const receive = useReceiveCarpet();
  const [code, setCode] = useState("");
  const [scanOpen, setScanOpen] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(manualCode?: string) {
    const value = (manualCode ?? code).trim();
    if (value.length < 3) return;
    setSuccess(null);
    try {
      const result = await receive.mutateAsync(value);
      setSuccess(
        `${result.tracking_code} — ${result.customer_name} (${result.status_label})`,
      );
      setCode("");
      setScanOpen(false);
      onReceived();
    } catch {
      /* error shown via receive.isError */
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ScanLine className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h2 className="font-bold text-navy">Receive from driver</h2>
          <p className="mt-1 text-sm text-muted">
            Scan QR or tracking code. Status becomes Received By Operation.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          className="flex-1"
          placeholder="Scan QR, or enter tracking code (e.g. QC-2026-…)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          autoComplete="off"
        />
        <Button type="submit" loading={receive.isPending} disabled={!code.trim()}>
          Confirm receipt
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setScanOpen((v) => !v)}
        >
          {scanOpen ? "Hide camera" : "Scan QR"}
        </Button>
      </form>

      {scanOpen && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <QrCameraScanner
            active={scanOpen}
            onSuggestCode={(suggested) => setCode(suggested)}
            onScan={(scanned) => {
              setCode(scanned);
              void submit(scanned);
            }}
          />
        </div>
      )}

      {receive.isError && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {receive.error instanceof Error ? receive.error.message : "Receive failed"}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Received: {success}
        </p>
      )}
    </section>
  );
}
