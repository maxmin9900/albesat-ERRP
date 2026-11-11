"use client";

import { TrackingHistoryItem } from "@/lib/api/hooks";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ScanLine, Truck, Wrench, GitBranch } from "lucide-react";

const ICONS: Record<string, typeof ScanLine> = {
  scan: ScanLine,
  status: GitBranch,
  delivery: Truck,
  operation: Wrench,
};

const COLORS: Record<string, string> = {
  scan: "bg-primary/10 text-primary",
  status: "bg-indigo-100 text-indigo-800",
  delivery: "bg-teal-100 text-teal-800",
  operation: "bg-amber-100 text-amber-800",
};

interface CarpetTrackingTimelineProps {
  items: TrackingHistoryItem[];
}

export function CarpetTrackingTimeline({ items }: CarpetTrackingTimelineProps) {
  if (!items.length) {
    return <p className="py-4 text-center text-sm text-muted">No tracking history yet.</p>;
  }

  return (
    <ol className="relative space-y-0 border-l border-border pl-6">
      {items.map((item, i) => {
        const Icon = ICONS[item.event_type] ?? ScanLine;
        return (
          <li key={`${item.event_type}-${item.created_at}-${i}`} className="relative pb-6">
            <span
              className={cn(
                "absolute -left-[1.85rem] flex h-7 w-7 items-center justify-center rounded-full",
                COLORS[item.event_type] ?? "bg-slate-100 text-slate-600",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold text-navy">{item.title}</p>
            {item.description && (
              <p className="mt-0.5 text-xs text-muted">{item.description}</p>
            )}
            <p className="mt-1 text-xs text-muted">
              {item.actor_name && <span>{item.actor_name} · </span>}
              {formatDate(item.created_at)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
