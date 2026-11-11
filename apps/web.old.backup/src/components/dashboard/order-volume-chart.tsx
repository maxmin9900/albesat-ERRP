"use client";

import { VolumeDataPoint } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface OrderVolumeChartProps {
  data: VolumeDataPoint[];
  onRangeChange: (range: string) => void;
  isLoading?: boolean;
}

const RANGES = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "1y", label: "1 Year" },
];

export function OrderVolumeChart({ data, onRangeChange, isLoading }: OrderVolumeChartProps) {
  const [range, setRange] = useState("7d");
  const max = Math.max(...data.map((d) => d.count), 1);

  const handleRange = (id: string) => {
    setRange(id);
    onRangeChange(id);
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-navy">Order Volume</h3>
        <div className="flex rounded-full bg-surface-alt p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleRange(r.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                range === r.id ? "bg-primary text-white" : "text-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <p className="mt-12 text-center text-sm text-muted">Loading chart...</p>
      ) : (
        <div className="mt-8 flex h-48 items-end justify-between gap-2">
          {data.map((point) => (
            <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={cn(
                  "w-full max-w-[40px] rounded-t-lg transition-all",
                  point.is_today ? "bg-navy" : "bg-primary",
                )}
                style={{ height: `${Math.max((point.count / max) * 100, 4)}%` }}
                title={`${point.count} orders`}
              />
              <span className="text-xs text-muted">{point.day}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
