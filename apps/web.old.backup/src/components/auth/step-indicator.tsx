import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  total?: number;
  className?: string;
}

export function StepIndicator({ current, total = 4, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isPast = step < current;
        if (isActive) {
          return <span key={step} className="h-2 w-8 rounded-full bg-primary" aria-current="step" />;
        }
        return (
          <span
            key={step}
            className={cn("h-2 w-2 rounded-full", isPast ? "bg-primary/60" : "bg-primary/20")}
          />
        );
      })}
    </div>
  );
}

