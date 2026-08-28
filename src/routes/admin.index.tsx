import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Clock,
  Download, Globe, HardDriveDownload, LineChart as LineChartIcon, Radio,
  RefreshCw, Sparkles, TrendingUp, Users, XCircle, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { dashboardApi, signalsApi, notificationsApi, type AdminDashboardData, type Notification, type Signal } from "@/lib/api";
import { useWSEvent } from "@/lib/ws-context";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const statusTone: Record<string, string> = {
  Executed: "bg-success/10 text-success border-success/20",
  Waiting: "bg-info/10 text-info border-info/20",
  Pending: "bg-muted text-muted-foreground border-border",
  Late: "bg-warning/10 text-warning border-warning/20",
  "Wrong Direction": "bg-destructive/10 text-destructive border-destructive/20",
  Missed: "bg-destructive/10 text-destructive border-destructive/20",
};

const economicEvents = [
  { time: "08:30", currency: "USD", event: "FOMC Minutes", forecast: "2.5%", previous: "2.4%", impact: "high" },
  { time: "10:00", currency: "EUR", event: "ECB Rate Decision", forecast: "2.0%", previous: "2.0%", impact: "high" },
  { time: "12:00", currency: "GBP", event: "GDP Growth", forecast: "0.5%", previous: "0.4%", impact: "medium" },
];

const tradingSessions = [
  { name: "London", state: "Open", color: "success" },
  { name: "New York", state: "Open", color: "success" },
  { name: "Tokyo", state: "Closed", color: "info" },
];

function AdminDashboard() {
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [signalTimeline, setSignalTimeline] = useState<Signal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [liveSignalUpdates, setLiveSignalUpdates] = useState<Signal[]>([]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const data = await dashboardApi.admin();
        if (active) setDashboard(data);
      } catch (error) {
        console.error("Failed to load admin dashboard", error);
      }
    };

    const loadSignals = async () => {
      try {
        const response = await signalsApi.list();
        const signals = Array.isArray(response) ? response : response.results ?? [];
        if (active) setSignalTimeline(signals.slice(0, 8));
      } catch (error) {
        console.error("Failed to load signal timeline", error);
      }
    };

    const loadNotifications = async () => {
      try {
        const items = await notificationsApi.list();
        if (active) setNotifications(Array.isArray(items) ? items : (items?.data ?? []));
      } catch (error) {
        console.error("Failed to load notifications", error);
      }
    };

    void loadDashboard();
    void loadSignals();
    void loadNotifications();

    return () => {
      active = false;
    };
  }, []);

  const attendanceTrend = useMemo(
    () => dashboard ? [
      { day: "Mon", present: dashboard.attendance.present, late: dashboard.attendance.late, absent: dashboard.attendance.absent },
      { day: "Tue", present: dashboard.attendance.present, late: dashboard.attendance.late, absent: dashboard.attendance.absent },
      { day: "Wed", present: dashboard.attendance.present, late: dashboard.attendance.late, absent: dashboard.attendance.absent },
      { day: "Thu", present: dashboard.attendance.present, late: dashboard.attendance.late, absent: dashboard.attendance.absent },
      { day: "Fri", present: dashboard.attendance.present, late: dashboard.attendance.late, absent: dashboard.attendance.absent },
    ] : [],
    [dashboard],
  );

  const sessionBreakdown = useMemo(
    () => dashboard ? [
      { name: "Executed", value: dashboard.signalBreakdown.executed, color: "#22c55e" },
      { name: "Missed", value: dashboard.signalBreakdown.missed, color: "#ef4444" },
      { name: "Late", value: dashboard.signalBreakdown.late, color: "#f59e0b" },
      { name: "Wrong", value: dashboard.signalBreakdown.wrongDirection, color: "#e11d48" },
    ] : [],
    [dashboard],
  );

  const executionTrend = useMemo(
    () => dashboard ? [
      { day: "Mon", execution: dashboard.executionRate, compliance: dashboard.executionRate },
      { day: "Tue", execution: dashboard.executionRate, compliance: dashboard.executionRate },
      { day: "Wed", execution: dashboard.executionRate, compliance: dashboard.executionRate },
      { day: "Thu", execution: dashboard.executionRate, compliance: dashboard.executionRate },
      { day: "Fri", execution: dashboard.executionRate, compliance: dashboard.executionRate },
    ] : [],
    [dashboard],
  );

  const handleSignalWS = useCallback((data: unknown) => {
    const sig = data as Signal;
    if (!sig?.id) return;
    setLiveSignalUpdates((prev) => {
      const exists = prev.find((s) => s.id === sig.id);
      if (exists) return prev.map((s) => (s.id === sig.id ? sig : s));
      return [sig, ...prev].slice(0, 8);
    });
  }, []);

  useWSEvent("signal_update", handleSignalWS);

  const handleDashStats = useCallback((data: unknown) => {
    const stats = data as { todaySignals?: number; executionRate?: number; attendance?: { present: number; late: number; absent: number } };
    if (!stats) return;
    setDashboard((prev) => prev ? { ...prev, ...stats } as AdminDashboardData : prev);
  }, []);

  useWSEvent("dashboard_stats", handleDashStats);

  const liveSignals = liveSignalUpdates.length > 0 ? liveSignalUpdates : signalTimeline;
  const online = dashboard ? dashboard.attendance.present + dashboard.attendance.late : 0;
  const present = dashboard?.attendance.present ?? 0;
  const late = dashboard?.attendance.late ?? 0;
  const absent = dashboard?.attendance.absent ?? 0;
  const missed = dashboard?.signalBreakdown.missed ?? 0;
  const wrong = dashboard?.signalBreakdown.wrongDirection ?? 0;
  const lateSig = dashboard?.signalBreakdown.late ?? 0;
  const followed = dashboard?.signalBreakdown.executed ?? 0;
  const execRate = dashboard?.executionRate ?? 0;
  const totalTraders = dashboard?.totalTraders ?? 0;
  const todaySignals = dashboard?.todaySignals ?? liveSignals.length;
  const mt5Connected = dashboard?.mt5Bridge?.connected ?? 0;
  const mt5Total = dashboard?.mt5Bridge?.total ?? 0;
  const mt5BridgeHint = mt5Total > 0 ? `${mt5Connected}/${mt5Total} accounts online` : "No MT5 accounts linked";

  return (
    <>
      <PageHeader
        eyebrow="Operations · London Session"
        title="Command Center"
        description="Real-time visibility across every trader, signal, and MT5 bridge."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" /> {now} UTC
            </Badge>
            <Button variant="outline" size="sm"><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>
            <Button size="sm" className="gradient-primary text-primary-foreground">
              <Download className="mr-1.5 h-3.5 w-3.5" />Export
            </Button>
          </>
        }
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Traders" value={totalTraders} hint="Active accounts" icon={<Users className="h-5 w-5" />} accent="primary" trend={5} />
        <StatCard label="Online Now" value={online} hint={`${online}/${totalTraders} active`} icon={<Activity className="h-5 w-5" />} accent="success" />
        <StatCard label="Attendance" value={`${present}/${totalTraders}`} hint={`${late} late · ${absent} absent`} icon={<CalendarClock className="h-5 w-5" />} accent="info" />
        <StatCard label="Today's Signals" value={todaySignals} hint="From TradingView webhook" icon={<Radio className="h-5 w-5" />} accent="primary" />
        <StatCard label="Execution Rate" value={`${execRate}%`} hint="Signal SOP adherence" icon={<TrendingUp className="h-5 w-5" />} accent="success" trend={3} />
        <StatCard label="Followed" value={followed} hint="Compliant entries" icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Missed" value={missed} hint="No entry taken" icon={<XCircle className="h-5 w-5" />} accent="destructive" trend={-2} />
        <StatCard label="Wrong Direction" value={wrong} hint="SOP violation" icon={<AlertTriangle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Late Entries" value={lateSig} hint="Past max entry time" icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="MT5 Bridge" value={mt5Total > 0 ? (mt5Connected > 0 ? "Live" : "Idle") : "Offline"} hint={mt5BridgeHint} icon={<HardDriveDownload className="h-5 w-5" />} accent={mt5Connected > 0 ? "success" : "warning"} />
        <StatCard label="TradingView" value="Streaming" hint="Webhook active" icon={<LineChartIcon className="h-5 w-5" />} accent="info" />
        <StatCard label="Compliance Score" value="94.6%" hint="Rolling 7-day" icon={<Sparkles className="h-5 w-5" />} accent="primary" trend={1} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Signal Execution vs Compliance</div>
              <div className="text-lg font-bold">14-day rolling trend</div>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Execution</Badge>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Compliance</Badge>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={executionTrend}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
              <Area type="monotone" dataKey="execution" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#grad1)" />
              <Area type="monotone" dataKey="compliance" stroke="var(--color-success)" strokeWidth={2.5} fill="url(#grad2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Session Breakdown</div>
            <div className="text-lg font-bold">Signal outcomes today</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sessionBreakdown} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {sessionBreakdown.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {sessionBreakdown.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.name}</span>
                </div>
                <span className="font-semibold tabular-nums">{s.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Signal Timeline</div>
              <div className="text-lg font-bold">Live TradingView webhook feed</div>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">View all <ArrowUpRight className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 font-semibold">Time</th>
                  <th className="pb-3 font-semibold">Pair</th>
                  <th className="pb-3 font-semibold">Dir</th>
                  <th className="pb-3 font-semibold">Fib</th>
                  <th className="pb-3 font-semibold">TP / SL</th>
                  <th className="pb-3 font-semibold">Max Entry</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {liveSignals.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 font-mono text-xs">{s.time}</td>
                    <td className="py-3 font-semibold">{s.pair}</td>
                    <td className="py-3">
                      <Badge className={s.direction === "BUY" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"} variant="outline">
                        {s.direction}
                      </Badge>
                    </td>
                    <td className="py-3 font-mono text-xs">{s.fibEntry}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">{s.takeProfit} / {s.stopLoss}</td>
                    <td className="py-3 font-mono text-xs">{s.maxEntryTime}</td>
                    <td className="py-3"><Badge variant="outline" className={statusTone[s.status]}>{s.status}</Badge></td>
                    <td className="py-3 text-right font-mono text-xs font-semibold">{s.executionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Attendance</div>
              <div className="text-lg font-bold">7-day trend</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="present" stackId="a" fill="var(--color-success)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="late" stackId="a" fill="var(--color-warning)" />
              <Bar dataKey="absent" stackId="a" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Separator className="my-4" />
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Trading Sessions</div>
            <div className="space-y-2">
              {tradingSessions.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{s.name}</span>
                  </div>
                  <Badge variant="outline" className={
                    s.color === "success" ? "bg-success/10 text-success border-success/20" :
                    s.color === "warning" ? "bg-warning/10 text-warning border-warning/20" :
                    s.color === "info" ? "bg-info/10 text-info border-info/20" :
                    "bg-muted text-muted-foreground border-border"
                  }>{s.state}</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Economic Calendar</div>
              <div className="text-lg font-bold">Today's high-impact events</div>
            </div>
          </div>
          <div className="space-y-2">
            {economicEvents.map((e) => (
              <div key={e.event} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className="text-center">
                  <div className="text-xs font-bold tabular-nums">{e.time}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{e.currency}</div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.event}</div>
                  <div className="text-[11px] text-muted-foreground">Forecast {e.forecast} · Prev {e.previous}</div>
                </div>
                <span className={`h-2 w-2 rounded-full ${e.impact === "high" ? "bg-destructive" : e.impact === "medium" ? "bg-warning" : "bg-muted-foreground"}`} />
              </div>
            ))}
          </div>
        </Card>


        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Notifications</div>
              <div className="text-lg font-bold">System alerts</div>
            </div>
            <Badge variant="secondary">{notifications.length} new</Badge>
          </div>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">No active notifications.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="flex gap-3 rounded-lg border border-border/60 p-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    n.level === "danger" ? "bg-destructive/10 text-destructive" :
                    n.level === "warning" ? "bg-warning/10 text-warning" :
                    n.level === "success" ? "bg-success/10 text-success" : "bg-info/10 text-info"
                  }`}>
                    {n.level === "danger" ? <AlertTriangle className="h-4 w-4" /> :
                     n.level === "success" ? <CheckCircle2 className="h-4 w-4" /> :
                     n.level === "warning" ? <Clock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-snug">{n.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
