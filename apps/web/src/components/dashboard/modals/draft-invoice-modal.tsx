"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  useDraftInvoice,
  useUpdateDraftInvoice,
  type DraftInvoice,
  type DraftInvoiceItemUpdate,
} from "@/lib/api/payments-hooks";
import { Order } from "@/lib/api/hooks";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface DraftInvoiceModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}

interface EditableService {
  name: string;
  amount: string;
}

interface EditableItem {
  carpet_id: string | null;
  carpet_code: string | null;
  carpet_type: string;
  services: EditableService[];
}

const STATUS_STYLES: Record<DraftInvoice["invoice_status"], string> = {
  draft: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  sent: "bg-teal-100 text-teal-800",
  final: "bg-green-100 text-green-800",
};

const STATUS_LABELS: Record<DraftInvoice["invoice_status"], string> = {
  draft: "Draft",
  confirmed: "Confirmed by driver",
  sent: "Sent to customer",
  final: "Final invoice",
};

function toEditable(inv: DraftInvoice): EditableItem[] {
  return inv.items.map((item) => ({
    carpet_id: item.carpet_id,
    carpet_code: item.carpet_code,
    carpet_type: item.carpet_type ?? "",
    services: item.services.map((s) => ({ name: s.name, amount: String(s.amount) })),
  }));
}

function itemTotal(item: EditableItem): number {
  return item.services.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-medium text-navy">{value ?? "—"}</span>
    </div>
  );
}

export function DraftInvoiceModal({ order, open, onClose, canEdit }: DraftInvoiceModalProps) {
  const { data: invoice, isLoading, error } = useDraftInvoice(order?.id ?? null, open);
  const updateInvoice = useUpdateDraftInvoice();

  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setSaveError(null);
    }
  }, [open]);

  useEffect(() => {
    if (invoice && editing) setItems(toEditable(invoice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const editedTotal = useMemo(
    () => items.reduce((sum, item) => sum + itemTotal(item), 0),
    [items],
  );

  const patchItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const patchService = (itemIdx: number, svcIdx: number, patch: Partial<EditableService>) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx
          ? {
              ...it,
              services: it.services.map((s, si) => (si === svcIdx ? { ...s, ...patch } : s)),
            }
          : it,
      ),
    );
  };

  const save = async () => {
    if (!invoice) return;
    setSaveError(null);
    const cleaned: DraftInvoiceItemUpdate[] = items.map((item) => ({
      carpet_id: item.carpet_id,
      carpet_type: item.carpet_type.trim() || null,
      services: item.services
        .filter((s) => s.name.trim())
        .map((s) => ({ name: s.name.trim(), amount: Number(s.amount) || 0 })),
    }));
    if (cleaned.length === 0) {
      setSaveError("The invoice needs at least one carpet.");
      return;
    }
    try {
      await updateInvoice.mutateAsync({ invoiceId: invoice.id, items: cleaned });
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the invoice");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Draft Invoice" dialogClassName="max-w-2xl">
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">Loading invoice…</p>
      ) : error || !invoice ? (
        <p className="py-8 text-center text-sm text-muted">
          No draft invoice yet — it is created automatically when the driver records the carpets
          at pickup.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-lg font-bold text-navy">{invoice.invoice_number}</p>
              <p className="text-xs text-muted">
                Order {invoice.order_number} · #{invoice.tracking_code}
                {invoice.session_code ? ` · ${invoice.session_code}` : ""}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[invoice.invoice_status]}`}
            >
              {STATUS_LABELS[invoice.invoice_status]}
            </span>
          </div>

          <div className="grid gap-2 rounded-xl bg-surface-alt p-4 sm:grid-cols-2">
            <InfoRow label="Customer" value={invoice.customer_name} />
            <InfoRow label="Phone" value={invoice.customer_phone} />
            <InfoRow label="Order date" value={formatDate(invoice.order_date)} />
            <InfoRow
              label="Pickup date"
              value={invoice.pickup_date ? formatDate(invoice.pickup_date) : "—"}
            />
            <InfoRow label="Carpets" value={invoice.carpet_count} />
            <InfoRow label="Payment" value={invoice.payment_status_label} />
          </div>

          {invoice.invoice_status === "final" && (
            <p className="flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-3 text-xs font-medium text-muted">
              <Lock className="h-4 w-4 shrink-0" />
              Financial data is locked — the final invoice has been issued.
            </p>
          )}
          {invoice.sent_at && (
            <p className="rounded-xl bg-teal-50 px-4 py-3 text-xs text-teal-800">
              Sent to {invoice.sent_to_phone} via WhatsApp
              {invoice.confirmed_by_name ? ` — confirmed by ${invoice.confirmed_by_name}` : ""}
            </p>
          )}

          {!editing ? (
            <>
              <div className="space-y-3">
                {invoice.items.length === 0 && (
                  <p className="text-center text-sm text-muted">No carpet lines recorded yet.</p>
                )}
                {invoice.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-3 text-sm">
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
                    <div className="mt-1.5 space-y-0.5">
                      {item.services.map((s, si) => (
                        <div key={si} className="flex justify-between text-xs text-muted">
                          <span>{s.name}</span>
                          <span>{formatCurrency(Number(s.amount), invoice.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="font-semibold text-navy">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(Number(invoice.total), invoice.currency)}
                </span>
              </div>

              {canEdit && invoice.editable && (
                <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit draft invoice
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="space-y-4">
                {items.map((item, i) => (
                  <div key={i} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={item.carpet_type}
                        onChange={(e) => patchItem(i, { carpet_type: e.target.value })}
                        placeholder="Carpet type"
                        className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-navy"
                      />
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, x) => x !== i))}
                        className="rounded p-2 text-muted hover:bg-danger/10 hover:text-danger"
                        aria-label="Remove carpet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {item.carpet_code && (
                      <p className="mt-1 text-xs text-muted">{item.carpet_code}</p>
                    )}

                    <div className="mt-2 space-y-2">
                      {item.services.map((s, si) => (
                        <div key={si} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={s.name}
                            onChange={(e) => patchService(i, si, { name: e.target.value })}
                            placeholder="Service (e.g. Washing)"
                            className="h-9 flex-1 rounded-lg border border-border bg-white px-3 text-xs text-navy"
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.001"
                            inputMode="decimal"
                            value={s.amount}
                            onChange={(e) => patchService(i, si, { amount: e.target.value })}
                            placeholder="0.000"
                            className="h-9 w-28 rounded-lg border border-border bg-white px-3 text-xs text-navy"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              patchItem(i, {
                                services: item.services.filter((_, x) => x !== si),
                              })
                            }
                            className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                            aria-label="Remove service"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          patchItem(i, {
                            services: [...item.services, { name: "", amount: "" }],
                          })
                        }
                        className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add service
                      </button>
                    </div>

                    <div className="mt-2 flex justify-between border-t border-border/60 pt-2 text-xs">
                      <span className="text-muted">Carpet total</span>
                      <span className="font-bold text-navy">
                        {formatCurrency(itemTotal(item), invoice.currency)}
                      </span>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      {
                        carpet_id: null,
                        carpet_code: null,
                        carpet_type: "",
                        services: [{ name: "Washing", amount: "" }],
                      },
                    ])
                  }
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold text-primary hover:border-primary/50"
                >
                  <Plus className="h-4 w-4" /> Add carpet
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="font-semibold text-navy">New total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(editedTotal, invoice.currency)}
                </span>
              </div>

              {saveError && (
                <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{saveError}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setEditing(false)}
                  disabled={updateInvoice.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  loading={updateInvoice.isPending}
                  onClick={() => void save()}
                >
                  Save changes
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
