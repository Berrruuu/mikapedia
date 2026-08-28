import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { Radio, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useWSEvent, useWSStatus } from "@/lib/ws-context";

export const Route = createFileRoute("/trader/signals")({
  component: TraderSignalsPage,
});

interface Signal {
  id: number;
  symbol: string;
  pair: string;
  direction: "BUY" | "SELL";
  timeframe: string;
  strategyName: string;
  time: string;
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
  sessionDate: string;
}

const STATUS_TONE: Record<string, string> = {
  Executed:          "bg-success/10 text-success border-success/20",
  Waiting:           "bg-info/10 text-info border-info/20",
  Pending:           "bg-muted text-muted-foreground border-border",
  Late:              "bg-warning/10 text-warning border-warning/20",
  "Wrong Direction": "bg-destructive/10 text-destructive border-destructive/20",
  Missed:            "bg-destructive/10 text-destructive border-destructive/20",
};

function TraderSignalsPage() {
  const [signals, setSignals]   = useState<Signal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const wsStatus                = useWSStatus();
  const prevCountRef            = useRef(0);

  const fetchSignals = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get<{ results?: Signal[]; count?: number } | Signal[]>(`/signals/?date=${date}`);
      const list = Array.isArray(data) ? data : (data as { results: Signal[] }).results ?? [];
      
      // Notify if new signals arrived
      if (silent && list.length > prevCountRef.current) {
        const newCount = list.length - prevCountRef.current;
        toast.info(`${newCount} sinyal baru masuk`, { icon: <Radio className="h-4 w-4" /> });
      }
      prevCountRef.current = list.length;
      setSignals(list);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void fetchSignals(); }, [date]);

  // WebSocket: replace polling with live push
  const handleSignalWS = useCallback((data: unknown) => {
    const sig = data as Signal;
    if (!sig?.id) return;
    const sigDate = sig.sessionDate ?? new Date().toISOString().slice(0, 10);
    if (sigDate !== date) return;
    setSignals((prev) => {
      const exists = prev.find((s) => s.id === sig.id);
      if (exists) return prev.map((s) => s.id === sig.id ? sig : s);
      prevCountRef.current += 1;
      toast.info(`📡 Sinyal baru: ${sig.pair} ${sig.direction}`);
      return [sig, ...prev];
    });
  }, [date]);

  useWSEvent("signal_update", handleSignalWS);

  const pending  = signals.filter((s) => s.status === "Pending" || s.status === "Waiting").length;
  const executed = signals.filter((s) => s.status === "Executed").length;
  const missed   = signals.filter((s) => s.status === "Missed" || s.status === "Wrong Direction").length;

  return (
    <>
      <PageHeader
        eyebrow="Trading Desk"
        title="Signal Timeline"
        description="Setiap sinyal TradingView yang diterbitkan hari ini beserta status eksekusimu."
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="h-9 w-40 text-sm" />
            <button
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${wsStatus === "connected" ? "border-success/60 bg-success/5 text-success" : "border-border/60 text-muted-foreground"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${wsStatus === "connected" ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
              {wsStatus === "connected" ? "Live" : wsStatus}
            </button>
            <Button variant="outline" size="sm" onClick={() => fetchSignals()}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1.5">
          <Radio className="h-3.5 w-3.5" />Total: {signals.length}
        </Badge>
        <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5 text-sm px-3 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />Executed: {executed}
        </Badge>
        <Badge variant="outline" className="bg-muted text-muted-foreground gap-1.5 text-sm px-3 py-1.5">
          <Clock className="h-3.5 w-3.5" />Pending: {pending}
        </Badge>
        {missed > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 text-sm px-3 py-1.5">
            <XCircle className="h-3.5 w-3.5" />Violation: {missed}
          </Badge>
        )}
      </div>

      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">Loading signals…</Card>
      ) : signals.length === 0 ? (
        <Card className="p-12 text-center">
          <Radio className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-30" />
          <div className="text-sm text-muted-foreground">Tidak ada sinyal untuk hari ini.</div>
          <div className="mt-2 text-xs text-muted-foreground">Signal akan muncul otomatis saat TradingView mengirim webhook.</div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden divide-y divide-border/60">
          {signals.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-muted/40 transition">
              {/* Time */}
              <div className="text-center min-w-[64px]">
                <div className="text-sm font-mono font-bold">{s.time}</div>
                <div className="text-[10px] text-muted-foreground">max {s.maxEntryTime}</div>
              </div>

              <Separator orientation="vertical" className="h-12" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold">{s.pair}</span>
                    <Badge variant="outline" className={s.direction === "BUY"
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"}>
                      {s.direction}
                    </Badge>
                    <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                      {s.timeframe}m
                    </Badge>
                  </div>
                  {/* 3 Entry prices */}
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    {s.fib_0236 && (
                      <span className="rounded bg-success/10 border border-success/20 px-1.5 py-0.5 text-[10px] font-mono text-success font-semibold">
                        E1 {s.fib_0236}
                      </span>
                    )}
                    {s.fib_0500 && (
                      <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary font-semibold">
                        E2 {s.fib_0500}
                      </span>
                    )}
                    {s.fib_0618 && (
                      <span className="rounded bg-warning/10 border border-warning/20 px-1.5 py-0.5 text-[10px] font-mono text-warning font-semibold">
                        E3 {s.fib_0618}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs font-mono text-muted-foreground">
                    <span className="text-success">TP {s.takeProfit}</span>
                    <span className="text-destructive">SL {s.stopLoss}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{s.strategyName} · #{s.id}</div>
                </div>

              {/* Status */}
              <Badge variant="outline" className={STATUS_TONE[s.status] ?? ""}>
                {s.status}
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {/* Pine Script example */}
      <Card className="mt-6 p-5 border-border/40">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Pine Script v6 — Alert Message Template
        </div>
        <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto bg-muted/30 p-3 rounded-lg leading-relaxed">{`{
  "secret": "mikapedia-tv-secret-2026",
  "symbol": "{{ticker}}",
  "pair": "XAUUSD",
  "direction": "{{strategy.order.action}}",
  "timeframe": "{{interval}}",
  "strategy": "Fibonacci Strategy v6",
  "fib_entry": 0.5,
  "take_profit": {{strategy.order.price}},
  "stop_loss": {{strategy.position_avg_price}},
  "fib_0236": 2394.2,
  "fib_0500": 2402.7,
  "fib_0618": 2408.4,
  "max_entry_minutes": 10,
  "expiry_minutes": 60
}`}</pre>
      </Card>
    </>
  );
}
