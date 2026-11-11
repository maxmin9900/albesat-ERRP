"use client";

import { WIZARD_STEPS } from "@/lib/orders/order-wizard";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface OrderWizardStepperProps {
  currentStep: number;
}

export function OrderWizardStepper({ currentStep }: OrderWizardStepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
      {WIZARD_STEPS.map((step, i) => {
        const done = step.id < currentStep;
        const active = step.id === currentStep;
        return (
          <li key={step.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  done && "bg-green-500 text-white",
                  active && !done && "bg-primary text-white",
                  !done && !active && "border-2 border-border bg-white text-muted",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : step.id}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  active ? "text-primary" : done ? "text-green-700" : "text-muted",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <span className="mx-2 hidden h-px w-6 bg-border sm:block lg:w-10" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
