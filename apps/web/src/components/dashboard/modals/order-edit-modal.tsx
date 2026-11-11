"use client";

import { AddressMapField } from "@/components/maps/address-map-field";
import { SourceBadge } from "@/components/dashboard/source-badge";
import { STATUS_LABELS } from "@/components/dashboard/status-badge";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Order, useOrder, useUpdateOrder } from "@/lib/api/hooks";
import { SERVICE_OPTIONS } from "@/lib/orders/order-wizard";
import { CustomerPhoneInput } from "@/components/ui/customer-phone-input";
import { isValidCustomerPhone, CUSTOMER_PHONE_ERROR, parseCustomerPhone } from "@/lib/phone";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  customer_name: z.string().min(2, "Name is required"),
  customer_phone: z
    .string()
    .trim()
    .min(1, "Valid phone required")
    .refine(isValidCustomerPhone, { message: CUSTOMER_PHONE_ERROR })
    .transform((val) => parseCustomerPhone(val)!),
  customer_email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().email().safeParse(value).success, {
      message: "Invalid email",
    }),
  carpet_description: z.string().optional(),
  pickup_address: z.string().optional(),
  house_number: z.string().optional(),
  service_type: z.enum(["standard", "premium", "antique"]),
  status: z.string().min(1, "Status is required"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface OrderEditModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

export function OrderEditModal({ order, open, onClose }: OrderEditModalProps) {
  const updateOrder = useUpdateOrder();
  const { data: detail, isLoading } = useOrder(open && order ? order.id : null);
  const current = detail ?? order;
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) updateOrder.reset();
  }, [open, updateOrder]);

  useEffect(() => {
    if (!open || !current) return;
    reset({
      customer_name: current.customer_name,
      customer_phone: current.customer_phone,
      customer_email: current.customer_email ?? "",
      carpet_description: current.carpet_description ?? "",
      pickup_address: current.pickup_address ?? "",
      house_number: current.house_number ?? "",
      service_type: current.service_type as FormData["service_type"],
      status: current.status,
      notes: current.notes ?? "",
    });
    if (current.latitude != null && current.longitude != null) {
      setMapLocation({
        lat: Number(current.latitude),
        lng: Number(current.longitude),
        address: current.pickup_address ?? undefined,
      });
    } else {
      setMapLocation(null);
    }
  }, [open, current, reset]);

  const onSubmit = async (data: FormData) => {
    if (!order) return;
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        body: {
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email || null,
          carpet_description: data.carpet_description || null,
          pickup_address: data.pickup_address || null,
          house_number: data.house_number || null,
          service_type: data.service_type,
          status: data.status,
          notes: data.notes || null,
        },
      });
      onClose();
    } catch {
      // surfaced via mutation state
    }
  };

  const pending = updateOrder.isPending;
  const error = updateOrder.error;

  return (
    <Modal open={open} onClose={onClose} title="Edit Order" dialogClassName="max-w-2xl">
      {!current ? (
        <p className="text-sm text-muted">No order selected.</p>
      ) : isLoading && !detail ? (
        <p className="text-sm text-muted">Loading order...</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm">
            <p className="font-semibold text-navy">
              #{current.order_number.replace("ORD-", "")} · {current.tracking_code}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-muted">Source:</span>
              <SourceBadge source={current.source} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Customer Name *"
              placeholder="e.g. John Smith"
              error={errors.customer_name?.message}
              {...register("customer_name")}
            />
            <CustomerPhoneInput
              label="Phone Number *"
              error={errors.customer_phone?.message}
              {...register("customer_phone")}
            />
          </div>

          <Input
            label="Email"
            placeholder="customer@example.com"
            type="email"
            error={errors.customer_email?.message}
            {...register("customer_email")}
          />

          <Input
            label="Carpet Description"
            placeholder="e.g. 3x4 m Persian rug"
            error={errors.carpet_description?.message}
            {...register("carpet_description")}
          />

          <Controller
            name="pickup_address"
            control={control}
            render={({ field }) => (
              <AddressMapField
                id="pickup_address"
                value={field.value ?? ""}
                onChange={field.onChange}
                location={mapLocation}
                onLocationChange={setMapLocation}
                label="Pickup Address"
                placeholder="Street address in Oman..."
                rows={2}
              />
            )}
          />

          <Input
            label="House / Plaque Number"
            placeholder="e.g. 24"
            error={errors.house_number?.message}
            {...register("house_number")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="service_type" className="mb-2 block text-sm font-semibold text-navy">
                Service Type
              </label>
              <select
                id="service_type"
                className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none"
                {...register("service_type")}
              >
                {SERVICE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({option.priceLabel})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="mb-2 block text-sm font-semibold text-navy">
                Status
              </label>
              <select
                id="status"
                className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none"
                {...register("status")}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.status?.message ? (
                <p className="mt-1 text-xs text-danger">{errors.status.message}</p>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-navy">
              Notes
            </label>
            <textarea
              id="notes"
              className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none"
              placeholder="Additional notes..."
              rows={3}
              {...register("notes")}
            />
          </div>

          {error ? (
            <p className="text-sm text-danger">
              {error instanceof Error ? error.message : "Failed to update order"}
            </p>
          ) : null}

          <div className="flex gap-3 border-t border-border pt-4">
            <Button type="submit" className="flex-1" loading={pending}>
              <Save className="h-4 w-4" /> Save Changes
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
