import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-navy">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-navy",
              "placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              icon && "pl-12",
              error && "border-danger focus:ring-danger/20",
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

