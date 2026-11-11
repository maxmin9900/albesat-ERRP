"use client";

import { useDriverDashboard } from "@/lib/api/driver-hooks";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useIsAuthenticated } from "@/lib/hooks/use-is-authenticated";
import { useSelectedRole } from "@/lib/hooks/use-selected-role";
import { cn } from "@/lib/utils";
import { ClipboardList, MapPin, Plus, QrCode, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const NAV = [
  { href: "/driver", label: "Orders", icon: ClipboardList },
  { href: "/driver/map", label: "Map", icon: MapPin },
  { href: "/driver/scan", label: "Scan QR", icon: QrCode },
];

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const redirect = useAuthRedirect();
  const { ready, authenticated, accessToken } = useIsAuthenticated();
  const selectedRole = useSelectedRole();
  const { data: dash } = useDriverDashboard();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      redirect("/login");
      return;
    }
    if (!selectedRole) return;
    if (selectedRole.slug !== "driver") redirect("/admin");
  }, [ready, authenticated, selectedRole, redirect]);

  if (!ready || !authenticated || !accessToken || !selectedRole) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  if (selectedRole.slug !== "driver") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Redirecting...
      </div>
    );
  }

  const hideNav =
    pathname.includes("/pickup/") ||
    pathname.includes("/handoff/") ||
    pathname.includes("/delivery/");

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-surface-alt pb-24">
      {!hideNav && (
        <header className="sticky top-0 z-30 border-b border-border bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Truck className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="font-bold text-navy">Driver Panel</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Albesat Logistics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pathname !== "/driver/orders/new" && (
                <Link
                  href="/driver/orders/new"
                  className="flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add Order
                </Link>
              )}
              {dash && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  ✓ {dash.done_today} done
                </span>
              )}
            </div>
          </div>
        </header>
      )}
      <main>{children}</main>
      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-border bg-white px-2 py-2">
          <div className="flex justify-around">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl",
                      active && "bg-primary/10",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
