"use client";

import { QrScannerViewport } from "@/components/driver/qr-scanner-viewport";
import { WorkflowStepper } from "@/components/driver/workflow-stepper";
import { Button } from "@/components/ui/button";
import {
  useConfirmPickupInvoice,
  useDriverOrder,
  usePickupInvoice,
  useSavePickupCarpets,
  useStartPickup,
} from "@/lib/api/driver-hooks";
import { formatCurrency } from "@/lib/utils";
import { openMapsNavigationTo } from "@/lib/maps";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = [
  { id: "navigate", label: "Navigate" },
  { id: "scan_qr", label: "Carpets" },
  { id: "collected", label: "Collected" },
];

// Price = length × width × rate (OMR per m²), by carpet type.
const CARPET_TYPES = [
  { id: "machine_thin", label: "Machine carpet (thin)", rate: 1.2 },
  { id: "machine_thick", label: "Machine carpet (thick)", rate: 1.8 },
  { id: "tufting", label: "Tufting carpet", rate: 3 },
  { id: "handmade", label: "Handmade carpet", rate: 5 },
  { id: "handmade_silk", label: "Handmade silk", rate: 6 },
] as const;

type CarpetTypeId = (typeof CARPET_TYPES)[number]["id"] | "";

function autoPrice(type: CarpetTypeId, length: string, width: string): string | null {
  const t = CARPET_TYPES.find((x) => x.id === type);
  const l = parseFloat(length);
  const w = parseFloat(width);
  if (!t || !Number.isFinite(l) || !Number.isFinite(w) || l <= 0 || w <= 0) return null;
  return (l * w * t.rate).toFixed(3);
}

interface CarpetForm {
  type: CarpetTypeId;
  length: string;
  width: string;
  price: string;
  needsRepair: boolean;
  damage: string;
  code: string;
}

function emptyCarpet(): CarpetForm {
  return { type: "", length: "", width: "", price: "", needsRepair: false, damage: "", code: "" };
}

function arrivedKey(orderId: string) {
  return `pickup-arrived-${orderId}`;
}

export default function PickupFlowPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = params.orderId as string;
  const { data: order, refetch } = useDriverOrder(orderId);
  const [arrived, setArrived] = useState(false);
  const startPickup = useStartPickup(orderId);
  const savePickupCarpets = useSavePickupCarpets(orderId);
  const [done, setDone] = useState(false);

  const [carpetCount, setCarpetCount] = useState("");
  const [carpets, setCarpets] = useState<CarpetForm[]>([emptyCarpet()]);
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialise the count from the order, defaulting to 1.
  useEffect(() => {
    if (!order) return;
    setCarpetCount((prev) => prev || String(order.carpet_count || 1));
  }, [order]);

  // Keep the carpets array in sync with the requested count (preserve entries).
  useEffect(() => {
    const n = Math.max(1, Math.min(parseInt(carpetCount, 10) || 1, 999));
    setCarpets((prev) => {
      if (prev.length === n) return prev;
      if (prev.length < n) {
        return [...prev, ...Array.from({ length: n - prev.length }, emptyCarpet)];
      }
      return prev.slice(0, n);
    });
  }, [carpetCount]);

  useEffect(() => {
    const fromUrl = searchParams.get("arrived") === "1";
    const fromStorage =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(arrivedKey(orderId)) === "1";
    if (fromUrl || fromStorage) setArrived(true);
  }, [orderId, searchParams]);

  useEffect(() => {
    if (order?.pickup_workflow === "accepted") {
      startPickup.mutate(undefined, { onSuccess: () => refetch() });
    }
  }, [order?.pickup_workflow]);

  const markArrived = () => {
    setArrived(true);
    sessionStorage.setItem(arrivedKey(orderId), "1");
  };

  const currentStep =
    done || order?.pickup_workflow === "collected"
      ? "collected"
      : arrived || order?.pickup_workflow === "qr_attached"
        ? "scan_qr"
        : "navigate";

  // US-DI-04: draft invoice (پیش‌فاکتور) summary + driver confirmation.
  const { data: invoice, refetch: refetchInvoice } = usePickupInvoice(
    orderId,
    currentStep === "collected",
  );
  const confirmInvoice = useConfirmPickupInvoice(orderId);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const handleConfirmInvoice = async () => {
    setInvoiceError(null);
    try {
      await confirmInvoice.mutateAsync();
      refetchInvoice();
    } catch (e) {
      setInvoiceError(e instanceof Error ? e.message : "Could not confirm the invoice");
    }
  };

  const updateCarpet = (index: number, patch: Partial<CarpetForm>) => {
    setCarpets((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  // Changing type/length/width re-fills the price (auto); the driver can still
  // override the price field manually afterwards.
  const updateCarpetSize = (index: number, patch: Partial<CarpetForm>) => {
    setCarpets((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const merged = { ...c, ...patch };
        const auto = autoPrice(merged.type, merged.length, merged.width);
        return auto !== null ? { ...merged, price: auto } : merged;
      }),
    );
  };

  const handleScan = (code: string) => {
    if (scanningIndex === null) return;
    const clean = code.trim();
    if (carpets.some((c, i) => i !== scanningIndex && c.code === clean)) {
      setError("This barcode is already assigned to another carpet.");
      return;
    }
    updateCarpet(scanningIndex, { code: clean });
    setScanningIndex(null);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const codes = carpets.map((c) => c.code.trim());
    if (codes.some((c) => !c)) {
      setError("Scan a barcode for every carpet before saving.");
      return;
    }
    if (new Set(codes).size !== codes.length) {
      setError("Each carpet must have a different barcode.");
      return;
    }
    try {
      await savePickupCarpets.mutateAsync({
        carpets: carpets.map((c) => ({
          code: c.code.trim(),
          carpet_type: CARPET_TYPES.find((t) => t.id === c.type)?.label ?? null,
          length: c.length.trim() ? Number(c.length) : null,
          width: c.width.trim() ? Number(c.width) : null,
          price: c.price.trim() ? Number(c.price) : null,
          needs_repair: c.needsRepair,
          damage_description: c.needsRepair && c.damage.trim() ? c.damage.trim() : null,
        })),
      });
      setDone(true);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save carpets");
    }
  };

  if (!order) {
    return <p className="p-8 text-center text-muted">Loading...</p>;
  }

  // Read-only customer panel (name / address / house plaque + phone), shown in
  // both the Navigate and Record-carpets steps. Editing customer details is
  // done from the admin / super-admin panel, not by the driver.
  const customerPanel = (
    <div className="overflow-hidden rounded-2xl border border-primary/20 shadow-sm">
      <div className="bg-navy px-4 py-3 font-semibold text-white">Customer details</div>
      <div className="space-y-4 p-4">
        <div>
          <p className="font-bold text-navy">{order.customer_name}</p>
          <p className="text-sm text-muted">#{order.tracking_code}</p>
        </div>
        {order.pickup_address && (
          <p className="flex items-start gap-2 text-sm text-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {order.pickup_address}
          </p>
        )}
        {order.house_number && (
          <p className="text-sm text-muted">
            <span className="font-semibold text-navy">House / plaque:</span>{" "}
            {order.house_number}
          </p>
        )}
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone}`}
            className="flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <Phone className="h-4 w-4" />
            {order.customer_phone}
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/driver" className="rounded-lg p-2 hover:bg-surface-alt">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-bold text-navy">Pickup — #{order.tracking_code}</h1>
            <WorkflowStepper steps={STEPS} currentStep={currentStep} />
          </div>
        </div>
      </header>

      <div className="space-y-6 p-4 pb-8">
        {currentStep === "collected" ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-navy">Pickup Confirmed</h2>
            <p className="mt-1 text-muted">#{order.tracking_code}</p>
            <div className="mt-8 space-y-3 rounded-2xl bg-surface-alt p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Customer</span>
                <span className="font-bold">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Carpets</span>
                <span className="font-bold text-primary">{order.carpets?.length || order.carpet_count}</span>
              </div>
              {(order.carpets ?? []).map((c) => (
                <div key={c.id} className="flex justify-between border-t border-border/60 pt-2">
                  <span className="text-muted">{c.carpet_code}</span>
                  <span className="font-medium">
                    {c.dimensions ?? "—"}
                    {c.price ? ` · ${c.price} ${order.currency}` : ""}
                    {c.needs_repair ? " · ⚠ repair" : ""}
                  </span>
                </div>
              ))}
            </div>
            {invoice && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-primary/20 text-left shadow-sm">
                <div className="flex items-center justify-between bg-navy px-4 py-3">
                  <span className="font-semibold text-white">Draft Invoice</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {invoice.invoice_number}
                  </span>
                </div>
                <div className="space-y-3 p-4 text-sm">
                  {invoice.items.map((item) => (
                    <div key={item.id} className="rounded-xl bg-surface-alt p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-navy">
                          {item.carpet_type || "Carpet"} #{item.position + 1}
                        </span>
                        <span className="font-bold text-navy">
                          {formatCurrency(Number(item.amount), invoice.currency)}
                        </span>
                      </div>
                      {item.carpet_code && (
                        <p className="mt-0.5 text-xs text-muted">{item.carpet_code}</p>
                      )}
                      <div className="mt-1 space-y-0.5">
                        {item.services.map((s, si) => (
                          <div key={si} className="flex justify-between text-xs text-muted">
                            <span>{s.name}</span>
                            <span>{formatCurrency(Number(s.amount), invoice.currency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-3">
                    <span className="font-semibold text-navy">Total</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(Number(invoice.total), invoice.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>Payment status</span>
                    <span className="font-semibold">{invoice.payment_status_label}</span>
                  </div>

                  {invoiceError && (
                    <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                      {invoiceError}
                    </p>
                  )}

                  {invoice.invoice_status === "draft" ? (
                    <Button
                      className="w-full"
                      loading={confirmInvoice.isPending}
                      onClick={() => void handleConfirmInvoice()}
                    >
                      Confirm invoice &amp; send to customer
                    </Button>
                  ) : (
                    <div className="rounded-xl bg-success/10 px-3 py-2 text-center text-xs font-semibold text-success">
                      {invoice.invoice_status === "sent"
                        ? `Invoice confirmed — sent to ${invoice.sent_to_phone ?? "customer"} via WhatsApp`
                        : "Invoice confirmed"}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              className="mt-8 w-full"
              variant="navy"
              onClick={() => router.push(`/driver/handoff/${orderId}`)}
            >
              Hand to Operations
            </Button>
            <Button className="mt-3 w-full" variant="secondary" onClick={() => router.push("/driver")}>
              Back to List
            </Button>
          </div>
        ) : currentStep === "scan_qr" ? (
          <>
            <div>
              <h2 className="text-xl font-bold text-navy">Record the carpets</h2>
              <p className="mt-1 text-sm text-muted">
                For each carpet, scan its pre-printed leather tag and record the size, price and
                whether it needs repair.
              </p>
            </div>
            {error && (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted">
                Number of carpets
              </label>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={carpetCount}
                onChange={(e) => setCarpetCount(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
                placeholder="e.g. 3"
              />
            </div>

            {scanningIndex !== null && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <p className="mb-3 text-sm font-semibold text-navy">
                  Scanning barcode for carpet #{scanningIndex + 1}
                </p>
                <QrScannerViewport
                  onScan={handleScan}
                  placeholder="Scan or type the carpet tag"
                />
                <Button
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => setScanningIndex(null)}
                >
                  Cancel scan
                </Button>
              </div>
            )}

            <div className="space-y-4">
              {carpets.map((c, i) => (
                <div key={i} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-navy">Carpet #{i + 1}</h3>
                    {c.code ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        {c.code}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">No barcode yet</span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant={c.code ? "outline" : "navy"}
                    className="mt-3 w-full"
                    onClick={() => {
                      setScanningIndex(i);
                      setError(null);
                    }}
                  >
                    <QrCode className="h-4 w-4" /> {c.code ? "Rescan barcode" : "Scan barcode"}
                  </Button>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted">
                      Carpet type
                    </label>
                    <select
                      value={c.type}
                      onChange={(e) =>
                        updateCarpetSize(i, { type: e.target.value as CarpetTypeId })
                      }
                      className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
                    >
                      <option value="">Select type…</option>
                      {CARPET_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} — {t.rate.toFixed(3)} / m²
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-semibold uppercase text-muted">
                        Length (m)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        inputMode="decimal"
                        value={c.length}
                        onChange={(e) => updateCarpetSize(i, { length: e.target.value })}
                        className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
                        placeholder="e.g. 3"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-semibold uppercase text-muted">
                        Width (m)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        inputMode="decimal"
                        value={c.width}
                        onChange={(e) => updateCarpetSize(i, { width: e.target.value })}
                        className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
                        placeholder="e.g. 2"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted">
                      Price ({order.currency})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={c.price}
                      onChange={(e) => updateCarpet(i, { price: e.target.value })}
                      className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy"
                      placeholder="e.g. 40"
                    />
                    <p className="mt-1 text-xs text-muted">
                      Auto: length × width × rate. You can edit it manually.
                    </p>
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={c.needsRepair}
                      onChange={(e) => updateCarpet(i, { needsRepair: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    Needs repair
                  </label>
                  {c.needsRepair && (
                    <textarea
                      value={c.damage}
                      onChange={(e) => updateCarpet(i, { damage: e.target.value })}
                      rows={2}
                      className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-navy"
                      placeholder="Describe the damage (optional)"
                    />
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="navy"
              size="lg"
              className="w-full"
              onClick={submit}
              disabled={savePickupCarpets.isPending}
            >
              {savePickupCarpets.isPending ? "Saving…" : "Confirm pickup"}
            </Button>

            {customerPanel}
          </>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-navy">Navigate to Customer</h2>
              <p className="mt-1 text-sm text-muted">
                Go to the pickup address, then scan the carpet QR tag.
              </p>
            </div>
            {customerPanel}
            <Button
              className="w-full"
              size="lg"
              onClick={() =>
                openMapsNavigationTo(order.pickup_address, order.latitude, order.longitude)
              }
            >
              <Navigation className="h-5 w-5" /> Open in Google Maps
            </Button>
            <Link href={`/driver/map?focus=${orderId}&start=1`} className="block">
              <Button variant="outline" className="w-full">
                <MapPin className="h-4 w-4" /> View on Route Map
              </Button>
            </Link>
            <Button className="w-full" variant="navy" size="lg" onClick={markArrived}>
              I&apos;m at customer — Record carpets
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
