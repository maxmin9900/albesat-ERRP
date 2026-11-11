"use client";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ensureCsrfCookie, syncCsrfAfterAuth } from "@/lib/api/client";
import { staffRoles } from "@/lib/auth-roles";
import {
  clearLoginPhoneStorage,
  dashboardPathForRole,
  parseLoginTokens,
} from "@/lib/auth-flow";
import { normalizePhone } from "@/lib/phone";
import { useAuthStore, type RoleInfo, type UserInfo } from "@/lib/stores/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(4, "Enter the verification code"),
});

type FormData = z.infer<typeof schema>;

interface VerifyResponse {
  user: UserInfo;
  available_roles: RoleInfo[];
  requires_role_selection: boolean;
  session_token: string | null;
}

async function completeRoleLogin(sessionToken: string, roleSlug: string) {
  await ensureCsrfCookie();
  return apiFetch<{
    user: UserInfo;
    selected_role: RoleInfo;
    tokens: { access_token: string; refresh_token: string };
  }>("/auth/role/select", {
    method: "POST",
    body: JSON.stringify({ role_slug: roleSlug }),
    sessionToken,
  });
}

export default function VerifyOtpPage() {
  const router = useRouter();
  const loginDoneRef = useRef(false);
  const setSession = useAuthStore((s) => s.setSession);
  const [phone, setPhone] = useState("");
  const [phoneApi, setPhoneApi] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const p = sessionStorage.getItem("login_phone");
    if (!p) {
      router.replace("/login");
      return;
    }
    setPhone(p);
    setPhoneApi(sessionStorage.getItem("login_phone_normalized") ?? normalizePhone(p));
    setDevOtp(sessionStorage.getItem("dev_otp"));
    setReady(true);
  }, [router]);

  const onSubmit = async (data: FormData) => {
    if (!phoneApi) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<VerifyResponse>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: phoneApi, code: data.code }),
      });

      if (!res.session_token) {
        setError("Could not start session. Please try again.");
        return;
      }

      const roles = staffRoles(res.available_roles);
      if (roles.length === 0) {
        setError("No staff roles assigned to this account.");
        return;
      }

      setSession(res.session_token, res.user, roles, phone);

      if (res.requires_role_selection && roles.length > 1) {
        router.replace("/login/role");
        return;
      }

      const loginRes = await completeRoleLogin(res.session_token, roles[0].slug);
      const { accessToken, refreshToken } = parseLoginTokens(loginRes);
      loginDoneRef.current = true;
      useAuthStore.getState().setTokens(
        accessToken,
        refreshToken,
        loginRes.user,
        loginRes.selected_role,
      );
      await syncCsrfAfterAuth();
      clearLoginPhoneStorage();
      router.replace(dashboardPathForRole(loginRes.selected_role.slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <AuthLayout step={2}>
        <div className="rounded-3xl bg-white p-8 text-center text-muted">Loading…</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout step={2}>
      <AuthCard title="Enter verification code" description={`Code sent via WhatsApp to ${phone || "your phone"}`}>
        {devOtp && (
          <p className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            Dev code: <strong>{devOtp}</strong>
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Input
            label="Verification Code"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            error={errors.code?.message}
            {...register("code")}
          />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Verify →
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
