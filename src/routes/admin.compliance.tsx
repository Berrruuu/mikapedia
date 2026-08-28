import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, ShieldCheck, XCircle,
  Filter, Bell, TrendingDown, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { complianceApi, api, type ComplianceRecord } from "@/lib/api";

export const Route = createFileRoute("/admin/compliance")({
  component: CompliancePage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface SOPWarning {
  id: number;
  violation_type: string;
  severity: 'warning' | 'danger';
  message: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
  user: { id: string; name: string; email: string };
}

const VIOLATION_LABELS: Record<string, string> = {
  missed_signal:      'Signal Dilewati',
  incomplete_entries: 'Entry Kurang dari 3',
  wrong_order_type:   'Pakai Market Order (harus Limit)',
  wrong_direction:    'Arah Salah',
  late_entry:         'Entry Terlambat',
  no_stop_loss:       'Tidak Ada SL',
  no_take_profit:     'Tidak Ada TP',
  wrong_stop_loss:    'SL Tidak Sesuai Level',
  wrong_lot_size:     'Lot Size Salah',
  entry_out_of_zone:  'Entry di Luar Zona',
  multiple:           'Beberapa Pelanggaran',
};

const statusTone: Record<string, string> = {
  Compliant:         "bg-success/10 text-success border-success/20",
  "Late Entry":      "bg-warning/10 text-warning border-warning/20",
  "Wrong Direction": "bg-destructive/10 text-destructive border-destructive/20",
  Missed:            "bg-destructive/10 text-destructive border-destructive/20",
  Partial:           "bg-info/10 text-info border-info/20",
};

const statusIcon = {
  Compliant:         CheckCircle2,
  "Late Entry":      Clock,
  "Wrong Direction": XCircle,
  Missed:            XCircle,
  Partial:           AlertTriangle,
};

const violationColor: Record<string, string> = {
  missed_signal:      "bg-destructive/10 text-destructive border-destructive/20",
  incomplete_entries: "bg-destructive/10 text-destructive border-destructive/20",
  wrong_order_type:   "bg-orange-500/10 text-orange-600 border-orange-500/20",
  wrong_direction:    "bg-destructive/10 text-destructive border-destructive/20",
  late_entry:         "bg-warning/10 text-warning border-warning/20",
  no_stop_loss:       "bg-orange-500/10 text-orange-600 border-orange-500/20",
  no_take_profit:     "bg-orange-500/10 text-orange-600 border-orange-500/20",
  wrong_stop_loss:    "bg-warning/10 text-warning border-warning/20",
  wrong_lot_size:     "bg-warning/10 text-warning border-warning/20",
  entry_out_of_zone:  "bg-info/10 text-info border-info/20",
  multiple:           "bg-destructive/10 text-destructive border-destructive/20",
};

// ── Component ─────────────────────────────────────────────────────────────────
function CompliancePage() {
  const [records, setRecords]   = useState<ComplianceRecord[]>([]);
  const [warnings, setWarnings] = useState<SOPWarning[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("records");
  const [filterTrader, setFilterTrader] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const [compData, warnData] = await Promise.all([
        complianceApi.list(),
        api.get<{ results?: SOPWarning[] } | SOPWarning[]>('/compliance/warnings/').catch(() => []),
      ]);
      const recs  = Array.isArray(compData) ? compData : compData?.results ?? [];
      const warns = Array.isArray(warnData) ? warnData : (warnData as { results: SOPWarning[] })?.results ?? [];
      setRecords(recs);
      setWarnings(warns);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data compliance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const traders = useMemo(
    () => Array.from(new Map(records.map((r) => [r.user.id, r.user])).values()),
    [records],
  );

  const filteredRecords = useMemo(
    () => records.filter((r) => {
      if (filterTrader !== "all" && String(r.user.id) !== filterTrader) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    }),
    [records, filterTrader, filterStatus],
  );

  const totalCompliant = records.filter((r) => r.status === "Compliant").length;
  const totalLate      = records.filter((r) => r.status === "Late Entry").length;
  const totalWrong     = records.filter((r) => r.status === "Wrong Direction").length;
  const totalMissed    = records.filter((r) => r.status === "Missed").length;
  const overallRate    = records.length ? Math.round((totalCompliant / records.length) * 100) : 0;
  const unackWarnings  = warnings.filter((w) => !w.acknowledged).length;
  const dangerWarnings = warnings.filter((w) => w.severity === 'danger').length;

  async function acknowledgeWarning(id: number) {
    try {
      await api.patch(`/compliance/warnings/${id}/`, { acknowledged: true });
      setWarnings((prev) => prev.map((w) => w.id === id ? { ...w, acknowledged: true } : w));
      toast.success("Peringatan ditandai sudah ditangani");
    } catch {
      toast.error("Gagal update peringatan");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Core Engine"
        title="Compliance & SOP Monitor"
        description="Deteksi otomatis pelanggaran SOP — missed signal, no SL/TP, lot salah, dan lainnya."
        actions={
          <div className="flex items-center gap-2">
            {unackWarnings > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5">
                <Bell className="h-3 w-3" />{unackWarnings} peringatan belum ditangani
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-6 mb-4">
        <StatCard label="Overall Rate" value={`${overallRate}%`} hint="Compliance" icon={<ShieldCheck className="h-5 w-5" />} accent="primary" />
        <StatCard label="Compliant"    value={totalCompliant}  hint="records" icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Late Entry"   value={totalLate}       hint="records" icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="Wrong Dir"    value={totalWrong}      hint="records" icon={<XCircle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Missed"       value={totalMissed}     hint="records" icon={<AlertTriangle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Peringatan"   value={dangerWarnings}  hint="danger" icon={<TrendingDown className="h-5 w-5" />} accent="destructive" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="records">Compliance Records</TabsTrigger>
          <TabsTrigger value="warnings" className="relative">
            SOP Warnings
            {unackWarnings > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                {unackWarnings}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Compliance Records ─────────────────────────────────── */}
        <TabsContent value="records">
          <Card className="p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterTrader} onValueChange={setFilterTrader}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Trader</SelectItem>
                  {traders.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {["Compliant","Partial","Late Entry","Wrong Direction","Missed"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto text-xs text-muted-foreground">{filteredRecords.length} record</div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="p-4 font-semibold">Trader</th>
                    <th className="p-4 font-semibold">Signal</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Score</th>
                    <th className="p-4 font-semibold">Pelanggaran</th>
                    <th className="p-4 font-semibold">Catatan Coaching</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Loading…</td></tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Tidak ada record.</td></tr>
                  ) : filteredRecords.map((record) => {
                    const Icon = statusIcon[record.status as keyof typeof statusIcon] ?? AlertTriangle;
                    const violations = (record as ComplianceRecord & { violations?: string[] }).violations ?? [];
                    return (
                      <tr key={record.id} className="hover:bg-muted/40">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
                                {record.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{record.user.name}</div>
                              <div className="text-[11px] text-muted-foreground">{record.user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{record.signal.pair}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {record.signal.direction} · {record.signal.timeframe}m
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={`gap-1 ${statusTone[record.status] ?? "bg-muted"}`}>
                            <Icon className="h-3 w-3" />{record.status}
                          </Badge>
                        </td>
                        <td className="p-4 w-32">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={record.score}
                              className="h-1.5 flex-1"
                            />
                            <span className={`text-xs font-mono font-bold w-8 text-right ${
                              record.score >= 80 ? "text-success" :
                              record.score >= 50 ? "text-warning" : "text-destructive"
                            }`}>{record.score}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {/* 3-position progress */}
                          {(() => {
                            const ec = (record as ComplianceRecord & { entryCount?: number }).entryCount ?? 0;
                            return (
                              <div className="flex items-center gap-1.5 mb-1">
                                {[1,2,3].map((n) => (
                                  <div key={n} className={`h-2 w-6 rounded-full ${
                                    n <= ec ? "bg-success" : "bg-muted"
                                  }`} title={`Entry ${n} (Fib ${n===1?"0.236":n===2?"0.500":"0.618"})`} />
                                ))}
                                <span className={`text-[10px] font-mono font-bold ml-1 ${
                                  ec === 3 ? "text-success" : ec > 0 ? "text-warning" : "text-destructive"
                                }`}>{ec}/3</span>
                              </div>
                            );
                          })()}
                          <div className="flex flex-wrap gap-1">
                            {violations.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : violations.map((v) => (
                              <Badge key={v} variant="outline"
                                className={`text-[10px] ${violationColor[v] ?? "bg-muted"}`}>
                                {VIOLATION_LABELS[v] ?? v}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground max-w-[200px] truncate">
                          {record.coachingNote || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 2: SOP Warnings ───────────────────────────────────────── */}
        <TabsContent value="warnings">
          <div className="space-y-3">
            {loading ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">Loading peringatan…</Card>
            ) : warnings.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success opacity-60" />
                <div className="text-sm text-muted-foreground">Tidak ada peringatan SOP. Semua trader dalam kondisi baik.</div>
              </Card>
            ) : warnings.map((w) => (
              <Card key={w.id} className={`p-4 border-l-4 ${
                w.severity === 'danger' ? 'border-l-destructive' : 'border-l-warning'
              } ${w.acknowledged ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 rounded-full p-2 ${
                    w.severity === 'danger' ? 'bg-destructive/10' : 'bg-warning/10'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      w.severity === 'danger' ? 'text-destructive' : 'text-warning'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{w.user.name}</span>
                      <Badge variant="outline" className={
                        w.severity === 'danger'
                          ? 'bg-destructive/10 text-destructive border-destructive/20 text-[10px]'
                          : 'bg-warning/10 text-warning border-warning/20 text-[10px]'
                      }>
                        {w.severity === 'danger' ? '🔴 DANGER' : '⚠️ WARNING'}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${violationColor[w.violation_type] ?? 'bg-muted'}`}>
                        {VIOLATION_LABELS[w.violation_type] ?? w.violation_type}
                      </Badge>
                      {w.acknowledged && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">
                          ✓ Ditangani
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{w.message}</p>
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                      {new Date(w.created_at).toLocaleString('id-ID')} · {w.user.email}
                    </div>
                  </div>
                  {!w.acknowledged && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => acknowledgeWarning(w.id)}
                      className="shrink-0 text-xs"
                    >
                      Tandai Ditangani
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
