"use client";

import { readAuthSnapshot } from "@/lib/auth-bootstrap";
import { useAuthStore, type RoleInfo } from "@/lib/stores/auth";
import { useAuthReady } from "@/lib/hooks/use-auth-ready";

/** Role from zustand or session snapshot while persist rehydrates. */
export function useSelectedRole(): RoleInfo | null {
  const authReady = useAuthReady();
  const fromStore = useAuthStore((s) => s.selectedRole);
  if (fromStore) return fromStore;
  if (!authReady) return null;
  return readAuthSnapshot()?.selectedRole ?? null;
}
