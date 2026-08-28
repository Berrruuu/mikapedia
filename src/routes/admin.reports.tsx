import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import {
  Download, FileBarChart, FileText, Calendar, TrendingUp,
  CheckCircle2, XCircle, Clock, ShieldCheck, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, API_BASE } from "@/lib/auth";
import { reportsApi, type AttendanceReport, type ComplianceReport, type ExecutionReport, type LeaderboardEntry, type SessionReport } from "@/lib/api";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

type ReportTab = "execution" | "attendance" | "compliance" | "leaderboard" | "session";
type ReportPeriod = "daily" | "weekly" | "monthly";
type ReportFormat = "pdf" | "xlsx";

const REPORT_TYPES = [
  { id: "execution", label: "Execution Report", icon: FileBarChart, description: "Signal outcomes and execution rate by period." },
  { id: "attendance", label: "Attendance Report", icon: Calendar, description: "Check-in status and attendance rate across traders." },
  { id: "compliance", label: "Compliance Report", icon: ShieldCheck, description: "Execution, timing, entry and compliance metrics." },
  { id: "leaderboard", label: "Leaderboard", icon: TrendingUp, description: "Ranked by SOP discipline, not profit." },
  { id: "session", label: "End-of-Session Report", icon: FileText, description: "Combined session summary for the selected date." },
] as const;

function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("execution");
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [execution, setExecution] = useState<ExecutionReport | null>(null);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [session, setSession] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [executionData, attendanceData, complianceData, leaderboardData, sessionData] = await Promise.all([
        reportsApi.execution(period, reportDate),
        reportsApi.attendance(period, reportDate),
        reportsApi.compliance(period, reportDate),
        reportsApi.leaderboard(period, reportDate),
        reportsApi.session(reportDate),
      ]);
      setExecution(executionData);
      setAttendance(attendanceData);
      setCompliance(complianceData);
      setLeaderboard(leaderboardData);
      setSession(sessionData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [period, reportDate]);

  const handleExport = async (report: ReportTab, format: ReportFormat) => {
    try {
      const query = new URLSearchParams({ format, ...(report !== "session" ? { period } : {}) });
      if (reportDate) query.set("date", reportDate);
      const response = await apiFetch(`/reports/export/${report}/?${query.toString()}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${report}_${period}.${format === "pdf" ? "pdf" : "xlsx"}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${report} exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export report.");
    }
  };

  const pairChartData = Object.entries(execution?.byPair ?? {}).map(([pair, values]) => ({
    pair,
    executed: values.executed,
    missed: values.missed,
    late: values.late,
  }));

  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Reports Center"
        description={`${periodLabel} reporting for execution, attendance, compliance, leaderboard, and end-of-session summaries.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={reportDate} onChange={(event: ChangeEvent<HTMLInputElement>) => setReportDate(event.target.value)} className="h-9 w-40 text-sm" />
            <Button variant="outline" size="sm" onClick={() => void loadReports()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => void handleExport(activeTab, "pdf")}>
              <Download className="mr-1.5 h-3.5 w-3.5" />Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleExport(activeTab, "xlsx")}>
              <Download className="mr-1.5 h-3.5 w-3.5" />Export Excel
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 mb-6">
        {REPORT_TYPES.map((report) => {
          const Icon = report.icon;
          return (
            <button
              key={report.id}
              onClick={() => setActiveTab(report.id as ReportTab)}
              className={`text-left rounded-xl border p-4 transition hover:border-primary/40 ${
                activeTab === report.id ? "border-primary/60 bg-primary/5" : "border-border/60"
              }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg mb-3 ${
                activeTab === report.id ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="font-semibold text-sm">{report.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{report.description}</div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading reports…</Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)}>
          <TabsContent value="execution">
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              {[
                { label: "Total Signals", value: execution?.totalSignals ?? 0, tone: "primary", icon: FileBarChart },
                { label: "Executed", value: execution?.executed ?? 0, tone: "success", icon: CheckCircle2 },
                { label: "Missed", value: execution?.missed ?? 0, tone: "destructive", icon: XCircle },
                { label: "Execution Rate", value: `${execution?.executionRate ?? 0}%`, tone: "primary", icon: TrendingUp },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="p-4 flex items-center gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      item.tone === "success" ? "bg-success/10 text-success" : item.tone === "destructive" ? "bg-destructive/10 text-destructive" : "gradient-primary text-primary-foreground"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                      <div className="text-2xl font-bold">{item.value}</div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <div className="mb-4 font-semibold text-sm">Execution by Pair</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pairChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="pair" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="executed" fill="var(--color-success)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="missed" fill="var(--color-destructive)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="late" fill="var(--color-warning)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-5">
                <div className="mb-4 font-semibold text-sm">Signal Log</div>
                <div className="space-y-3">
                  {(execution?.signals ?? []).slice(0, 6).map((signal) => (
                    <div key={signal.id as string | number} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm">{String(signal.pair)}</div>
                        <Badge variant="outline" className={String(signal.status) === "Executed" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}>{String(signal.status)}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{String(signal.direction)} · {String(signal.strategy_name)} · {String(signal.timeframe)} · {String(signal.execution_rate)}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attendance">
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              {[
                { label: "Present", value: attendance?.present ?? 0, tone: "success", icon: CheckCircle2 },
                { label: "Late", value: attendance?.late ?? 0, tone: "warning", icon: Clock },
                { label: "Absent", value: attendance?.absent ?? 0, tone: "destructive", icon: XCircle },
                { label: "Attendance Rate", value: `${attendance?.attendanceRate ?? 0}%`, tone: "primary", icon: Calendar },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="p-4 flex items-center gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      item.tone === "success" ? "bg-success/10 text-success" : item.tone === "warning" ? "bg-warning/10 text-warning" : item.tone === "destructive" ? "bg-destructive/10 text-destructive" : "gradient-primary text-primary-foreground"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                      <div className="text-2xl font-bold">{item.value}</div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <Card className="p-0 overflow-hidden">
              <div className="border-b border-border/60 p-4 font-semibold text-sm">Attendance Log</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                      <th className="p-4 font-semibold">Trader</th>
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Session</th>
                      <th className="p-4 font-semibold">Covers</th>
                      <th className="p-4 font-semibold">Check-in</th>
                      <th className="p-4 font-semibold">Validated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(attendance?.records ?? []).slice(0, 10).map((record, index) => {
                      const name = `${String(record.user__first_name ?? "").trim()} ${String(record.user__last_name ?? "").trim()}`.trim() || "Unknown Trader";
                      return (
                        <tr key={`${record.id ?? index}`} className="hover:bg-muted/40">
                          <td className="p-4 font-medium">{name}</td>
                          <td className="p-4 font-mono text-xs">{String(record.date ?? "")}</td>
                          <td className="p-4"><Badge variant="outline" className={String(record.status) === "Present" ? "bg-success/10 text-success border-success/20" : String(record.status) === "Late" ? "bg-warning/10 text-warning border-warning/20" : "bg-destructive/10 text-destructive border-destructive/20"}>{String(record.status)}</Badge></td>
                          <td className="p-4"><span className="text-sm font-medium capitalize">{String(record.session_type ?? "original")}</span></td>
                          <td className="p-4 text-xs text-muted-foreground">{record.covers ? `${record.covers.name} · ${record.covers.email}` : "—"}</td>
                          <td className="p-4 font-mono text-xs">{String(record.check_in_time ?? "—")}</td>
                          <td className="p-4">{record.is_validated ? "Yes" : "No"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="compliance">
            <Card className="p-0 overflow-hidden">
              <div className="border-b border-border/60 p-4 flex items-center justify-between">
                <div className="font-semibold text-sm">Trader Compliance Breakdown</div>
                <Badge variant="outline">Ranked by SOP discipline</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                      <th className="p-4 font-semibold">Trader</th>
                      <th className="p-4 font-semibold">Execution</th>
                      <th className="p-4 font-semibold">Entry Accuracy</th>
                      <th className="p-4 font-semibold">Timing</th>
                      <th className="p-4 font-semibold">Compliance</th>
                      <th className="p-4 font-semibold text-right">Late Entries</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(compliance?.traders ?? []).map((trader, index) => (
                      <tr key={`${trader.id ?? index}`} className="hover:bg-muted/40">
                        <td className="p-4">
                          <div className="font-medium">{String(trader.name ?? "Unknown")}</div>
                          <div className="text-xs text-muted-foreground">{String(trader.accountNumber ?? "")}</div>
                        </td>
                        {["executionRate", "entryAccuracy", "timingAccuracy", "complianceScore"].map((metric, metricIndex) => (
                          <td key={`${String(trader.id ?? index)}-${metric}`} className="p-4 w-40">
                            <div className="flex items-center gap-2">
                              <Progress value={Number(trader[metric] ?? 0)} className="h-1.5 flex-1" />
                              <span className="w-8 text-right text-xs font-mono font-semibold">{Number(trader[metric] ?? 0)}%</span>
                            </div>
                          </td>
                        ))}
                        <td className="p-4 text-right font-mono font-semibold">{trader.lateEntries ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard">
            <Card className="p-0 overflow-hidden">
              <div className="border-b border-border/60 p-4 flex items-center justify-between">
                <div className="font-semibold text-sm">Discipline Leaderboard</div>
                <Badge variant="outline">Profit is excluded</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                      <th className="p-4 font-semibold">Rank</th>
                      <th className="p-4 font-semibold">Trader</th>
                      <th className="p-4 font-semibold">Exec Rate</th>
                      <th className="p-4 font-semibold">Compliance</th>
                      <th className="p-4 font-semibold">Entry Acc</th>
                      <th className="p-4 font-semibold">Timing Acc</th>
                      <th className="p-4 font-semibold">Late</th>
                      <th className="p-4 font-semibold">SOP Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {leaderboard.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/40">
                        <td className="p-4 font-semibold">#{entry.rank}</td>
                        <td className="p-4">
                          <div className="font-medium">{entry.name}</div>
                          <div className="text-xs text-muted-foreground">{entry.accountNumber || entry.email}</div>
                        </td>
                        <td className="p-4 font-mono">{entry.executionRate}%</td>
                        <td className="p-4 font-mono">{entry.complianceScore}%</td>
                        <td className="p-4 font-mono">{entry.entryAccuracy}%</td>
                        <td className="p-4 font-mono">{entry.timingAccuracy}%</td>
                        <td className="p-4 font-mono">{entry.lateEntries}</td>
                        <td className="p-4 font-mono font-semibold">{entry.sopScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="session">
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              {[
                { label: "Signals", value: session?.execution.totalSignals ?? 0, tone: "primary", icon: FileBarChart },
                { label: "Executed", value: session?.execution.executed ?? 0, tone: "success", icon: CheckCircle2 },
                { label: "Present", value: session?.attendance.present ?? 0, tone: "success", icon: Calendar },
                { label: "Attendance Rate", value: `${session?.attendance.attendanceRate ?? 0}%`, tone: "primary", icon: TrendingUp },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="p-4 flex items-center gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      item.tone === "success" ? "bg-success/10 text-success" : "gradient-primary text-primary-foreground"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                      <div className="text-2xl font-bold">{item.value}</div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <Card className="p-0 overflow-hidden">
              <div className="border-b border-border/60 p-4 font-semibold text-sm">Top 5 Discipline Leaders</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                      <th className="p-4 font-semibold">Rank</th>
                      <th className="p-4 font-semibold">Trader</th>
                      <th className="p-4 font-semibold">Exec Rate</th>
                      <th className="p-4 font-semibold">Compliance</th>
                      <th className="p-4 font-semibold">SOP Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(session?.leaderboard ?? []).map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/40">
                        <td className="p-4 font-semibold">#{entry.rank}</td>
                        <td className="p-4">{entry.name}</td>
                        <td className="p-4 font-mono">{entry.executionRate}%</td>
                        <td className="p-4 font-mono">{entry.complianceScore}%</td>
                        <td className="p-4 font-mono">{entry.sopScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
