"use client";

import { AuthLayout } from "@/components/auth/auth-layout";
import { dashboardPathForRole } from "@/lib/auth-flow";
import { useAuthReady } from "@/lib/hooks/use-auth-ready";
import { useAuthStore } from "@/lib/stores/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy success step — auto-forward to dashboard when tokens exist. */
export default function LoginSuccessPage() {
  const router = useRouter();
  const authReady = useAuthReady();
  const { user, selectedRole, accessToken } = useAuthStore();

  useEffect(() => {
    if (!authReady) return;
    if (!accessToken || !user || !selectedRole) {
      router.replace("/login");
      return;
    }
    router.replace(dashboardPathForRole(selectedRole.slug));
  }, [authReady, accessToken, user, selectedRole, router]);

  return (
    <AuthLayout step={4}>
      <div className="rounded-3xl bg-white p-8 text-center text-muted">Redirecting to dashboard…</div>
    </AuthLayout>
  );
}
