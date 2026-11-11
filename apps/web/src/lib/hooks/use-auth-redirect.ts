"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef } from "react";

/**
 * Defer navigation until after mount to avoid
 * "Router action dispatched before initialization" in Next.js App Router.
 */
export function useAuthRedirect() {
  const router = useRouter();
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return useCallback(
    (href: string) => {
      if (!mounted.current) return;
      const run = () => {
        if (!mounted.current) return;
        startTransition(() => {
          try {
            router.replace(href);
          } catch {
            window.location.assign(href);
          }
        });
      };
      requestAnimationFrame(() => requestAnimationFrame(run));
    },
    [router],
  );
}
