"use client";

import { isAuthPersistHydrated, onAuthPersistHydrated, useAuthStore } from "@/lib/stores/auth";
import { useEffect, useState } from "react";

type PersistApi = {
  hasHydrated?: () => boolean;
  onFinishHydration?: (fn: () => void) => () => void;
};

function getPersistApi(): PersistApi | undefined {
  return (useAuthStore as unknown as { persist?: PersistApi }).persist;
}

/** Wait until zustand persist has rehydrated before auth guards run. */
export function useAuthReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isAuthPersistHydrated()) {
      setReady(true);
      return;
    }

    const persist = getPersistApi();
    if (persist?.hasHydrated?.()) {
      setReady(true);
      return;
    }

    const unsubPersist = persist?.onFinishHydration?.(() => setReady(true));
    const unsubAuth = onAuthPersistHydrated(() => setReady(true));

    return () => {
      unsubPersist?.();
      unsubAuth();
    };
  }, []);

  return ready;
}
