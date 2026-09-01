// Single shared API client for every backend call.
// Base URL contract: NEXT_PUBLIC_API_BASE_URL must be reachable by the
// BROWSER (e.g. http://localhost:5000/api/v1 in local dev). Docker-internal
// hostnames like http://backend:5000 are never resolvable from a browser.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "currentUser";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): void {
  if (typeof window === "undefined") return;
  if (tokens.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  }
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
  if (tokens.accessToken || tokens.refreshToken) {
    notifyAuthChange();
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChange();
}

/** Parse the persisted session user, or null when absent/corrupt. */
export function readCurrentUser(): { id?: string; role?: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: string; role?: string };
    return typeof parsed?.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

// Auth change pub/sub so components can react to login/logout/refresh in the
// same tab (the `storage` event only fires across tabs).
type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

export function subscribeToAuth(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function notifyAuthChange(): void {
  for (const listener of authListeners) listener();
}

interface AuthResponsePayload {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
}

/** Persist an auth payload exactly as the backend issues it. */
export function storeAuthPayload(payload: AuthResponsePayload): void {
  setTokens(payload);
  if (payload.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    notifyAuthChange();
  }
}

// Single-flight refresh: concurrent 401s share one refresh call instead of
// racing the rotation endpoint with multiple requests.
let refreshInFlight: Promise<string | null> | null = null;

function requestAccessTokenRefresh(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { accessToken?: string };
      if (!data.accessToken) return null;

      setTokens({ accessToken: data.accessToken });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface ApiRequestOptions extends RequestInit {
  /**
   * Internal marker for the single replay after a refresh; the retried
   * request must never trigger another refresh (loop prevention).
   */
  skipAuthRetry?: boolean;
}

/**
 * Fetch wrapper that attaches JSON headers + the current access token and,
 * on a 401, attempts ONE token refresh then replays the original request ONCE.
 * Refresh is skipped for auth endpoints themselves so failed logins or an
 * expired refresh token surface directly to the caller.
 */
export async function apiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const { skipAuthRetry, headers, ...rest } = options;
  const accessToken = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (
    response.status === 401 &&
    !skipAuthRetry &&
    getRefreshToken() &&
    !path.startsWith("/auth/")
  ) {
    const refreshedToken = await requestAccessTokenRefresh();
    if (refreshedToken && refreshedToken !== accessToken) {
      return apiRequest(path, { ...options, skipAuthRetry: true });
    }
  }

  return response;
}

/**
 * Revoke the refresh token server-side and clear all local session state.
 * Deliberately uses plain fetch: a 401 during logout must not trigger the
 * refresh interceptor, and network failure must not trap the user signed in.
 */
export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  try {
    if (accessToken || refreshToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
    }
  } catch {
    // Server unreachable: still drop local credentials below.
  } finally {
    clearSession();
  }
}
