"use client";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import { Search, Check, Droplets, Package, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TimelineStep {
  status: string;
  label: string;
  timestamp: string | null;
  is_completed: boolean;
  is_current: boolean;
}

interface TrackResult {
  tracking_code: string;
  customer_name: string;
  carpet_description: string | null;
  current_status_label: string;
  estimated_delivery_at: string | null;
  timeline: TimelineStep[];
}

const ICONS: Record<string, React.ReactNode> = {
  pending_pickup: <Package className="h-4 w-4" />,
  in_washing: <Droplets className="h-4 w-4" />,
  delivered: <Check className="h-4 w-4" />,
};

export default function TrackPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TrackResult>(`/orders/track?code=${encodeURIComponent(code.trim())}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order not found");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-navy">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
              <Droplets className="h-5 w-5" />
            </span>
            البساط
          </Link>
          <nav className="hidden gap-6 text-sm md:flex">
            {["Home", "Services", "About Us", "Contact"].map((l) => (
              <Link key={l} href="/" className="text-navy/70 hover:text-primary">
                {l}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <h1 className="text-center text-3xl font-bold text-navy">Track Your Carpet</h1>
          <p className="mt-3 text-center text-muted">
            Enter the tracking code you received to see the cleaning status and estimated delivery time.
          </p>
          <div className="mt-8 flex overflow-hidden rounded-xl border border-border">
            <div className="flex flex-1 items-center gap-2 px-4">
              <Search className="h-5 w-5 text-muted" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Enter tracking code or order ID"
                className="w-full py-3 text-sm outline-none"
                aria-label="Tracking code"
              />
            </div>
            <Button onClick={search} loading={loading} className="rounded-none rounded-r-xl px-8">
              Search
            </Button>
          </div>
          {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
        </div>

        {result && (
          <>
            <div className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <span className="rounded-full bg-navy px-4 py-1 text-sm font-bold text-yellow-400">
                  #{result.tracking_code}
                </span>
                {result.estimated_delivery_at && (
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <Clock className="h-4 w-4" />
                    Estimated Delivery: {formatDate(result.estimated_delivery_at)}
                  </p>
                )}
              </div>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">Customer Name</p>
                  <p className="font-bold text-navy">{result.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">Carpet Type</p>
                  <p className="font-bold text-navy">{result.carpet_description}</p>
                </div>
              </div>
              <p className="mt-6 text-sm text-muted">
                CURRENT STATUS:{" "}
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {result.current_status_label}
                </span>
              </p>
            </div>

            <div className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
              <h2 className="flex items-center gap-3 font-bold text-navy">
                Cleaning Progress
                <span className="h-0.5 w-12 bg-primary" />
              </h2>
              <ol className="mt-8 space-y-0">
                {result.timeline.map((step, i) => (
                  <li key={step.status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full",
                          step.is_current
                            ? "bg-primary text-white"
                            : step.is_completed
                              ? "bg-primary text-white"
                              : "border-2 border-slate-200 text-slate-300",
                        )}
                      >
                        {step.is_completed || step.is_current ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          ICONS[step.status] ?? <Clock className="h-4 w-4" />
                        )}
                      </div>
                      {i < result.timeline.length - 1 && (
                        <div className={cn("w-0.5 flex-1 min-h-[40px]", step.is_completed ? "bg-primary" : "bg-slate-200")} />
                      )}
                    </div>
                    <div className="pb-8">
                      <p className={cn("font-semibold", step.is_current ? "text-primary" : "text-navy")}>
                        {step.label}
                      </p>
                      {step.timestamp && (
                        <p className="text-sm text-muted">{formatDate(step.timestamp)}</p>
                      )}
                      {!step.timestamp && !step.is_completed && (
                        <p className="text-sm text-slate-300">Pending</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-muted">
        © 2024 البساط — All rights reserved.
      </footer>
    </div>
  );
}
