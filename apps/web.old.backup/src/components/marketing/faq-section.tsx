"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    q: "How long does carpet cleaning take?",
    a: "Most carpets are ready within 3–5 business days. Antique and silk pieces may require up to 7 days for proper care.",
  },
  {
    q: "Do you offer same-day pickup?",
    a: "Yes, same-day pickup is available in most Manhattan and Brooklyn neighborhoods when you book before 2 PM.",
  },
  {
    q: "What types of carpets do you accept?",
    a: "We clean machine-made, handwoven wool, silk, and antique Persian carpets using specialized processes for each type.",
  },
  {
    q: "Is my carpet insured during cleaning?",
    a: "Every carpet is fully insured from pickup through delivery. Our liability coverage protects your investment.",
  },
  {
    q: "How do I track my order?",
    a: "Use your tracking code on our Track page or enable SMS notifications for real-time status updates.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeader overline="FAQ" title="Common Questions" />
        <ul className="mt-10 space-y-4">
          {FAQS.map((faq, i) => (
            <li key={faq.q}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-white p-6 text-left shadow-sm"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="font-semibold text-navy">{faq.q}</span>
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt",
                    open === i && "bg-primary/10",
                  )}
                >
                  <ChevronDown
                    className={cn("h-5 w-5 text-muted transition-transform", open === i && "rotate-180 text-primary")}
                  />
                </span>
              </button>
              {open === i && (
                <p className="mt-2 rounded-2xl bg-surface-alt px-6 py-4 text-sm text-muted">{faq.a}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
