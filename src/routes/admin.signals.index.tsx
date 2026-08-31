import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import {
  Radio, ArrowUpRight, RefreshCw,
  Zap, Clock, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useWSEvent } from "@/lib/ws-context";

export const Route = createFileRoute("/admin/signals/")({
  component: SignalsPage,
});

interface Signal {
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
}

// ── Timing Bar Component ──────────────────────────────────────────────────────
function SignalTimingBar({ signal }: { signal: Signal }) {
  const now = new Date();
  const sessionDate = signal.sessionDate ?? new Date().toISOString().slice(0, 10);

  // Parse issued_at and maxEntryTime into full Date objects
  const issuedAt   = new Date(`${sessionDate}T${signal.time}:00`);
  const maxEntry   = new Date(`${sessionDate}T${signal.maxEntryTime}:00`);
  const expiresAt  = signal.expiresAt ? new Date(signal.expiresAt) : new Date(maxEntry.getTime() + 25 * 60000);

  const totalMs   = expiresAt.getTime() - issuedAt.getTime();
  const elapsed   = Math.min(Math.max(now.getTime() - issuedAt.getTime(), 0), totalMs);
  const pct       = totalMs > 0 ? (elapsed / totalMs) * 100 : 0;

  // Zone boundaries as percentages
  const maxEntryPct = totalMs > 0
    ? ((maxEntry.getTime() - issuedAt.getTime()) / totalMs) * 100
    : 40;

  const isExpired = now > expiresAt;
  const isPastMax = now > maxEntry;

  if (["Executed", "Wrong Direction", "Missed"].includes(signal.status)) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 font-mono">
        <span>{signal.time}</span>
        <span className={isPastMax ? "text-warning font-semibold" : "text-muted-foreground"}>
          Max {signal.maxEntryTime}
        </span>
        <span className={isExpired ? "text-destructive font-semibold" : "text-muted-foreground"}>
          {signal.expiresAt
            ? new Date(signal.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        {/* Zone: on-time (green) */}
        <div
          className="absolute left-0 top-0 h-full bg-success/30 rounded-full"
          style={{ width: `${maxEntryPct}%` }}
        />
        {/* Zone: late (orange) */}
        <div
          className="absolute top-0 h-full bg-warning/30"
          style={{ left: `${maxEntryPct}%`, width: `${100 - maxEntryPct}%` }}
        />
        {/* Progress indicator */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${
            isExpired ? "bg-destructive" : isPastMax ? "bg-warning" : "bg-success"
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* Max entry line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-warning/80"
          style={{ left: `${maxEntryPct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-center font-medium">
        {isExpired
          ? <span className="text-destructive">⏰ Window habis — sinyal kadaluarsa</span>
          : isPastMax
          ? <span className="text-warning">⚠️ Melewati batas entry — zone terlambat</span>
          : <span className="text-success">✅ Window entry masih terbuka</span>
        }
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  Executed:         "bg-success/10 text-success border-success/20",
  Waiting:          "bg-info/10 text-info border-info/20",
  Pending:          "bg-muted text-muted-foreground border-border",
  Late:             "bg-warning/10 text-warning border-warning/20",
  "Wrong Direction":"bg-destructive/10 text-destructive border-destructive/20",
  Missed:           "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Executed:          CheckCircle2,
  Waiting:           Clock,
  Pending:           Clock,
  Late:              AlertTriangle,
  "Wrong Direction": XCircle,
  Missed:            XCircle,
};

const ALL_STATUSES = ["Pending","Waiting","Executed","Late","Wrong Direction","Missed"];

function SignalsPage() {
  const [signals, setSignals]   = useState<Signal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [testModal, setTestModal] = useState(false);
  const [webhookUrl]            = useState(() => {
    if (typeof window === "undefined") return "https://mikapedia.online/api/signals/webhook/";
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const proto = window.location.protocol;
    const port = isLocal ? ":8000" : "";
    return `${proto}//${host}${port}/api/signals/webhook/`;
  });

  // Test webhook form
  const [twSymbol, setTwSymbol]     = useState("OANDA:XAUUSD");
  const [twPair, setTwPair]         = useState("XAUUSD");
  const [twDir, setTwDir]           = useState<"BUY"|"SELL">("BUY");
  const [twTf, setTwTf]             = useState("15");
  const [twFib, setTwFib]           = useState("0.5");
  const [twTp, setTwTp]             = useState("2412.4");
  const [twSl, setTwSl]             = useState("2394.2");
  const [twBusy, setTwBusy]         = useState(false);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ results?: Signal[]; count?: number } | Signal[]>(
        `/signals/?date=${date}${filter !== "all" ? `&status=${filter}` : ""}`
      );
      const list = Array.isArray(data) ? data : (data as { results: Signal[] }).results ?? [];
      setSignals(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchSignals(); }, [date, filter]);

  // WebSocket: live signal updates (no polling needed)
  const handleSignalWS = useCallback((data: unknown) => {
    const sig = data as Signal;
    if (!sig?.id) return;
    const sigDate = sig.sessionDate ?? new Date().toISOString().slice(0, 10);
    if (sigDate !== date) return;
    setSignals((prev) => {
      const exists = prev.find((s) => s.id === sig.id);
      if (exists) return prev.map((s) => s.id === sig.id ? sig : s);
      toast.info(`New signal: ${sig.pair} ${sig.direction}`, { icon: "📡" });
      return [sig, ...prev];
    });
  }, [date]);

  useWSEvent("signal_update", handleSignalWS);

  async function handleStatusUpdate(signal: Signal, newStatus: string) {
    try {
      const updated = await api.patch<Signal>(`/signals/${signal.id}/`, { status: newStatus });
      setSignals((prev) => prev.map((s) => s.id === signal.id ? updated : s));
      toast.success(`${signal.pair} → ${newStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleTestWebhook() {
    setTwBusy(true);
    try {
      const body = {
        secret: "mikapedia-tv-secret-2026",
        symbol: twSymbol, pair: twPair, direction: twDir,
        timeframe: twTf, strategy: "Fibonacci Strategy v6",
        fib_entry: parseFloat(twFib),
        take_profit: parseFloat(twTp),
        stop_loss: parseFloat(twSl),
        max_entry_minutes: 10, expiry_minutes: 60,
      };
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { pair: string; direction: string; signal_id: number };
      toast.success(`Signal created: ${data.pair} ${data.direction} (ID: ${data.signal_id})`);
      setTestModal(false);
      void fetchSignals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Webhook failed");
    } finally {
      setTwBusy(false);
    }
  }

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = signals.filter((x) => x.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <PageHeader
        eyebrow="Trading Operations"
        title="Signal Center"
        description="Setiap alert TradingView webhook yang diterima hari ini."
        actions={
          <div className="flex gap-2">
            <Input type="date" value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="h-9 w-40 text-sm" />
            <Button variant="outline" size="sm" onClick={fetchSignals} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTestModal(true)}>
              <Zap className="mr-1.5 h-3.5 w-3.5" />Test Webhook
            </Button>
          </div>
        }
      />

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${filter === "all" ? "border-primary/60 bg-primary/5 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
          All ({signals.length})
        </button>
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${filter === s ? "border-primary/60 bg-primary/5 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Webhook info */}
      <Card className="mb-4 p-4 border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3 flex-wrap">
          <Radio className="h-4 w-4 text-primary shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">TradingView Webhook URL: </span>
            <code className="font-mono text-xs bg-background/80 px-2 py-0.5 rounded border border-border/60">
              {webhookUrl}
            </code>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Secret: <code className="font-mono">mikapedia-tv-secret-2026</code>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading signals…</div>
      ) : signals.length === 0 ? (
        <Card className="p-12 text-center">
          <Radio className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-30" />
          <div className="text-sm text-muted-foreground">Tidak ada sinyal untuk filter ini.</div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setTestModal(true)}>
            <Zap className="mr-1.5 h-3.5 w-3.5" />Kirim Test Signal
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {signals.map((s) => {
            const Icon = STATUS_ICON[s.status] ?? Clock;
            return (
              <Card key={s.id} className="p-4 hover:shadow-elevated hover:-translate-y-0.5 transition-all">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{s.pair}</span>
                      <Badge variant="outline" className={s.direction === "BUY"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"}>
                        {s.direction}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-muted">{s.timeframe}m</Badge>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      #{s.id} · {s.time} · {s.symbol}
                    </div>
                  </div>
                  <Badge variant="outline" className={`gap-1 ${STATUS_TONE[s.status]}`}>
                    <Icon className="h-3 w-3" />{s.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div className="rounded-md bg-success/5 border border-success/20 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry 1 (0.236)</div>
                    <div className="font-mono font-semibold">{s.fib_0236 ?? "—"}</div>
                  </div>
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry 2 (0.500)</div>
                    <div className="font-mono font-semibold">{s.fib_0500 ?? "—"}</div>
                  </div>
                  <div className="rounded-md bg-warning/5 border border-warning/20 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry 3 (0.618)</div>
                    <div className="font-mono font-semibold">{s.fib_0618 ?? "—"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TP (-0.27)</div>
                    <div className="font-mono font-semibold text-success">{s.takeProfit}</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SL (0.786)</div>
                    <div className="font-mono font-semibold text-destructive">{s.stopLoss}</div>
                  </div>
                </div>

                {/* Timing bar */}
                <SignalTimingBar signal={s} />

                <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-3">
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Max entry: <span className="font-semibold text-foreground">{s.maxEntryTime}</span>
                    {s.expiresAt && (
                      <> · Expire: <span className="font-semibold text-foreground">
                        {new Date(s.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span></>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/signals/$id" params={{ id: String(s.id) }} className="gap-1 text-xs">
                      Detail <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Test Webhook Modal */}
      <Dialog open={testModal} onOpenChange={setTestModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test TradingView Webhook</DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-2 text-sm">
            <div className="rounded-lg bg-muted/30 p-3 text-xs font-mono">
              POST {webhookUrl}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Symbol</Label>
                <Input value={twSymbol} onChange={(e: ChangeEvent<HTMLInputElement>) => setTwSymbol(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Pair</Label>
                <Input value={twPair} onChange={(e: ChangeEvent<HTMLInputElement>) => setTwPair(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Direction</Label>
                <Select value={twDir} onValueChange={(v) => setTwDir(v as "BUY"|"SELL")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Timeframe</Label>
                <Select value={twTf} onValueChange={setTwTf}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1","5","15","60","240","D"].map((t) => <SelectItem key={t} value={t}>{t === "60" ? "1H" : t === "240" ? "4H" : t === "D" ? "1D" : `${t}m`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Fib Entry</Label>
                <Select value={twFib} onValueChange={setTwFib}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.236">0.236</SelectItem>
                    <SelectItem value="0.5">0.500</SelectItem>
                    <SelectItem value="0.618">0.618</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Take Profit</Label>
                <Input value={twTp} onChange={(e: ChangeEvent<HTMLInputElement>) => setTwTp(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Stop Loss</Label>
                <Input value={twSl} onChange={(e: ChangeEvent<HTMLInputElement>) => setTwSl(e.target.value)} />
              </div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-[11px] text-muted-foreground">
              Pine Script alert body harus berformat JSON dengan field di atas + secret.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestModal(false)}>Batal</Button>
            <Button className="gradient-primary text-primary-foreground" disabled={twBusy} onClick={handleTestWebhook}>
              <Zap className="mr-1.5 h-3.5 w-3.5" />{twBusy ? "Sending…" : "Kirim Signal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
