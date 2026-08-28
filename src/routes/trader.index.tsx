import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  HardDriveDownload,
  LineChart as LineChartIcon,
  Radio,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  dashboardApi,
  mt5Api,
  signalsApi,
  type TraderDashboardData,
  type MT5Account,
  type Signal,
} from "@/lib/api";
import { TradingViewChart, useIsDarkMode } from "@/components/tradingview-widget";
import { useWSEvent } from "@/lib/ws-context";

const TIMEFRAMES = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
];

export const Route = createFileRoute("/trader/")({
  component: TraderDashboard,
});

const statusTone: Record<string, string> = {
  Executed: "bg-success/10 text-success border-success/20",
  Waiting: "bg-info/10 text-info border-info/20",
  Pending: "bg-muted text-muted-foreground border-border",
  Late: "bg-warning/10 text-warning border-warning/20",
  "Wrong Direction": "bg-destructive/10 text-destructive border-destructive/20",
  Missed: "bg-destructive/10 text-destructive border-destructive/20",
};

function TraderDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<TraderDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const isDark = useIsDarkMode();
  const [interval, setInterval] = useState("15");
  const [signalTimeline, setSignalTimeline] = useState<Signal[]>([]);
  const [signalCount, setSignalCount] = useState(0);
  const [executedCount, setExecutedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [complianceRecords, setComplianceRecords] = useState<Array<{
    id: number; status: string; score: number;
    violations: string[]; coachingNote: string;
    signal: { pair: string; direction: string; timeframe: string };
  }>>([]);
  const executionTrend = useMemo(() => {
    const rate = dashboard?.executionRate ?? 0;
    return [
      { day: "Mon", execution: rate, compliance: rate },
      { day: "Tue", execution: rate, compliance: rate },
      { day: "Wed", execution: rate, compliance: rate },
      { day: "Thu", execution: rate, compliance: rate },
      { day: "Fri", execution: rate, compliance: rate },
    ];
  }, [dashboard]);

  // WebSocket: live MT5 account update
  interface MT5Live {
    accountNumber?: string;
    balance?: number;
    equity?: number;
    floatingPnl?: number;
    marginLevel?: number;
    drawdown?: number;
    openPositions?: number;
    positions?: MT5Account["positions"];
    status?: string;
  }

  const [mt5Live, setMt5Live] = useState<Partial<MT5Live>>({});
  const handleMT5WS = useCallback((data: unknown) => {
    const payload = data as Record<string, unknown>;
    const live: Partial<MT5Live> = {
      accountNumber: payload.accountNumber as string | undefined,
      balance: payload.balance as number | undefined,
      equity: payload.equity as number | undefined,
      floatingPnl: (payload.floatingPnl ?? payload.floating ?? payload.floating_pnl) as
        number | undefined,
      marginLevel: payload.marginLevel as number | undefined,
      drawdown: payload.drawdown as number | undefined,
      openPositions: payload.openPositions as number | undefined,
      positions: payload.positions as MT5Account["positions"] | undefined,
      status: payload.status as string | undefined,
    };

    if (live.balance !== undefined || live.equity !== undefined || live.floatingPnl !== undefined) {
      setMt5Live((current) => ({ ...current, ...live }));
    }

    if (live.positions) {
      setPositions(live.positions);
    }

    if (
      live.openPositions !== undefined ||
      live.marginLevel !== undefined ||
      live.drawdown !== undefined
    ) {
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          mt5: {
            ...prev.mt5,
            accountNumber: live.accountNumber ?? prev.mt5?.accountNumber,
            status: live.status ?? prev.mt5?.status,
            balance: live.balance ?? prev.mt5?.balance,
            equity: live.equity ?? prev.mt5?.equity,
            floating: live.floatingPnl ?? prev.mt5?.floating,
            marginLevel: live.marginLevel ?? prev.mt5?.marginLevel,
            drawdown: live.drawdown ?? prev.mt5?.drawdown,
            openPositions: live.openPositions ?? prev.mt5?.openPositions,
          },
        };
      });
    }
  }, []);
  useWSEvent("mt5_update", handleMT5WS);

  useEffect(() => {
    let active = true;
    const fetchDashboard = async () => {
      try {
        const data = await dashboardApi.trader();
        if (active) setDashboard(data);
      } catch {
        if (active) setDashboard(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchDashboard();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchSignals = async () => {
      try {
        const response = await signalsApi.list();
        const signals = Array.isArray(response) ? response : (response.results ?? []);
        if (!active) return;
        setSignalTimeline(signals.slice(0, 8));
        setSignalCount(signals.length);
        setExecutedCount(signals.filter((s) => s.status === "Executed").length);
        setPendingCount(
          signals.filter((s) => s.status === "Pending" || s.status === "Waiting").length,
        );
      } catch (error) {
        console.error("Failed to load signals", error);
      }
    };
    void fetchSignals();
    return () => { active = false; };
  }, []);

  // Load compliance records for checklist widget
  useEffect(() => {
    let active = true;
    const fetchCompliance = async () => {
      try {
        const { api: apiClient } = await import("@/lib/api");
        const res = await apiClient.get<{ results?: typeof complianceRecords } | typeof complianceRecords>('/compliance/');
        if (!active) return;
        const list = Array.isArray(res) ? res : (res as { results: typeof complianceRecords })?.results ?? [];
        setComplianceRecords(list.slice(0, 20));
      } catch { /* silent */ }
    };
    void fetchCompliance();
    return () => { active = false; };
  }, []);

  // WebSocket: live signal count
  useWSEvent(
    "signal_update",
    useCallback((data: unknown) => {
      const sig = data as Signal;
      if (!sig?.id) return;
      setSignalTimeline((prev) => {
        const exists = prev.find((s) => s.id === sig.id);
        if (exists) return prev.map((s) => (s.id === sig.id ? sig : s)).slice(0, 8);
        return [sig, ...prev].slice(0, 8);
      });
      setSignalCount((c) => c + 1);
      if (sig.status === "Executed") setExecutedCount((c) => c + 1);
      if (sig.status === "Pending" || sig.status === "Waiting") setPendingCount((c) => c + 1);
    }, []),
  );

  const account = dashboard?.mt5;
  const [positions, setPositions] = useState<MT5Account["positions"]>([]);

  const liveMt5 = account
    ? {
        ...account,
        balance: mt5Live.balance ?? account.balance,
        equity: mt5Live.equity ?? account.equity,
        floating: mt5Live.floatingPnl ?? account.floating,
        marginLevel: mt5Live.marginLevel ?? account.marginLevel,
        drawdown: mt5Live.drawdown ?? account.drawdown,
        openPositions: mt5Live.openPositions ?? account.openPositions,
      }
    : null;

  useEffect(() => {
    if (!account) return;
    const fetchPositions = async () => {
      try {
        const mt5Account = await mt5Api.me();
        setPositions(mt5Account.positions);
      } catch {
        setPositions([]);
      }
    };
    void fetchPositions();
  }, [account]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary animate-pulse">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-xs text-muted-foreground">Loading dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Trader Desk"
        title={`Good session, ${user?.name.split(" ")[0]}`}
        description={
          account
            ? `MT5 ${liveMt5?.accountNumber ?? account.accountNumber} · London session · Balance $${(liveMt5?.balance ?? account.balance).toLocaleString()}`
            : "Dashboard overview"
        }
        actions={
          <>
            <Badge
              variant="outline"
              className="gap-1.5 bg-success/10 text-success border-success/20"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Present
            </Badge>
            <Button size="sm" className="gradient-primary text-primary-foreground">
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
              Check-in Selfie
            </Button>
          </>
        }
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Attendance"
          value={dashboard?.attendance ?? "Absent"}
          hint={dashboard?.attendance === "Present" ? "Checked in" : "No check-in"}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label="TradingView"
          value="Live"
          hint="Webhook streaming"
          icon={<LineChartIcon className="h-5 w-5" />}
          accent="info"
        />
        <StatCard
          label="MetaTrader 5"
          value={account ? (liveMt5?.accountNumber ?? account.accountNumber) : "No account"}
          hint={
            account
              ? `$${(liveMt5?.balance ?? account.balance ?? 0).toLocaleString()}`
              : "Connect your MT5"
          }
          icon={<HardDriveDownload className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label="Today's Signals"
          value={dashboard?.todaySignals ?? signalCount}
          hint={`${executedCount} executed`}
          icon={<Radio className="h-5 w-5" />}
          accent="primary"
        />
        <StatCard
          label="Execution Rate"
          value={`${dashboard?.executionRate ?? Math.round((executedCount / (dashboard?.todaySignals || signalCount || 1)) * 100)}%`}
          hint="SOP adherence"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="success"
          trend={4}
        />
        <StatCard
          label="Pending"
          value={dashboard?.pendingSignals ?? pendingCount}
          hint="Awaiting entry"
          icon={<Clock className="h-5 w-5" />}
          accent="warning"
        />
      </div>

      <div className="mt-4 lg:mt-6">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Your Schedule
              </div>
              <div className="text-lg font-bold">Today's assigned shift</div>
            </div>
            <div className="flex items-center gap-2">
              {dashboard?.schedule ? (
                <Badge
                  variant="outline"
                  className={
                    dashboard.schedule.isActive
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-muted text-muted-foreground border-border"
                  }
                >
                  {dashboard.schedule.isActive ? "Active" : "Inactive"}
                </Badge>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => setScheduleOpen(true)}>
                View Schedule
              </Button>
            </div>
          </div>

          {dashboard?.schedule ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Session
                </div>
                <div className="mt-2 text-lg font-semibold">{dashboard.schedule.shift.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {dashboard.schedule.shift.startTime} - {dashboard.schedule.shift.endTime}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Grace: {dashboard.schedule.shift.graceMinutes} min
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Notes
                </div>
                <div className="mt-2 text-sm leading-6 text-foreground">
                  {dashboard.schedule.notes || "No additional notes provided."}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              No schedule assigned yet. Please contact your admin to assign your session.
            </div>
          )}
        </Card>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Schedule Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            {dashboard?.schedule ? (
              <>
                <div className="grid gap-4">
                  <div className="rounded-xl border border-border/60 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Assignment
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {dashboard.schedule.assignmentType === "off"
                        ? "Off day"
                        : dashboard.schedule.assignmentType === "cover"
                          ? `Cover ${dashboard.schedule.coverFor?.name ?? dashboard.schedule.coverFor?.email ?? "trader"}`
                          : "Regular assignment"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {dashboard.schedule.assignmentType === "cover"
                        ? `Cover date: ${dashboard.schedule.date ?? "-"}`
                        : dashboard.schedule.date
                          ? `Date: ${dashboard.schedule.date}`
                          : "Date: Today"}
                    </div>
                  </div>
                  {dashboard.schedule.shift ? (
                    <div className="rounded-xl border border-border/60 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Shift
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {dashboard.schedule.shift.name}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {dashboard.schedule.shift.startTime} - {dashboard.schedule.shift.endTime}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Grace: {dashboard.schedule.shift.graceMinutes} min
                      </div>
                    </div>
                  ) : null}
                  {dashboard.baseSchedule ? (
                    <div className="rounded-xl border border-border/60 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Original Schedule
                      </div>
                      {dashboard.baseSchedule.shift ? (
                        <>
                          <div className="mt-2 text-lg font-semibold">
                            {dashboard.baseSchedule.shift.name}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {dashboard.baseSchedule.shift.startTime} - {dashboard.baseSchedule.shift.endTime}
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            Grace: {dashboard.baseSchedule.shift.graceMinutes} min
                          </div>
                        </>
                      ) : (
                        <div className="mt-2 text-sm text-foreground">No original shift assigned.</div>
                      )}
                      <div className="mt-3 text-sm text-muted-foreground">
                        {dashboard.baseSchedule.startDate || "-"} → {dashboard.baseSchedule.endDate || "-"}
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border/60 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Schedule Range
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {dashboard.schedule.startDate || "-"} → {dashboard.schedule.endDate || "-"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Notes
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {dashboard.schedule.notes || "No additional notes provided."}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                No schedule assigned yet.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* TradingView chart embed */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
                <LineChartIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">XAUUSD · TradingView</div>
                <div className="text-[11px] text-muted-foreground">
                  Pine Script v6 · Fibonacci 0.236 / 0.5 / 0.618 · TP -0.27
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border/60 overflow-hidden">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setInterval(tf.value)}
                    className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                      interval === tf.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                BUY zone active
              </Badge>
            </div>
          </div>
          <div className="overflow-hidden rounded-b-lg">
            <TradingViewChart
              symbol="OANDA:XAUUSD"
              interval={interval}
              theme={isDark ? "dark" : "light"}
              height={420}
            />
          </div>
        </Card>

        {/* MT5 Account panel */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                MetaTrader 5
              </div>
              <div className="text-lg font-bold">
                Account {liveMt5?.accountNumber ?? account?.accountNumber ?? "No account"}
              </div>
            </div>
            <Badge
              variant="outline"
              className="bg-success/10 text-success border-success/20 gap-1.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Balance
              </div>
              <div className="mt-1 text-lg font-bold font-mono">
                ${account ? (liveMt5?.balance ?? account.balance ?? 0).toLocaleString() : "0.00"}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Equity
              </div>
              <div className="mt-1 text-lg font-bold font-mono">
                ${account ? (liveMt5?.equity ?? account.equity ?? 0).toLocaleString() : "0.00"}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Floating P/L
              </div>
              <div
                className={`mt-1 text-lg font-bold font-mono flex items-center gap-1 ${account && (liveMt5?.floating ?? liveMt5?.floatingPnl ?? account.floating) >= 0 ? "text-success" : "text-destructive"}`}
              >
                {account && (liveMt5?.floating ?? liveMt5?.floatingPnl ?? account.floating) >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                $
                {account
                  ? Math.abs(
                      liveMt5?.floating ?? liveMt5?.floatingPnl ?? account.floating ?? 0,
                    ).toLocaleString()
                  : "0.00"}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Margin Level
              </div>
              <div className="mt-1 text-lg font-bold font-mono">
                {account ? `${liveMt5?.marginLevel ?? account.marginLevel}%` : "0%"}
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Drawdown
            </div>
            <span className="text-xs font-mono">
              {account ? `${liveMt5?.drawdown ?? account.drawdown}%` : "0%"}
            </span>
          </div>
          <Progress
            value={account ? (liveMt5?.drawdown ?? account.drawdown) * 10 : 0}
            className="h-2"
          />

          <Separator className="my-4" />

          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Open Positions ({account ? (liveMt5?.openPositions ?? account.openPositions) : 0})
          </div>
          <div className="space-y-2">
            {positions.length > 0 ? (
              positions.map((pos) => (
                <div key={pos.ticket} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{pos.symbol}</span>
                      <Badge
                        variant="outline"
                        className={
                          pos.type === "BUY"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {pos.type} · {pos.lotSize}
                      </Badge>
                    </div>
                    <span
                      className={`text-sm font-bold font-mono ${(pos.floatingPnl ?? 0) >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {(pos.floatingPnl ?? 0) >= 0 ? "+" : ""}${(pos.floatingPnl ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground">
                    <span>E {pos.entryPrice != null ? pos.entryPrice.toFixed(5) : "-"}</span>
                    <span>SL {pos.stopLoss ?? "-"}</span>
                    <span>TP {pos.takeProfit ?? "-"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                No open positions available.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Your Signal Timeline
              </div>
              <div className="text-lg font-bold">Today's TradingView signals</div>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              Full list <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {signalTimeline.length === 0 ? (
              <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                No TradingView signals available.
              </div>
            ) : (
              signalTimeline.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-3 hover:border-primary/30 transition"
                >
                  <div className="text-center min-w-[52px]">
                    <div className="text-xs font-mono font-bold">{s.time}</div>
                    <div className="text-[10px] text-muted-foreground">max {s.maxEntryTime}</div>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{s.pair}</span>
                      <Badge
                        variant="outline"
                        className={
                          s.direction === "BUY"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {s.direction}
                      </Badge>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Fib {s.fibEntry}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                      TP {s.takeProfit} · SL {s.stopLoss}
                    </div>
                  </div>
                  <Badge variant="outline" className={statusTone[s.status]}>
                    {s.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Execution Checklist
            </div>
            <div className="text-lg font-bold">SOP compliance today</div>
          </div>
          <div className="space-y-2.5">
            {complianceRecords.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Belum ada data compliance hari ini.
              </div>
            ) : (() => {
              const noSL    = complianceRecords.filter(r => r.violations.includes("no_stop_loss")).length;
              const noTP    = complianceRecords.filter(r => r.violations.includes("no_take_profit")).length;
              const wrongDir= complianceRecords.filter(r => r.violations.includes("wrong_direction")).length;
              const late    = complianceRecords.filter(r => r.violations.includes("late_entry")).length;
              const wrongLot= complianceRecords.filter(r => r.violations.includes("wrong_lot_size")).length;
              const missed  = complianceRecords.filter(r => r.status === "Missed").length;
              const total   = complianceRecords.length;
              const incomplete = complianceRecords.filter(r => r.violations.includes("incomplete_entries")).length;
              const wrongOrder = complianceRecords.filter(r => r.violations.includes("wrong_order_type")).length;
              const items = [
                { label: "3 Entry per Signal",         ok: incomplete === 0 && missed === 0, note: incomplete === 0 ? `${total}/${total} signal dengan 3 posisi` : `${incomplete} signal entry tidak lengkap` },
                { label: "Metode: Buy/Sell Limit",     ok: wrongOrder === 0,  note: wrongOrder === 0 ? "Semua pakai Limit Order" : `${wrongOrder} pakai Market Order` },
                { label: "Trade Direction",             ok: wrongDir === 0,    note: wrongDir === 0 ? `${total}/${total} arah benar` : `${wrongDir} arah salah` },
                { label: "Take Profit (-0.27)",         ok: noTP === 0,        note: noTP === 0 ? "Semua TP terpasang" : `${noTP} posisi tanpa TP` },
                { label: "Stop Loss (0.786)",           ok: noSL === 0,        note: noSL === 0 ? "Semua SL terpasang" : `${noSL} posisi tanpa SL` },
                { label: "Lot Size",                    ok: wrongLot === 0,    note: wrongLot === 0 ? "Lot sesuai SOP" : `${wrongLot} trade over limit` },
                { label: "Entry Timing (5 mnt)",        ok: late === 0,        note: late === 0 ? "Semua entry tepat waktu" : `${late} entry terlambat` },
                { label: "Signal Execution",            ok: missed === 0,      note: missed === 0 ? "Semua signal dieksekusi" : `${missed} signal dilewati` },
              ];
              return items.map((c) => (
                <div key={c.label} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                  {c.ok
                    ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    : <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{c.label}</div>
                    <div className="text-[11px] text-muted-foreground">{c.note}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
          <Separator className="my-4" />
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Shield className="h-3.5 w-3.5" /> Overall Score
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="text-4xl font-bold text-gradient">
                {complianceRecords.length > 0
                  ? Math.round(complianceRecords.reduce((sum, r) => sum + r.score, 0) / complianceRecords.length)
                  : "—"
                }
              </div>
              <div className="pb-1 text-sm text-muted-foreground">/ 100</div>
            </div>
            <Progress
              value={complianceRecords.length > 0
                ? Math.round(complianceRecords.reduce((sum, r) => sum + r.score, 0) / complianceRecords.length)
                : 0
              }
              className="mt-2 h-1.5"
            />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Your Execution Trend
              </div>
              <div className="text-lg font-bold">Rolling 14-day compliance</div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Not measured by P/L
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Measured by SOP
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={executionTrend}>
              <defs>
                <linearGradient id="trader-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="execution"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#trader-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}
