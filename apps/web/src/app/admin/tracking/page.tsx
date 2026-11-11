"use client";

import { CarpetDetailDrawer } from "@/components/dashboard/carpet-detail-drawer";
import { ScanQrModal } from "@/components/dashboard/modals/scan-qr-modal";
import { Button } from "@/components/ui/button";
import { useCarpets, useCarpet, useGenerateQr, CarpetListItem } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { QrCode, Search, ScanLine, ChevronRight } from "lucide-react";
import { useState } from "react";

const CARPET_STATUS_STYLES: Record<string, string> = {
  registered: "bg-slate-100 text-slate-600",
  in_transit: "bg-blue-100 text-blue-800",
  in_washing: "bg-primary/15 text-primary",
  drying: "bg-indigo-100 text-indigo-800",
  ready: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
};

export default function CarpetTrackingPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);

  const { data, isLoading } = useCarpets({ page, search: search || undefined });
  const { data: detail } = useCarpet(selectedId);
  const generateQr = useGenerateQr();

  const handleSelect = (item: CarpetListItem) => {
    setSelectedId(item.id);
    setGeneratedQr(null);
  };

  const handleGenerate = async () => {
    if (!selectedId) return;
    const result = await generateQr.mutateAsync({ carpet_id: selectedId });
    setGeneratedQr(result.qr_code);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Carpet Tracking</h1>
          <p className="mt-1 text-muted">
            Generate signed QR codes and track carpets through the wash facility
          </p>
        </div>
        <Button onClick={() => setScanOpen(true)}>
          <ScanLine className="h-4 w-4" /> Scan QR
        </Button>
      </div>

      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search by code, customer, tracking..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="mt-8 rounded-2xl bg-white shadow-sm">
        {isLoading ? (
          <p className="p-8 text-center text-muted">Loading carpets...</p>
        ) : !data?.items.length ? (
          <p className="p-8 text-center text-muted">No carpets found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface-alt"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <QrCode className="h-5 w-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy">#{item.carpet_code}</p>
                      {item.has_qr && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                          QR
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted">{item.customer_name}</p>
                    <p className="text-xs text-muted">{item.order_number}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                      CARPET_STATUS_STYLES[item.status] ?? "bg-slate-100",
                    )}
                  >
                    {item.status.replace(/_/g, " ")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > data.page_size && (
          <div className="flex justify-center gap-2 border-t border-border p-4">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page * data.page_size >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <CarpetDetailDrawer
        carpet={detail ?? null}
        open={!!selectedId && !!detail}
        onClose={() => {
          setSelectedId(null);
          setGeneratedQr(null);
        }}
        onGenerateQr={handleGenerate}
        generating={generateQr.isPending}
        generatedQr={generatedQr}
      />

      <ScanQrModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}
