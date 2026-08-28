import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { signalsApi, complianceApi, type ComplianceRecord, type Signal } from "@/lib/api";

export const Route = createFileRoute("/admin/signals/$id")({
  loader: async ({ params }) => {
    const signal = await signalsApi.getById(params.id!);
    if (!signal) throw notFound();

    const complianceResponse = await complianceApi.list({ signal: params.id! });
    const records = Array.isArray(complianceResponse)
      ? complianceResponse
      : complianceResponse?.results ?? [];

    return { signal, records };
  },
  component: SignalDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">Signal not found.</div>
  ),
});

const complianceMap = [
  { status: "Compliant", tone: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  { status: "Partial", tone: "bg-warning/10 text-warning border-warning/20", icon: AlertTriangle },
  { status: "Late Entry", tone: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  { status: "Wrong Direction", tone: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  { status: "Missed", tone: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  { status: "Pending", tone: "bg-muted text-muted-foreground border-border", icon: Clock },
];

function SignalDetail() {
  const { signal, records } = Route.useLoaderData() as { signal: Signal; records: ComplianceRecord[] };

  const sampleMt5Trades = useMemo(() => {
    const pair = signal.pair || "XAUUSD";
    const directionLabel = signal.direction === "SELL" ? "SELL" : "BUY";
    const baseEntry = signal.fibEntry || signal.takeProfit || 2400;

    return [
      {
        id: 1001,
        ticket: 900101,
        symbol: pair,
        direction: directionLabel,
        orderType: directionLabel === "BUY" ? "buy_limit" : "sell_limit",
        volume: 0.1,
        entryPrice: Number((baseEntry + 0.08).toFixed(2)),
        stopLoss: Number((baseEntry - 1.4).toFixed(2)),
        takeProfit: Number((baseEntry + 2.3).toFixed(2)),
        status: "pending",
        openTime: null,
        account: { id: 1, login: 110001, accountNumber: "10012345", userName: "Ayu Pratama" },
      },
      {
        id: 1002,
        ticket: 900102,
        symbol: pair,
        direction: directionLabel,
        orderType: directionLabel === "BUY" ? "buy_limit" : "sell_limit",
        volume: 0.08,
        entryPrice: Number((baseEntry + 0.03).toFixed(2)),
        stopLoss: Number((baseEntry - 1.1).toFixed(2)),
        takeProfit: Number((baseEntry + 2.0).toFixed(2)),
        status: "open",
        openTime: "2026-07-26T10:15:00",
        account: { id: 2, login: 110002, accountNumber: "10012346", userName: "Bima Surya" },
      },
      {
        id: 1003,
        ticket: 900103,
        symbol: pair,
        direction: directionLabel,
        orderType: directionLabel === "BUY" ? "buy_limit" : "sell_limit",
        volume: 0.06,
        entryPrice: Number((baseEntry - 0.05).toFixed(2)),
        stopLoss: Number((baseEntry - 1.2).toFixed(2)),
        takeProfit: Number((baseEntry + 1.9).toFixed(2)),
        status: "closed",
        openTime: "2026-07-26T09:40:00",
        account: { id: 3, login: 110003, accountNumber: "10012347", userName: "Citra Lestari" },
      },
    ];
  }, [signal.pair, signal.direction, signal.fibEntry, signal.takeProfit]);

  const hasRealMt5Trades = Boolean((signal as Signal & { mt5Trades?: unknown[] }).mt5Trades?.length);
  const mt5Trades = hasRealMt5Trades
    ? ((signal as Signal & { mt5Trades?: Array<{
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
        account: { id: number; login: number; accountNumber: string; userName: string };
      }> }).mt5Trades ?? [])
    : sampleMt5Trades;

  const mt5Summary = (signal as Signal & { mt5Summary?: { totalTrades?: number; pending?: number; open?: number; closed?: number; cancelled?: number } }).mt5Summary ?? {
    totalTrades: mt5Trades.length,
    pending: mt5Trades.filter((trade) => trade.status === "pending").length,
    open: mt5Trades.filter((trade) => trade.status === "open").length,
    closed: mt5Trades.filter((trade) => trade.status === "closed").length,
    cancelled: mt5Trades.filter((trade) => trade.status === "cancelled").length,
  };

  const rows = useMemo(() => {
    return records.map((record) => {
      const compliance = complianceMap.find((item) => item.status === record.status) ?? complianceMap[0];
      return {
        trader: record.user,
        status: record.status,
        direction: record.actualDirection ?? signal.direction,
        entry: record.actualEntry ?? signal.fibEntry,
        tp: signal.takeProfit,
        entryTime: record.actualEntryTime ?? "—",
        score: record.score,
        compliance,
      };
    });
  }, [records, signal]);

  return (
    <>
      <PageHeader
        eyebrow="Signal Detail"
        title={`${signal.pair} · ${signal.direction}`}
        description={`Issued ${signal.time} · Max entry ${signal.maxEntryTime} · TP ${signal.takeProfit} · SL ${signal.stopLoss} · E1 ${signal.fib_0236 ?? "—"} · E2 ${signal.fib_0500 ?? "—"} · E3 ${signal.fib_0618 ?? "—"}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/signals"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back to signals</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        {[
          { label: "Compliant", value: rows.filter((r) => r.status === "Compliant").length, tone: "success" as const },
          { label: "Partial / Late", value: rows.filter((r) => r.status === "Partial" || r.status === "Late Entry").length, tone: "warning" as const },
          { label: "Violations", value: rows.filter((r) => r.status === "Wrong Direction" || r.status === "Missed").length, tone: "destructive" as const },
          { label: "Avg Score", value: `${rows.length ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0}%`, tone: "primary" as const },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
            <div className={`mt-1 text-3xl font-bold ${
              item.tone === "success" ? "text-success" : item.tone === "warning" ? "text-warning" : item.tone === "destructive" ? "text-destructive" : "text-foreground"
            }`}>{item.value}</div>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        {[
          { label: "MT5 trades", value: mt5Summary.totalTrades, tone: "primary" as const },
          { label: "Pending", value: mt5Summary.pending, tone: "warning" as const },
          { label: "Open", value: mt5Summary.open, tone: "success" as const },
          { label: "Closed / Cancelled", value: mt5Summary.closed + mt5Summary.cancelled, tone: "destructive" as const },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
            <div className={`mt-1 text-3xl font-bold ${item.tone === "success" ? "text-success" : item.tone === "warning" ? "text-warning" : item.tone === "destructive" ? "text-destructive" : "text-foreground"}`}>{item.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden mb-6">
        <div className="border-b border-border/60 p-4">
          <div className="text-sm font-semibold">MT5 linked orders / positions</div>
          <div className="text-xs text-muted-foreground">
            {hasRealMt5Trades
              ? "Pending limit orders and executed positions linked to this signal."
              : "Contoh tampilan data MT5 realistis untuk preview sebelum data live terhubung."}
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-semibold">Trader</th>
                <th className="p-4 font-semibold">Ticket</th>
                <th className="p-4 font-semibold">Symbol</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Entry</th>
                <th className="p-4 font-semibold">SL / TP</th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mt5Trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">No MT5 trades linked to this signal yet.</td>
                </tr>
              ) : mt5Trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-muted/40">
                  <td className="p-4">
                    <div className="font-medium">{trade.account.userName}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">#{trade.account.login}</div>
                  </td>
                  <td className="p-4 font-mono text-xs">{trade.ticket}</td>
                  <td className="p-4 font-medium">{trade.symbol}</td>
                  <td className="p-4">
                    <Badge variant="outline" className={trade.orderType.includes("buy") ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                      {trade.orderType}
                    </Badge>
                  </td>
                  <td className="p-4 font-mono text-xs">{trade.entryPrice}</td>
                  <td className="p-4 font-mono text-xs">
                    {trade.stopLoss ?? "—"} / {trade.takeProfit ?? "—"}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={trade.status === "pending" ? "bg-warning/10 text-warning border-warning/20" : trade.status === "open" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"}>
                      {trade.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-border/60 p-4">
          <div className="text-sm font-semibold">Trader compliance breakdown</div>
          <div className="text-xs text-muted-foreground">Each trader's MT5 result for this signal.</div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-semibold">Trader</th>
                <th className="p-4 font-semibold">Dir</th>
                <th className="p-4 font-semibold">Entry Level</th>
                <th className="p-4 font-semibold">TP</th>
                <th className="p-4 font-semibold">Entry Time</th>
                <th className="p-4 font-semibold">Score</th>
                <th className="p-4 font-semibold">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr key={row.trader.id} className="hover:bg-muted/40">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
                          {row.trader.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{row.trader.name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{row.trader.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={row.direction === signal.direction ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                      {row.direction}
                    </Badge>
                  </td>
                  <td className="p-4 font-mono text-xs">{row.entry ?? "—"}</td>
                  <td className="p-4 font-mono text-xs">{row.tp}</td>
                  <td className="p-4 font-mono text-xs">{row.entryTime}</td>
                  <td className="p-4 w-40">
                    <div className="flex items-center gap-2">
                      <Progress value={row.score} className="h-1.5 flex-1" />
                      <span className="w-8 text-right text-xs font-mono font-semibold">{row.score}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={`gap-1 ${row.compliance.tone}`}>
                      <row.compliance.icon className="h-3 w-3" />{row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
