"use client";

import { VolumeDataPoint } from "@/lib/api/hooks";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { cn } from "@/lib/utils";

interface OrderVolumeChartProps {
  data: VolumeDataPoint[];
  range: string;
  onRangeChange: (range: string) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const RANGES = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "1y", label: "1 Year" },
];

export function OrderVolumeChart({
  data,
  range,
  onRangeChange,
  isLoading,
  isError,
  onRetry,
}: OrderVolumeChartProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-navy">Order Volume</h3>
        <div className="flex rounded-full bg-surface-alt p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRangeChange(r.id)}
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
      ) : isError ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-red-600">Could not load order volume.</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium text-primary">
              Retry
            </button>
          ) : null}
        </div>
      ) : (
        <SimpleBarChart
          data={data.map((point) => ({
            label: point.day,
            value: point.count,
            highlight: point.is_today,
          }))}
          emptyLabel="No volume data for this range."
        />
      )}
    </div>
  );
}
