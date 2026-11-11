"use client";

import { Button } from "@/components/ui/button";
import { DriverOrderCard as Order } from "@/lib/api/driver-hooks";
import { cn } from "@/lib/utils";
import { Clock, MapPin, Navigation, Phone, Truck } from "lucide-react";
import Link from "next/link";

const AVATAR_COLORS = ["bg-rose-300", "bg-blue-300", "bg-amber-300", "bg-teal-300", "bg-purple-300"];

const SOURCE_STYLES: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-700",
  website: "bg-blue-100 text-blue-700",
  phone: "bg-slate-100 text-slate-600",
};

function useElapsed(startedAt: string | null) {
  if (!startedAt) return "0:00";
  const sec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface DriverOrderCardProps {
  order: Order;
  variant: "pending" | "in_progress" | "collected" | "delivery";
  index?: number;
  onAction?: () => void;
  actionLabel?: string;
  actionHref?: string;
  actionLoading?: boolean;
}

export function DriverOrderCardUI({
  order,
  variant,
  index = 0,
  onAction,
  actionLabel,
  actionHref,
  actionLoading,
}: DriverOrderCardProps) {
  const elapsed = useElapsed(order.pickup_started_at);

  return (
    <article
      className={cn(
        "rounded-2xl bg-white p-4 shadow-sm",
        variant === "in_progress" && "border-2 border-amber-300",
      )}
    >
      {variant === "in_progress" && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <span>• Pickup In Progress</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {elapsed}
          </span>
        </div>
      )}
      <div className="flex gap-3">
        <span className={cn("h-12 w-12 shrink-0 rounded-xl", AVATAR_COLORS[index % AVATAR_COLORS.length])} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-primary">#{order.tracking_code}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                SOURCE_STYLES[order.source] ?? "bg-slate-100",
              )}
            >
              {order.source}
            </span>
            {variant === "pending" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  order.assigned_to_me
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {order.assigned_to_me ? "Your pickup" : "Unassigned — claim"}
              </span>
            )}
            {variant === "collected" && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                • Collected
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-navy">{order.customer_name}</p>
          <p className="text-sm text-muted">{order.carpet_description}</p>
        </div>
      </div>
      {order.pickup_address && (
        <div
          className={cn(
            "mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
            variant === "in_progress" ? "bg-amber-50 text-amber-900" : "bg-surface-alt text-muted",
          )}
        >
          <MapPin className={cn("mt-0.5 h-4 w-4 shrink-0", variant === "in_progress" ? "text-amber-600" : "text-primary")} />
          {order.pickup_address}
        </div>
      )}
      {order.customer_phone && variant !== "delivery" && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Phone className="h-4 w-4 text-primary" /> {order.customer_phone}
        </p>
      )}
      {variant === "delivery" && (
        <div className="mt-3 space-y-2">
          <div className="text-sm">
            <p className="text-xs text-muted">Carpets loaded</p>
            <p className="font-bold text-navy">
              {order.carpet_count} carpet{order.carpet_count > 1 ? "s" : ""}
            </p>
          </div>
          <span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800">
            {order.status_label}
          </span>
        </div>
      )}
      {actionHref ? (
        <Link href={actionHref} className="mt-4 block">
          <Button className="w-full" variant={variant === "collected" ? "navy" : "primary"}>
            {variant === "collected" ? null : <Truck className="h-4 w-4" />}
            {variant === "in_progress" && <Navigation className="h-4 w-4" />}
            {actionLabel}
          </Button>
        </Link>
      ) : (
        onAction && (
          <Button className="mt-4 w-full bg-navy" onClick={onAction} loading={actionLoading} disabled={actionLoading}>
            {actionLabel}
          </Button>
        )
      )}
    </article>
  );
}
