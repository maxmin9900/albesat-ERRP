"use client";

import { QrScannerViewport } from "@/components/driver/qr-scanner-viewport";
import { Button } from "@/components/ui/button";
import {
  OperationCarpetItem,
  useCompleteOperation,
  useOperationsQueue,
  useRecordOperationStep,
  useScanOperation,
} from "@/lib/api/operations-hooks";
import { cn } from "@/lib/utils";
import { CheckCircle2, Droplets, Package, Wind } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useState } from "react";

const STEPS = [
  { id: "washing", label: "Washing", icon: Droplets },
  { id: "drying", label: "Drying", icon: Wind },
  { id: "packaging", label: "Packaging", icon: Package },
] as const;

function CarpetCard({
  item,
  selected,
  onSelect,
}: {
  item: OperationCarpetItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-colors",
        selected ? "border-primary" : "border-transparent",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-primary">#{item.carpet_code}</p>
          <p className="font-bold text-navy">{item.customer_name}</p>
          <p className="text-sm text-muted">{item.service_label}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary capitalize">
          {item.status.replace(/_/g, " ")}
        </span>
      </div>
    </button>
  );
}

export default function OperationsPage() {
  const { data, isLoading } = useOperationsQueue();
  const scanOp = useScanOperation();
  const [selected, setSelected] = useState<OperationCarpetItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const recordStep = useRecordOperationStep(selected?.id ?? "");
  const completeOp = useCompleteOperation(selected?.id ?? "");

  const formatError = (e: unknown) =>
    e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Request failed";

  const sections = [
    { key: "received", title: "Received at Operations", items: data?.received ?? [] },
    { key: "in_operation", title: "In Operation", items: data?.in_operation ?? [] },
    { key: "drying", title: "Drying", items: data?.drying ?? [] },
    { key: "ready", title: "Ready for Delivery", items: data?.ready ?? [] },
  ] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-navy">Operations Queue</h1>
          <p className="text-sm text-muted">Scan QR to start or select a carpet below</p>
        </div>
        <QrScannerViewport
          placeholder="Scan carpet QR at intake..."
          manualLabel="SCAN OR ENTER CODE"
          onScan={async (code) => {
            setActionError(null);
            try {
              const carpet = await scanOp.mutateAsync(code);
              setSelected(carpet);
            } catch (e) {
              setActionError(formatError(e));
            }
          }}
          loading={scanOp.isPending}
        />
        {actionError && (
          <p className="rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">{actionError}</p>
        )}
        {isLoading ? (
          <p className="text-muted">Loading queue...</p>
        ) : (
          sections.map(
            (sec) =>
              sec.items.length > 0 && (
                <section key={sec.key}>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                    {sec.title} ({sec.items.length})
                  </p>
                  <div className="space-y-3">
                    {sec.items.map((item) => (
                      <CarpetCard
                        key={item.id}
                        item={item}
                        selected={selected?.id === item.id}
                        onSelect={() => {
                          setActionError(null);
                          setSelected(item);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ),
          )
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        {selected ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">#{selected.carpet_code}</h2>
            <p className="text-sm text-muted">{selected.customer_name} · {selected.tracking_code}</p>
            <hr className="my-4 border-border" />
            <p className="mb-3 text-xs font-semibold uppercase text-muted">Record wash steps</p>
            <div className="space-y-2">
              {STEPS.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => {
                    setActionError(null);
                    try {
                      await recordStep.mutateAsync({ step: id });
                    } catch (e) {
                      setActionError(formatError(e));
                    }
                  }}
                  loading={recordStep.isPending}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Button>
              ))}
            </div>
            <Button
              className="mt-4 w-full bg-success hover:bg-success/90"
              onClick={async () => {
                setActionError(null);
                try {
                  await completeOp.mutateAsync(undefined);
                } catch (e) {
                  setActionError(formatError(e));
                }
              }}
              loading={completeOp.isPending}
            >
              <CheckCircle2 className="h-4 w-4" /> Complete — Ready for Delivery
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-muted">
            Select or scan a carpet to manage operations
          </div>
        )}
      </div>
    </div>
  );
}
