import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, type ChangeEvent, type FormEvent } from "react";
import {
  HardDriveDownload, TrendingUp, TrendingDown, RefreshCw,
  Settings, CheckCircle2, AlertTriangle, Eye, EyeOff, Save,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { mt5Api } from "@/lib/api";
import { useWSEvent } from "@/lib/ws-context";

export const Route = createFileRoute("/trader/mt5")({
  component: TraderMT5Page,
});

interface MT5Position {
  ticket: number; symbol: string; type: string;
  lotSize: number; entryPrice: number; currentPrice: number;
  stopLoss: number | null; takeProfit: number | null;
  floatingPnl: number; swap: number; timeOpen: string | null;
}
interface MT5Order {
  ticket: number; symbol: string; type: string;
  lotSize: number; price: number;
  stopLoss: number | null; takeProfit: number | null;
  timeSetup: string | null;
}
interface MT5Deal {
  ticket: number; symbol: string; type: string; entry: string;
  volume: number; price: number; profit: number; swap: number;
  commission: number; time: string | null;
}
interface MT5Account {
  id: number; login: number; accountNumber: string;
  server: string; broker: string; status: string;
  isDemo: boolean; currency: string; leverage: number; company: string;
  balance: number; equity: number; floatingPnl: number;
  margin: number; freeMargin: number; marginLevel: number;
  drawdown: number; openPositions: number; pendingOrders: number;
  lastSync: string | null; errorMessage: string;
  positions: MT5Position[];
  orders: MT5Order[];
}

function TraderMT5Page() {
  const [account, setAccount]   = useState<MT5Account | null>(null);
  const [deals, setDeals]       = useState<MT5Deal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [syncing, setSyncing]   = useState(false);

  const autoSyncRef = useRef(false);
  const syncingRef = useRef(false);

  // Credentials form
  const [showCreds, setShowCreds]   = useState(false);
  const [login, setLogin]           = useState("");
  const [password, setPassword]     = useState("");
  const [server, setServer]         = useState("");
  const [broker, setBroker]         = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  const fetchAccount = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await mt5Api.me();
      console.log('✓ MT5 account loaded:', data);
      setAccount(data);
      setNotFound(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      console.error('✗ Failed to load MT5 account:', msg, err);
      if (msg.includes("404") || msg.includes("No MT5")) {
        console.log('→ No MT5 account found (expected before first save)');
        setNotFound(true);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchDeals = async () => {
    if (!account) return;
    try {
      const data = await mt5Api.deals(account.id);
      setDeals(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { void fetchAccount(); }, []);
  useEffect(() => { if (account) void fetchDeals(); }, [account?.id]);
  useEffect(() => {
    if (!account) return;
    setLogin(String(account.login));
    setServer(account.server ?? "");
    setBroker(account.broker ?? "");

    // ⚠️ DISABLED: Auto-sync on mount will generate simulation data in production
    // EA pushes real data via WebSocket, no need to call sync endpoint
    // If you need to force sync (e.g., development), uncomment below:
    /*
    if (!autoSyncRef.current) {
      autoSyncRef.current = true;
      void handleSync();
    }
    */
  }, [account]);

  // WebSocket: replace 10s polling with live MT5 push
  const handleMT5WS = useCallback((data: unknown) => {
    const acc = data as MT5Account;
    if (!acc?.id) return;
    if (account && acc.id !== account.id) return;
    setAccount(acc);
  }, [account]);
  useWSEvent("mt5_update", handleMT5WS);

  const handleSync = useCallback(async () => {
    if (!account || syncingRef.current) return;
    setSyncing(true);
    syncingRef.current = true;

    try {
      const updated = await mt5Api.syncOne(account.id);
      setAccount(updated);
    } catch (err) {
      // keep silent on background sync failures
    } finally {
      setSyncing(false);
      syncingRef.current = false;
    }
  }, [account]);

  useEffect(() => {
    if (!account || account.status !== "connected") return;

    // ⚠️ DISABLED: EA pushes data via WebSocket, no need to poll sync endpoint
    // Polling sync endpoint will overwrite EA data with simulation in production
    // 
    // If you need to force sync (e.g., development without EA), uncomment below:
    /*
    const interval = setInterval(() => {
      if (!syncingRef.current) {
        void handleSync();
      }
    }, 1000);

    return () => clearInterval(interval);
    */
    
    // No-op: EA + WebSocket handles real-time updates
  }, [account, handleSync]);

  const handleSaveCredentials = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!login || !password || !server) {
      toast.error("Login, password, and server are required");
      return;
    }
    setSavingCreds(true);
    try {
      const data = await mt5Api.setCredentials({
        login: parseInt(login, 10), password, server, broker,
      });
      setAccount(data);
      setNotFound(false);
      setShowCreds(false);
      setPassword("");
      toast.success(`Connected: ${data.accountNumber} @ ${data.server}`);
      
      // ⚠️ DISABLED: Don't force refresh after save, EA will push data
      // Forcing refresh triggers sync endpoint which generates simulation data
      // EA should push real data within seconds via /api/v1/mt5/ea-report/
      /*
      setTimeout(async () => {
        try {
          const refreshed = await mt5Api.me();
          setAccount(refreshed);
          console.log('MT5 account refreshed:', refreshed);
        } catch (err) {
          console.error('Failed to refresh MT5 account:', err);
        }
      }, 1000);
      */
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to connect";
      console.error('MT5 setCredentials error:', err);
      toast.error(errorMsg);
    } finally {
      setSavingCreds(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-sm text-muted-foreground">Connecting to MT5…</div>;

  return (
    <>
      <PageHeader
        eyebrow="Trading Desk"
        title="MetaTrader 5"
        description="Monitor akun trading kamu secara real-time."
        actions={
          account ? (
            <div className="flex gap-2">
              <Badge variant="outline" className={account.status === "connected"
                ? "bg-success/10 text-success border-success/20 gap-1.5"
                : "bg-warning/10 text-warning border-warning/20 gap-1.5"}>
                <span className={`h-1.5 w-1.5 rounded-full ${account.status === "connected" ? "bg-success animate-pulse" : "bg-warning"}`} />
                {account.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                Sync
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreds((v) => !v)}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />Update Credentials
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreds(true)}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />Connect MT5 Account
              </Button>
            </div>
          )
        }
      />

      {/* Credentials form */}
      {(notFound || showCreds) && (
        <Card className="mb-4 p-6">
          <div className="mb-4">
            <div className="text-sm font-bold">{notFound ? "Connect MT5 Account" : "Update Credentials"}</div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Password disimpan terenkripsi di server.</p>
              <p>Isi login, server, dan password MT5 milikmu untuk menghubungkan akun.</p>
            </div>
          </div>
          <form onSubmit={handleSaveCredentials} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Login (Account Number)</Label>
                <Input type="number" value={login} onChange={(e: ChangeEvent<HTMLInputElement>) => setLogin(e.target.value)} placeholder="7724091" required />
              </div>
              <div className="grid gap-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="MT5 password" required className="pr-10" />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Server</Label>
                <Input value={server} onChange={(e: ChangeEvent<HTMLInputElement>) => setServer(e.target.value)} placeholder="ICMarkets-Live01" required />
              </div>
              <div className="grid gap-1.5">
                <Label>Broker (opsional)</Label>
                <Input value={broker} onChange={(e: ChangeEvent<HTMLInputElement>) => setBroker(e.target.value)} placeholder="ICMarkets" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={savingCreds} className="gradient-primary text-primary-foreground">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {savingCreds ? "Connecting…" : "Save & Connect"}
              </Button>
              {showCreds && <Button type="button" variant="outline" onClick={() => setShowCreds(false)}>Cancel</Button>}
            </div>
          </form>
        </Card>
      )}

      {account && (
        <>
          {/* Error */}
          {account.status === "error" && (
            <Card className="mb-4 p-4 border-destructive/20 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />{account.errorMessage || "Connection error"}
              </div>
            </Card>
          )}

          {/* Account overview */}
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            {[
              { label: "Balance",    value: `${account.currency} ${account.balance.toLocaleString()}`, color: "" },
              { label: "Equity",     value: `${account.currency} ${account.equity.toLocaleString()}`,  color: "text-success" },
              { label: "Floating P/L", value: `${account.floatingPnl >= 0 ? "+" : ""}${account.floatingPnl.toFixed(2)}`, color: account.floatingPnl >= 0 ? "text-success" : "text-destructive" },
              { label: "Margin Level", value: `${account.marginLevel.toFixed(0)}%`, color: "" },
            ].map((k) => (
              <Card key={k.label} className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
                <div className={`text-2xl font-bold font-mono mt-1 ${k.color}`}>{k.value}</div>
              </Card>
            ))}
          </div>

          {/* Drawdown */}
          <Card className="mb-4 p-4">
            <div className="flex items-center justify-between mb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{account.accountNumber}</span>
                <Badge variant="outline" className="text-[10px]">{account.server}</Badge>
                {account.isDemo && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">DEMO</Badge>}
                <span className="text-muted-foreground">{account.company}</span>
              </div>
              <div className="text-muted-foreground">
                {account.lastSync && `Synced ${new Date(account.lastSync).toLocaleTimeString("id-ID")}`}
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase text-muted-foreground mb-1">
              <span>Drawdown</span><span className="font-mono font-semibold">{account.drawdown.toFixed(2)}%</span>
            </div>
            <Progress value={Math.min(account.drawdown * 5, 100)} className="h-2" />
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-muted-foreground">Free Margin: </span><span className="font-mono">{account.freeMargin.toFixed(2)}</span></div>
              <div><span className="text-muted-foreground">Leverage: </span><span className="font-mono">1:{account.leverage}</span></div>
              <div><span className="text-muted-foreground">Open/Orders: </span><span className="font-mono">{account.openPositions}/{account.pendingOrders}</span></div>
            </div>
          </Card>

          {/* Positions / Orders / History */}
          <Tabs defaultValue="positions">
            <TabsList>
              <TabsTrigger value="positions">Open Positions ({account.positions.length})</TabsTrigger>
              <TabsTrigger value="orders">Pending Orders ({account.orders.length})</TabsTrigger>
              <TabsTrigger value="history">Deal History ({deals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="positions">
              <Card className="p-0 overflow-hidden">
                {account.positions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada posisi terbuka.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="p-3">Ticket</th><th className="p-3">Symbol</th><th className="p-3">Type</th>
                        <th className="p-3">Lot</th><th className="p-3">Entry</th><th className="p-3">Current</th>
                        <th className="p-3">SL</th><th className="p-3">TP</th><th className="p-3 text-right">P/L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {account.positions.map((p) => (
                        <tr key={p.ticket} className="hover:bg-muted/40 font-mono">
                          <td className="p-3 text-muted-foreground">{p.ticket}</td>
                          <td className="p-3 font-semibold">{p.symbol}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={`text-[10px] ${p.type === "BUY" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>{p.type}</Badge>
                          </td>
                          <td className="p-3">{p.lotSize}</td>
                          <td className="p-3">{p.entryPrice}</td>
                          <td className="p-3">{p.currentPrice}</td>
                          <td className="p-3 text-muted-foreground">{p.stopLoss ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{p.takeProfit ?? "—"}</td>
                          <td className={`p-3 text-right font-semibold ${p.floatingPnl >= 0 ? "text-success" : "text-destructive"}`}>
                            {p.floatingPnl >= 0 ? "+" : ""}{p.floatingPnl.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="orders">
              <Card className="p-0 overflow-hidden">
                {account.orders.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada pending orders.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="p-3">Ticket</th><th className="p-3">Symbol</th><th className="p-3">Type</th>
                        <th className="p-3">Lot</th><th className="p-3">Price</th><th className="p-3">SL</th><th className="p-3">TP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {account.orders.map((o) => (
                        <tr key={o.ticket} className="hover:bg-muted/40 font-mono">
                          <td className="p-3 text-muted-foreground">{o.ticket}</td>
                          <td className="p-3 font-semibold">{o.symbol}</td>
                          <td className="p-3">{o.type}</td>
                          <td className="p-3">{o.lotSize}</td>
                          <td className="p-3">{o.price}</td>
                          <td className="p-3 text-muted-foreground">{o.stopLoss ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{o.takeProfit ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="p-0 overflow-hidden">
                {deals.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada history.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="p-3">Ticket</th><th className="p-3">Symbol</th><th className="p-3">Type</th>
                        <th className="p-3">Entry</th><th className="p-3">Vol</th><th className="p-3">Price</th>
                        <th className="p-3 text-right">Profit</th><th className="p-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {deals.map((d) => (
                        <tr key={d.ticket} className="hover:bg-muted/40 font-mono">
                          <td className="p-3 text-muted-foreground">{d.ticket}</td>
                          <td className="p-3 font-semibold">{d.symbol}</td>
                          <td className="p-3">{d.type}</td>
                          <td className="p-3">{d.entry}</td>
                          <td className="p-3">{d.volume}</td>
                          <td className="p-3">{d.price}</td>
                          <td className={`p-3 text-right font-semibold ${d.profit >= 0 ? "text-success" : "text-destructive"}`}>
                            {d.profit >= 0 ? "+" : ""}{d.profit.toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {d.time ? new Date(d.time).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}
