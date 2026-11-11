"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface WorkflowStep {
  id: string;
  label: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  currentStep: string;
}

export function WorkflowStepper({ steps, currentStep }: WorkflowStepperProps) {
  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = step.id === currentStep;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                done && "bg-green-100 text-green-700",
                active && !done && "bg-primary text-white",
                !done && !active && "bg-slate-100 text-muted",
              )}
            >
              {done && <Check className="h-3 w-3" />}
              {step.label}
            </span>
            {i < steps.length - 1 && <span className="text-muted">›</span>}
          </div>
        );
      })}
    </div>
  );
}
