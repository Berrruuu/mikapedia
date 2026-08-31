import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ScrollText, Search, Download, Filter } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { auditApi, type AuditLogEntry } from "@/lib/api";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

type Severity = "info" | "warning" | "high" | "critical";

interface LogEntry {
  time: string;
  actor: string;
  action: string;
  ip: string;
  severity: Severity;
  category: string;
}

const MOCK_LOGS: LogEntry[] = [
  { time: "13:42:11", actor: "Rania Pratama", action: "Updated Fib entry rule (0.5 → 0.5, tolerance 0.008)", ip: "10.24.8.2", severity: "high", category: "settings" },
  { time: "13:36:04", actor: "system", action: "TradingView webhook received signal #s8 XAUUSD BUY", ip: "webhook", severity: "info", category: "signal" },
  { time: "13:28:22", actor: "Arif Wibowo", action: "Signed in from 10.24.8.20 (macOS Safari)", ip: "10.24.8.20", severity: "info", category: "auth" },
  { time: "13:14:59", actor: "system", action: "MT5 bridge reconnected — account MT5-7724095", ip: "bridge", severity: "warning", category: "system" },
  { time: "12:58:03", actor: "Rania Pratama", action: "Exported end-of-session report (PDF)", ip: "10.24.8.2", severity: "info", category: "report" },
  { time: "12:41:47", actor: "system", action: "Compliance engine flagged wrong direction — Rendra Prakoso · BTCUSD", ip: "engine", severity: "critical", category: "compliance" },
  { time: "12:30:05", actor: "Handoko Wijaya", action: "Invited new user nadia@mikapedia.com (role: trader)", ip: "10.24.8.4", severity: "high", category: "auth" },
  { time: "12:18:44", actor: "system", action: "Attendance GPS validation failed — Bagus Setiawan (dist: 340m)", ip: "gps", severity: "warning", category: "attendance" },
  { time: "11:55:09", actor: "Rania Pratama", action: "Updated SOP: max lot size 0.50 → 0.30", ip: "10.24.8.2", severity: "high", category: "settings" },
  { time: "11:32:17", actor: "system", action: "Signal #s6 BTCUSD SELL — 2 wrong direction executions detected", ip: "engine", severity: "critical", category: "compliance" },
  { time: "11:10:00", actor: "system", action: "Session snapshot saved to archive", ip: "scheduler", severity: "info", category: "system" },
  { time: "10:47:38", actor: "Melati Rahayu", action: "Check-in selfie verified — GPS OK (42m from office)", ip: "10.24.8.12", severity: "info", category: "attendance" },
  { time: "09:15:02", actor: "Rendra Prakoso", action: "Failed login attempt (wrong password)", ip: "10.24.9.7", severity: "warning", category: "auth" },
  { time: "09:00:01", actor: "system", action: "Trading Session 1 opened — 8 accounts eligible", ip: "scheduler", severity: "info", category: "system" },
  { time: "08:58:44", actor: "system", action: "Daily SOP rules loaded from configuration", ip: "scheduler", severity: "info", category: "settings" },
];

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  high: "bg-primary/10 text-primary border-primary/20",
  info: "bg-muted text-muted-foreground",
};

const CATEGORIES = ["all", "auth", "signal", "compliance", "attendance", "settings", "report", "system"];

function AuditPage() {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);

  useEffect(() => {
    let active = true;
    async function loadAuditLogs() {
      try {
        const params: { severity?: string; category?: string; search?: string } = {};
        if (severity !== "all") params.severity = severity;
        if (category !== "all") params.category = category;
        if (search) params.search = search;
        
        const data = await auditApi.list(params);
        if (active && Array.isArray(data) && data.length > 0) {
          const mapped: LogEntry[] = data.map((item) => ({
            time: item.time || new Date(item.created_at).toLocaleTimeString("en-GB"),
            actor: item.actorLabel || "system",
            action: item.action,
            ip: item.ipAddress || "-",
            severity: item.severity || "info",
            category: item.category || "system",
          }));
          setLogs(mapped);
        }
      } catch (err) {
        // Fallback to MOCK_LOGS if offline or endpoint empty
      }
    }
    loadAuditLogs();
    return () => { active = false; };
  }, [search, severity, category]);

  const filtered = logs.filter((l) => {
    const matchSearch = !search || l.actor.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severity === "all" || l.severity === severity;
    const matchCategory = category === "all" || l.category === category;
    return matchSearch && matchSeverity && matchCategory;
  });

  const exportCSV = () => {
    const headers = ["Waktu", "Actor", "Aksi", "Kategori", "IP", "Severity"];
    const rows = filtered.map((l) => [l.time, l.actor, `"${l.action.replace(/"/g, '""')}"`, l.category, l.ip, l.severity]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Audit Logs"
        description="Rekaman permanen setiap aksi operasional dan event sistem."
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
          </Button>
        }
      />

      {/* Summary badges */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["critical", "warning", "high", "info"] as Severity[]).map((s) => {
          const count = logs.filter((l) => l.severity === s).length;
          return (
            <button key={s} onClick={() => setSeverity(severity === s ? "all" : s)}>
              <Badge variant="outline" className={`gap-1.5 cursor-pointer ${severity === s ? SEVERITY_TONE[s] : ""}`}>
                {count} {s}
              </Badge>
            </button>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari actor atau aksi..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c === "all" ? "Semua Kategori" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} entri</span>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="p-4 font-semibold">Waktu</th>
              <th className="p-4 font-semibold">Actor</th>
              <th className="p-4 font-semibold">Aksi</th>
              <th className="p-4 font-semibold">Kategori</th>
              <th className="p-4 font-semibold">IP</th>
              <th className="p-4 font-semibold">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Tidak ada log yang cocok.</td></tr>
            ) : filtered.map((l, i) => (
              <tr key={i} className="hover:bg-muted/40 font-mono text-xs">
                <td className="p-4 text-muted-foreground">{l.time}</td>
                <td className="p-4 font-sans font-medium">{l.actor}</td>
                <td className="p-4 font-sans max-w-sm">{l.action}</td>
                <td className="p-4 font-sans">
                  <Badge variant="outline" className="capitalize">{l.category}</Badge>
                </td>
                <td className="p-4 text-muted-foreground">{l.ip}</td>
                <td className="p-4">
                  <Badge variant="outline" className={SEVERITY_TONE[l.severity]}>{l.severity}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

