"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { BenefitAccordion } from "@/components/marketing/benefit-accordion";
import { Clock, Shield, Award, Sparkles } from "lucide-react";

const BENEFITS = [
  {
    id: "pickup",
    icon: Clock,
    iconBg: "bg-blue-50 text-blue-600",
    title: "Free Pickup & Delivery",
    short: "We come to you, same-day available",
    detail:
      "Schedule a pickup window as early as today. Our drivers cover all city districts and handle heavy carpets — no effort on your part.",
  },
  {
    id: "eco",
    icon: Shield,
    iconBg: "bg-green-50 text-green-600",
    title: "Eco-Safe Formulas",
    short: "Child & pet friendly detergents",
    detail: "Our plant-based detergents are certified safe for children and pets while delivering professional-grade cleaning results.",
  },
  {
    id: "expertise",
    icon: Award,
    iconBg: "bg-orange-50 text-orange-600",
    title: "15 Years of Expertise",
    short: "Certified by Persian Carpet Guild",
    detail: "Our master cleaners are guild-certified specialists in Persian, silk, and antique carpets with decades of combined experience.",
  },
  {
    id: "guarantee",
    icon: Sparkles,
    iconBg: "bg-purple-50 text-purple-600",
    title: "100% Satisfaction Guarantee",
    short: "Free re-wash if not satisfied",
    detail: "If you are not completely satisfied with our service, we will re-wash your carpet at no additional charge.",
  },
];

export function BenefitsSection() {
  return (
    <section id="benefits" className="py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeader overline="WHY CHOOSE US" title="The Albesat Difference" />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <BenefitAccordion items={BENEFITS} />
        </div>
      </div>
    </section>
  );
}
