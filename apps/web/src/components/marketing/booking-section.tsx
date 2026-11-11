import { SectionHeader } from "@/components/ui/section-header";
import { Check } from "lucide-react";

const CHECKLIST = [
  "Free pickup & delivery included",
  "Transparent pricing, no hidden fees",
  "Real-time SMS order tracking",
  "Satisfaction guaranteed or re-wash free",
];

export function BookingSection() {
  return (
    <section className="bg-surface-alt py-20">
      <div className="mx-auto max-w-3xl px-4 lg:px-8">
        <SectionHeader
          overline="BOOK ONLINE"
          title="Schedule a Pickup in Under 2 Minutes"
          description="Use the booking form at the top of this page. Our team will call you back within 30 minutes to confirm the pickup time."
          align="center"
        />
        <ul className="mt-10 space-y-4">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-navy">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15">
                <Check className="h-4 w-4 text-success" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
