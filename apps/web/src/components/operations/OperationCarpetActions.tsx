"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  useCompleteOperation,
  useFlagRepairAtOperations,
  useRepairWorkFromOperations,
  type OperationCarpetItem,
} from "@/lib/api/operations-hooks";

type Props = {
  item: OperationCarpetItem;
  onUpdated: () => void;
};

// Live repair status shown on the carpet while a repair is open. While one of
// these is set, the flag button is replaced by a status badge.
const REPAIR_BADGE: Record<string, { label: string; className: string }> = {
  pending_approval: {
    label: "Repair: awaiting admin approval",
    className: "bg-amber-100 text-amber-700",
  },
  waiting_customer_response: {
    label: "Repair: awaiting approval",
    className: "bg-amber-100 text-amber-700",
  },
  customer_approved: {
    label: "Repair: approved",
    className: "bg-blue-100 text-blue-700",
  },
  in_repair: {
    label: "Repair: in progress",
    className: "bg-indigo-100 text-indigo-700",
  },
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });
}

function FlagRepairButton({ item, onUpdated }: Props) {
  const flag = useFlagRepairAtOperations();
  const [open, setOpen] = useState(false);
  const [damageType, setDamageType] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ data_url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const loaded = await Promise.all(
        Array.from(files).slice(0, 5).map(async (f) => ({ data_url: await readFileAsDataUrl(f) })),
      );
      setPhotos((prev) => [...prev, ...loaded].slice(0, 5));
    } catch {
      setError("Could not read one of the photos.");
    }
  }

  async function submit() {
    setError(null);
    if (damageType.trim().length < 2) {
      setError("Enter the damage type.");
      return;
    }
    if (description.trim().length < 3) {
      setError("Describe the damage.");
      return;
    }
    try {
      await flag.mutateAsync({
        code: item.qr_code ?? item.tracking_code,
        damage_type: damageType.trim(),
        damage_description: description.trim(),
        photos,
      });
      setDamageType("");
      setDescription("");
      setPhotos([]);
      close();
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not flag repair");
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Needs repair
      </Button>
      <Modal open={open} onClose={close} title="Flag carpet for repair">
        <div className="space-y-4">
          <div className="rounded-xl bg-surface-alt p-3 text-sm">
            <p className="font-semibold text-navy">{item.customer_name}</p>
            <p className="text-muted" dir="ltr">
              #{item.tracking_code} · {item.carpet_code}
            </p>
          </div>
          <Input
            label="Damage type"
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
            placeholder="e.g. fringe tear, hole, color run"
          />
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted">
              Description
            </label>
            <textarea
              className="w-full rounded-xl border border-border p-3 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be repaired?"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted">
              Photos (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              aria-label="Upload damage photos"
              onChange={(e) => void onFiles(e.target.files)}
              className="text-sm"
            />
            {photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <img
                    // eslint-disable-next-line @next/next/no-img-element
                    key={i}
                    src={p.data_url}
                    alt="Damage"
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            )}
          </div>
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={flag.isPending}
              onClick={() => void submit()}
            >
              Send to repair queue
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Live repair badge + the action the operations team can take in each state:
// approved -> Start repair (US-31); in progress -> Complete repair (US-32).
function RepairWorkSlot({ item, onUpdated }: Props) {
  const work = useRepairWorkFromOperations();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const badge = item.repair_status ? REPAIR_BADGE[item.repair_status] : undefined;
  if (!badge) return null;

  async function startRepair() {
    if (!item.repair_id) return;
    setError(null);
    try {
      await work.mutateAsync({
        repair_id: item.repair_id,
        status: "in_repair",
        qr_code: item.qr_code ?? item.tracking_code,
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start repair");
    }
  }

  async function completeRepair() {
    if (!item.repair_id) return;
    setError(null);
    try {
      await work.mutateAsync({
        repair_id: item.repair_id,
        status: "repair_completed",
        completion_notes: notes.trim() || undefined,
      });
      setCompleteOpen(false);
      setNotes("");
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete repair");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
      >
        {badge.label}
      </span>
      {item.repair_status === "customer_approved" && item.repair_id && (
        <Button
          type="button"
          size="sm"
          variant="navy"
          loading={work.isPending}
          onClick={() => void startRepair()}
        >
          Start repair
        </Button>
      )}
      {item.repair_status === "in_repair" && item.repair_id && (
        <Button type="button" size="sm" variant="navy" onClick={() => setCompleteOpen(true)}>
          Complete repair
        </Button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete repair"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted">
              Completion notes (optional)
            </label>
            <textarea
              className="w-full rounded-xl border border-border p-3 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was repaired?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCompleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={work.isPending}
              onClick={() => void completeRepair()}
            >
              Mark repair completed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function OperationCarpetActions({ item, onUpdated }: Props) {
  const complete = useCompleteOperation(item.id);

  const canMarkReady = item.status === "in_washing" || item.status === "drying";
  const canFlagRepair =
    item.status === "received_by_operation" ||
    item.status === "in_washing" ||
    item.status === "drying";
  const repairBadge = item.repair_status ? REPAIR_BADGE[item.repair_status] : undefined;

  async function runComplete() {
    try {
      await complete.mutateAsync();
      onUpdated();
    } catch {
      /* shown via complete.isError */
    }
  }

  // Ready/loaded carpets have no inline actions here.
  if (item.status === "ready") {
    return <span className="text-xs text-muted">Use Load scan below</span>;
  }

  const repairSlot = repairBadge ? (
    <RepairWorkSlot item={item} onUpdated={onUpdated} />
  ) : canFlagRepair ? (
    <FlagRepairButton item={item} onUpdated={onUpdated} />
  ) : null;

  return (
    <div className="flex min-w-[180px] flex-col gap-2">
      {item.status === "received_by_operation" && (
        <span className="text-xs text-muted">Use Start scan above</span>
      )}
      {canMarkReady && (
        <>
          <Button
            type="button"
            size="sm"
            loading={complete.isPending}
            onClick={() => void runComplete()}
          >
            Mark Ready For Delivery
          </Button>
          {complete.isError && (
            <p className="text-xs text-danger">
              {complete.error instanceof Error ? complete.error.message : "Action failed"}
            </p>
          )}
        </>
      )}
      {repairSlot}
    </div>
  );
}
