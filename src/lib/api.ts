/**
 * MIKAPEDIA TOMS — API Client
 * Centralized fetch wrapper for all Django backend calls.
 * All responses match the interfaces in mock-data.ts.
 */

import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearTokens } from "./auth";

// Compute API base dynamically so dev tunnels (localtunnel/ngrok) work.
const _apiHost = (typeof window !== 'undefined' && window.location?.hostname)
  ? window.location.hostname
  : 'localhost';
const _apiProto = _apiHost.includes('loca.lt') || _apiHost.includes('ngrok') ? 'https' : 'http';
const _apiPort = (_apiHost === 'localhost' || _apiHost === '127.0.0.1') ? ':8000' : '';
export const API_BASE = `${_apiProto}://${_apiHost}${_apiPort}/api`;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 400) {
      clearTokens();
    }
    return false;
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== "object" || !json.access) {
    return false;
  }

  setAccessToken(json.access);
  if (json.refresh) {
    setRefreshToken(json.refresh);
  }
  return true;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit, retrying = false): Promise<T> {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = await res.json().catch(() => null);

  if (res.status === 401 && !retrying) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, init, true);
    }
  }

  if (!res.ok) {
    const err = json as { detail?: string } | null;
    throw new Error(err?.detail ?? `HTTP ${res.status}`);
  }

  if (json && typeof json === "object" && "success" in json) {
    const wrapped = json as { success: boolean; data?: unknown; error?: { message?: string } };
    if (wrapped.success === false) {
      throw new Error(wrapped.error?.message ?? "Request failed");
    }
    return wrapped.data as T;
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
type PaginatedResponse<T> =
  | T[]
  | {
      results?: T[];
      count?: number;
      next?: string | null;
      previous?: string | null;
    };

function normalizePaginatedResponse<T>(data: PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}
// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => api.get<import("./auth").AuthUser>("/auth/me/"),
  refreshToken: (refresh: string) =>
    api.post<{ access: string }>("/auth/token/refresh/", { refresh }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface AdminDashboardData {
  totalTraders: number;
  todaySignals: number;
  executionRate: number;
  mt5Bridge?: { connected: number; total: number };
  attendance: { present: number; late: number; absent: number };
  signalBreakdown: {
    executed: number;
    missed: number;
    late: number;
    wrongDirection: number;
    waiting: number;
    pending: number;
  };
}

export interface TraderDashboardData {
  attendance: string;
  todaySignals: number;
  executionRate: number;
  pendingSignals: number;
  mt5: {
    accountNumber: string;
    status: string;
    balance: number;
    equity: number;
    floating: number;
    marginLevel: number;
    drawdown: number;
    openPositions: number;
  } | null;
  schedule?: {
    id: number;
    shift?: {
      id: number;
      name: string;
      startTime: string;
      endTime: string;
      graceMinutes: number;
      isActive: boolean;
      description: string;
    } | null;
    assignmentType?: string;
    coverFor?: {
      id: number;
      name: string;
      email: string;
    } | null;
    date?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive: boolean;
    notes: string;
  } | null;
  baseSchedule?: {
    id: number;
    shift?: {
      id: number;
      name: string;
      startTime: string;
      endTime: string;
      graceMinutes: number;
      isActive: boolean;
      description: string;
    } | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive: boolean;
    notes: string;
  } | null;
}

export const dashboardApi = {
  admin: () => api.get<AdminDashboardData>("/dashboard/admin/"),
  trader: () => api.get<TraderDashboardData>("/dashboard/trader/"),
};

// ─── Signals ──────────────────────────────────────────────────────────────────

export interface Signal {
  id: number;
  symbol: string;
  pair: string;
  direction: "BUY" | "SELL";
  timeframe: string;
  strategyName: string;
  time: string;
  sessionDate: string;
  maxEntryTime: string;
  expiresAt: string | null;
  fibEntry: number;
  takeProfit: number;
  stopLoss: number;
  fib_0236: number | null;
  fib_0500: number | null;
  fib_0618: number | null;
  fib_tp: number | null;
  status: string;
  executionRate: number;
  created_at: string;
  mt5Summary?: {
    totalTrades: number;
    pending: number;
    open: number;
    closed: number;
    cancelled: number;
  };
  mt5Trades?: Array<{
    id: number;
    ticket: number;
    symbol: string;
    direction: string;
    orderType: string;
    volume: number;
    entryPrice: number;
    stopLoss: number | null;
    takeProfit: number | null;
    status: string;
    openTime: string | null;
    account: {
      id: number;
      login: number;
      accountNumber: string;
      userName: string;
    };
  }>;
}

export const signalsApi = {
  list: (date?: string, status?: string) => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (status) params.set("status", status);
    return api.get<{ results?: Signal[]; count?: number } | Signal[]>(`/signals/?${params}`);
  },
  getById: (id: string | number) => api.get<Signal>(`/signals/${id}/`),
  updateStatus: (id: number, status: string) => api.patch<Signal>(`/signals/${id}/`, { status }),
  webhook: (payload: Record<string, unknown>) =>
    fetch(`${API_BASE}/signals/webhook/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};

// ─── Attendance ───────────────────────────────────────────────────────────────

export interface AttendanceShift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  is_active: boolean;
  description: string;
}

export interface AttendanceSchedule {
  id: number;
  user: UserSummary;
  shift: AttendanceShift;
  startDate: string;
  endDate: string;
  is_active: boolean;
  notes: string;
}

export interface AttendanceScheduleEntry {
  id: number;
  user: UserSummary;
  shift?: AttendanceShift | null;
  coverFor?: UserSummary | null;
  date: string | null;
  assignmentType: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: number;
  user: import("./auth").AuthUser;
  date: string;
  shift?: AttendanceShift | null;
  status: "Present" | "Late" | "Absent";
  checkInTime: string | null;
  gpsValid: boolean;
  gpsDistanceM: number | null;
  gpsAccuracyM: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  ipAddress: string | null;
  deviceInfo: string;
  browser: string;
  os: string;
  selfieUrl: string | null;
  isValidated: boolean;
  created_at?: string;
}

export const attendanceApi = {
  list: (params?: { date?: string; status?: string }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]) as [string, string][],
        ).toString()
      : "";
    return api
      .get<PaginatedResponse<AttendanceRecord>>(`/attendance/${qs}`)
      .then(normalizePaginatedResponse);
  },
  getById: (id: number) => api.get<AttendanceRecord>(`/attendance/${id}/`),
  today: () => api.get<{
      checked_in: boolean;
      records: AttendanceRecord[];
      available_shifts: AttendanceShift[];
    }>("/attendance/today/"),
  summary: (date?: string) =>
    api.get<unknown>(`/attendance/summary/${date ? `?date=${date}` : ""}`),
  validate: (id: number, body: { status: string; admin_note?: string }) =>
    api.patch<AttendanceRecord>(`/attendance/${id}/validate/`, body),
  listShifts: () =>
    api.get<PaginatedResponse<AttendanceShift>>("/attendance/shifts/").then(normalizePaginatedResponse),
  listSchedules: (params?: { user?: string; shift?: string; isActive?: boolean }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]) as [string, string][],
        ).toString()
      : "";
    return api
      .get<PaginatedResponse<AttendanceSchedule>>(`/attendance/schedules/${qs}`)
      .then(normalizePaginatedResponse);
  },
  createSchedule: (body: {
    userId: string;
    shiftId: number;
    startDate: string;
    endDate: string;
    notes?: string;
    is_active?: boolean;
  }) => api.post<AttendanceSchedule>("/attendance/schedules/", body),
  updateSchedule: (
    id: number,
    body: Partial<{ userId: string; shiftId: number; startDate: string; endDate: string; notes: string; is_active: boolean }>,
  ) => api.patch<AttendanceSchedule>(`/attendance/schedules/${id}/`, body),
  swapSchedules: (userIdA: string, userIdB: string) =>
    api.post<{ schedules: AttendanceSchedule[] }>("/attendance/schedules/swap/", { userIdA, userIdB }),
  deleteSchedule: (id: number) => api.del<void>(`/attendance/schedules/${id}/`),
  listScheduleEntries: (params?: { date?: string; user?: string; assignmentType?: string }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]) as [string, string][],
        ).toString()
      : "";
    return api
      .get<PaginatedResponse<AttendanceScheduleEntry>>(`/attendance/schedule-entries/${qs}`)
      .then(normalizePaginatedResponse);
  },
  createScheduleEntry: (body: {
    userId: string;
    date: string;
    assignmentType: string;
    shiftId?: number | null;
    coverForId?: string | null;
    notes?: string;
  }) => api.post<AttendanceScheduleEntry>("/attendance/schedule-entries/", body),
  updateScheduleEntry: (
    id: number,
    body: Partial<{ userId: string; date: string; assignmentType: string; shiftId?: number | null; coverForId?: string | null; notes: string }>,
  ) => api.patch<AttendanceScheduleEntry>(`/attendance/schedule-entries/${id}/`, body),
  deleteScheduleEntry: (id: number) => api.del<void>(`/attendance/schedule-entries/${id}/`),
};

// ─── MT5 ──────────────────────────────────────────────────────────────────────

export interface MT5Account {
  id: number;
  accountNumber: string;
  broker: string;
  status: "connected" | "disconnected";
  balance: number;
  equity: number;
  floatingPnl: number;
  marginLevel: number;
  drawdown: number;
  openPositions: number;
  lastSync: string | null;
  positions: MT5Position[];
}

export interface MT5Position {
  id: number;
  symbol: string;
  direction: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  floatingPnl: number;
  opened_at: string | null;
}

export const mt5Api = {
  list: () => api.get<MT5Account[]>("/mt5/"),
  me: () => api.get<MT5Account>("/mt5/me/"),
  summary: () => api.get<unknown>("/mt5/summary/"),
  syncAll: () => api.post<unknown>("/mt5/sync-all/", {}),
  syncOne: (id: number) => api.post<MT5Account>(`/mt5/${id}/sync/`, {}),
  deals: (id: number) => api.get<unknown[]>(`/mt5/${id}/deals/`),
  setCredentials: (payload: { login: number; password: string; server: string; broker?: string }) =>
    api.post<MT5Account>("/mt5/credentials/", payload),
};

// ─── Compliance ───────────────────────────────────────────────────────────────

export interface ComplianceRecord {
  id: number;
  user: import("./auth").AuthUser;
  signal: Signal;
  status: string;
  score: number;
  actualDirection: string | null;
  actualEntry: number | null;
  actualEntryTime: string | null;
  coachingNote: string;
  created_at: string;
}

export const complianceApi = {
  list: (params?: { status?: string; signal?: string | number; user?: string | number }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]) as [string, string][],
        ).toString()
      : "";
    return api.get<{ results?: ComplianceRecord[]; count?: number } | ComplianceRecord[]>(
      `/compliance/${qs}`,
    );
  },
  getById: (id: number) => api.get<ComplianceRecord>(`/compliance/${id}/`),
};

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar?: string | null;
  accountNumber?: string | null;
  employeeId?: string | null;
  department?: string;
  position?: string;
  phone?: string;
  executionRate?: number;
  complianceScore?: number;
  entryAccuracy?: number;
  timingAccuracy?: number;
  lateEntries?: number;
  date_joined?: string;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  status?: string;
  employeeId?: string;
  department?: string;
  position?: string;
  phone?: string;
  accountNumber?: string;
  brokerServer?: string;
  brokerName?: string;
}

export interface UserUpdatePayload {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
  employeeId?: string;
  department?: string;
  position?: string;
  phone?: string;
  accountNumber?: string;
  brokerServer?: string;
  brokerName?: string;
}

export const usersApi = {
  list: (params?: { role?: string; status?: string; search?: string; page_size?: number }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]) as [string, string][],
        ).toString()
      : "";
    return api.get<PaginatedResponse<UserSummary>>(`/users/${qs}`).then(normalizePaginatedResponse);
  },
  create: (payload: UserCreatePayload) => api.post<UserSummary>("/users/", payload),
  update: (id: string, payload: UserUpdatePayload) =>
    api.patch<UserSummary>(`/users/${id}/`, payload),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  type: string;
  title: string;
  level: "info" | "warning" | "danger" | "success";
  read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: () =>
    api.get<PaginatedResponse<Notification>>("/notifications/").then(normalizePaginatedResponse),
  markRead: (id: number) => api.patch<Notification>(`/notifications/${id}/mark_read/`, {}),
  markAllRead: () => api.patch<void>("/notifications/mark_all_read/", {}),
  dismiss: (id: number) => api.del<void>(`/notifications/${id}/`),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  time: string;
  actorLabel: string;
  action: string;
  category: string;
  severity: "info" | "warning" | "high" | "critical";
  ipAddress: string | null;
  created_at: string;
}

export const auditApi = {
  list: (params?: { severity?: string; category?: string; search?: string }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params).filter(([, v]) => v) as [string, string][],
        ).toString()
      : "";
    return api.get<AuditLogEntry[]>(`/audit-logs/${qs}`);
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface SystemSettings {
  companyName: string;
  timezone: string;
  logoUrl: string;
  tvWebhookUrl: string;
  mt5BridgeHost: string;
  telegramBotToken: string;
  smtpHost: string;
  sessionOpenUtc: string;
  sessionCloseUtc: string;
  attendanceCutoff: string;
  officeGpsRadiusM: number;
  fibEntryA: number;
  fibEntryB: number;
  fibEntryC: number;
  takeProfitFib: number;
  maxEntryDelayMinutes: number;
  maxLotPerTrade: number;
  autoRejectWrongDirection: boolean;
  notifyOnMissedSignal: boolean;
}

export const settingsApi = {
  get: () => api.get<SystemSettings>("/settings/"),
  update: (data: Partial<SystemSettings>) => api.patch<SystemSettings>("/settings/", data),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ExecutionReport {
  period: string;
  start: string;
  end: string;
  totalSignals: number;
  executed: number;
  missed: number;
  late: number;
  wrongDirection: number;
  waiting: number;
  executionRate: number;
  byPair: Record<
    string,
    { total: number; executed: number; missed: number; late: number; wrong: number }
  >;
  signals: Array<Record<string, unknown>>;
}

export interface AttendanceReport {
  period: string;
  start: string;
  end: string;
  totalTraders: number;
  totalDays: number;
  expected: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
  records: Array<Record<string, unknown>>;
}

export interface ComplianceReport {
  period: string;
  start: string;
  end: string;
  traders: Array<Record<string, unknown>>;
  avgExecutionRate: number;
  avgComplianceScore: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  accountNumber: string;
  employeeId: string;
  department: string;
  position: string;
  executionRate: number;
  complianceScore: number;
  entryAccuracy: number;
  timingAccuracy: number;
  lateEntries: number;
  attendanceRate: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  sopScore: number;
  rank: number;
}

export interface SessionReport {
  sessionDate: string;
  execution: ExecutionReport;
  attendance: AttendanceReport;
  leaderboard: LeaderboardEntry[];
}

export const reportsApi = {
  execution: (period = "daily", date?: string) => {
    const params = new URLSearchParams({ period });
    if (date) params.set("date", date);
    return api.get<ExecutionReport>(`/reports/execution/?${params.toString()}`);
  },
  attendance: (period = "daily", date?: string) => {
    const params = new URLSearchParams({ period });
    if (date) params.set("date", date);
    return api.get<AttendanceReport>(`/reports/attendance/?${params.toString()}`);
  },
  compliance: (period = "daily", date?: string) => {
    const params = new URLSearchParams({ period });
    if (date) params.set("date", date);
    return api.get<ComplianceReport>(`/reports/compliance/?${params.toString()}`);
  },
  leaderboard: (period = "daily", date?: string) => {
    const params = new URLSearchParams({ period });
    if (date) params.set("date", date);
    return api.get<LeaderboardEntry[]>(`/reports/leaderboard/?${params.toString()}`);
  },
  session: (date?: string) => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    return api.get<SessionReport>(
      `/reports/session/${params.toString() ? `?${params.toString()}` : ""}`,
    );
  },
};
