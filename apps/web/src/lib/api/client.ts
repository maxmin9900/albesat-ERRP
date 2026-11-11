const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/api/v1";
const CSRF_STORAGE_KEY = "fz_csrf_token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getCsrfTokenForBootstrap(): string | null {
  return getCsrfToken();
}

function getCsrfToken(): string | null {
  if (typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem(CSRF_STORAGE_KEY);
    if (stored) return stored;
  }
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)fz_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function storeCsrfToken(token: string): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token);
  }
}

export function applyCsrfToken(token: string | null | undefined): void {
  if (token) storeCsrfToken(token);
}

function extractCsrfFromSetCookie(res: Response): string | null {
  if (typeof res.headers.getSetCookie !== "function") return null;
  for (const raw of res.headers.getSetCookie()) {
    const match = raw.match(/(?:^|;\s*)fz_csrf=([^;]+)/i) ?? raw.match(/^fz_csrf=([^;]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export function clearCsrfToken(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

/** Call after login/refresh — auth endpoints rotate the CSRF cookie. */
export async function syncCsrfAfterAuth(): Promise<void> {
  try {
    await ensureCsrfCookie();
  } catch {
    /* non-fatal; apiFetch will retry on 403 */
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      await ensureCsrfCookie();
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      const { useAuthStore } = await import("@/lib/stores/auth");
      applyCsrfToken(data.csrf_token ?? extractCsrfFromSetCookie(res));
      // A token refresh must NOT change which role the user is operating as.
      // Keep the role the session already selected (e.g. driver); only fall back
      // to the server's role when the store has none. Otherwise a refresh of a
      // multi-role account could flip a driver to admin mid-task and bounce them
      // out of the driver panel.
      const currentRole = useAuthStore.getState().selectedRole;
      useAuthStore.getState().setTokens(
        data.tokens.access_token,
        data.tokens.refresh_token,
        data.user,
        currentRole ?? data.selected_role,
      );
      return data.tokens.access_token as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & {
    token?: string;
    sessionToken?: string;
    skipAuthRetry?: boolean;
    _csrfRetried?: boolean;
  } = {},
): Promise<T> {
  const { token, sessionToken, skipAuthRetry, _csrfRetried, ...init } = options;
  const method = init.method ?? "GET";

  if (method !== "GET" && method !== "HEAD" && !getCsrfToken()) {
    await ensureCsrfCookie();
  }

  const buildHeaders = (accessToken?: string) => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };
    const hasBody = init.body != null && init.body !== "";
    if (hasBody && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    const bearer = accessToken ?? token;
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    if (sessionToken) headers["X-Session-Token"] = sessionToken;
    const csrf = getCsrfToken();
    if (csrf && method !== "GET" && method !== "HEAD") {
      headers["X-CSRF-Token"] = csrf;
    }
    return headers;
  };

  const doFetch = async (accessToken?: string) => {
    try {
      return await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: buildHeaders(accessToken),
        credentials: "include",
      });
    } catch (err) {
      const apiDownHint =
        "Cannot reach the API. Start the backend: docker compose -f docker-compose.yml -f docker-compose.dockerdb.yml up -d";
      const hint =
        err instanceof TypeError && err.message === "Failed to fetch" ? `. ${apiDownHint}` : "";
      throw new ApiError(
        err instanceof Error ? `${err.message}${hint}` : apiDownHint,
        0,
        "network_error",
      );
    }
  };

  let res = await doFetch(token);
  if (res.status === 401 && token && !skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(newToken);
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }

  let data = await res.json().catch(() => ({} as Record<string, unknown>));

  if (
    res.status === 403 &&
    data.error === "csrf_validation_failed" &&
    !_csrfRetried &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    await ensureCsrfCookie();
    return apiFetch<T>(path, { ...options, _csrfRetried: true });
  }

  if (!res.ok) {
    const apiDownHint =
      "Cannot reach the API. Start the backend: docker compose -f docker-compose.hostdb.yml up -d";
    const detail = data.detail;
    let detailText: string | undefined;
    if (typeof detail === "string") {
      detailText = detail;
    } else if (Array.isArray(detail)) {
      detailText = (detail as { msg?: string }[]).map((d) => d.msg).filter(Boolean).join(", ");
    } else if (detail && typeof detail === "object" && "message" in detail) {
      detailText = String((detail as { message: string }).message);
    }
    const message =
      (data.message as string) ??
      detailText ??
      (typeof data.error === "string" && data.error !== "network_error" ? String(data.error) : undefined) ??
      (res.status === 502 ? apiDownHint : `Request failed (HTTP ${res.status})`);
    throw new ApiError(message, res.status, data.error as string | undefined);
  }
  if (data && typeof data === "object" && "csrf_token" in data && data.csrf_token) {
    applyCsrfToken(data.csrf_token as string);
  }
  return data as T;
}

/** Fetch CSRF token (cookie may not be readable cross-origin; store from JSON). */
export async function ensureCsrfCookie(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" });
  if (!res.ok) throw new ApiError("Failed to load CSRF token", res.status);
  const data = (await res.json()) as { csrf_token: string };
  const fromCookie = extractCsrfFromSetCookie(res);
  const token = fromCookie ?? data.csrf_token;
  storeCsrfToken(token);
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)fz_csrf=([^;]*)/);
    if (match) {
      const cookieToken = decodeURIComponent(match[1]);
      storeCsrfToken(cookieToken);
      return cookieToken;
    }
  }
  return token;
}
