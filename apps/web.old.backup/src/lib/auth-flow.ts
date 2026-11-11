import type { RoleInfo, UserInfo } from "@/lib/stores/auth";

export const PENDING_SESSION_KEY = "fz_pending_session";
export const PENDING_ROLES_KEY = "fz_pending_roles";
export const PENDING_USER_KEY = "fz_pending_user";
export const LOGIN_PHONE_KEY = "login_phone";
export const LOGIN_PHONE_NORMALIZED_KEY = "login_phone_normalized";
export const AUTH_SNAPSHOT_KEY = "fz_auth_snapshot";

export interface AuthSnapshot {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
  selectedRole: RoleInfo;
  displayPhone?: string | null;
}

export function saveAuthSnapshot(snapshot: AuthSnapshot): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function readAuthSnapshot(): AuthSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as AuthSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearAuthSnapshot(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(AUTH_SNAPSHOT_KEY);
}

export function savePendingLogin(
  sessionToken: string,
  roles: RoleInfo[],
  user?: UserInfo,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PENDING_SESSION_KEY, sessionToken);
  sessionStorage.setItem(PENDING_ROLES_KEY, JSON.stringify(roles));
  if (user) {
    sessionStorage.setItem(PENDING_USER_KEY, JSON.stringify(user));
  }
}

export function clearPendingLogin(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PENDING_SESSION_KEY);
  sessionStorage.removeItem(PENDING_ROLES_KEY);
  sessionStorage.removeItem(PENDING_USER_KEY);
}

export function readPendingSessionToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(PENDING_SESSION_KEY);
}

export function readPendingRoles(): RoleInfo[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(PENDING_ROLES_KEY);
    return raw ? (JSON.parse(raw) as RoleInfo[]) : [];
  } catch {
    return [];
  }
}

export function readPendingUser(): UserInfo | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export function dashboardPathForRole(slug: string): string {
  if (slug === "driver") return "/driver";
  if (slug === "operation_team") return "/operations";
  return "/admin";
}

/** Normalize login API token payload (snake_case or camelCase). */
export function parseLoginTokens(data: {
  tokens?: { access_token?: string; refresh_token?: string; accessToken?: string; refreshToken?: string };
}): { accessToken: string; refreshToken: string } {
  const t = data.tokens;
  if (!t) throw new Error("Missing tokens in response");
  const accessToken = t.access_token ?? t.accessToken;
  const refreshToken = t.refresh_token ?? t.refreshToken;
  if (!accessToken || !refreshToken) throw new Error("Invalid token response");
  return { accessToken, refreshToken };
}

export function clearLoginPhoneStorage(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(LOGIN_PHONE_KEY);
  sessionStorage.removeItem(LOGIN_PHONE_NORMALIZED_KEY);
  sessionStorage.removeItem("dev_otp");
}
