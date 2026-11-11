"use client";

import { useAuthStore } from "@/lib/stores/auth";
import { useCallback } from "react";

export function usePermissions() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);

  const has = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );

  return { permissions, has };
}
