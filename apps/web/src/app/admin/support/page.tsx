"use client";

import { BookOpen, ChevronDown, Mail, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const QUICK_LINKS = [
  { icon: BookOpen, title: "Documentation", desc: "Guides and API reference" },
  { icon: Mail, title: "Contact Support", desc: "support@firouzeh.ir" },
  { icon: Video, title: "Video Tutorials", desc: "Step-by-step walkthroughs" },
];

const FAQ = [
  {
    q: "How do I register a new carpet order?",
    a: 'Use the "New Order" button on the Dashboard or Orders page. Fill in customer details and carpet size.',
  },
  {
    q: "How does the QR tracking system work?",
    a: "Each carpet gets a signed QR code. Scan at intake, wash, and delivery to update status automatically.",
  },
  {
    q: "Can I export order history to Excel?",
    a: "Yes. Go to Reports and use Export PDF, or open Orders and export from the table actions.",
  },
  {
    q: "How do I assign a delivery driver?",
    a: "Open Logistics & Delivery, select pending deliveries, and confirm assignment to an available driver.",
  },
];

export default function SupportPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-navy">Support Center</h1>
        <p className="mt-1 text-muted">Get help and find answers to your questions.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 font-bold text-navy">{title}</p>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-navy">Frequently Asked Questions</h2>
        <div className="mt-4 divide-y divide-border">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-4 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-navy">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && <p className="pb-4 text-sm text-muted">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <p className="mt-6 text-center text-sm text-muted">
        Need more help?{" "}
        <Link href="mailto:support@firouzeh.ir" className="font-medium text-primary hover:underline">
          Email our team
        </Link>
      </p>
    </div>
  );
}
