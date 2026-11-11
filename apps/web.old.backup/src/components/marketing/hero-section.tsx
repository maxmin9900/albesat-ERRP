import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Star, Leaf } from "lucide-react";

export function HeroSection() {
  return (
    <section className="grid-bg relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
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
            <Link href="#book">
              <Button size="lg">Book Now Online →</Button>
            </Link>
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
        <div className="relative">
          <div className="relative aspect-square overflow-hidden rounded-3xl shadow-2xl">
            <Image
              src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80"
              alt="Clean modern living room"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="absolute -right-2 top-4 rounded-2xl bg-navy p-4 text-white shadow-xl sm:right-4">
            <p className="text-3xl font-bold">4.9</p>
            <div className="my-1 flex gap-0.5 text-yellow-400" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="text-xs text-slate-300">1,200 reviews</p>
          </div>
          <div className="absolute -left-2 bottom-8 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xl sm:left-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Leaf className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-navy">Eco-Certified</p>
              <p className="text-sm text-muted">Safe for kids & pets</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
