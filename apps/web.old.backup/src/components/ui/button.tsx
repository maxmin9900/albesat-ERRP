import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "navy";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary-hover",
      secondary: "bg-white text-navy border border-border hover:bg-surface-alt",
      outline: "bg-white text-primary border-2 border-primary hover:bg-primary/5",
      ghost: "bg-transparent text-navy hover:bg-surface-alt",
      navy: "bg-navy text-white hover:bg-navy/90",
    };
    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-6 text-sm",
      lg: "h-13 px-8 text-base font-semibold",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

