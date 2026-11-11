"use client";

import {
  bootstrapAuthFromSnapshot,
  readAuthSnapshot,
} from "@/lib/auth-bootstrap";
import { useAuthStore } from "@/lib/stores/auth";
import { useAuthReady } from "@/lib/hooks/use-auth-ready";
import { useEffect, useState } from "react";

/**
 * Auth guard helper: waits for persist rehydrate, restores session snapshot if needed.
 */
export function useIsAuthenticated(): {
  ready: boolean;
  authenticated: boolean;
  accessToken: string | null;
} {
  const authReady = useAuthReady();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!useAuthStore.getState().accessToken) {
      bootstrapAuthFromSnapshot();
    }
    setBootstrapped(true);
  }, [authReady]);

  const token =
    accessToken ??
    (bootstrapped && authReady ? readAuthSnapshot()?.accessToken ?? null : null);

  return {
    ready: authReady && bootstrapped,
    authenticated: !!token,
    accessToken: token,
  };
}
