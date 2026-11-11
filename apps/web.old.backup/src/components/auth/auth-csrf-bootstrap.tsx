"use client";

import { ensureCsrfCookie, getCsrfTokenForBootstrap } from "@/lib/api/client";
import { useAuthReady } from "@/lib/hooks/use-auth-ready";
import { useAuthStore } from "@/lib/stores/auth";
import { useEffect } from "react";

/** Ensures CSRF header matches cookie when user already has a session. */
export function AuthCsrfBootstrap() {
  const authReady = useAuthReady();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!authReady || !accessToken) return;
    if (getCsrfTokenForBootstrap()) return;
    void ensureCsrfCookie().catch(() => undefined);
  }, [authReady, accessToken]);

  return null;
}
