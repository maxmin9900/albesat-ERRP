import { BookingForm } from "@/components/marketing/booking-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="grid-bg relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-2 lg:items-start lg:px-8 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
            Same-Day Pickup Available
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-navy sm:text-5xl lg:text-6xl">
            Your Carpets, <span className="text-primary">Restored</span> to Perfection.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Expert Persian carpet cleaning with free pickup and delivery. Trusted by families across New York for 15 years.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="#services">
              <Button variant="secondary" size="lg">
                View Services
              </Button>
            </Link>
          </div>
          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-border pt-8">
            {[
              { value: "40K+", label: "Carpets cleaned" },
              { value: "15", label: "Years of service" },
              { value: "4.9★", label: "Average rating" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-bold text-navy">{stat.value}</dt>
                <dd className="mt-1 text-sm text-muted">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div id="book" className="lg:sticky lg:top-24">
          <BookingForm />
        </div>
      </div>
    </section>
  );
}
