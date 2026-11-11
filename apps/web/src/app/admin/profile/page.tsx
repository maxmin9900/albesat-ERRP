"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/auth-roles";
import { useSelectedRole } from "@/lib/hooks/use-selected-role";
import { useAuthStore, UserInfo } from "@/lib/stores/auth";
import { apiFetch } from "@/lib/api/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().email().safeParse(value).success, {
      message: "Invalid email",
    }),
});

type FormData = z.infer<typeof schema>;

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const selectedRole = useSelectedRole();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!user) return;
    reset({
      full_name: user.full_name,
      email: user.email ?? "",
    });
  }, [user, reset]);

  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        token: accessToken ?? undefined,
        skipAuthRetry: true,
      });
    } catch {
      /* ignore */
    }
    logout();
    router.replace("/login");
  };

  const onSubmit = async (data: FormData) => {
    if (!accessToken) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<UserInfo>("/auth/me", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({
          full_name: data.full_name.trim(),
          email: data.email.trim() || null,
        }),
      });
      updateUser(updated);
      reset({
        full_name: updated.full_name,
        email: updated.email ?? "",
      });
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <p className="text-muted">Loading profile...</p>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-navy">My profile</h1>
      <p className="mt-1 text-muted">Update your account information</p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm"
        noValidate
      >
        <Input
          label="Full name *"
          placeholder="Your name"
          error={errors.full_name?.message}
          {...register("full_name")}
        />

        <div>
          <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-navy">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            value={user.phone}
            readOnly
            dir="ltr"
            className="w-full cursor-not-allowed rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-muted"
          />
          <p className="mt-1 text-xs text-muted">Phone number cannot be changed here.</p>
        </div>

        <Input
          label="Email"
          placeholder="you@example.com"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase text-muted">Current role</label>
          <p className="font-medium text-primary">
            {selectedRole ? (ROLE_LABELS[selectedRole.slug] ?? selectedRole.name) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            This is the role you selected when signing in. To switch roles, sign out and log in again.
          </p>
        </div>

        {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        {saved ? <p className="text-sm text-primary">Profile saved successfully.</p> : null}

        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
          <Button type="button" variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </form>
    </div>
  );
}
