"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DriverOrderCard } from "@/lib/api/driver-hooks";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, Globe, MapPin, Package, X } from "lucide-react";

const SOURCE_BADGE: Record<string, string> = {
  website: "bg-blue-100 text-blue-700",
  whatsapp: "bg-green-100 text-green-700",
  phone: "bg-slate-100 text-slate-600",
  partner: "bg-purple-100 text-purple-700",
};

interface AcceptPickupModalProps {
  order: DriverOrderCard | null;
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  loading?: boolean;
}

export function AcceptPickupModal({
  order,
  open,
  onClose,
  onAccept,
  loading,
}: AcceptPickupModalProps) {
  if (!order) return null;

  return (
    <Modal open={open} onClose={onClose} title="Accept Pickup" hideHeader className="max-w-md overflow-hidden p-0">
      <div className="bg-navy px-6 py-5 text-white">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Accept This Pickup?</h2>
            <p className="text-sm text-white/70">#{order.tracking_code}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3 rounded-xl bg-surface-alt p-4">
          <span className="h-12 w-12 shrink-0 rounded-xl bg-rose-200" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-navy">{order.customer_name}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${SOURCE_BADGE[order.source] ?? "bg-slate-100"}`}
              >
                {order.source === "website" && <Globe className="mr-0.5 inline h-3 w-3" />}
                {order.source}
              </span>
            </div>
            <p className="mt-1 flex items-start gap-1 text-sm text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {order.pickup_address}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Carpets", `${order.carpet_count} carpet${order.carpet_count > 1 ? "s" : ""}`],
            ["Size", order.carpet_dimensions ?? "—"],
            ["Service", order.service_label],
            ["Distance", order.distance_km ? `${order.distance_km} km` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-alt p-3">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 text-sm font-bold text-navy">{value}</p>
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={onAccept} loading={loading}>
          <CheckCircle2 className="h-4 w-4" /> Accept & Assign to Me
        </Button>
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
