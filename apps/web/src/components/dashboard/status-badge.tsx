import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending_pickup: "bg-amber-100 text-amber-800",
  picked_up: "bg-blue-100 text-blue-800",
  in_washing: "bg-primary/15 text-primary",
  drying: "bg-indigo-100 text-indigo-800",
  repairing: "bg-pink-100 text-pink-800",
  ready_for_delivery: "bg-teal-100 text-teal-800",
  out_for_delivery: "bg-cyan-100 text-cyan-800",
  delivered: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-800",
};

export const STATUS_LABELS: Record<string, string> = {
  pending_pickup: "Pending Pickup",
  picked_up: "Picked Up",
  in_washing: "Washing",
  drying: "Drying",
  repairing: "Repairing",
  ready_for_delivery: "Ready for Delivery",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
