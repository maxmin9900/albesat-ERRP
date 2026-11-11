"use client";

import { OrderSourcesChart } from "@/components/dashboard/order-sources-chart";
import { OrderVolumeChart } from "@/components/dashboard/order-volume-chart";
import { Button } from "@/components/ui/button";
import { useOrderSources, useOrderVolume } from "@/lib/api/hooks";
import { Download } from "lucide-react";
import { useState } from "react";

const KPIS = [
  { label: "Avg. Processing Time", value: "3.2 days", ok: true },
  { label: "Customer Satisfaction", value: "94.7%", ok: true },
  { label: "On-Time Delivery Rate", value: "87.3%", ok: false },
  { label: "Repeat Customer Rate", value: "62.1%", ok: true },
  { label: "Revenue per Order", value: "₺820K", ok: true },
];

export default function ReportsPage() {
  const [volumeRange, setVolumeRange] = useState("30d");
  const { data: volume, isLoading: volumeLoading } = useOrderVolume(volumeRange);
  const { data: sources, isLoading: sourcesLoading } = useOrderSources();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reports & Analytics</h1>
          <p className="mt-1 text-muted">Deep dive into business performance metrics.</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" /> Export PDF
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <OrderVolumeChart
          data={volume?.data ?? []}
          onRangeChange={setVolumeRange}
          isLoading={volumeLoading}
        />
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold text-navy">Revenue by Month</h3>
          <p className="mt-1 text-sm text-muted">Trend from order volume (proxy)</p>
          <div className="mt-6 flex h-48 items-end justify-between gap-1">
            {(volume?.data ?? []).map((p) => {
              const max = Math.max(...(volume?.data ?? []).map((x) => x.count), 1);
              return (
                <div
                  key={p.day}
                  className="flex-1 rounded-t bg-primary/30"
                  style={{ height: `${(p.count / max) * 100}%`, minHeight: 4 }}
                  title={p.day}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <OrderSourcesChart
          sources={sources?.sources ?? []}
          total={sources?.total ?? 0}
          isLoading={sourcesLoading}
        />
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold text-navy">Key Performance Indicators</h3>
          <ul className="mt-6 space-y-4">
            {KPIS.map((k) => (
              <li key={k.label} className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0">
                <span className="flex items-center gap-2 text-sm text-navy">
                  <span
                    className={`h-2 w-2 rounded-full ${k.ok ? "bg-green-500" : "bg-red-500"}`}
                    aria-hidden
                  />
                  {k.label}
                </span>
                <span className="font-bold text-navy">{k.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
