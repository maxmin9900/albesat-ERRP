"use client";

import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useIsAuthenticated } from "@/lib/hooks/use-is-authenticated";
import { useSelectedRole } from "@/lib/hooks/use-selected-role";

export default function RepairLayout({ children }: { children: React.ReactNode }) {
  const redirect = useAuthRedirect();
  const { ready, authenticated } = useIsAuthenticated();
  const selectedRole = useSelectedRole();

  if (!ready || !authenticated || !selectedRole) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading...</div>;
  }

  if (selectedRole.slug !== "repair_team" && selectedRole.slug !== "super_admin" && selectedRole.slug !== "admin") {
    redirect("/admin");
    return null;
  }

  return <>{children}</>;
}
