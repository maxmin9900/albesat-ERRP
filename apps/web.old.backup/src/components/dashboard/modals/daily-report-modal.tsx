"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useDailyReport } from "@/lib/api/hooks";
import { Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyReportModalProps {
  open: boolean;
  onClose: () => void;
}

export function DailyReportModal({ open, onClose }: DailyReportModalProps) {
  const { data, isLoading } = useDailyReport();

  return (
    <Modal open={open} onClose={onClose} title={`Daily Report — ${data?.date ?? "Today"}`} className="max-w-xl">
      {isLoading ? (
        <p className="text-center text-muted">Loading report...</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            {data.stats.map((stat) => (
              <div key={stat.label} className="rounded-xl bg-surface-alt p-4">
                <p className="text-xs font-semibold uppercase text-muted">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-navy">{stat.value}</p>
                {stat.subtext && (
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      stat.trend === "up" ? "text-success" : stat.trend === "down" ? "text-danger" : "text-muted",
                    )}
                  >
                    {stat.subtext}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-primary/10 p-4">
            <p className="font-semibold text-navy">Highlights</p>
            <ul className="mt-3 space-y-2">
              {data.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-navy">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 flex gap-3">
            <Button className="flex-1">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}

function div({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex gap-3", className)}>{children}</div>;
}
