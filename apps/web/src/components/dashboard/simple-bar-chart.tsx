"use client";

import { cn } from "@/lib/utils";

export const CHART_BAR_AREA_HEIGHT = 192;

export interface BarChartPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

interface SimpleBarChartProps {
  data: BarChartPoint[];
  className?: string;
  barClassName?: string;
  highlightBarClassName?: string;
  emptyLabel?: string;
}

export function barHeight(value: number, max: number, areaHeight = CHART_BAR_AREA_HEIGHT): number {
  const usable = areaHeight - 28;
  if (max <= 0) return value > 0 ? 12 : 4;
  return Math.max(Math.round((value / max) * usable), value > 0 ? 12 : 4);
}

export function SimpleBarChart({
  data,
  className,
  barClassName = "bg-primary",
  highlightBarClassName = "bg-navy",
  emptyLabel = "No data for this range.",
}: SimpleBarChartProps) {
  if (data.length === 0) {
    return <p className="mt-12 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div
      className={cn("mt-8 flex items-end justify-between gap-2", className)}
      style={{ height: CHART_BAR_AREA_HEIGHT }}
    >
      {data.map((point, index) => {
        const height = barHeight(point.value, max);
        return (
          <div
            key={`${point.label}-${index}`}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <div
              className={cn(
                "w-full max-w-[40px] rounded-t-lg transition-all",
                point.highlight ? highlightBarClassName : barClassName,
              )}
              style={{ height }}
              title={`${point.value}`}
            />
            <span className="text-xs text-muted">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}
