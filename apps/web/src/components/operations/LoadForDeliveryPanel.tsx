"use client";

import { useState } from "react";
import { Truck } from "lucide-react";

import { QrCameraScanner } from "@/components/qr/qr-camera-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useLoadForDelivery,
  useOperationsDrivers,
  type OperationCarpetDetail,
} from "@/lib/api/operations-hooks";
import { formatDate } from "@/lib/utils";

type Props = {
  onLoaded: () => void;
};

export function LoadForDeliveryPanel({ onLoaded }: Props) {
  const load = useLoadForDelivery();
  const { data: drivers = [] } = useOperationsDrivers();
  const [code, setCode] = useState("");
  const [driverId, setDriverId] = useState("");
  const [scanOpen, setScanOpen] = useState(true);
  const [detail, setDetail] = useState<OperationCarpetDetail | null>(null);

  async function submit(manualCode?: string) {
    const value = (manualCode ?? code).trim();
    if (value.length < 3 || !driverId) return;
    setDetail(null);
    try {
      const result = await load.mutateAsync({ code: value, driver_id: driverId });
      setDetail(result);
      setCode("");
      setScanOpen(false);
      onLoaded();
    } catch {
      /* error via load.isError */
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
          <Truck className="h-5 w-5 text-orange-600" />
        </span>
        <div>
          <h2 className="font-bold text-navy">Load for delivery</h2>
          <p className="mt-1 text-sm text-muted">
            Scan a carpet in Ready For Delivery, assign a driver, and add to their delivery list.
          </p>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold uppercase text-muted">
          Destination driver
        </label>
        <select
          className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
        >
          <option value="">Select driver…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
              {d.phone ? ` (${d.phone})` : ""}
            </option>
          ))}
        </select>
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
          placeholder="Scan QR to load carpet"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          autoComplete="off"
        />
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
              if (!driverId) {
                setScanOpen(false);
                return;
              }
              void submit(scanned);
            }}
          />
        </div>
      )}

      {load.isError && (
        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {load.error instanceof Error ? load.error.message : "Load failed"}
        </p>
      )}
      {detail && (
        <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Loaded for {detail.loaded_for_driver_name} at{" "}
          {detail.loaded_for_delivery_at ? formatDate(detail.loaded_for_delivery_at) : "now"} — Out
          for Delivery
        </p>
      )}
    </section>
  );
}
