"use client";

import { OrderSummaryPanel } from "@/components/orders/order-summary-panel";
import { OrderWizardStepper } from "@/components/orders/order-wizard-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrder, useOrders } from "@/lib/api/hooks";
import { usePartners } from "@/lib/api/payments-hooks";
import {
  buildNotes,
  buildPickupAddress,
  clearWizardDraft,
  defaultServiceForSource,
  EMPTY_DRAFT,
  loadWizardDraft,
  OrderSourceType,
  OrderWizardDraft,
  previewOrderNumber,
  previewSessionCode,
  saveWizardDraft,
  SERVICE_OPTIONS,
  SOURCE_OPTIONS,
  ServiceTypeId,
} from "@/lib/orders/order-wizard";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  Crown,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  Upload,
  Users,
  WashingMachine,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const SOURCE_ICONS: Record<OrderSourceType, React.ReactNode> = {
  website: <Globe className="h-6 w-6 text-primary" />,
  whatsapp: <MessageCircle className="h-6 w-6 text-green-600" />,
  phone: <Phone className="h-6 w-6 text-amber-600" />,
  partner: <Users className="h-6 w-6 text-purple-600" />,
};

const SERVICE_ICONS: Record<ServiceTypeId, React.ReactNode> = {
  standard: <WashingMachine className="h-6 w-6" />,
  premium: <Sparkles className="h-6 w-6" />,
  antique: <Crown className="h-6 w-6" />,
};

function validateStep(step: number, draft: OrderWizardDraft): string | null {
  if (step === 1) {
    if (draft.source === "partner" && !draft.partnerId) return "Select a partner laundry";
    return null;
  }
  if (step === 2) {
    if (draft.customerName.trim().length < 2) return "Customer name is required";
    if (draft.phone.trim().length < 10) return "Valid phone number is required";
    return null;
  }
  if (step === 3) {
    if (draft.pickupAddress.trim().length < 5) return "Pickup address is required";
    return null;
  }
  return null;
}

function canSubmitDraft(draft: OrderWizardDraft): boolean {
  return (
    validateStep(1, draft) === null &&
    validateStep(2, draft) === null &&
    validateStep(3, draft) === null
  );
}

export function OrderRegistrationWizard() {
  const router = useRouter();
  const createOrder = useCreateOrder();
  const { data: partners = [] } = usePartners();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OrderWizardDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [previewOrderId] = useState(previewOrderNumber);
  const [previewSessionId] = useState(previewSessionCode);

  const { data: customerLookup } = useOrders({
    page: 1,
    search: customerSearch.length >= 2 ? customerSearch : undefined,
  });

  useEffect(() => {
    const saved = loadWizardDraft();
    if (saved) {
      setDraft(saved.draft);
      setStep(saved.step);
    }
  }, []);

  const patch = useCallback((partial: Partial<OrderWizardDraft>) => {
    setDraft((d) => ({ ...d, ...partial }));
  }, []);

  const goNext = () => {
    const err = validateStep(step, draft);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  };

  const goPrev = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSaveDraft = () => {
    saveWizardDraft(draft, step);
    setError(null);
    alert("Draft saved locally.");
  };

  const handleDiscard = () => {
    if (!window.confirm("Discard this draft?")) return;
    clearWizardDraft();
    setDraft(EMPTY_DRAFT);
    setStep(1);
    router.push("/admin/orders");
  };

  const handleSubmit = async () => {
    const err = canSubmitDraft(draft) ? null : "Complete all required steps before submitting";
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    try {
      const created = await createOrder.mutateAsync({
        customer_name: draft.customerName.trim(),
        phone: draft.phone.trim(),
        customer_email: draft.email.trim() || undefined,
        source: draft.source,
        service_type: draft.serviceType,
        pickup_address: buildPickupAddress(draft),
        notes: buildNotes(draft),
        partner_id: draft.source === "partner" ? draft.partnerId : undefined,
        partner_reference:
          draft.source === "partner" && draft.partnerReference.trim()
            ? draft.partnerReference.trim()
            : undefined,
      });
      clearWizardDraft();
      router.push(`/admin/orders?created=${created.tracking_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    }
  };

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; address?: string | null }>();
    for (const o of customerLookup?.items ?? []) {
      const key = o.customer_phone;
      if (!map.has(key)) {
        map.set(key, {
          name: o.customer_name,
          phone: o.customer_phone,
          address: o.pickup_address,
        });
      }
    }
    return Array.from(map.values()).slice(0, 6);
  }, [customerLookup?.items]);

  const selectedPartner = partners.find((p) => p.id === draft.partnerId);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link href="/admin" className="hover:text-primary">
              Admin Panel
            </Link>
            {" / "}
            <Link href="/admin/orders" className="hover:text-primary">
              Order Management
            </Link>
            {" / "}
            <span className="text-navy">New Order Registration</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-navy">New Order Registration</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/orders")}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft}>
            Save Draft
          </Button>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <OrderWizardStepper currentStep={step} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-navy">Step 1: Order Source</h2>
                <p className="mt-1 text-sm text-muted">
                  Please specify how the customer placed this order.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {SOURCE_OPTIONS.map((opt) => {
                    const selected = draft.source === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          patch({
                            source: opt.id,
                            serviceType: defaultServiceForSource(opt.id),
                            partnerId: opt.id === "partner" ? draft.partnerId : "",
                          })
                        }
                        className={cn(
                          "relative rounded-2xl border-2 p-5 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border bg-surface-alt hover:border-primary/40",
                        )}
                      >
                        {selected && (
                          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                          {SOURCE_ICONS[opt.id]}
                        </span>
                        <p className="mt-3 font-bold text-navy">{opt.label}</p>
                      </button>
                    );
                  })}
                </div>

                {draft.source === "website" && (
                  <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Customer registered via website portal. Service type defaults to Standard Wash.
                  </p>
                )}

                {draft.source === "partner" && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-navy">
                        Select Partner Laundry
                      </label>
                      <select
                        value={draft.partnerId}
                        onChange={(e) => patch({ partnerId: e.target.value })}
                        className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm"
                      >
                        <option value="">Please select a partner...</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Partner Reference Number (Optional)"
                      placeholder="e.g. PTR-20240811-007"
                      value={draft.partnerReference}
                      onChange={(e) => patch({ partnerReference: e.target.value })}
                    />
                    <p className="text-xs text-muted">
                      Enter the partner&apos;s internal order ID for cross-reference.
                    </p>
                    {selectedPartner && (
                      <p className="rounded-xl bg-purple-50 px-4 py-3 text-sm text-purple-900">
                        This order will be linked to <strong>{selectedPartner.name}</strong> for
                        monthly settlement. A PARTNER label will be attached to this customer.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold text-navy">Step 2: Customer Information</h2>
                <p className="mt-1 text-sm text-muted">Enter customer contact details.</p>
                <div className="relative mt-6">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    placeholder="Search by name or phone number..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-alt py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {uniqueCustomers.length > 0 && customerSearch.length >= 2 && (
                  <ul className="mt-2 rounded-xl border border-border bg-white shadow-sm">
                    {uniqueCustomers.map((c) => (
                      <li key={c.phone}>
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm hover:bg-surface-alt"
                          onClick={() =>
                            patch({
                              customerName: c.name,
                              phone: c.phone,
                              pickupAddress: c.address ?? draft.pickupAddress,
                            })
                          }
                        >
                          <span className="font-medium text-navy">{c.name}</span>
                          <span className="ml-2 text-muted">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full Name *"
                    value={draft.customerName}
                    onChange={(e) => patch({ customerName: e.target.value })}
                  />
                  <Input
                    label="Phone Number *"
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                  <Input
                    label="Email (Optional)"
                    type="email"
                    className="sm:col-span-2"
                    value={draft.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </div>
                <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  If this customer already exists, use the search above to auto-fill their details
                  from previous orders.
                </p>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold text-navy">Step 3: Address & Location</h2>
                <p className="mt-1 text-sm text-muted">
                  Specify the exact pickup location for the carpet.
                </p>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">
                      Full Address *
                    </label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Street, building, city..."
                      value={draft.pickupAddress}
                      onChange={(e) => patch({ pickupAddress: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Input
                      label="Postal Code"
                      className="flex-1 min-w-[160px]"
                      value={draft.postalCode}
                      onChange={(e) => patch({ postalCode: e.target.value })}
                    />
                    <Button type="button" variant="outline" className="mt-7">
                      <MapPin className="h-4 w-4" /> Select on Map
                    </Button>
                  </div>
                  <div className="relative h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-xl bg-white px-4 py-2 text-center shadow-lg">
                        <MapPin className="mx-auto h-6 w-6 text-primary" />
                        <p className="mt-1 text-xs font-medium text-navy">
                          Confirm location for driver navigation
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="text-xl font-bold text-navy">Step 4: Service Type</h2>
                <p className="mt-1 text-sm text-muted">
                  Select the washing type and any additional services.
                </p>
                <div className="mt-6 space-y-4">
                  {SERVICE_OPTIONS.map((svc) => {
                    const selected = draft.serviceType === svc.id;
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => patch({ serviceType: svc.id })}
                        className={cn(
                          "relative flex w-full items-start gap-4 rounded-2xl border-2 p-5 text-left",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-surface-alt hover:border-primary/30",
                        )}
                      >
                        {selected && (
                          <span className="absolute right-4 top-4 text-primary">
                            <Check className="h-5 w-5" />
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl",
                            selected ? "bg-primary/15 text-primary" : "bg-white text-muted",
                          )}
                        >
                          {SERVICE_ICONS[svc.id]}
                        </span>
                        <div>
                          <p className="font-bold text-navy">{svc.label}</p>
                          <p className="text-sm text-muted">{svc.description}</p>
                          <p className="mt-2 text-sm font-semibold text-primary">
                            Estimated Price {svc.priceLabel}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <h2 className="text-xl font-bold text-navy">Step 5: Notes & Photos</h2>
                <p className="mt-1 text-sm text-muted">
                  Add additional details or upload carpet photos if needed.
                </p>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-navy">
                      Notes for Driver or Cleaning Unit
                    </label>
                    <textarea
                      className="min-h-[120px] w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm"
                      placeholder="e.g. Old grease stains, fringe repair needed on edges..."
                      value={draft.notes}
                      onChange={(e) => patch({ notes: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-navy">
                      Carpet Photos (Current Condition)
                    </p>
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-alt py-10 hover:border-primary/50">
                      <Upload className="h-8 w-8 text-muted" />
                      <span className="mt-2 text-sm font-medium text-muted">Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const names = Array.from(e.target.files ?? []).map((f) => f.name);
                          patch({ photoNames: [...draft.photoNames, ...names] });
                        }}
                      />
                    </label>
                    {draft.photoNames.length > 0 && (
                      <p className="mt-2 text-sm text-muted">
                        {draft.photoNames.length} photo(s) attached: {draft.photoNames.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-8 flex justify-between border-t border-border pt-6">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={goPrev}>
                  Previous
                </Button>
              ) : (
                <span />
              )}
              {step < 5 ? (
                <Button type="button" variant="navy" onClick={goNext}>
                  Next Step <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} loading={createOrder.isPending}>
                  <Check className="h-4 w-4" /> Preview & Confirm
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <OrderSummaryPanel
            draft={draft}
            partners={partners}
            previewOrderId={previewOrderId}
            previewSessionId={previewSessionId}
            canSubmit={canSubmitDraft(draft)}
            submitting={createOrder.isPending}
            onSubmit={handleSubmit}
            onDiscard={handleDiscard}
          />
        </div>
      </div>
    </div>
  );
}
