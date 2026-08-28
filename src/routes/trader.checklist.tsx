import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, Shield, AlertTriangle,
  Clock, RefreshCw, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/trader/checklist")({
  component: ChecklistPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface ComplianceRecord {
  id: number;
  status: string;
  score: number;
  actualDirection: string | null;
  actualEntry: number | null;
  actualEntryTime: string | null;
  coachingNote: string;
  violations: string[];
  created_at: string;
  signal: {
    id: number;
    pair: string;
    direction: string;
    timeframe: string;
    time: string;
    takeProfit: number;
    stopLoss: number;
    fib_0236: number | null;
    fib_0500: number | null;
    fib_0618: number | null;
  };
}

const VIOLATION_LABELS: Record<string, string> = {
  missed_signal:      "Signal Dilewati",
  incomplete_entries: "Entry Kurang dari 3",
  wrong_order_type:   "Pakai Market Order (harus Limit)",
  wrong_direction:    "Arah Salah",
  late_entry:         "Entry Terlambat",
  no_stop_loss:       "Tidak Ada Stop Loss",
  no_take_profit:     "Tidak Ada Take Profit",
  wrong_stop_loss:    "Stop Loss Tidak Sesuai Level",
  wrong_lot_size:     "Lot Size Tidak Sesuai",
  entry_out_of_zone:  "Entry di Luar Zona Fib",
};

const STATUS_TONE: Record<string, string> = {
  Compliant:         "bg-success/10 text-success border-success/20",
  "Late Entry":      "bg-warning/10 text-warning border-warning/20",
  "Wrong Direction": "bg-destructive/10 text-destructive border-destructive/20",
  Missed:            "bg-destructive/10 text-destructive border-destructive/20",
  Partial:           "bg-info/10 text-info border-info/20",
  Pending:           "bg-muted text-muted-foreground border-border",
};

// SOP items derived from compliance records
function buildChecklistItems(records: ComplianceRecord[]) {
  if (records.length === 0) return [];

  const total = records.length;
  const compliant    = records.filter(r => r.status === "Compliant").length;
  const executed     = records.filter(r => !["Missed", "Pending"].includes(r.status)).length;
  const lateEntries  = records.filter(r => r.violations.includes("late_entry")).length;
  const noSL         = records.filter(r => r.violations.includes("no_stop_loss")).length;
  const noTP         = records.filter(r => r.violations.includes("no_take_profit")).length;
  const wrongDir     = records.filter(r => r.violations.includes("wrong_direction")).length;
  const wrongLot     = records.filter(r => r.violations.includes("wrong_lot_size")).length;
  const missedCount  = records.filter(r => r.status === "Missed").length;
  const outOfZone    = records.filter(r => r.violations.includes("entry_out_of_zone")).length;
  const incompleteEntries = records.filter(r => r.violations.includes("incomplete_entries")).length;
  const wrongOrderType   = records.filter(r => r.violations.includes("wrong_order_type")).length;
  // Average entry count across all records
  const avgEntries   = records.length > 0
    ? (records.reduce((sum, r) => sum + ((r as ComplianceRecord & { entryCount?: number }).entryCount ?? 0), 0) / records.length).toFixed(1)
    : "0";

  return [
    {
      label: "3 Entry per Signal (0.236 / 0.500 / 0.618)",
      ok: incompleteEntries === 0 && missedCount === 0,
      detail: incompleteEntries === 0 && missedCount === 0
        ? `Semua ${executed} signal dieksekusi dengan 3 posisi lengkap.`
        : `${incompleteEntries} signal dengan entry tidak lengkap. Rata-rata: ${avgEntries}/3 posisi.`,
    },
    {
      label: "Metode Order: Buy/Sell Limit",
      ok: wrongOrderType === 0,
      detail: wrongOrderType === 0
        ? "Semua entry menggunakan Limit Order sesuai SOP."
        : `${wrongOrderType} signal menggunakan Market Order — SOP mengharuskan Buy/Sell Limit.`,
    },
    {
      label: "Trade Direction",
      ok: wrongDir === 0,
      detail: wrongDir === 0
        ? `Semua ${executed} entry mengikuti arah signal TradingView.`
        : `${wrongDir} trade berlawanan arah dengan signal.`,
    },
    {
      label: "Fibonacci Entry Level",
      ok: outOfZone === 0,
      detail: outOfZone === 0
        ? "Semua entry masuk dalam zona Fib 0.236 / 0.500 / 0.618."
        : `${outOfZone} entry di luar zona Fibonacci.`,
    },
    {
      label: "Take Profit (-0.27)",
      ok: noTP === 0,
      detail: noTP === 0
        ? "Semua posisi terbuka dengan Take Profit terpasang."
        : `${noTP} posisi tidak memasang Take Profit — melanggar SOP.`,
    },
    {
      label: "Stop Loss (0.786)",
      ok: noSL === 0,
      detail: noSL === 0
        ? "Semua posisi terlindungi dengan Stop Loss."
        : `${noSL} posisi tidak memasang Stop Loss — risiko tidak terkelola.`,
    },
    {
      label: "Lot Size",
      ok: wrongLot === 0,
      detail: wrongLot === 0
        ? "Semua lot size sesuai batas profil trader."
        : `${wrongLot} trade dengan lot size melebihi batas.`,
    },
    {
      label: "Timing Entry (max 5 menit)",
      ok: lateEntries === 0,
      detail: lateEntries === 0
        ? `Semua entry dalam ${total > 0 ? `${total}` : "0"} signal tepat waktu.`
        : `${lateEntries} entry terlambat melewati batas waktu signal.`,
    },
    {
      label: "Signal Execution Rate",
      ok: missedCount === 0,
      detail: missedCount === 0
        ? `Semua ${total} signal hari ini dieksekusi.`
        : `${missedCount} dari ${total} signal tidak dieksekusi (Missed).`,
    },
    {
      label: "Overall Compliance",
      ok: compliant === total && total > 0,
      detail: total === 0
        ? "Belum ada signal hari ini."
        : `${compliant} dari ${total} signal sepenuhnya compliant.`,
    },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────
function ChecklistPage() {
  const { user } = useAuth();
  const [records, setRecords]   = useState<ComplianceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ results?: ComplianceRecord[] } | ComplianceRecord[]>(
        `/compliance/?ordering=-created_at`
      );
      const list = Array.isArray(data) ? data : data?.results ?? [];
      // Filter to today's records based on signal date if possible
      setRecords(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data checklist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [date]);

  const items = buildChecklistItems(records);
  const okCount = items.filter(i => i.ok).length;
  const score   = items.length > 0 ? Math.round((okCount / items.length) * 100) : 0;

  const avgScore = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length)
    : 0;

  const recentViolations = records.filter(r =>
    r.violations.length > 0 && r.status !== "Compliant"
  ).slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Trading Desk"
        title="Execution Checklist"
        description="Validasi SOP real-time untuk setiap trade yang kamu lakukan hari ini."
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-40 text-sm"
            />
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Memuat data checklist…
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Checklist Items ─────────────────────────────────────────── */}
          <Card className="lg:col-span-2 p-6 divide-y divide-border/60">
            {records.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Shield className="mx-auto mb-3 h-8 w-8 opacity-30" />
                Belum ada data compliance untuk hari ini.
                <div className="mt-1 text-xs">Data akan muncul otomatis setelah signal dieksekusi.</div>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.label} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  {item.ok
                    ? <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                    : <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                  }
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        item.ok
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}>
                        {item.ok ? "PASS" : "FAIL"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
                  </div>
                </div>
              ))
            )}
          </Card>

          {/* ── Score Card ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            <Card className="p-6 gradient-hero text-white">
              <Shield className="h-6 w-6" />
              <div className="mt-4 text-[11px] uppercase tracking-widest text-white/70">
                SOP Checklist Score
              </div>
              <div className="text-6xl font-bold">{score}</div>
              <div className="text-sm text-white/80">dari 100 poin SOP</div>
              <Progress value={score} className="mt-4 h-1.5 bg-white/20" />
              <Separator className="my-4 bg-white/10" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">Avg compliance score</span>
                <span className="font-bold">{avgScore}/100</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-white/70">Total signal hari ini</span>
                <span className="font-bold">{records.length}</span>
              </div>
              <Separator className="my-4 bg-white/10" />
              <div className="text-xs text-white/70">
                {score >= 80
                  ? "✅ Performa baik. Pertahankan konsistensi."
                  : score >= 50
                  ? "⚠️ Ada beberapa pelanggaran SOP hari ini."
                  : "🔴 Banyak pelanggaran SOP. Perlu evaluasi segera."}
              </div>
            </Card>

            {/* Recent violations */}
            {recentViolations.length > 0 && (
              <Card className="p-5">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Pelanggaran Terbaru
                </div>
                <div className="space-y-3">
                  {recentViolations.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold">{r.signal.pair}</span>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[r.status] ?? ""}`}>
                          {r.status}
                        </Badge>
                        <span className="ml-auto text-xs font-mono text-muted-foreground">
                          {r.score}/100
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {r.violations.map((v) => (
                          <Badge key={v} variant="outline"
                            className="text-[10px] bg-destructive/5 text-destructive border-destructive/20">
                            {VIOLATION_LABELS[v] ?? v}
                          </Badge>
                        ))}
                      </div>
                      {r.coachingNote && (
                        <div className="text-[10px] text-muted-foreground">{r.coachingNote}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Full compliance history */}
      {records.length > 0 && (
        <Card className="mt-4 p-0 overflow-hidden">
          <div className="p-4 border-b border-border/60">
            <div className="text-sm font-semibold">Riwayat Compliance Hari Ini</div>
            <div className="text-xs text-muted-foreground">{records.length} record</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-3 font-semibold">Signal</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Score</th>
                  <th className="p-3 font-semibold">Pelanggaran</th>
                  <th className="p-3 font-semibold">Entry</th>
                  <th className="p-3 font-semibold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium text-xs">{r.signal.pair}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {r.signal.direction} · {r.signal.timeframe}m · {r.signal.time}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-[10px] gap-1 ${STATUS_TONE[r.status] ?? ""}`}>
                        {r.status === "Compliant"
                          ? <CheckCircle2 className="h-3 w-3" />
                          : r.status === "Missed"
                          ? <XCircle className="h-3 w-3" />
                          : <AlertTriangle className="h-3 w-3" />
                        }
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Progress value={r.score} className="h-1.5 w-16" />
                        <span className={`text-xs font-mono font-bold ${
                          r.score >= 80 ? "text-success"
                          : r.score >= 50 ? "text-warning"
                          : "text-destructive"
                        }`}>{r.score}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {r.violations.length === 0
                          ? <span className="text-xs text-success">✓ Tidak ada</span>
                          : r.violations.map((v) => (
                              <Badge key={v} variant="outline"
                                className="text-[10px] bg-destructive/5 text-destructive border-destructive/20">
                                {VIOLATION_LABELS[v] ?? v}
                              </Badge>
                            ))
                        }
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {r.actualEntry ?? "—"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[160px] truncate">
                      {r.coachingNote || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
