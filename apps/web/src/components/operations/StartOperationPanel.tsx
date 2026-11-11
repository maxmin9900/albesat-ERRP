"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";

import { QrCameraScanner } from "@/components/qr/qr-camera-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStartOperation, type OperationCarpetDetail } from "@/lib/api/operations-hooks";
import { formatDate } from "@/lib/utils";

type Props = {
  onStarted: () => void;
};

function CarpetInfo({ detail }: { detail: OperationCarpetDetail }) {
  return (
    <dl className="mt-3 grid gap-2 rounded-xl bg-surface-alt p-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs font-semibold uppercase text-muted">Customer</dt>
        <dd className="font-semibold text-navy">{detail.customer_name}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase text-muted">Carpet type</dt>
        <dd className="text-navy">{detail.carpet_type || "—"}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase text-muted">QR</dt>
        <dd className="font-mono text-xs text-navy" dir="ltr">
          {detail.qr_code || "—"}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase text-muted">Status</dt>
        <dd className="font-semibold text-primary">{detail.status_label}</dd>
      </div>
      {detail.operation_started_at && (
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase text-muted">Started at</dt>
          <dd className="text-navy">{formatDate(detail.operation_started_at)}</dd>
        </div>
      )}
    </dl>
  );
}

export function StartOperationPanel({ onStarted }: Props) {
  const start = useStartOperation();
  const [code, setCode] = useState("");
  const [scanOpen, setScanOpen] = useState(true);
  const [detail, setDetail] = useState<OperationCarpetDetail | null>(null);

  async function submit(manualCode?: string) {
    const value = (manualCode ?? code).trim();
    if (value.length < 3) return;
    setDetail(null);
    try {
      const result = await start.mutateAsync(value);
      setDetail(result);
      setCode("");
      setScanOpen(false);
      onStarted();
    } catch {
      /* error via start.isError */
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10">
          <PlayCircle className="h-5 w-5 text-teal-600" />
        </span>
        <div>
          <h2 className="font-bold text-navy">Start operation</h2>
          <p className="mt-1 text-sm text-muted">
            Scan a carpet in Received By Operation. Status becomes In Operation.
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
          placeholder="Scan QR or tracking code (QC-2026-…)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          autoComplete="off"
        />
        <Button type="submit" loading={start.isPending} disabled={!code.trim()}>
          Start operation
        </Button>
        <Button type="button" variant="secondary" onClick={() => setScanOpen((v) => !v)}>
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

      {start.isError && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {start.error instanceof Error ? start.error.message : "Start failed"}
        </p>
      )}
      {detail && <CarpetInfo detail={detail} />}
    </section>
  );
}
