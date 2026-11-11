"use client";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useIsAuthenticated } from "@/lib/hooks/use-is-authenticated";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const redirect = useAuthRedirect();
  const { ready, authenticated } = useIsAuthenticated();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) redirect("/login");
  }, [ready, authenticated, redirect]);

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Loading...
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
