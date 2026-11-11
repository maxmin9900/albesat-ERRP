import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  subtext: string;
  icon: LucideIcon;
}

export function StatCard({ title, value, trend, trendUp = true, subtext, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <p className="mt-2 text-3xl font-bold text-navy">{value}</p>
          {trend && (
            <p className={cn("mt-1 text-sm font-medium", trendUp ? "text-success" : "text-danger")}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">{subtext}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}
