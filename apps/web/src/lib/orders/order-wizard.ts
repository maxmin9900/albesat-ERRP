export type OrderSourceType = "website" | "whatsapp" | "phone" | "partner";
export type ServiceTypeId = "standard" | "premium" | "antique";

export const WIZARD_STEPS = [
  { id: 1, key: "source", label: "Channel" },
  { id: 2, key: "customer", label: "Customer Info" },
  { id: 3, key: "address", label: "Address & Location" },
] as const;

export const WIZARD_STEP_COUNT = WIZARD_STEPS.length;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export interface OrderWizardDraft {
  source: OrderSourceType;
  partnerId: string;
  partnerReference: string;
  customerName: string;
  phone: string;
  email: string;
  pickupAddress: string;
  latitude: number | null;
  longitude: number | null;
  serviceType: ServiceTypeId;
  notes: string;
  photoNames: string[];
}

export const EMPTY_DRAFT: OrderWizardDraft = {
  source: "whatsapp",
  partnerId: "",
  partnerReference: "",
  customerName: "",
  phone: "",
  email: "",
  pickupAddress: "",
  latitude: null,
  longitude: null,
  serviceType: "standard",
  notes: "",
  photoNames: [],
};

// Edit doc US-NO-01/06: manual orders have exactly two channels — WhatsApp and
// Partner. Website is a Source reserved for orders arriving from the public
// booking form and must not appear here.
export const SOURCE_OPTIONS: {
  id: OrderSourceType;
  label: string;
  description: string;
}[] = [
  { id: "whatsapp", label: "WhatsApp", description: "Order received through WhatsApp" },
  { id: "partner", label: "Partner", description: "Order from a partner laundry" },
];

export const SERVICE_OPTIONS: {
  id: ServiceTypeId;
  label: string;
  description: string;
  priceLabel: string;
}[] = [
  {
    id: "standard",
    label: "Standard Wash",
    description: "Suitable for regular machine-made carpets",
    priceLabel: "10 – 20 OMR",
  },
  {
    id: "premium",
    label: "Premium Wash",
    description: "Nano detergents and heavy stain removers",
    priceLabel: "25 – 35 OMR",
  },
  {
    id: "antique",
    label: "Antique Carpet Wash",
    description: "Hand washing with direct expert supervision",
    priceLabel: "From 40 OMR",
  },
];

export const SERVICE_PRICING: Record<ServiceTypeId, { low: number; high: number }> = {
  standard: { low: 10, high: 20 },
  premium: { low: 25, high: 35 },
  antique: { low: 40, high: 80 },
};

export function sourceLabel(source: OrderSourceType): string {
  return SOURCE_OPTIONS.find((s) => s.id === source)?.label ?? source;
}

export function serviceLabel(service: ServiceTypeId): string {
  return SERVICE_OPTIONS.find((s) => s.id === service)?.label ?? service;
}

export function formatPriceRange(service: ServiceTypeId): string {
  const p = SERVICE_PRICING[service];
  return `${p.low}–${p.high} OMR`;
}

export function previewOrderNumber(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `#QC-${new Date().getFullYear()}-${n}`;
}

export function previewSessionCode(): string {
  const hex = Math.random().toString(16).slice(2, 7).toUpperCase();
  return `SES-${new Date().getFullYear()}-${hex}`;
}

const DRAFT_KEY = "fz_order_wizard_draft";

export function saveWizardDraft(draft: OrderWizardDraft, step: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step, savedAt: Date.now() }));
}

export function loadWizardDraft(): { draft: OrderWizardDraft; step: number } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft: OrderWizardDraft; step: number };
    return parsed;
  } catch {
    return null;
  }
}

export function clearWizardDraft(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

export function defaultServiceForSource(source: OrderSourceType): ServiceTypeId {
  return source === "website" ? "standard" : "standard";
}

export function buildPickupAddress(draft: OrderWizardDraft): string {
  return draft.pickupAddress.trim();
}

export function buildNotes(draft: OrderWizardDraft): string | undefined {
  const lines: string[] = [];
  if (draft.notes.trim()) lines.push(draft.notes.trim());
  if (draft.photoNames.length > 0) {
    lines.push(`Attached photos: ${draft.photoNames.join(", ")}`);
  }
  return lines.length ? lines.join("\n") : undefined;
}
