"use client";

import { AddressMapField } from "@/components/maps/address-map-field";
import type { MapLocation } from "@/components/maps/oman-map-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  useCreatePartner,
  useDeletePartner,
  usePartners,
  useUpdatePartner,
  type Partner,
  type PartnerInput,
} from "@/lib/api/payments-hooks";
import { OmanPhoneInput } from "@/components/ui/oman-phone-input";
import { isValidOmanPhone, OMAN_PHONE_ERROR, parseOmanPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Eye, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const emptyForm: PartnerInput = {
  name: "",
  contact_phone: "",
  address: "",
  notes: "",
  commission_rate: 15,
  is_active: true,
};

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

// Edit doc — EPIC Partner Management (US-P-01..03): add / list / delete partners.
export default function PartnersPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data: allPartners, isLoading } = usePartners(true);
  const partners = (allPartners ?? []).filter((p) =>
    statusFilter === "all" ? true : statusFilter === "active" ? p.is_active : !p.is_active,
  );
  const create = useCreatePartner();
  const update = useUpdatePartner();
  const remove = useDeletePartner();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState<PartnerInput>(emptyForm);
  const [location, setLocation] = useState<MapLocation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Partner | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setLocation(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name,
      contact_phone: p.contact_phone ?? "",
      address: p.address ?? "",
      notes: p.notes ?? "",
      contact_email: p.contact_email ?? undefined,
      commission_rate: Number(p.commission_rate),
      is_active: p.is_active,
    });
    setLocation(
      p.latitude != null && p.longitude != null
        ? { lat: Number(p.latitude), lng: Number(p.longitude), address: p.address ?? undefined }
        : null,
    );
    setFormError(null);
    setShowForm(true);
  };

  const submit = async () => {
    setFormError(null);
    // Edit doc US-P-01 acceptance criteria: name, phone and location required.
    if (form.name.trim().length < 2) {
      setFormError("Partner name is required (at least 2 characters).");
      return;
    }
    // Legacy partners may have a pre-Oman-rules phone: only validate the phone
    // when it was actually changed, so toggling Active etc. is never blocked.
    const phoneChanged =
      !editing || form.contact_phone.trim() !== (editing.contact_phone ?? "").trim();
    if (phoneChanged && !isValidOmanPhone(form.contact_phone)) {
      setFormError(OMAN_PHONE_ERROR);
      return;
    }
    if (form.address.trim().length < 5) {
      setFormError("Location / address is required — type it or pick it on the map.");
      return;
    }
    try {
      const body = {
        ...form,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
      };
      if (editing) {
        const { contact_phone, ...rest } = body;
        await update.mutateAsync({
          id: editing.id,
          ...rest,
          // Unchanged phone is omitted from the PATCH entirely.
          ...(phoneChanged ? { contact_phone: parseOmanPhone(contact_phone)! } : {}),
        });
      } else {
        await create.mutateAsync({ ...body, contact_phone: parseOmanPhone(form.contact_phone)! });
      }
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save partner.");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(null);
    try {
      // Soft delete: partner is deactivated — orders and finance history remain.
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete partner.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Partners</h1>
          <p className="mt-1 text-muted">
            Partner laundries — orders, statements and settlements.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-medium",
                  statusFilter === f.id ? "bg-primary text-white" : "bg-surface-alt text-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Partner
          </Button>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-sm">
        {isLoading ? (
          <p className="p-8 text-muted">Loading partners...</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <th className="p-4">Partner</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Location</th>
                <th className="p-4">Orders</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    {statusFilter === "all"
                      ? "No partners yet. Add the first partner laundry."
                      : `No ${statusFilter} partners.`}
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-surface-alt/50">
                    <td className="p-4">
                      <p className="font-semibold text-navy">{p.name}</p>
                      <p className="text-xs text-muted">{p.slug}</p>
                    </td>
                    <td className="p-4" dir="ltr">
                      {p.contact_phone ?? "—"}
                    </td>
                    <td className="p-4 max-w-[260px]">
                      <p className="truncate text-muted" title={p.address ?? undefined}>
                        {p.address ?? "—"}
                      </p>
                      {p.latitude != null && p.longitude != null && (
                        <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-muted" dir="ltr">
                          <MapPin className="h-3 w-3" />
                          {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
                        </p>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-navy">{p.order_count}</td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          p.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-surface-alt text-muted",
                        )}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 text-muted">
                        <Link
                          href={`/admin/partners/${p.id}`}
                          className="rounded-lg p-2 hover:bg-surface-alt hover:text-primary"
                          aria-label="Partner detail"
                          title="Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          className="rounded-lg p-2 hover:bg-surface-alt hover:text-primary"
                          aria-label="Edit partner"
                          title="Edit"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 hover:bg-surface-alt hover:text-danger"
                          aria-label="Delete partner"
                          title="Delete"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(p);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Partner" : "Add Partner"}
        dialogClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Partner Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <OmanPhoneInput
              label="Phone *"
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            />
          </div>
          <AddressMapField
            label="Location *"
            value={form.address}
            onChange={(address) => setForm((f) => ({ ...f, address }))}
            location={location}
            onLocationChange={setLocation}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Commission % (settlement)"
              type="number"
              value={String(form.commission_rate ?? 15)}
              onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })}
            />
            <Input
              label="Notes (Optional)"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active partner
          </label>
          {formError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {formError}
            </p>
          )}
          <div className="flex gap-2 border-t border-border pt-4">
            <Button loading={create.isPending || update.isPending} onClick={submit}>
              {editing ? "Save Changes" : "Create Partner"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete Partner"
        dialogClassName="max-w-md"
      >
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-navy">
              Delete <strong>{deleting.name}</strong>?
            </p>
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              The partner will be deactivated (status becomes Inactive). Previous orders and
              financial records are kept — you can restore it any time via Edit → Active.
            </p>
            {deleteError && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2 border-t border-border pt-4">
              <Button
                className="bg-danger hover:bg-danger/90"
                loading={remove.isPending}
                onClick={confirmDelete}
              >
                <Trash2 className="h-4 w-4" /> Delete Partner
              </Button>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
