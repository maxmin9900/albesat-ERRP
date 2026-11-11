"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, MapPin } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const CHECKLIST = [
  "Free pickup & delivery included",
  "Transparent pricing, no hidden fees",
  "Real-time SMS order tracking",
  "Satisfaction guaranteed or re-wash free",
];

const SERVICES = [
  { id: "standard", label: "Standard Wash", price: "$30-$50", icon: "🧺" },
  { id: "premium", label: "Premium Wash", price: "$60-$80", icon: "✨" },
  { id: "antique", label: "Antique Carpet", price: "From $100", icon: "👑" },
] as const;

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(10),
  pickup_address: z.string().min(5),
  service_type: z.enum(["standard", "premium", "antique"]),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function BookingSection() {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { service_type: "premium" },
  });

  const selectedService = watch("service_type");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ tracking_code: string; message: string }>("/orders/public/booking", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setSuccess(`${res.message} Tracking: ${res.tracking_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="book" className="bg-surface-alt py-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-2 lg:px-8">
        <div>
          <SectionHeader
            overline="BOOK ONLINE"
            title="Schedule a Pickup in Under 2 Minutes"
            description="Fill in the quick form and our team will call you back within 30 minutes to confirm the pickup time."
            align="left"
          />
          <ul className="mt-8 space-y-4">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-navy">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15">
                  <Check className="h-4 w-4 text-success" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <h3 className="text-xl font-bold text-navy">Quick Order Form</h3>
          {success ? (
            <p className="mt-6 rounded-xl bg-success/10 p-4 text-sm text-success">{success}</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
              <Input label="Full Name" placeholder="e.g. Sarah Mitchell" error={errors.full_name?.message} {...register("full_name")} />
              <Input label="Phone Number" placeholder="+1 (555) 000-0000" type="tel" error={errors.phone?.message} {...register("phone")} />
              <div>
                <label className="mb-2 block text-sm font-semibold text-navy">Pickup Address</label>
                <div className="flex gap-2">
                  <textarea
                    className="min-h-[80px] flex-1 rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="123 Main St, New York, NY"
                    {...register("pickup_address")}
                  />
                  <Button type="button" variant="outline" className="shrink-0 self-start">
                    <MapPin className="h-4 w-4" /> Pin
                  </Button>
                </div>
              </div>
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-navy">Service Type</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {SERVICES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setValue("service_type", s.id)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        selectedService === s.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <p className="mt-2 text-xs font-bold text-navy">{s.label}</p>
                      <p className="text-xs text-muted">{s.price}</p>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="mb-2 block text-sm font-semibold text-navy">Notes (optional)</label>
                <textarea
                  className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm"
                  placeholder="Any special instructions about your carpet..."
                  {...register("notes")}
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Submit Booking Request
              </Button>
              <p className="text-center text-xs text-muted">
                We will contact you within 30 minutes to confirm your pickup time.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
