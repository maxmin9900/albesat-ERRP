"use client";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { QrCodeDisplay } from "@/components/dashboard/qr-code-display";
import { CarpetTrackingTimeline } from "@/components/dashboard/carpet-tracking-timeline";
import { Button } from "@/components/ui/button";
import { CarpetDetail } from "@/lib/api/hooks";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { X, Phone, Package, Clock, MapPin } from "lucide-react";
import { useState } from "react";

interface CarpetDetailDrawerProps {
  carpet: CarpetDetail | null;
  open: boolean;
  onClose: () => void;
  onGenerateQr?: () => void;
  generating?: boolean;
  generatedQr?: string | null;
}

const CARPET_STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  in_transit: "In Transit",
  in_washing: "In Washing",
  drying: "Drying",
  ready: "Ready for Delivery",
  delivered: "Delivered",
};

type Tab = "timeline" | "scans" | "delivery" | "operations";

export function CarpetDetailDrawer({
  carpet,
  open,
  onClose,
  onGenerateQr,
  generating,
  generatedQr,
}: CarpetDetailDrawerProps) {
  const [tab, setTab] = useState<Tab>("timeline");

  if (!open || !carpet) return null;

  const qrValue = generatedQr ?? carpet.qr_code;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="carpet-drawer-title"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Carpet Details</p>
            <h2 id="carpet-drawer-title" className="text-lg font-bold text-navy">
              #{carpet.carpet_code}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface-alt"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {qrValue ? (
            <div className="flex flex-col items-center">
              <QrCodeDisplay value={qrValue} size={180} />
              <p className="mt-3 text-center text-xs text-muted">
                Unique signed QR · Scan for warehouse ID
              </p>
              {carpet.qr_issued_at && (
                <p className="mt-1 text-xs text-muted">
                  Issued {formatDate(carpet.qr_issued_at)}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-alt p-6 text-center">
              <p className="text-sm text-muted">No QR code generated yet</p>
              {onGenerateQr && (
                <Button className="mt-4" onClick={onGenerateQr} loading={generating}>
                  Generate QR Code
                </Button>
              )}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Carpet Status</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {CARPET_STATUS_LABELS[carpet.status] ?? carpet.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Order Status</span>
              <StatusBadge status={carpet.order_status} />
            </div>
          </div>

          <hr className="my-6 border-border" />

          <dl className="space-y-4 text-sm">
            <div className="flex gap-3">
              <Package className="h-5 w-5 shrink-0 text-muted" />
              <div>
                <dt className="text-muted">Customer</dt>
                <dd className="font-semibold text-navy">{carpet.customer_name}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Phone className="h-5 w-5 shrink-0 text-muted" />
              <div>
                <dt className="text-muted">Phone</dt>
                <dd className="font-semibold text-navy">{carpet.customer_phone}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-muted" />
              <div>
                <dt className="text-muted">Carpet</dt>
                <dd className="font-semibold text-navy">{carpet.description ?? "—"}</dd>
                {carpet.dimensions && <dd className="text-muted">{carpet.dimensions}</dd>}
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="h-5 w-5 shrink-0 text-muted" />
              <div>
                <dt className="text-muted">Order</dt>
                <dd className="font-semibold text-navy">{carpet.order_number}</dd>
                <dd className="text-primary">{formatCurrency(Number(carpet.total))}</dd>
              </div>
            </div>
          </dl>

          <div className="mt-8">
            <div className="flex gap-1 rounded-xl bg-surface-alt p-1">
              {(
                [
                  ["timeline", "History"],
                  ["scans", `Scans (${carpet.scan_logs.length})`],
                  ["delivery", `Delivery (${carpet.delivery_logs.length})`],
                  ["operations", `Ops (${carpet.operation_logs.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                    tab === key ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "timeline" && (
                <CarpetTrackingTimeline items={carpet.tracking_history} />
              )}
              {tab === "scans" && (
                <ul className="space-y-3">
                  {carpet.scan_logs.map((s) => (
                    <li key={s.id} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium text-navy">
                        {s.is_valid ? "Valid scan" : "Invalid scan"} · {s.scan_method}
                      </p>
                      <p className="text-xs text-muted">
                        {s.scanned_by_name ?? "Unknown"} · {formatDate(s.created_at)}
                      </p>
                    </li>
                  ))}
                  {!carpet.scan_logs.length && (
                    <p className="text-sm text-muted">No scan logs yet.</p>
                  )}
                </ul>
              )}
              {tab === "delivery" && (
                <ul className="space-y-3">
                  {carpet.delivery_logs.map((d) => (
                    <li key={d.id} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium capitalize text-navy">
                        {d.event_type.replace(/_/g, " ")}
                      </p>
                      {d.location && <p className="text-xs text-muted">{d.location}</p>}
                      <p className="text-xs text-muted">{formatDate(d.created_at)}</p>
                    </li>
                  ))}
                  {!carpet.delivery_logs.length && (
                    <p className="text-sm text-muted">No delivery logs yet.</p>
                  )}
                </ul>
              )}
              {tab === "operations" && (
                <ul className="space-y-3">
                  {carpet.operation_logs.map((o) => (
                    <li key={o.id} className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium capitalize text-navy">
                        {o.operation.replace(/_/g, " ")}
                      </p>
                      {o.note && <p className="text-xs text-muted">{o.note}</p>}
                      <p className="text-xs text-muted">{formatDate(o.created_at)}</p>
                    </li>
                  ))}
                  {!carpet.operation_logs.length && (
                    <p className="text-sm text-muted">No operation logs yet.</p>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border p-4">
          {qrValue && onGenerateQr && (
            <Button variant="outline" className="w-full" onClick={onGenerateQr} loading={generating}>
              Regenerate QR
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
