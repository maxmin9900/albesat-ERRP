"use client";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PinInput } from "@/components/ui/pin-input";
import { apiFetch, applyCsrfToken, ensureCsrfCookie } from "@/lib/api/client";
import { dashboardPathForRole, parseLoginTokens } from "@/lib/auth-flow";
import {
  isValidLoginPhone,
  loginPhoneSchema,
  normalizeLoginPhone,
  sanitizePhoneInput,
} from "@/lib/phone";
import { useAuthStore, type RoleInfo, type UserInfo } from "@/lib/stores/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const PIN_LENGTH = 6;

const schema = z.object({
  phone: loginPhoneSchema,
  code: z
    .string()
    .length(PIN_LENGTH, `Enter all ${PIN_LENGTH} digits`)
    .regex(/^\d{6}$/, "Access code must be 6 digits"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "", code: "" },
    mode: "onChange",
  });

  const phoneValue = watch("phone");
  const codeValue = watch("code");
  const canSubmit =
    isValidLoginPhone(phoneValue ?? "") &&
    (codeValue?.replace(/\D/g, "").length ?? 0) === PIN_LENGTH;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    const phone = normalizeLoginPhone(data.phone);
    const code = data.code.replace(/\D/g, "").slice(0, PIN_LENGTH);
    try {
      await ensureCsrfCookie();
      const res = await apiFetch<{
        user: UserInfo;
        selected_role: RoleInfo;
        tokens: { access_token: string; refresh_token: string };
        csrf_token?: string | null;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });

      applyCsrfToken(res.csrf_token);

      const { accessToken, refreshToken } = parseLoginTokens(res);
      useAuthStore.getState().setTokens(
        accessToken,
        refreshToken,
        res.user,
        res.selected_role,
      );
      router.replace(dashboardPathForRole(res.selected_role.slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout step={1} totalSteps={1}>
      <AuthCard
        title="Welcome back"
        description="Enter your phone number and 6-digit role access code."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input
                label="Phone Number"
                placeholder="09XX XXX XXXX or 9XXXXXXX"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={16}
                icon={<Phone className="h-5 w-5" />}
                error={errors.phone?.message}
                value={field.value}
                onChange={(e) => field.onChange(sanitizePhoneInput(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <PinInput
                label="Role Access Code"
                value={field.value}
                onChange={field.onChange}
                error={errors.code?.message}
                length={PIN_LENGTH}
                autoFocus={false}
              />
            )}
          />
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
            disabled={!canSubmit || loading}
          >
            Sign In →
          </Button>
          <p className="text-center text-xs text-muted">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="font-medium text-primary hover:underline">
              Terms of Service
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
