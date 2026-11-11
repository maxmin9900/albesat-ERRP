"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  REPAIR_STATUS_LABELS,
  useRecordAssessment,
  useRepairWorkQueue,
  useUpdateRepairWork,
  type RepairRequest,
} from "@/lib/api/repairs-hooks";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";

function AssessmentForm({ item }: { item: RepairRequest }) {
  const assess = useRecordAssessment();
  const [repairType, setRepairType] = useState("");
  const [price, setPrice] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase text-muted">Repair proposal</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Repair type" value={repairType} onChange={(e) => setRepairType(e.target.value)} />
        <Input label="Estimated price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input label="Estimated deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <Input
          label="Notes"
          className="sm:col-span-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        loading={assess.isPending}
        disabled={!repairType || !price || !deadline}
        onClick={() =>
          assess.mutate({
            id: item.id,
            repair_type: repairType,
            quoted_price: parseFloat(price),
            repair_deadline: deadline,
            assessment_notes: notes || undefined,
          })
        }
      >
        Submit for customer approval
      </Button>
    </div>
  );
}

function StartRepairForm({ item }: { item: RepairRequest }) {
  const updateWork = useUpdateRepairWork();
  const [qr, setQr] = useState(item.qr_code ?? "");

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase text-muted">Start repair (scan QR)</p>
      <Input label="QR code" value={qr} onChange={(e) => setQr(e.target.value)} />
      <Button
        size="sm"
        loading={updateWork.isPending}
        disabled={!qr}
        onClick={() => updateWork.mutate({ id: item.id, status: "in_repair", qr_code: qr })}
      >
        Start repair
      </Button>
    </div>
  );
}

function CompleteRepairForm({ item }: { item: RepairRequest }) {
  const updateWork = useUpdateRepairWork();
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase text-muted">Complete repair</p>
      <Input label="Completion notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button
        size="sm"
        loading={updateWork.isPending}
        onClick={() =>
          updateWork.mutate({
            id: item.id,
            status: "repair_completed",
            completion_notes: notes || undefined,
          })
        }
      >
        Mark repair completed
      </Button>
    </div>
  );
}

function RepairCard({ item }: { item: RepairRequest }) {
  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-navy">{item.customer_name}</p>
          <p className="text-sm text-muted">{item.customer_phone}</p>
          <p className="text-xs text-primary">
            QR: {item.qr_code ?? "—"} · Session: {item.session_code ?? "—"}
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
          <dt className="text-muted">Source</dt>
          <dd className="capitalize">{item.flagged_source ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">Description</dt>
          <dd>{item.damage_description ?? "—"}</dd>
        </div>
        {item.repair_type && (
          <>
            <div>
              <dt className="text-muted">Repair type</dt>
              <dd>{item.repair_type}</dd>
            </div>
            <div>
              <dt className="text-muted">Quoted</dt>
              <dd>{item.quoted_price ? formatCurrency(Number(item.quoted_price)) : "—"}</dd>
            </div>
          </>
        )}
      </dl>

      {item.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.data_url}
              alt={photo.caption ?? "Damage photo"}
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}

      {item.status === "pending_approval" && <AssessmentForm item={item} />}
      {item.status === "customer_approved" && <StartRepairForm item={item} />}
      {item.status === "in_repair" && <CompleteRepairForm item={item} />}
    </li>
  );
}

export default function RepairTeamPage() {
  const { data: items, isLoading } = useRepairWorkQueue();

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-surface-alt p-6">
      <h1 className="text-2xl font-bold text-navy">Repair queue</h1>
      <p className="mt-1 text-muted">carpets flagged for repair — assess, start, and complete</p>

      {isLoading ? (
        <p className="mt-8 text-muted">Loading...</p>
      ) : !items?.length ? (
        <p className="mt-8 rounded-xl bg-white p-8 text-center text-muted">No repairs in queue.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((item) => (
            <RepairCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
