import { SectionHeader } from "@/components/ui/section-header";
import { Phone, MessageCircle, Mail } from "lucide-react";

/** Business contact line — the same number the system sends invoices from. */
export const BUSINESS_PHONE = "+968 9966 7661";
const BUSINESS_PHONE_E164 = "+96899667661";

const CONTACTS = [
  {
    icon: Phone,
    iconBg: "bg-blue-50 text-blue-600",
    title: "Call Us",
    detail: BUSINESS_PHONE,
    href: `tel:${BUSINESS_PHONE_E164}`,
    detailClass: "text-primary",
    sub: "Mon–Sun, 8AM–8PM",
  },
  {
    icon: MessageCircle,
    iconBg: "bg-green-50 text-green-600",
    title: "WhatsApp",
    detail: "Message Us",
    href: `https://wa.me/${BUSINESS_PHONE_E164.replace("+", "")}`,
    detailClass: "text-green-600",
    sub: "Fastest response",
  },
  {
    icon: Mail,
    iconBg: "bg-orange-50 text-orange-600",
    title: "Email",
    detail: "amir@albesat.com",
    href: "mailto:amir@albesat.com",
    detailClass: "text-orange-500",
    sub: "Reply within 2 hours",
  },
];

export function ContactSection() {
  return (
    <section id="contact" className="py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeader
          overline="CONTACT US"
          title="Reach Out Anytime"
          description="Available 7 days a week, 8 AM – 8 PM. We typically respond within 15 minutes."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CONTACTS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-2xl bg-white p-8 text-center shadow-lg">
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${c.iconBg}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-bold text-navy">{c.title}</h3>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className={`mt-2 block font-semibold hover:underline ${c.detailClass}`}
                  dir="ltr"
                >
                  {c.detail}
                </a>
                <p className="mt-1 text-sm text-muted">{c.sub}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
