"use client";

import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SourceBadge } from "@/components/dashboard/source-badge";
import { Button } from "@/components/ui/button";
import { Order, useOrder } from "@/lib/api/hooks";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (order: Order) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export function OrderDetailModal({ order, open, onClose, onEdit }: OrderDetailModalProps) {
  const { data: detail, isLoading } = useOrder(open && order ? order.id : null);
  const o = detail ?? order;

  return (
    <Modal open={open} onClose={onClose} title="Order Details">
      {!o ? (
        <p className="text-sm text-muted">No order selected.</p>
      ) : isLoading && !detail ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-bold text-navy">#{o.order_number.replace("ORD-", "")}</p>
            <StatusBadge status={o.status} />
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer">
              <span className="font-medium text-navy">{o.customer_name}</span>
            </Field>
            <Field label="Phone">
              <span className="text-navy">{o.customer_phone}</span>
            </Field>
            <Field label="Source">
              <SourceBadge source={o.source} />
            </Field>
            <Field label="Tracking">
              <span className="font-mono text-navy">{o.tracking_code}</span>
            </Field>
            <Field label="Service">
              <span className="capitalize text-navy">{o.service_type}</span>
            </Field>
            <Field label="Carpets">
              <span className="text-navy">{o.carpet_count ?? 1}</span>
            </Field>
            {o.carpet_dimensions ? (
              <Field label="Area / size">
                <span className="text-navy">{o.carpet_dimensions}</span>
              </Field>
            ) : null}
            <Field label="Price">
              <span className="font-semibold text-navy">
                {formatCurrency(Number(o.total), o.currency)}
              </span>
            </Field>
            {o.carpet_description ? (
              <div className="sm:col-span-2">
                <Field label="Carpet">
                  <span className="text-navy">{o.carpet_description}</span>
                </Field>
              </div>
            ) : null}
            {o.notes ? (
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <span className="text-navy">{o.notes}</span>
                </Field>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Link href="/admin/tracking">
              <Button type="button" variant="outline" size="sm">
                Open Tracking
              </Button>
            </Link>
            {onEdit ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onEdit(o);
                  onClose();
                }}
              >
                Edit Order
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
