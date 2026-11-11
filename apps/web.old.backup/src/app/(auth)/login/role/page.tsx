"use client";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { apiFetch, ensureCsrfCookie, syncCsrfAfterAuth } from "@/lib/api/client";
import { staffRoles } from "@/lib/auth-roles";
import {
  clearLoginPhoneStorage,
  dashboardPathForRole,
  parseLoginTokens,
  readPendingRoles,
  readPendingSessionToken,
  readPendingUser,
} from "@/lib/auth-flow";
import { useAuthReady } from "@/lib/hooks/use-auth-ready";
import { cn } from "@/lib/utils";
import { useAuthStore, type RoleInfo } from "@/lib/stores/auth";
import {
  LayoutGrid,
  Truck,
  UserCog,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const ROLE_UI: Record<
  string,
  { icon: React.ReactNode; bg: string; description: string }
> = {
  super_admin: {
    icon: <LayoutGrid className="h-5 w-5 text-purple-600" />,
    bg: "bg-purple-50",
    description: "Full access to all modules and reports.",
  },
  operation_team: {
    icon: <Wrench className="h-5 w-5 text-primary" />,
    bg: "bg-primary/10",
    description: "Manage orders and wash operations.",
  },
  driver: {
    icon: <Truck className="h-5 w-5 text-orange-500" />,
    bg: "bg-orange-50",
    description: "Handle pickups and deliveries.",
  },
  admin: {
    icon: <UserCog className="h-5 w-5 text-blue-600" />,
    bg: "bg-blue-50",
    description: "User management and system settings.",
  },
};

export default function RoleSelectPage() {
  const router = useRouter();
  const authReady = useAuthReady();
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const selectedRole = useAuthStore((s) => s.selectedRole);
  const availableRoles = useAuthStore((s) => s.availableRoles);
  const user = useAuthStore((s) => s.user);
  const loginDoneRef = useRef(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = useMemo(() => {
    const fromStore = availableRoles.length > 0 ? availableRoles : (user?.roles ?? []);
    const list = fromStore.length > 0 ? fromStore : readPendingRoles();
    return staffRoles(list);
  }, [availableRoles, user?.roles]);

  useEffect(() => {
    if (!authReady) return;
    if (loginDoneRef.current) return;

    if (accessToken && selectedRole) {
      router.replace(dashboardPathForRole(selectedRole.slug));
      return;
    }

    const pending = readPendingSessionToken();
    const token = sessionToken ?? pending;
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!sessionToken && pending) {
      const pendingRoles = readPendingRoles();
      const pendingUser = readPendingUser();
      useAuthStore.setState({
        sessionToken: pending,
        availableRoles: pendingRoles,
        user: pendingUser ? { ...pendingUser, roles: pendingRoles } : undefined,
      });
    }

    setActiveToken(token);
    setReady(true);
  }, [authReady, sessionToken, accessToken, selectedRole, router]);

  const handleContinue = async () => {
    const token = activeToken ?? sessionToken ?? readPendingSessionToken();
    if (!selected || !token) return;
    setLoading(true);
    setError(null);
    try {
      await ensureCsrfCookie();
      const res = await apiFetch<{
        user: NonNullable<typeof user>;
        selected_role: RoleInfo;
        tokens: { access_token: string; refresh_token: string };
      }>("/auth/role/select", {
        method: "POST",
        body: JSON.stringify({ role_slug: selected }),
        sessionToken: token,
      });
      const { accessToken: at, refreshToken: rt } = parseLoginTokens(res);
      const path = dashboardPathForRole(res.selected_role.slug);

      loginDoneRef.current = true;
      useAuthStore.getState().setTokens(at, rt, res.user, res.selected_role);
      await syncCsrfAfterAuth();
      clearLoginPhoneStorage();
      router.replace(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <AuthLayout step={3}>
        <div className="rounded-3xl bg-white p-8 text-center text-muted">Loading…</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout step={3}>
      <AuthCard
        title="Select Your Role"
        description="Choose the role that applies to you to access the right dashboard."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {roles.map((role) => {
            const ui = ROLE_UI[role.slug] ?? ROLE_UI.admin;
            const isSelected = selected === role.slug;
            return (
              <button
                key={role.slug}
                type="button"
                onClick={() => setSelected(role.slug)}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-surface-alt hover:border-primary/40",
                )}
              >
                <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", ui.bg)}>
                  {ui.icon}
                </div>
                <p className="font-bold text-navy">{role.name}</p>
                <p className="mt-1 text-xs text-muted">{ui.description}</p>
              </button>
            );
          })}
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <Button
          className={cn(
            "mt-6 w-full",
            !selected && "!bg-slate-200 !text-slate-400 !shadow-none hover:!bg-slate-200",
          )}
          size="lg"
          disabled={!selected}
          loading={loading}
          onClick={handleContinue}
        >
          Enter Dashboard <ChevronRight className="h-4 w-4" />
        </Button>
      </AuthCard>
    </AuthLayout>
  );
}
