"use client";

import { SourceBadge } from "@/components/dashboard/source-badge";
import { Button } from "@/components/ui/button";
import { Partner } from "@/lib/api/payments-hooks";
import {
  formatPriceRange,
  OrderWizardDraft,
  serviceLabel,
} from "@/lib/orders/order-wizard";
import { cn } from "@/lib/utils";
import { Info, Trash2 } from "lucide-react";
import { useMemo } from "react";

interface OrderSummaryPanelProps {
  draft: OrderWizardDraft;
  partners: Partner[];
  previewOrderId: string;
  previewSessionId: string;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onDiscard: () => void;
}

function SummaryRow({
  label,
  value,
  filled,
}: {
  label: string;
  value: React.ReactNode;
  filled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("text-right font-medium", filled ? "text-navy" : "italic text-muted")}>
        {value}
      </span>
    </div>
  );
}

export function OrderSummaryPanel({
  draft,
  partners,
  previewOrderId,
  previewSessionId,
  canSubmit,
  submitting,
  onSubmit,
  onDiscard,
}: OrderSummaryPanelProps) {
  const partner = partners.find((p) => p.id === draft.partnerId);

  const addressDisplay = useMemo(() => {
    if (!draft.pickupAddress.trim()) return "Not filled";
    return draft.postalCode.trim()
      ? `${draft.pickupAddress.trim()} (${draft.postalCode})`
      : draft.pickupAddress.trim();
  }, [draft.pickupAddress, draft.postalCode]);

  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-navy">Order Summary</h3>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            Draft
          </span>
        </div>

        <p className="mt-4 font-mono text-lg font-bold text-navy">{previewOrderId}</p>
        {draft.source === "partner" && (
          <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
            Partner
          </span>
        )}

        <div className="mt-4 space-y-2.5 border-t border-border pt-4">
          <SummaryRow
            label="Source"
            filled
            value={<SourceBadge source={draft.source} />}
          />
          <SummaryRow
            label="Customer"
            filled={!!draft.customerName.trim()}
            value={draft.customerName.trim() || "Not filled"}
          />
          <SummaryRow
            label="Phone"
            filled={!!draft.phone.trim()}
            value={draft.phone.trim() || "Not filled"}
          />
          <SummaryRow label="Service" filled value={serviceLabel(draft.serviceType)} />
          <SummaryRow label="Address" filled={!!draft.pickupAddress.trim()} value={addressDisplay} />
          {draft.source === "partner" && (
            <SummaryRow
              label="Settlement"
              filled={!!partner}
              value={partner ? partner.name : "Partner: —"}
            />
          )}
        </div>

        <div className="mt-4 rounded-xl bg-surface-alt p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted">
            Session ID <Info className="h-3 w-3" />
          </p>
          <p className="mt-1 font-mono text-sm text-navy">{previewSessionId}</p>
          <p className="mt-1 text-[10px] text-muted">
            {canSubmit ? "Created on submit" : "Fill required fields to preview"}
          </p>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted">Estimated Cost</p>
          <p className="text-xl font-bold text-primary">{formatPriceRange(draft.serviceType)}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            * Final price will be invoiced after on-site assessment by the driver and exact size
            measurement.
          </p>
        </div>

        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={!canSubmit || submitting}
          loading={submitting}
          onClick={onSubmit}
        >
          Submit Order
        </Button>
        <button
          type="button"
          onClick={onDiscard}
          className="mt-3 flex w-full items-center justify-center gap-2 text-sm text-muted hover:text-danger"
        >
          <Trash2 className="h-4 w-4" /> Discard Draft
        </button>
      </div>

      <div className="rounded-2xl bg-navy p-5 text-white shadow-sm">
        <p className="font-bold">Special Repair Services</p>
        <p className="mt-2 text-sm text-white/80">
          Fringe repair, re-weaving, and leather stitching can be added during the driver&apos;s
          on-site assessment.
        </p>
      </div>
    </div>
  );
}
