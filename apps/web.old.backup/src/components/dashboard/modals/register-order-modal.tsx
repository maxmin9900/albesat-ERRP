"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Order, useCreateOrder, useUpdateOrder } from "@/lib/api/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  customer_name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone required"),
  carpet_description: z.string().optional(),
  source: z.enum(["website", "whatsapp", "phone", "partner"]),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface RegisterOrderModalProps {
  open: boolean;
  onClose: () => void;
  order?: Order | null;
  title?: string;
}

export function RegisterOrderModal({ open, onClose, order, title }: RegisterOrderModalProps) {
  const isEdit = !!order;
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { source: "website" },
  });

  useEffect(() => {
    if (!open) return;
    if (order) {
      reset({
        customer_name: order.customer_name,
        phone: order.customer_phone,
        carpet_description: order.carpet_description ?? "",
        source: order.source as FormData["source"],
        notes: order.notes ?? "",
      });
    } else {
      reset({ source: "website", customer_name: "", phone: "", carpet_description: "", notes: "" });
    }
  }, [open, order, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && order) {
        await updateOrder.mutateAsync({
          id: order.id,
          body: {
            customer_name: data.customer_name,
            customer_phone: data.phone,
            carpet_description: data.carpet_description || null,
            notes: data.notes || null,
          },
        });
      } else {
        await createOrder.mutateAsync(data);
      }
      reset();
      onClose();
    } catch {
      // error surfaced via mutation state
    }
  };

  const pending = createOrder.isPending || updateOrder.isPending;
  const error = createOrder.error ?? updateOrder.error;

  return (
    <Modal open={open} onClose={onClose} title={title ?? (isEdit ? "Edit Order" : "Register New Order")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Customer Name *"
          placeholder="e.g. John Smith"
          error={errors.customer_name?.message}
          {...register("customer_name")}
        />
        <Input
          label="Phone Number"
          placeholder="+1 555 ..."
          type="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Input
          label="Carpet Size"
          placeholder="e.g. 3x4 m"
          error={errors.carpet_description?.message}
          {...register("carpet_description")}
        />
        <div>
          <label htmlFor="source" className="mb-2 block text-sm font-semibold text-navy">
            Order Source
          </label>
          <select
            id="source"
            disabled={isEdit}
            className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none disabled:opacity-60"
            {...register("source")}
          >
            <option value="website">Website</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="partner">Partner</option>
          </select>
        </div>
        <div>
          <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-navy">
            Note
          </label>
          <textarea
            id="notes"
            className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm"
            placeholder="Additional notes..."
            rows={3}
            {...register("notes")}
          />
        </div>
        {error && (
          <p className="text-sm text-danger">
            {error instanceof Error ? error.message : isEdit ? "Failed to update order" : "Failed to create order"}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" loading={pending}>
            <Plus className="h-4 w-4" /> {isEdit ? "Save Changes" : "Submit Order"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
