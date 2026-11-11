"use client";

import { Button } from "@/components/ui/button";
import {
  REPAIR_STATUS_LABELS,
  useRecordCustomerContact,
  useRepairApprovalQueue,
  type RepairRequest,
} from "@/lib/api/repairs-hooks";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";

function RepairCard({ item }: { item: RepairRequest }) {
  const contact = useRecordCustomerContact();
  const [notes, setNotes] = useState(item.customer_contact_notes ?? "");

  return (
    <article className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-navy">{item.customer_name}</h2>
          <p className="text-sm text-muted">{item.customer_phone}</p>
          <p className="text-xs text-primary">
            #{item.tracking_code} · {item.carpet_code} · QR: {item.qr_code ?? "—"}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {REPAIR_STATUS_LABELS[item.status] ?? item.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Damage type</dt>
          <dd>{item.damage_type ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Flagged by</dt>
          <dd className="capitalize">{item.flagged_source ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">Damage</dt>
          <dd>{item.damage_description ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Repair type</dt>
          <dd>{item.repair_type ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Quoted price</dt>
          <dd>{item.quoted_price ? formatCurrency(Number(item.quoted_price)) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Deadline</dt>
          <dd>{item.repair_deadline ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Assessment notes</dt>
          <dd>{item.assessment_notes ?? "—"}</dd>
        </div>
      </dl>

      {item.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.data_url}
              alt={photo.caption ?? "Damage photo"}
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}

      {(item.status === "pending_approval" ||
        item.status === "waiting_customer_response") && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase text-muted">Admin decision</p>
          <textarea
            className="w-full rounded-xl border border-border p-3 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Approval / rejection notes..."
          />
          {contact.isError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {contact.error instanceof Error ? contact.error.message : "Action failed"}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={contact.isPending}
              onClick={() => contact.mutate({ id: item.id, outcome: "approved", notes })}
            >
              Approve repair
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={contact.isPending}
              onClick={() => contact.mutate({ id: item.id, outcome: "rejected", notes })}
            >
              Reject repair
            </Button>
          </div>
        </div>
      )}

      {item.status === "customer_approved" && (
        <p className="mt-4 border-t border-border pt-4 text-sm text-success">
          Approved for repair — repair specialist will scan QR to start.
        </p>
      )}
    </article>
  );
}

export default function AdminRepairsPage() {
  const { data: items, isLoading } = useRepairApprovalQueue();

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Repair approvals</h1>
      <p className="mt-1 text-muted">record customer approval or rejection after specialist proposal</p>

      {isLoading ? (
        <p className="mt-8 text-muted">Loading...</p>
      ) : !items?.length ? (
        <p className="mt-8 rounded-xl bg-white p-8 text-center text-muted">
          No carpets awaiting customer approval.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <RepairCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
