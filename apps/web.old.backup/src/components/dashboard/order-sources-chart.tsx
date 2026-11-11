"use client";

import { SourceBreakdownItem } from "@/lib/api/hooks";

interface OrderSourcesChartProps {
  sources?: SourceBreakdownItem[];
  total?: number;
  isLoading?: boolean;
}

export function OrderSourcesChart({
  sources = [],
  total = 0,
  isLoading,
}: OrderSourcesChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-center text-sm text-muted">Loading...</p>
      </div>
    );
  }

  const items = sources ?? [];
  const displayTotal = total || items.reduce((s, x) => s + x.count, 0);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="font-bold text-navy">Order Sources</h3>
        <p className="mt-8 text-center text-sm text-muted">No order data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="font-bold text-navy">Order Sources</h3>
      <div className="mt-6 flex flex-col items-center">
        <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-[12px] border-primary/20">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${items.map((s, i) => {
                const start = items.slice(0, i).reduce((a, x) => a + x.percentage, 0);
                return `${s.color} ${start}% ${start + s.percentage}%`;
              }).join(", ")})`,
              mask: "radial-gradient(farthest-side, transparent 58%, black 60%)",
              WebkitMask: "radial-gradient(farthest-side, transparent 58%, black 60%)",
            }}
          />
          <div className="relative text-center">
            <p className="text-2xl font-bold text-navy">{displayTotal}</p>
            <p className="text-xs text-muted">TOTAL</p>
          </div>
        </div>
        <ul className="mt-6 w-full space-y-3">
          {items.map((s) => (
            <li key={s.source} className="flex items-center gap-3 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-navy">{s.label}</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-alt">
                <div className="h-full rounded-full" style={{ width: `${s.percentage}%`, backgroundColor: s.color }} />
              </div>
              <span className="w-10 text-right font-medium text-muted">{s.percentage}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
