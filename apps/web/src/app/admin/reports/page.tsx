"use client";

import { OrderSourcesChart } from "@/components/dashboard/order-sources-chart";
import { OrderVolumeChart } from "@/components/dashboard/order-volume-chart";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { Button } from "@/components/ui/button";
import { useOrderSources, useOrderVolume } from "@/lib/api/hooks";
import { Download } from "lucide-react";
import { useState } from "react";

export default function ReportsPage() {
  const [volumeRange, setVolumeRange] = useState("7d");
  const {
    data: volume,
    isLoading: volumeLoading,
    isError: volumeError,
    refetch: refetchVolume,
  } = useOrderVolume(volumeRange);
  const {
    data: sources,
    isLoading: sourcesLoading,
    isError: sourcesError,
    refetch: refetchSources,
  } = useOrderSources();

  const volumeData = volume?.data ?? [];

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
          data={volumeData}
          range={volumeRange}
          onRangeChange={setVolumeRange}
          isLoading={volumeLoading}
          isError={volumeError}
          onRetry={() => void refetchVolume()}
        />
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="font-bold text-navy">Revenue by Month</h3>
          <p className="mt-1 text-sm text-muted">Trend from order volume (proxy)</p>
          {volumeLoading ? (
            <p className="mt-12 text-center text-sm text-muted">Loading chart...</p>
          ) : volumeError ? (
            <p className="mt-12 text-center text-sm text-red-600">Could not load revenue trend.</p>
          ) : volumeData.length === 0 ? (
            <p className="mt-12 text-center text-sm text-muted">No revenue data for this range.</p>
          ) : (
            <SimpleBarChart
              data={volumeData.map((p) => ({ label: p.day, value: p.count, highlight: p.is_today }))}
              barClassName="bg-primary/40"
              emptyLabel="No revenue data for this range."
            />
          )}
        </div>
      </div>

      <div className="mt-6">
        <OrderSourcesChart
          sources={sources?.sources ?? []}
          total={sources?.total ?? 0}
          isLoading={sourcesLoading}
          isError={sourcesError}
          onRetry={() => void refetchSources()}
        />
      </div>
    </div>
  );
}
