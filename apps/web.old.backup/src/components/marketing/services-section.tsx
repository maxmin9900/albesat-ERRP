import { SectionHeader } from "@/components/ui/section-header";
import { ServiceCard } from "@/components/marketing/service-card";

const SERVICES = [
  {
    title: "Standard Wash",
    subtitle: "Machine-made carpets",
    description:
      "Professional deep-cleaning for everyday machine-made carpets. We use pH-balanced detergents and warm-water extraction to restore color and softness.",
    price: "$30 – $50",
    borderColor: "border-t-service-standard",
    icon: "🧺",
  },
  {
    title: "Premium Wash",
    subtitle: "Handwoven & wool rugs",
    description:
      "Advanced nano-detergent formula with industrial stain removal. Ideal for delicate handwoven and wool carpets requiring specialist care.",
    price: "$60 – $80",
    borderColor: "border-t-service-premium",
    icon: "✨",
  },
  {
    title: "Antique Carpet",
    subtitle: "Heirlooms & rare pieces",
    description:
      "Meticulous hand-washing under direct expert supervision. Each piece is assessed individually before any treatment begins, preserving heritage and value.",
    price: "From $100",
    borderColor: "border-t-service-antique",
    icon: "👑",
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="grid-bg py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeader
          overline="OUR SERVICES"
          title="Expert Care for Every Carpet"
          description="From everyday machine-made rugs to irreplaceable antique heirlooms, we have the right process for every piece."
        />
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <ServiceCard key={s.title} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
