"use client";

import { useWashOperationsOverview } from "@/lib/api/hooks";
import { formatDate } from "@/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";

export default function AdminWashOperationsPage() {
  const { data, isLoading, isError, refetch } = useWashOperationsOverview();

  const stages = data?.stages ?? [];
  const total = stages.reduce((s, x) => s + x.count, 0) || 1;
  const allItems = [
    ...(data?.received ?? []).map((c) => ({ ...c, stageLabel: "Intake" })),
    ...(data?.in_operation ?? []).map((c) => ({ ...c, stageLabel: "Washing" })),
    ...(data?.drying ?? []).map((c) => ({ ...c, stageLabel: "Drying" })),
    ...(data?.ready ?? []).map((c) => ({ ...c, stageLabel: "Packaging" })),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Wash Operations</h1>
          <p className="mt-1 text-muted">Monitor all active wash stages and team capacity.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-surface-alt"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted">Loading operations...</p>
      ) : isError ? (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-red-600">Could not load wash operations.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 text-sm font-medium text-primary"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((s) => (
              <div key={s.key} className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-muted">{s.label}</p>
                <p className="mt-1 text-3xl font-bold text-navy">{s.count}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
              <h2 className="font-bold text-navy">Stage Distribution</h2>
              <div className="mt-6 space-y-4">
                {stages.map((s) => (
                  <div key={s.key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted">{s.label}</span>
                      <span className="font-semibold text-navy">{s.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max((s.count / total) * 100, s.count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Active Carpets in Wash</h2>
            <div className="mt-4 divide-y divide-border">
              {allItems.length === 0 ? (
                <p className="py-8 text-center text-muted">No carpets in wash queue.</p>
              ) : (
                allItems.slice(0, 20).map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
                    <div>
                      <p className="font-semibold text-primary">{c.tracking_code || c.carpet_code}</p>
                      <p className="text-sm text-navy">{c.customer_name}</p>
                      <p className="text-xs text-muted">{c.service_label}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {c.stageLabel}
                    </span>
                    {c.received_at && (
                      <span className="text-xs text-muted">{formatDate(c.received_at)}</span>
                    )}
                    <Link href="/admin/tracking" className="text-sm font-medium text-primary hover:underline">
                      Track →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
