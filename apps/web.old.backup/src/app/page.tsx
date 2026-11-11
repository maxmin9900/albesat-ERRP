import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { BenefitsSection } from "@/components/marketing/benefits-section";
import { BookingSection } from "@/components/marketing/booking-section";
import { ContactSection } from "@/components/marketing/contact-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { ServicesSection } from "@/components/marketing/services-section";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <ServicesSection />
        <BenefitsSection />
        <BookingSection />
        <FaqSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}

