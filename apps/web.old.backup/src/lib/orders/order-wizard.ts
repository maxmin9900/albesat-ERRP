export type OrderSourceType = "website" | "whatsapp" | "phone" | "partner";
export type ServiceTypeId = "standard" | "premium" | "antique";

export const WIZARD_STEPS = [
  { id: 1, key: "source", label: "Order Source" },
  { id: 2, key: "customer", label: "Customer Info" },
  { id: 3, key: "address", label: "Address & Location" },
  { id: 4, key: "service", label: "Service Type" },
  { id: 5, key: "notes", label: "Notes & Photos" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export interface OrderWizardDraft {
  source: OrderSourceType;
  partnerId: string;
  partnerReference: string;
  customerName: string;
  phone: string;
  email: string;
  pickupAddress: string;
  postalCode: string;
  serviceType: ServiceTypeId;
  notes: string;
  photoNames: string[];
}

export const EMPTY_DRAFT: OrderWizardDraft = {
  source: "website",
  partnerId: "",
  partnerReference: "",
  customerName: "",
  phone: "",
  email: "",
  pickupAddress: "",
  postalCode: "",
  serviceType: "standard",
  notes: "",
  photoNames: [],
};

export const SOURCE_OPTIONS: {
  id: OrderSourceType;
  label: string;
  description: string;
}[] = [
  { id: "website", label: "Website", description: "Customer registered via website portal" },
  { id: "whatsapp", label: "WhatsApp", description: "Order received through WhatsApp" },
  { id: "phone", label: "Phone Call", description: "Order taken by phone" },
  { id: "partner", label: "Partner Laundry", description: "Order from partner dry cleaner" },
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
    priceLabel: "$30 – $50",
  },
  {
    id: "premium",
    label: "Premium Wash",
    description: "Nano detergents and heavy stain removers",
    priceLabel: "$60 – $80",
  },
  {
    id: "antique",
    label: "Antique Carpet Wash",
    description: "Hand washing with direct expert supervision",
    priceLabel: "$100+",
  },
];

export const SERVICE_PRICING: Record<ServiceTypeId, { low: number; high: number }> = {
  standard: { low: 30, high: 50 },
  premium: { low: 60, high: 80 },
  antique: { low: 100, high: 200 },
};

export function sourceLabel(source: OrderSourceType): string {
  return SOURCE_OPTIONS.find((s) => s.id === source)?.label ?? source;
}

export function serviceLabel(service: ServiceTypeId): string {
  return SERVICE_OPTIONS.find((s) => s.id === service)?.label ?? service;
}

export function formatPriceRange(service: ServiceTypeId): string {
  const p = SERVICE_PRICING[service];
  return `$${p.low}–$${p.high} USD`;
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
  const parts = [draft.pickupAddress.trim()];
  if (draft.postalCode.trim()) parts.push(`Postal: ${draft.postalCode.trim()}`);
  return parts.filter(Boolean).join("\n");
}

export function buildNotes(draft: OrderWizardDraft): string | undefined {
  const lines: string[] = [];
  if (draft.notes.trim()) lines.push(draft.notes.trim());
  if (draft.photoNames.length > 0) {
    lines.push(`Attached photos: ${draft.photoNames.join(", ")}`);
  }
  return lines.length ? lines.join("\n") : undefined;
}
