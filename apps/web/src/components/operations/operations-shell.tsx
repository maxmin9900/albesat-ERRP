"use client";

import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useIsAuthenticated } from "@/lib/hooks/use-is-authenticated";
import { useSelectedRole } from "@/lib/hooks/use-selected-role";
import { Droplets } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

const OPS_ROLES = new Set(["operation_team", "admin", "super_admin"]);

export function OperationsShell({ children }: { children: React.ReactNode }) {
  const redirect = useAuthRedirect();
  const { ready, authenticated } = useIsAuthenticated();
  const selectedRole = useSelectedRole();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      redirect("/login");
      return;
    }
    if (!selectedRole) return;
    if (!OPS_ROLES.has(selectedRole.slug)) {
      redirect(selectedRole.slug === "driver" ? "/driver" : "/admin");
    }
  }, [ready, authenticated, selectedRole, redirect]);

  if (!ready || !authenticated || !selectedRole) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  if (!OPS_ROLES.has(selectedRole.slug)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Redirecting...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="sticky top-0 z-30 border-b border-border bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/operations" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Droplets className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="font-bold text-navy">Wash Operations</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Albesat Operations Center
              </p>
            </div>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
