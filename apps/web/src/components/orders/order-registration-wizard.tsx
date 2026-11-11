"use client";

import { OmanMapPicker } from "@/components/maps/oman-map-picker";
import { isInsideOman, OMAN_LOCATION_ERROR } from "@/lib/oman-geo";
import { OrderSummaryPanel } from "@/components/orders/order-summary-panel";
import { OrderWizardStepper } from "@/components/orders/order-wizard-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrder, useCustomerLookup } from "@/lib/api/hooks";
import { usePartners } from "@/lib/api/payments-hooks";
import {
  buildNotes,
  buildPickupAddress,
  clearWizardDraft,
  defaultServiceForSource,
  EMPTY_DRAFT,
  OrderSourceType,
  OrderWizardDraft,
  saveWizardDraft,
  SOURCE_OPTIONS,
  WIZARD_STEP_COUNT,
} from "@/lib/orders/order-wizard";
import { CustomerPhoneInput } from "@/components/ui/customer-phone-input";
import { isValidCustomerPhone, CUSTOMER_PHONE_ERROR, parseCustomerPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Globe, MessageCircle, Phone, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const SOURCE_ICONS: Record<OrderSourceType, React.ReactNode> = {
  website: <Globe className="h-6 w-6 text-primary" />,
  whatsapp: <MessageCircle className="h-6 w-6 text-green-600" />,
  phone: <Phone className="h-6 w-6 text-amber-600" />,
  partner: <Users className="h-6 w-6 text-purple-600" />,
};

function validateStep(step: number, draft: OrderWizardDraft): string | null {
  if (step === 1) {
    if (draft.source === "partner" && !draft.partnerId) return "Select a partner laundry";
    return null;
  }
  if (step === 2) {
    if (draft.customerName.trim().length < 2) return "Customer name is required";
    if (!isValidCustomerPhone(draft.phone)) return CUSTOMER_PHONE_ERROR;
    return null;
  }
  if (step === 3) {
    if (draft.pickupAddress.trim().length < 5) return "Pickup address is required";
    if (draft.latitude == null || draft.longitude == null) return "Select location on the map";
    if (!isInsideOman(draft.latitude, draft.longitude)) return OMAN_LOCATION_ERROR;
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

interface OrderRegistrationWizardProps {
  /** Page heading + final breadcrumb label. Defaults to the order flow. */
  heading?: string;
  /** Middle breadcrumb link (the section this flow belongs to). */
  section?: { label: string; href: string };
  /** Where Cancel / back navigation returns to. */
  cancelHref?: string;
  /** Where "View Orders" / discard lands after the flow. */
  doneHref?: string;
  /**
   * `driver` renders a compact mobile layout for the driver panel: no admin
   * breadcrumbs, no summary sidebar, and WhatsApp as the only channel (drivers
   * cannot read partner laundries).
   */
  variant?: "admin" | "driver";
}

export function OrderRegistrationWizard({
  heading = "New Order Registration",
  section = { label: "Order Management", href: "/admin/orders" },
  cancelHref = "/admin/orders",
  doneHref = "/admin/orders",
  variant = "admin",
}: OrderRegistrationWizardProps = {}) {
  const router = useRouter();
  const createOrder = useCreateOrder();
  const isDriver = variant === "driver";
  // Drivers skip the channel step: their orders are always WhatsApp.
  const firstStep = isDriver ? 2 : 1;
  // Only active partners are selectable — the API rejects inactive ones.
  const { data: partners = [] } = usePartners(false, !isDriver);
  const [step, setStep] = useState(firstStep);
  const [draft, setDraft] = useState<OrderWizardDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [lookupApplied, setLookupApplied] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    trackingCode: string;
    customerName: string;
  } | null>(null);

  useEffect(() => {
    clearWizardDraft();
  }, []);

  const lookupPhone =
    customerSearch.replace(/\D/g, "").length >= 8 ? customerSearch.trim() : undefined;
  const { data: customerLookup, isFetching: lookupLoading } = useCustomerLookup(lookupPhone);

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
    setStep((s) => Math.min(WIZARD_STEP_COUNT, s + 1));
  };

  const goPrev = () => {
    setError(null);
    setStep((s) => Math.max(firstStep, s - 1));
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
    setStep(firstStep);
    router.push(doneHref);
  };

  const applyCustomerLookup = () => {
    if (!customerLookup?.found) return;
    patch({
      customerName: customerLookup.customer_name,
      phone: customerLookup.phone,
      email: customerLookup.customer_email ?? "",
      pickupAddress: customerLookup.pickup_address ?? "",
      latitude: customerLookup.latitude != null ? Number(customerLookup.latitude) : null,
      longitude: customerLookup.longitude != null ? Number(customerLookup.longitude) : null,
    });
    setLookupApplied(true);
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
        phone: parseCustomerPhone(draft.phone.trim())!,
        customer_email: draft.email.trim() || undefined,
        source: draft.source,
        service_type: draft.serviceType,
        pickup_address: buildPickupAddress(draft),
        latitude: draft.latitude ?? undefined,
        longitude: draft.longitude ?? undefined,
        notes: buildNotes(draft),
        partner_id: draft.source === "partner" ? draft.partnerId : undefined,
        partner_reference:
          draft.source === "partner" && draft.partnerReference.trim()
            ? draft.partnerReference.trim()
            : undefined,
      });
      clearWizardDraft();
      setConfirmed({
        trackingCode: created.tracking_code,
        customerName: draft.customerName.trim(),
      });
      setDraft(EMPTY_DRAFT);
      setStep(firstStep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    }
  };

  const selectedPartner = partners.find((p) => p.id === draft.partnerId);

  if (confirmed) {
    return (
      <div className={cn("mx-auto max-w-lg text-center", isDriver ? "px-4 py-10" : "py-16")}>
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-navy">Order Registered Successfully</h1>
        <p className="mt-2 text-muted">
          New order created for <strong>{confirmed.customerName}</strong>
        </p>
        <p className="mt-4 font-mono text-lg font-bold text-primary" dir="ltr">
          {confirmed.trackingCode}
        </p>
        <p className="mt-6 text-sm text-muted">
          Share the tracking code with the customer. A new session was created for this order.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => router.push(doneHref)}>View Orders</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmed(null);
              setCustomerSearch("");
              setLookupApplied(false);
              clearWizardDraft();
            }}
          >
            Register Another Order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(isDriver && "p-4")}>
      {isDriver ? (
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-navy">{heading}</h1>
          <Button size="sm" variant="outline" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">
              <Link href="/admin" className="hover:text-primary">
                Admin Panel
              </Link>
              {" / "}
              <Link href={section.href} className="hover:text-primary">
                {section.label}
              </Link>
              {" / "}
              <span className="text-navy">{heading}</span>
            </p>
            <h1 className="mt-2 text-2xl font-bold text-navy">{heading}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(cancelHref)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleSaveDraft}>
              Save Draft
            </Button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "overflow-x-auto rounded-2xl bg-white p-4 shadow-sm sm:p-6",
          isDriver ? "mt-4" : "mt-8",
        )}
      >
        <OrderWizardStepper currentStep={step} />
      </div>

      <div className={cn("grid gap-6 lg:grid-cols-3", isDriver ? "mt-4" : "mt-6")}>
        <div className={cn(isDriver ? "lg:col-span-3" : "lg:col-span-2")}>
          <div className={cn("rounded-2xl bg-white shadow-sm", isDriver ? "p-4" : "p-6 sm:p-8")}>
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-navy">Step 1: Channel</h2>
                <p className="mt-1 text-sm text-muted">
                  Select the channel this order came from — WhatsApp or a partner laundry.
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
                    {partners.length === 0 ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        No partner laundry is registered yet. Add one in{" "}
                        <a href="/admin/partners" className="font-semibold underline">
                          Admin → Partners
                        </a>{" "}
                        before creating a partner order.
                      </p>
                    ) : (
                      <>
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
                      </>
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
                    type="tel"
                    inputMode="tel"
                    placeholder="Search by customer phone number..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setLookupApplied(false);
                    }}
                    className="w-full rounded-xl border border-border bg-surface-alt py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    dir="ltr"
                  />
                </div>
                {lookupPhone && (
                  <div className="mt-3 rounded-xl border border-border bg-surface-alt p-4 text-sm">
                    {lookupLoading ? (
                      <p className="text-muted">Searching customer...</p>
                    ) : customerLookup?.found ? (
                      <>
                        <p className="font-semibold text-navy">{customerLookup.customer_name}</p>
                        <p className="mt-1 text-muted" dir="ltr">
                          {customerLookup.phone}
                        </p>
                        {customerLookup.customer_email && (
                          <p className="mt-1 text-muted">{customerLookup.customer_email}</p>
                        )}
                        {customerLookup.pickup_address && (
                          <p className="mt-2 text-muted">{customerLookup.pickup_address}</p>
                        )}
                        <p className="mt-2 text-xs text-muted">
                          {customerLookup.previous_orders} previous order
                          {customerLookup.previous_orders === 1 ? "" : "s"} — a new order will be
                          created.
                        </p>
                        {!lookupApplied && (
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3"
                            onClick={applyCustomerLookup}
                          >
                            Use customer details
                          </Button>
                        )}
                        {lookupApplied && (
                          <p className="mt-2 text-xs font-semibold text-green-700">
                            Customer details applied to this new order.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted">
                        Customer not found — a new customer will be created together with this
                        order. Enter the details below.
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full Name *"
                    value={draft.customerName}
                    onChange={(e) => patch({ customerName: e.target.value })}
                  />
                  <CustomerPhoneInput
                    label="Phone Number *"
                    value={draft.phone}
                    onChange={(e) => {
                      patch({ phone: e.target.value });
                      setLookupApplied(false);
                    }}
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
                  Search by phone to view customer profile. Each submission creates a brand-new
                  order and session — never linked to previous orders.
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
                      placeholder="Street, building, city — or pick on map below"
                      value={draft.pickupAddress}
                      onChange={(e) =>
                        patch({
                          pickupAddress: e.target.value,
                          latitude: null,
                          longitude: null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-navy">Pickup location on map *</p>
                    <p className="mb-3 text-xs text-muted">
                      Paste the location the customer sent on WhatsApp, or click the map / drag the
                      pin to set the exact pickup point (Oman only).
                    </p>
                    <OmanMapPicker
                      linkPaste
                      height={isDriver ? "300px" : "360px"}
                      value={
                        draft.latitude != null && draft.longitude != null
                          ? {
                              lat: draft.latitude,
                              lng: draft.longitude,
                              address: draft.pickupAddress || undefined,
                            }
                          : null
                      }
                      onChange={(loc) =>
                        patch({
                          latitude: loc.lat,
                          longitude: loc.lng,
                          pickupAddress: loc.address ?? draft.pickupAddress,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-8 flex justify-between border-t border-border pt-6">
              {step > firstStep ? (
                <Button type="button" variant="outline" onClick={goPrev}>
                  Previous
                </Button>
              ) : (
                <span />
              )}
              {step < WIZARD_STEP_COUNT ? (
                <Button type="button" variant="navy" onClick={goNext}>
                  Next Step <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  loading={createOrder.isPending}
                  disabled={!canSubmitDraft(draft)}
                >
                  <Check className="h-4 w-4" /> Submit Order
                </Button>
              )}
            </div>
          </div>
        </div>

        {!isDriver && (
          <div className="lg:col-span-1">
            <OrderSummaryPanel
              draft={draft}
              partners={partners}
              canSubmit={canSubmitDraft(draft)}
              submitting={createOrder.isPending}
              onSubmit={handleSubmit}
              onDiscard={handleDiscard}
            />
          </div>
        )}
      </div>
    </div>
  );
}
