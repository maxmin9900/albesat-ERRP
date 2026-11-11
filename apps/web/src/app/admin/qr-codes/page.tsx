"use client";

import { QrCameraScanner } from "@/components/qr/qr-camera-scanner";
import { QrImageUploadButton } from "@/components/qr/qr-image-upload-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useBulkCreatePhysicalQr,
  useCreatePhysicalQr,
  usePhysicalQrTags,
  useTogglePhysicalQr,
} from "@/lib/api/qr-registry-hooks";
import { cn, formatDate } from "@/lib/utils";
import { Plus, QrCode, Search } from "lucide-react";
import { useState } from "react";

export default function QrCodesAdminPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const { data, isLoading, refetch } = usePhysicalQrTags({ page, search: search || undefined });
  const createQr = useCreatePhysicalQr();
  const bulkCreate = useBulkCreatePhysicalQr();
  const toggleQr = useTogglePhysicalQr();

  const handleCreate = async (code?: string) => {
    const value = (code ?? newCode).trim();
    if (value.length < 3) return;
    await createQr.mutateAsync({ code: value, label: newLabel.trim() || undefined });
    setNewCode("");
    setNewLabel("");
    setScanOpen(false);
    refetch();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">QR Code Management</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Tags are printed on leather punch cards ahead of time — not generated when an order is
            created. Register each code here once. At pickup the driver sticks the tag on the carpet
            and scans it to link tag → carpet → order. After delivery the tag can be reused.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-navy">Add new QR tag</h2>
        <p className="mt-1 text-sm text-muted">
          Scan the punched code, upload a QR image (PNG/JPG), or type it manually. Tags are not
          generated during order registration.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Input
            className="flex-1"
            label="QR ID / code value"
            placeholder="Scan or paste tag code"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            dir="ltr"
          />
          <Input
            className="flex-1"
            label="Label (optional)"
            placeholder="e.g. Batch A #12"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Button
            className="mt-7 sm:mt-0"
            onClick={() => void handleCreate()}
            loading={createQr.isPending}
          >
            <Plus className="h-4 w-4" /> Add QR
          </Button>
          <Button
            className="mt-7 sm:mt-0"
            variant="secondary"
            type="button"
            onClick={() => setScanOpen((v) => !v)}
          >
            {scanOpen ? "Hide scanner" : "Scan to add"}
          </Button>
          <QrImageUploadButton
            className="mt-7 sm:mt-0"
            label="Upload QR image"
            onDecoded={(decoded) => {
              setNewCode(decoded);
              void handleCreate(decoded);
            }}
            onSuggestCode={(code) => setNewCode(code)}
          />
        </div>
        {scanOpen && (
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <QrCameraScanner
              active={scanOpen}
              onScan={(decoded) => {
                setNewCode(decoded);
                void handleCreate(decoded);
              }}
            />
          </div>
        )}
        {createQr.isError && (
          <p className="mt-2 text-sm text-danger">
            {createQr.error instanceof Error ? createQr.error.message : "Failed to add QR"}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-navy">Bulk import (manual batch)</h2>
        <p className="mt-1 text-sm text-muted">
          Paste pre-printed codes — one per line (e.g. CARPET-0001-0A0FA103). Up to 500 at a time.
        </p>
        <textarea
          className="mt-4 min-h-[140px] w-full rounded-xl border border-border bg-surface-alt px-4 py-3 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder={"CARPET-0001-0A0FA103\nCARPET-0002-1B1FB204\n..."}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          dir="ltr"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            className="flex-1"
            label="Batch label prefix (optional)"
            placeholder="e.g. March 2026 batch"
            value={bulkLabel}
            onChange={(e) => setBulkLabel(e.target.value)}
          />
          <Button
            loading={bulkCreate.isPending}
            disabled={!bulkText.trim()}
            onClick={async () => {
              setBulkResult(null);
              const codes = bulkText
                .split(/[\n,;]+/)
                .map((l) => l.trim())
                .filter((l) => l.length >= 3);
              if (!codes.length) return;
              const res = await bulkCreate.mutateAsync({
                codes,
                label_prefix: bulkLabel.trim() || undefined,
              });
              setBulkResult(
                `Added ${res.created} tag(s). Skipped ${res.skipped} duplicate(s) or invalid line(s).`,
              );
              setBulkText("");
              refetch();
            }}
          >
            Import batch
          </Button>
        </div>
        {bulkResult && <p className="mt-2 text-sm text-success">{bulkResult}</p>}
        {bulkCreate.isError && (
          <p className="mt-2 text-sm text-danger">
            {bulkCreate.error instanceof Error ? bulkCreate.error.message : "Bulk import failed"}
          </p>
        )}
      </div>

      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search QR codes..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        {isLoading ? (
          <p className="p-8 text-center text-muted">Loading...</p>
        ) : !data?.items.length ? (
          <p className="p-8 text-center text-muted">No QR tags registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-alt text-left text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">QR ID</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last used</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 shrink-0 text-primary" />
                        <span className="font-mono text-xs" dir="ltr" title={item.code}>
                          {item.code.length > 28 ? `${item.code.slice(0, 28)}…` : item.code}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-muted" dir="ltr">
                        {item.id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.label || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          item.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {item.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          item.in_use ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {item.in_use ? "In use" : "Available"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 text-muted">
                      {item.last_used_at ? formatDate(item.last_used_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={toggleQr.isPending}
                        onClick={() =>
                          void toggleQr
                            .mutateAsync({ id: item.id, active: !item.is_active })
                            .then(() => refetch())
                        }
                      >
                        {item.is_active ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && (
          <div className="flex flex-col items-center gap-3 border-t border-border p-4 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted">
              Showing{" "}
              <span className="font-semibold text-navy">
                {(data.page - 1) * data.page_size + 1}–
                {Math.min(data.page * data.page_size, data.total)}
              </span>{" "}
              of <span className="font-semibold text-navy">{data.total}</span> tags
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="px-1 text-sm font-semibold text-navy">
                Page {data.page} of {Math.max(1, Math.ceil(data.total / data.page_size))}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * data.page_size >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
