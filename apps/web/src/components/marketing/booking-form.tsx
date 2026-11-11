"use client";

import { AddressMapField } from "@/components/maps/address-map-field";
import type { MapLocation } from "@/components/maps/oman-map-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerPhoneInput } from "@/components/ui/customer-phone-input";
import { apiFetch } from "@/lib/api/client";
import { customerPhoneSchema } from "@/lib/phone";
import { isInsideOman, OMAN_LOCATION_ERROR } from "@/lib/oman-geo";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const SERVICES = [
  { id: "standard", label: "Standard Wash", icon: "🧺" },
  { id: "premium", label: "Premium Wash", icon: "✨" },
  { id: "antique", label: "Antique Carpet", icon: "👑" },
] as const;

// After a successful booking the visitor is taken to the main Albesat site's
// services page. Override per environment via NEXT_PUBLIC_MAIN_SITE_SERVICES_URL
// (e.g. http://49.13.160.62:8004/services until the domain switch is done).
const MAIN_SITE_SERVICES_URL =
  process.env.NEXT_PUBLIC_MAIN_SITE_SERVICES_URL ??
  "https://albesat.com/services";

const schema = z
  .object({
    full_name: z.string().min(2),
    phone: customerPhoneSchema,
    pickup_address: z.string().min(5),
    house_number: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    service_type: z.enum(["standard", "premium", "antique"]),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.latitude == null || data.longitude == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select pickup location on the Oman map (Pin button)",
        path: ["pickup_address"],
      });
      return;
    }
    if (!isInsideOman(data.latitude, data.longitude)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: OMAN_LOCATION_ERROR,
        path: ["pickup_address"],
      });
    }
  });

type FormData = z.infer<typeof schema>;

export function BookingForm() {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapLocation, setMapLocation] = useState<MapLocation | null>(null);

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
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
        body: JSON.stringify({
          full_name: data.full_name,
          phone: data.phone,
          pickup_address: data.pickup_address,
          house_number: data.house_number || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          service_type: data.service_type,
          notes: data.notes,
        }),
      });
      setSuccess(
        `${res.message} Tracking: ${res.tracking_code} — Redirecting you to our services…`
      );
      // give the customer a moment to note the tracking code, then continue
      // the journey on the main site's services page
      window.setTimeout(() => {
        window.location.href = MAIN_SITE_SERVICES_URL;
      }, 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8">
      <h3 className="text-xl font-bold text-navy">Quick Order Form</h3>
      {success ? (
        <p className="mt-6 rounded-xl bg-success/10 p-4 text-sm text-success">{success}</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Input label="Full Name" placeholder="e.g. Sarah Mitchell" error={errors.full_name?.message} {...register("full_name")} />
          <CustomerPhoneInput label="Phone Number" error={errors.phone?.message} {...register("phone")} />
          <Controller
            name="pickup_address"
            control={control}
            render={({ field }) => (
              <AddressMapField
                value={field.value ?? ""}
                onChange={field.onChange}
                location={mapLocation}
                onLocationChange={(loc) => {
                  setMapLocation(loc);
                  setValue("latitude", loc?.lat);
                  setValue("longitude", loc?.lng);
                }}
                placeholder="Street, building, Muscat, Oman"
                error={errors.pickup_address?.message}
              />
            )}
          />
          <Input
            label="House / Plaque Number"
            placeholder="e.g. 24"
            error={errors.house_number?.message}
            {...register("house_number")}
          />
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
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Final price is set by our driver after measuring your carpet on-site.
            </p>
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
  );
}
