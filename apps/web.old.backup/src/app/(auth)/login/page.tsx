"use client";

import { DevLoginHint } from "@/components/auth/dev-login-hint";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { normalizePhone } from "@/lib/phone";
import { zodResolver } from "@hookform/resolvers/zod";
import { Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  phone: z.string().min(10, "Enter a valid phone number"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    const phone = normalizePhone(data.phone);
    try {
      const res = await apiFetch<{ dev_code?: string }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      sessionStorage.setItem("login_phone", data.phone.trim());
      sessionStorage.setItem("login_phone_normalized", phone);
      if (res.dev_code) sessionStorage.setItem("dev_otp", res.dev_code);
      router.push("/login/verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout step={1}>
      <AuthCard
        title="Welcome back"
        description="Enter your phone number to receive a verification code."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Input
            label="Phone Number"
            placeholder="+1 (555) 000-0000"
            type="tel"
            autoComplete="tel"
            icon={<Phone className="h-5 w-5" />}
            error={errors.phone?.message}
            {...register("phone")}
          />
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Get Verification Code →
          </Button>
          <p className="text-center text-xs text-muted">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="font-medium text-primary hover:underline">
              Terms of Service
            </Link>
          </p>
          <DevLoginHint />
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

