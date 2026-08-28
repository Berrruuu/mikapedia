import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "trader";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended" | "inactive";
  avatar?: string | null;
  accountNumber?: string | null;
  employeeId?: string | null;
  department?: string;
  position?: string;
  brokerName?: string;
  brokerServer?: string;
  phone?: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<AuthUser>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY  = "mikapedia.session";
const TOKEN_KEY    = "mikapedia.access";
const REFRESH_KEY  = "mikapedia.refresh";
// Derive API base dynamically to support dev tunnels (localtunnel/ngrok).
const _authApiHost = (typeof window !== 'undefined' && window.location?.hostname)
  ? window.location.hostname
  : 'localhost';
const _authApiProto = _authApiHost.includes('loca.lt') || _authApiHost.includes('ngrok') ? 'https' : 'http';
const _authApiPort = (_authApiHost === 'localhost' || _authApiHost === '127.0.0.1') ? ':8000' : '';
export const API_BASE = `${_authApiProto}://${_authApiHost}${_authApiPort}/api`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  const storage = getTokenStorage();
  const v = storage?.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  if (!v) return null;
  if (v === 'undefined' || v === 'null') return null;
  return v;
}

export function getRefreshToken(): string | null {
  const storage = getTokenStorage();
  const v = storage?.getItem(REFRESH_KEY) ?? localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  if (!v) return null;
  if (v === 'undefined' || v === 'null') return null;
  return v;
}

export function getTokenStorage(): Storage | null {
  const localHasToken = localStorage.getItem(TOKEN_KEY) != null || localStorage.getItem(REFRESH_KEY) != null;
  const sessionHasToken = sessionStorage.getItem(TOKEN_KEY) != null || sessionStorage.getItem(REFRESH_KEY) != null;

  if (localHasToken) return localStorage;
  if (sessionHasToken) return sessionStorage;

  const localHasSession = localStorage.getItem(STORAGE_KEY) != null;
  const sessionHasSession = sessionStorage.getItem(STORAGE_KEY) != null;
  if (localHasSession) return localStorage;
  if (sessionHasSession) return sessionStorage;

  return null;
}

export function setAccessToken(token: string) {
  const storage = getTokenStorage() ?? sessionStorage;
  storage.setItem(TOKEN_KEY, token);
}

export function setRefreshToken(token: string) {
  const storage = getTokenStorage() ?? sessionStorage;
  storage.setItem(REFRESH_KEY, token);
}

export async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    return false;
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 400) {
      clearStorage();
    }
    return false;
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object' || !('access' in json)) {
    return false;
  }

  setAccessToken((json as any).access as string);
  if ('refresh' in json) {
    setRefreshToken((json as any).refresh as string);
  }
  return true;
}

export function clearTokens() {
  clearStorage();
}

function clearStorage() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(STORAGE_KEY);
    s.removeItem(TOKEN_KEY);
    s.removeItem(REFRESH_KEY);
  });
}

async function apiCall<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // backend may return { success: false, error: { message } }
    if (json && typeof json === 'object' && 'success' in json && json.success === false) {
      const msg = (json as any).error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    throw new Error((json as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }

  // unwrap standardized backend envelope { success: true, data: ... }
  if (json && typeof json === 'object' && 'success' in json) {
    return (json as any).data as T;
  }

  return json as T;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw) as AuthUser);
      } catch { /* ignore */ }

      const refresh = getRefreshToken();
      if (refresh) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearStorage();
          setUser(null);
        }
      }

      setLoading(false);
    };

    void restore();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string, remember: boolean): Promise<AuthUser> => {
    const data = await apiCall<{ user: AuthUser; access: string; refresh: string }>(
      "/auth/login/",
      { method: "POST", body: JSON.stringify({ email, password, remember }) },
    );

    clearStorage();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(STORAGE_KEY, JSON.stringify(data.user));
    storage.setItem(TOKEN_KEY,   data.access);
    storage.setItem(REFRESH_KEY, data.refresh);

    setUser(data.user);
    return data.user;
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    const refresh = getRefreshToken();
    const access  = getAccessToken();
    try {
      if (refresh) {
        await apiCall("/auth/logout/", {
          method: "POST",
          body: JSON.stringify({ refresh }),
        }, access);
      }
    } catch { /* always clear locally */ }
    clearStorage();
    setUser(null);
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const forgotPassword = async (email: string): Promise<string> => {
    const data = await apiCall<{ detail: string; reset_token?: string }>(
      "/auth/forgot-password/",
      { method: "POST", body: JSON.stringify({ email }) },
    );
    return data.detail;
  };

  // ── Reset password ─────────────────────────────────────────────────────────
  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    await apiCall("/auth/reset-password/", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  };

  // ── Change password ────────────────────────────────────────────────────────
  const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    const access = getAccessToken();
    const data = await apiCall<{ detail: string; access: string; refresh: string }>(
      "/auth/change-password/",
      { method: "POST", body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }) },
      access,
    );
    // Update stored tokens without logging out
    const useLocal = !!localStorage.getItem(TOKEN_KEY);
    const storage  = useLocal ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY,   data.access);
    storage.setItem(REFRESH_KEY, data.refresh);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, forgotPassword, resetPassword, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Authenticated fetch — use this for all API calls */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryToken = getAccessToken();
      const retryHeaders: Record<string, string> = {
        ...(init?.headers as Record<string, string> ?? {}),
      };
      if (retryToken) retryHeaders["Authorization"] = `Bearer ${retryToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...init, headers: retryHeaders });
    }
  }
  return res;
}

