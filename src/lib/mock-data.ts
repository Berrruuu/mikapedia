// Mock data for MIKAPEDIA TOMS — swap for backend calls later.

export type ComplianceStatus =
  | "compliant"
  | "partial"
  | "late"
  | "wrong-direction"
  | "missed"
  | "pending";

export interface Signal {
  id: string;
  time: string; // HH:mm
  pair: string;
  direction: "BUY" | "SELL";
  fibEntry: 0.236 | 0.5 | 0.618;
  takeProfit: number;
  stopLoss: number;
  maxEntryTime: string;
  status: "Executed" | "Waiting" | "Pending" | "Late" | "Wrong Direction" | "Missed";
  executionRate: number;
}

export interface Trader {
  id: string;
  name: string;
  avatar?: string;
  accountNumber: string;
  status: "online" | "offline" | "away";
  attendance: "Present" | "Late" | "Absent";
  balance: number;
  equity: number;
  floating: number;
  marginLevel: number;
  drawdown: number;
  openPositions: number;
  mt5: "connected" | "disconnected";
  tradingview: "connected" | "disconnected";
  executionRate: number;
  compliance: number;
  entryAccuracy: number;
  timingAccuracy: number;
  lateEntries: number;
}

export const TRADERS: Trader[] = [
  {
    id: "t1", name: "Arif Wibowo", accountNumber: "MT5-7724091", status: "online",
    attendance: "Present", balance: 25400, equity: 25812, floating: 412, marginLevel: 842,
    drawdown: 2.1, openPositions: 2, mt5: "connected", tradingview: "connected",
    executionRate: 96, compliance: 94, entryAccuracy: 98, timingAccuracy: 92, lateEntries: 1,
  },
  {
    id: "t2", name: "Dewi Kartika", accountNumber: "MT5-7724092", status: "online",
    attendance: "Present", balance: 18220, equity: 18054, floating: -166, marginLevel: 512,
    drawdown: 3.4, openPositions: 1, mt5: "connected", tradingview: "connected",
    executionRate: 91, compliance: 88, entryAccuracy: 90, timingAccuracy: 87, lateEntries: 2,
  },
  {
    id: "t3", name: "Bagus Setiawan", accountNumber: "MT5-7724093", status: "away",
    attendance: "Late", balance: 32100, equity: 32340, floating: 240, marginLevel: 1104,
    drawdown: 1.2, openPositions: 3, mt5: "connected", tradingview: "connected",
    executionRate: 88, compliance: 84, entryAccuracy: 85, timingAccuracy: 82, lateEntries: 4,
  },
  {
    id: "t4", name: "Sinta Halim", accountNumber: "MT5-7724094", status: "online",
    attendance: "Present", balance: 14750, equity: 14980, floating: 230, marginLevel: 622,
    drawdown: 2.8, openPositions: 2, mt5: "connected", tradingview: "connected",
    executionRate: 94, compliance: 92, entryAccuracy: 95, timingAccuracy: 90, lateEntries: 1,
  },
  {
    id: "t5", name: "Rendra Prakoso", accountNumber: "MT5-7724095", status: "offline",
    attendance: "Absent", balance: 9820, equity: 9820, floating: 0, marginLevel: 0,
    drawdown: 0, openPositions: 0, mt5: "disconnected", tradingview: "disconnected",
    executionRate: 71, compliance: 68, entryAccuracy: 74, timingAccuracy: 65, lateEntries: 6,
  },
  {
    id: "t6", name: "Melati Rahayu", accountNumber: "MT5-7724096", status: "online",
    attendance: "Present", balance: 41200, equity: 41560, floating: 360, marginLevel: 1420,
    drawdown: 1.9, openPositions: 4, mt5: "connected", tradingview: "connected",
    executionRate: 98, compliance: 97, entryAccuracy: 99, timingAccuracy: 96, lateEntries: 0,
  },
  {
    id: "t7", name: "Yudha Kusuma", accountNumber: "MT5-7724097", status: "online",
    attendance: "Present", balance: 22300, equity: 22120, floating: -180, marginLevel: 704,
    drawdown: 3.1, openPositions: 2, mt5: "connected", tradingview: "connected",
    executionRate: 85, compliance: 82, entryAccuracy: 87, timingAccuracy: 80, lateEntries: 3,
  },
  {
    id: "t8", name: "Nadia Fitri", accountNumber: "MT5-7724098", status: "online",
    attendance: "Late", balance: 16800, equity: 16920, floating: 120, marginLevel: 588,
    drawdown: 2.4, openPositions: 1, mt5: "connected", tradingview: "connected",
    executionRate: 89, compliance: 86, entryAccuracy: 88, timingAccuracy: 85, lateEntries: 2,
  },
];

export const SIGNALS: Signal[] = [
  { id: "s1", time: "09:02", pair: "XAUUSD", direction: "BUY", fibEntry: 0.5, takeProfit: 2412.4, stopLoss: 2394.2, maxEntryTime: "09:12", status: "Executed", executionRate: 92 },
  { id: "s2", time: "09:34", pair: "EURUSD", direction: "SELL", fibEntry: 0.618, takeProfit: 1.0824, stopLoss: 1.0902, maxEntryTime: "09:44", status: "Executed", executionRate: 88 },
  { id: "s3", time: "10:11", pair: "GBPJPY", direction: "BUY", fibEntry: 0.236, takeProfit: 199.42, stopLoss: 197.88, maxEntryTime: "10:21", status: "Late", executionRate: 62 },
  { id: "s4", time: "10:47", pair: "XAUUSD", direction: "SELL", fibEntry: 0.5, takeProfit: 2382.1, stopLoss: 2401.6, maxEntryTime: "10:57", status: "Missed", executionRate: 0 },
  { id: "s5", time: "11:20", pair: "USDJPY", direction: "BUY", fibEntry: 0.618, takeProfit: 156.82, stopLoss: 155.94, maxEntryTime: "11:30", status: "Executed", executionRate: 95 },
  { id: "s6", time: "11:58", pair: "BTCUSD", direction: "SELL", fibEntry: 0.5, takeProfit: 61240, stopLoss: 62880, maxEntryTime: "12:08", status: "Wrong Direction", executionRate: 20 },
  { id: "s7", time: "12:36", pair: "EURUSD", direction: "BUY", fibEntry: 0.236, takeProfit: 1.0912, stopLoss: 1.0844, maxEntryTime: "12:46", status: "Waiting", executionRate: 0 },
  { id: "s8", time: "13:04", pair: "XAUUSD", direction: "BUY", fibEntry: 0.5, takeProfit: 2428.9, stopLoss: 2410.4, maxEntryTime: "13:14", status: "Pending", executionRate: 0 },
];

export const EXECUTION_TREND = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  execution: 78 + Math.round(Math.sin(i / 2) * 8 + i * 0.6),
  compliance: 74 + Math.round(Math.cos(i / 2) * 6 + i * 0.7),
}));

export const ATTENDANCE_TREND = Array.from({ length: 7 }, (_, i) => ({
  day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  present: 18 + Math.round(Math.random() * 3),
  late: 2 + Math.round(Math.random() * 3),
  absent: Math.round(Math.random() * 2),
}));

export const SESSION_BREAKDOWN = [
  { name: "Compliant", value: 62, color: "var(--color-success)" },
  { name: "Partial", value: 14, color: "var(--color-chart-3)" },
  { name: "Late", value: 9, color: "var(--color-warning)" },
  { name: "Wrong Direction", value: 6, color: "var(--color-destructive)" },
  { name: "Missed", value: 9, color: "var(--color-muted-foreground)" },
];

export const ECONOMIC_EVENTS = [
  { time: "13:30", currency: "USD", event: "Core CPI m/m", impact: "high", forecast: "0.3%", previous: "0.4%" },
  { time: "15:00", currency: "USD", event: "Crude Oil Inventories", impact: "medium", forecast: "-1.2M", previous: "-0.8M" },
  { time: "20:00", currency: "USD", event: "FOMC Statement", impact: "high", forecast: "—", previous: "—" },
  { time: "23:50", currency: "JPY", event: "Trade Balance", impact: "low", forecast: "-0.4T", previous: "-0.6T" },
];

export const MARKET_NEWS = [
  { time: "12m", title: "Gold retreats from record as USD firms into FOMC", source: "Reuters" },
  { time: "38m", title: "BOJ signals patience on yields, yen slips further", source: "Bloomberg" },
  { time: "1h", title: "Oil steady as OPEC+ maintains output guidance", source: "FT" },
  { time: "2h", title: "EU inflation trends bolster ECB rate cut expectations", source: "WSJ" },
];

export const NOTIFICATIONS = [
  { id: "n1", type: "signal", title: "New signal published: XAUUSD BUY @ Fib 0.5", time: "2m", level: "info" as const },
  { id: "n2", type: "compliance", title: "Rendra Prakoso — Wrong Direction on EURUSD", time: "14m", level: "danger" as const },
  { id: "n3", type: "attendance", title: "Bagus Setiawan marked Late (09:18)", time: "1h", level: "warning" as const },
  { id: "n4", type: "system", title: "MT5 bridge reconnected — 8/8 accounts live", time: "1h", level: "success" as const },
];

export const SESSIONS = [
  { name: "Sydney", state: "Closed", color: "muted" },
  { name: "Tokyo", state: "Closing", color: "warning" },
  { name: "London", state: "Open", color: "success" },
  { name: "New York", state: "Opens in 2h 14m", color: "info" },
] as const;
