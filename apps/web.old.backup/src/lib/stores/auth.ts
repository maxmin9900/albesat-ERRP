import {
  clearAuthSnapshot,
  clearPendingLogin,
  saveAuthSnapshot,
  savePendingLogin,
} from "@/lib/auth-flow";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RoleInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface UserInfo {
  id: string;
  phone: string;
  full_name: string;
  email: string | null;
  roles: RoleInfo[];
  permissions: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sessionToken: string | null;
  user: UserInfo | null;
  availableRoles: RoleInfo[];
  displayPhone: string | null;
  selectedRole: RoleInfo | null;
  setSession: (sessionToken: string, user: UserInfo, roles: RoleInfo[], displayPhone?: string) => void;
  setTokens: (access: string, refresh: string, user: UserInfo, role: RoleInfo) => void;
  logout: () => void;
}

let authPersistHydrated = false;
const authHydrateListeners = new Set<() => void>();

function markAuthHydrated(): void {
  if (authPersistHydrated) return;
  authPersistHydrated = true;
  authHydrateListeners.forEach((fn) => fn());
  authHydrateListeners.clear();
}

/** True after zustand persist has finished rehydrating (client only). */
export function isAuthPersistHydrated(): boolean {
  return authPersistHydrated;
}

export function onAuthPersistHydrated(cb: () => void): () => void {
  if (authPersistHydrated) {
    cb();
    return () => undefined;
  }
  authHydrateListeners.add(cb);
  return () => authHydrateListeners.delete(cb);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      sessionToken: null,
      user: null,
      availableRoles: [],
      displayPhone: null,
      selectedRole: null,
      setSession: (sessionToken, user, roles, displayPhone) => {
        savePendingLogin(sessionToken, roles, user);
        set({
          sessionToken,
          user: { ...user, roles },
          availableRoles: roles,
          displayPhone: displayPhone ?? user.phone,
          accessToken: null,
          refreshToken: null,
          selectedRole: null,
        });
      },
      setTokens: (accessToken, refreshToken, user, selectedRole) => {
        clearPendingLogin();
        saveAuthSnapshot({
          accessToken,
          refreshToken,
          user,
          selectedRole,
          displayPhone: get().displayPhone,
        });
        set({
          accessToken,
          refreshToken,
          user,
          selectedRole,
          sessionToken: null,
          availableRoles: [],
        });
        void import("@/lib/api/client").then(({ syncCsrfAfterAuth }) => syncCsrfAfterAuth());
      },
      logout: () => {
        clearPendingLogin();
        clearAuthSnapshot();
        void import("@/lib/api/client").then(({ clearCsrfToken }) => clearCsrfToken());
        set({
          accessToken: null,
          refreshToken: null,
          sessionToken: null,
          user: null,
          availableRoles: [],
          displayPhone: null,
          selectedRole: null,
        });
      },
    }),
    {
      name: "firoozeh-auth",
      // Pending login lives in sessionStorage only — do not persist (rehydrate was wiping it)
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        selectedRole: state.selectedRole,
        displayPhone: state.displayPhone,
      }),
      onRehydrateStorage: () => () => {
        markAuthHydrated();
      },
    },
  ),
);

if (typeof window !== "undefined") {
  queueMicrotask(() => {
    const persist = (useAuthStore as unknown as { persist?: { hasHydrated?: () => boolean } })
      .persist;
    if (!persist || persist.hasHydrated?.()) {
      markAuthHydrated();
    }
  });
}
