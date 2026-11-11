import { cn } from "@/lib/utils";
import { Navigation } from "lucide-react";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  href?: string;
  variant?: "default" | "footer";
}

export function Logo({ size = "md", showSubtitle = false, href = "/", variant = "default" }: LogoProps) {
  const sizes = {
    sm: { icon: "h-8 w-8", title: "text-sm", sub: "text-[10px]" },
    md: { icon: "h-10 w-10", title: "text-lg", sub: "text-xs" },
    lg: { icon: "h-12 w-12", title: "text-xl", sub: "text-xs" },
  };
  const s = sizes[size];
  const isFooter = variant === "footer";

  const content = (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-primary text-white",
          s.icon,
        )}
        aria-hidden
      >
        <Navigation className="h-1/2 w-1/2" fill="currentColor" />
      </div>
      <div className="text-left">
        <p className={cn("font-bold leading-tight", s.title, isFooter ? "text-white" : "text-navy")}>
          {isFooter ? "Albesat Carpet Cleaners" : "Albesat Carpet Pro"}
        </p>
        {showSubtitle && (
          <p className={cn("font-semibold uppercase tracking-widest text-primary", s.sub)}>
            Persian Carpet Pro
          </p>
        )}
        {!showSubtitle && size === "md" && (
          <p className={cn("font-semibold uppercase tracking-widest text-primary", s.sub)}>
            Carpet Cleaners
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
        {content}
      </Link>
    );
  }
  return content;
}

