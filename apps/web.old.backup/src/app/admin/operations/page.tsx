"use client";

import { useOperationsQueue } from "@/lib/api/operations-hooks";
import { Download } from "lucide-react";
import Link from "next/link";

const STAGE_LABELS: Record<string, string> = {
  received: "Intake",
  in_operation: "Washing",
  drying: "Drying",
  ready: "Packaging",
};

const TEAMS = [
  { name: "Team Alpha", done: 8, capacity: 12 },
  { name: "Team Beta", done: 6, capacity: 10 },
  { name: "Team Gamma", done: 4, capacity: 8 },
];

export default function AdminWashOperationsPage() {
  const { data, isLoading } = useOperationsQueue();

  const stages = data
    ? [
        { key: "received", count: data.received.length, items: data.received },
        { key: "in_operation", count: data.in_operation.length, items: data.in_operation },
        { key: "drying", count: data.drying.length, items: data.drying },
        { key: "ready", count: data.ready.length, items: data.ready },
      ]
    : [];

  const total = stages.reduce((s, x) => s + x.count, 0) || 1;
  const allItems = stages.flatMap((s) =>
    s.items.map((c) => ({ ...c, stage: STAGE_LABELS[s.key] ?? s.key })),
  );

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
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((s) => (
              <div key={s.key} className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm text-muted">{STAGE_LABELS[s.key] ?? s.key}</p>
                <p className="mt-1 text-3xl font-bold text-navy">{s.count}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-bold text-navy">Stage Distribution</h2>
              <div className="mt-6 space-y-4">
                {stages.map((s) => (
                  <div key={s.key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted">{STAGE_LABELS[s.key]}</span>
                      <span className="font-semibold text-navy">{s.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(s.count / total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-bold text-navy">Active Wash Teams</h2>
              <div className="mt-6 space-y-5">
                {TEAMS.map((t) => (
                  <div key={t.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-navy">{t.name}</span>
                      <span className="text-muted">
                        {t.done}/{t.capacity}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${(t.done / t.capacity) * 100}%` }}
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
                allItems.slice(0, 12).map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
                    <div>
                      <p className="font-semibold text-primary">{c.carpet_code}</p>
                      <p className="text-sm text-navy">{c.customer_name}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {c.stage}
                    </span>
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
