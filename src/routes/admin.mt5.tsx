import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  HardDriveDownload, TrendingDown, TrendingUp, RefreshCw,
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp, Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useWSEvent } from "@/lib/ws-context";

export const Route = createFileRoute("/admin/mt5")({
  component: MT5Page,
});

interface MT5User { id: string; name: string; email: string; avatar: string | null }
interface MT5Position {
  ticket: number; symbol: string; type: string;
  lotSize: number; entryPrice: number; currentPrice: number;
  stopLoss: number | null; takeProfit: number | null;
  floatingPnl: number; timeOpen: string | null;
}
interface MT5Account {
  id: number; user: MT5User; login: number;
  accountNumber: string; server: string; broker: string;
  status: "connected" | "disconnected" | "error" | "pending";
  isDemo: boolean; currency: string; leverage: number; company: string;
  balance: number; equity: number; floatingPnl: number;
  margin: number; freeMargin: number; marginLevel: number;
  drawdown: number; openPositions: number; pendingOrders: number;
  lastSync: string | null; errorMessage: string;
  positions: MT5Position[];
}

interface Summary {
  totalAccounts: number; connected: number; disconnected: number;
  totalBalance: number; totalEquity: number; totalFloating: number;
}

const STATUS_TONE: Record<string, string> = {
  connected:    "bg-success/10 text-success border-success/20",
  disconnected: "bg-muted text-muted-foreground",
  error:        "bg-destructive/10 text-destructive border-destructive/20",
  pending:      "bg-warning/10 text-warning border-warning/20",
};

function MT5Page() {
  const [accounts, setAccounts]   = useState<MT5Account[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Helper to get date range for quick filters
  const getDateRange = (filter: 'week' | 'month' | 'lastMonth' | 'all') => {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const format = (d: Date) => d.toISOString().split('T')[0];

    switch (filter) {
      case 'week':
        return { start: format(startOfWeek), end: format(today) };
      case 'month':
        return { start: format(startOfMonth), end: format(today) };
      case 'lastMonth':
        return { start: format(startOfLastMonth), end: format(endOfLastMonth) };
      case 'all':
        return { start: '', end: '' };
      default:
        return { start: '', end: '' };
    }
  };

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [accs, sum] = await Promise.all([
        api.get<{ results?: MT5Account[] } | MT5Account[]>("/mt5/"),
        api.get<Summary>("/mt5/summary/"),
      ]);
      const list = Array.isArray(accs) ? accs : (accs as { results: MT5Account[] }).results ?? [];
      setAccounts(list);
      setSummary(sum);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void fetchAll(); }, []);

  // WebSocket: replace 10s polling with live push
  const handleMT5WS = useCallback((data: unknown) => {
    const acc = data as MT5Account;
    if (!acc?.id) return;
    setAccounts((prev) => prev.map((a) => a.id === acc.id ? acc : a));
    setSummary((prev) => prev ? {
      ...prev,
      totalBalance:  accounts.reduce((s, a) => s + (a.id === acc.id ? acc.balance  : a.balance), 0),
      totalEquity:   accounts.reduce((s, a) => s + (a.id === acc.id ? acc.equity   : a.equity), 0),
      totalFloating: accounts.reduce((s, a) => s + (a.id === acc.id ? acc.floatingPnl : a.floatingPnl), 0),
    } : prev);
  }, [accounts]);

  useWSEvent("mt5_update", handleMT5WS);

  // Still fetch summary periodically for connected count (lightweight)
  useEffect(() => {
    const t = setInterval(() => {
      api.get<Summary>("/mt5/summary/").then(setSummary).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await api.post<{ synced: number }>("/mt5/sync-all/", {});
      await fetchAll(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncOne = async (id: number) => {
    try {
      const updated = await api.post<MT5Account>(`/mt5/${id}/sync/`, {});
      setAccounts((prev) => prev.map((a) => a.id === id ? updated : a));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  };

  const toggleExpand = (id: number) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Show all open positions (don't filter by date)
  const filteredAccounts = accounts;

  // Download trading history for a trader
  const handleDownloadHistory = async (accountId: number, userName: string) => {
    try {
      // Build URL with date range params if set
      let url = `/mt5/${accountId}/export-history/`;
      const params = new URLSearchParams();
      if (exportStartDate) params.append('start_date', exportStartDate);
      if (exportEndDate) params.append('end_date', exportEndDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await api.get<string>(url, { method: 'GET' });
      
      // Create blob and download
      const blob = new Blob([response as any], { type: 'text/csv' });
      const url_obj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url_obj;
      
      // Include date range in filename
      let filename = `trading-history-${userName}`;
      if (exportStartDate && exportEndDate) {
        filename += `-${exportStartDate}_to_${exportEndDate}`;
      } else if (exportStartDate) {
        filename += `-from_${exportStartDate}`;
      } else if (exportEndDate) {
        filename += `-until_${exportEndDate}`;
      }
      filename += `.csv`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url_obj);
      document.body.removeChild(a);
      toast.success('History downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Live Monitoring"
        title="MetaTrader 5 Bridge"
        description="Real-time account telemetry dari setiap trader yang terhubung."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1 text-sm rounded-md border border-border bg-background"
            />
            <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              {summary?.connected ?? 0}/{summary?.totalAccounts ?? 0} connected
            </Badge>
            <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync All
            </Button>
          </div>
        }
      />

      {/* Summary KPIs */}
      {summary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total Balance", value: `$${summary.totalBalance.toLocaleString()}`, tone: "primary" },
            { label: "Total Equity",  value: `$${summary.totalEquity.toLocaleString()}`,  tone: "success" },
            { label: "Total Floating",value: `$${summary.totalFloating.toFixed(2)}`,      tone: summary.totalFloating >= 0 ? "success" : "destructive" },
            { label: "Connected",     value: summary.connected,     tone: "success" },
            { label: "Disconnected",  value: summary.disconnected,  tone: "destructive" },
          ].map((k) => (
            <Card key={k.label} className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className={`mt-1 text-xl font-bold ${
                k.tone === "success" ? "text-success" :
                k.tone === "destructive" ? "text-destructive" : "text-gradient"
              }`}>{k.value}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Export History Filter */}
      <Card className="mb-6 p-4">
        <div className="text-sm font-semibold mb-3">Export Trading History</div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={exportStartDate === '' && exportEndDate === '' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setExportStartDate(''); setExportEndDate(''); }}
          >
            All Time
          </Button>
          <Button
            variant={exportStartDate === getDateRange('week').start && exportEndDate === getDateRange('week').end ? 'default' : 'outline'}
            size="sm"
            onClick={() => { const r = getDateRange('week'); setExportStartDate(r.start); setExportEndDate(r.end); }}
          >
            This Week
          </Button>
          <Button
            variant={exportStartDate === getDateRange('month').start && exportEndDate === getDateRange('month').end ? 'default' : 'outline'}
            size="sm"
            onClick={() => { const r = getDateRange('month'); setExportStartDate(r.start); setExportEndDate(r.end); }}
          >
            This Month
          </Button>
          <Button
            variant={exportStartDate === getDateRange('lastMonth').start && exportEndDate === getDateRange('lastMonth').end ? 'default' : 'outline'}
            size="sm"
            onClick={() => { const r = getDateRange('lastMonth'); setExportStartDate(r.start); setExportEndDate(r.end); }}
          >
            Last Month
          </Button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">Loading accounts…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAccounts.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
                        {a.user.name.split(" ").map((n) => n[0]).join("").slice(0,2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                      a.status === "connected" ? "bg-success" : a.status === "error" ? "bg-destructive" : "bg-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{a.user.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{a.accountNumber} · {a.server}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={STATUS_TONE[a.status]}>
                      {a.status}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0"
                      title="Download trading history"
                      onClick={() => handleDownloadHistory(a.id, a.user.name)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSyncOne(a.id)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Error */}
                {a.status === "error" && a.errorMessage && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{a.errorMessage}
                  </div>
                )}

                {/* Account stats */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Balance</div>
                    <div className="font-mono font-semibold">{a.currency} {a.balance.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Equity</div>
                    <div className="font-mono font-semibold">{a.currency} {a.equity.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Floating P/L</div>
                    <div className={`font-mono font-semibold flex items-center gap-1 ${a.floatingPnl >= 0 ? "text-success" : "text-destructive"}`}>
                      {a.floatingPnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {a.floatingPnl >= 0 ? "+" : ""}{a.floatingPnl.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Margin Level</div>
                    <div className="font-mono font-semibold">{a.marginLevel.toFixed(0)}%</div>
                  </div>
                </div>

                {/* Drawdown */}
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-[10px]">
                    <span className="uppercase text-muted-foreground">Drawdown</span>
                    <span className="font-mono font-semibold">{a.drawdown.toFixed(2)}%</span>
                  </div>
                  <Progress value={Math.min(a.drawdown * 5, 100)} className="h-1.5" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{a.openPositions} positions · {a.pendingOrders} orders</span>
                  {a.lastSync && <span>Sync {new Date(a.lastSync).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
              </div>

              {/* Positions toggle */}
              {a.positions.length > 0 && (
                <>
                  <button
                    onClick={() => toggleExpand(a.id)}
                    className="w-full flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition"
                  >
                    <span>{a.positions.length} open position{a.positions.length !== 1 ? "s" : ""}</span>
                    {expanded.has(a.id) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {expanded.has(a.id) && (
                    <div className="border-t border-border/60 divide-y divide-border/40">
                      {a.positions.map((p) => (
                        <div key={p.ticket} className="px-4 py-2.5 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{p.symbol}</span>
                              <Badge variant="outline" className={`text-[10px] ${p.type === "BUY" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                                {p.type}
                              </Badge>
                              <span className="font-mono text-muted-foreground">{p.lotSize} lot</span>
                            </div>
                            <span className={`font-mono font-semibold ${p.floatingPnl >= 0 ? "text-success" : "text-destructive"}`}>
                              {p.floatingPnl >= 0 ? "+" : ""}{p.floatingPnl.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
                            <span>E {p.entryPrice}</span>
                            {p.stopLoss && <span>SL {p.stopLoss}</span>}
                            {p.takeProfit && <span>TP {p.takeProfit}</span>}
                            <span className="ml-auto">#{p.ticket}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
