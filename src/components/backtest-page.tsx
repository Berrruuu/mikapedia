import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  BarChart3,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  backtestApi,
  type BacktestJournal,
  type BacktestJournalDetail,
  type BacktestTrade,
} from "@/lib/api";

const SESSION_OPTIONS: { value: BacktestTrade["session"]; label: string }[] = [
  { value: "ASIA", label: "Asia" },
  { value: "LONDON", label: "London" },
  { value: "NEWYORK", label: "New York" },
  { value: "MIDNIGHT", label: "Midnight" },
];

function localDateTimeValue() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function money(value: number | string, currency: string) {
  return `${currency} ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)}`;
}

export function BacktestPage() {
  const [journals, setJournals] = useState<BacktestJournal[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<BacktestJournalDetail | null>(null);
  const [loadingJournals, setLoadingJournals] = useState(true);
  const [journalError, setJournalError] = useState("");
  const [journalReload, setJournalReload] = useState(0);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [journalName, setJournalName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [tradeDate, setTradeDate] = useState(localDateTimeValue);
  const [session, setSession] = useState<BacktestTrade["session"]>("ASIA");
  const [pips, setPips] = useState("");
  const [netPl, setNetPl] = useState("");

  useEffect(() => {
    let active = true;
    setJournalError("");
    const loadJournals = async () => {
      try {
        const data = await backtestApi.list();
        if (active) {
          setJournals(data);
          setSelectedId((current) =>
            current && data.some((journal) => journal.id === current)
              ? current
              : (data[0]?.id ?? ""),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal memuat daftar backtest";
        if (active) {
          setJournalError(message);
          toast.error(message);
        }
      } finally {
        if (active) setLoadingJournals(false);
      }
    };
    void loadJournals();
    return () => {
      active = false;
    };
  }, [journalReload]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let active = true;
    setDetail(null);
    setDetailError("");
    setLoadingDetail(true);
    backtestApi
      .get(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : "Gagal memuat jurnal backtest";
          setDetailError(message);
          toast.error(message);
          setDetail(null);
        }
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const createJournal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const balance = Number(startingBalance);
    const journalCurrency = currency.trim().toUpperCase();
    if (!journalName.trim() || !Number.isFinite(balance) || balance <= 0 || !journalCurrency) {
      toast.error("Isi nama jurnal, modal awal di atas 0, dan mata uang.");
      return;
    }

    setSaving(true);
    try {
      const journal = await backtestApi.create({
        name: journalName.trim(),
        startingBalance: balance.toFixed(2),
        currency: journalCurrency,
      });
      setJournalError("");
      setJournals((current) => [journal, ...current]);
      setSelectedId(journal.id);
      setJournalName("");
      setStartingBalance("");
      toast.success("Jurnal backtest berhasil dibuat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat jurnal backtest");
    } finally {
      setSaving(false);
    }
  };

  const addTrade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedNetPl = Number(netPl);
    const parsedPips = pips.trim() ? Number(pips) : null;
    if (!selectedId || !tradeDate || !Number.isFinite(parsedNetPl)) {
      toast.error("Tanggal dan NET P/L harus diisi dengan angka yang valid.");
      return;
    }
    if (parsedPips !== null && !Number.isFinite(parsedPips)) {
      toast.error("PIPS harus berupa angka yang valid.");
      return;
    }

    setSaving(true);
    try {
      await backtestApi.addTrade(selectedId, {
        tradeDate: new Date(`${tradeDate}:00+07:00`).toISOString(),
        session,
        pips: parsedPips === null ? null : parsedPips.toFixed(2),
        netPl: parsedNetPl.toFixed(2),
      });
      const updated = await backtestApi.get(selectedId);
      setDetail(updated);
      setTradeDate(localDateTimeValue());
      setPips("");
      setNetPl("");
      toast.success("Trade ditambahkan ke jurnal.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambahkan trade");
    } finally {
      setSaving(false);
    }
  };

  const deleteTrade = async (trade: BacktestTrade) => {
    if (!selectedId || !window.confirm("Hapus trade ini dari jurnal backtest?")) return;
    try {
      await backtestApi.deleteTrade(selectedId, trade.id);
      setDetail(await backtestApi.get(selectedId));
      toast.success("Trade berhasil dihapus.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus trade");
    }
  };

  const deleteJournal = async (journal: BacktestJournal) => {
    if (!window.confirm(`Hapus jurnal "${journal.name}" beserta semua trade-nya?`)) return;
    try {
      await backtestApi.delete(journal.id);
      const remaining = journals.filter((item) => item.id !== journal.id);
      setJournals(remaining);
      setSelectedId(remaining[0]?.id ?? "");
      toast.success("Jurnal backtest berhasil dihapus.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus jurnal");
    }
  };

  const selectedJournal = detail?.journal;
  const metrics = detail?.metrics;

  return (
    <>
      <PageHeader
        eyebrow="Trading Analysis"
        title="Backtest Tools"
        description="Catat hasil backtest dengan struktur jurnal yang sama dan pantau risiko serta profit."
      />

      <Card className="mb-6 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Buat jurnal backtest</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Setiap jurnal menyimpan skenario dan modal awal yang terpisah.
          </p>
        </div>
        <form onSubmit={createJournal} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            aria-label="Nama jurnal"
            placeholder="Nama jurnal (contoh: EURUSD M15)"
            value={journalName}
            onChange={(event) => setJournalName(event.target.value)}
            maxLength={100}
            required
          />
          <Input
            aria-label="Modal awal"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Modal awal"
            value={startingBalance}
            onChange={(event) => setStartingBalance(event.target.value)}
            required
          />
          <Input
            aria-label="Mata uang"
            placeholder="Mata uang"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            maxLength={10}
            required
          />
          <Button
            type="submit"
            disabled={saving}
            className="gradient-primary text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            Buat jurnal
          </Button>
        </form>
      </Card>

      {journals.length > 0 && (
        <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
            <select
              aria-label="Pilih jurnal backtest"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {journals.map((journal) => (
                <option key={journal.id} value={journal.id}>
                  {journal.name}
                </option>
              ))}
            </select>
          </div>
          {selectedJournal && (
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs text-muted-foreground">
                Modal awal {money(selectedJournal.startingBalance, selectedJournal.currency)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Hapus jurnal backtest"
                onClick={() => void deleteJournal(selectedJournal)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {loadingJournals ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Memuat jurnal backtest...
        </Card>
      ) : journalError ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-destructive">{journalError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoadingJournals(true);
              setJournalReload((attempt) => attempt + 1);
            }}
          >
            Coba lagi
          </Button>
        </Card>
      ) : journals.length === 0 ? (
        <Card className="p-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Belum ada jurnal backtest</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Buat jurnal di atas untuk mulai mencatat trade.
          </p>
        </Card>
      ) : loadingDetail ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Memuat data backtest...
        </Card>
      ) : !detail ? (
        <Card className="p-8 text-center text-sm text-destructive">
          {detailError || "Data jurnal backtest tidak tersedia."}
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total Trade"
              value={metrics?.totalTrades ?? 0}
              icon={<Activity className="h-4 w-4" />}
              accent="primary"
            />
            <StatCard
              label="Gross Profit"
              value={money(metrics?.grossProfit ?? 0, selectedJournal?.currency ?? "USD")}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="success"
            />
            <StatCard
              label="Net P/L"
              value={money(metrics?.netProfit ?? 0, selectedJournal?.currency ?? "USD")}
              icon={<Wallet className="h-4 w-4" />}
              accent={(metrics?.netProfit ?? 0) >= 0 ? "success" : "destructive"}
            />
            <StatCard
              label="Win Rate"
              value={`${metrics?.winRate ?? 0}%`}
              hint={`${metrics?.winningTrades ?? 0} profit · ${metrics?.losingTrades ?? 0} loss`}
              icon={<Target className="h-4 w-4" />}
              accent="info"
            />
            <StatCard
              label="Max Drawdown"
              value={money(metrics?.maxDrawdown ?? 0, selectedJournal?.currency ?? "USD")}
              hint={`${metrics?.maxDrawdownPercent ?? 0}% dari balance puncak`}
              icon={<TrendingDown className="h-4 w-4" />}
              accent="destructive"
            />
            <StatCard
              label="Consecutive Loss"
              value={metrics?.maxConsecutiveLosses ?? 0}
              hint="Rangkaian loss terpanjang"
              icon={<Activity className="h-4 w-4" />}
              accent="warning"
            />
            <StatCard
              label="Total Loss"
              value={money(metrics?.grossLoss ?? 0, selectedJournal?.currency ?? "USD")}
              icon={<TrendingDown className="h-4 w-4" />}
              accent="destructive"
            />
            <StatCard
              label="Balance Akhir"
              value={money(metrics?.endingBalance ?? 0, selectedJournal?.currency ?? "USD")}
              icon={<Wallet className="h-4 w-4" />}
              accent="primary"
            />
          </div>

          <Card className="mb-6 p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold">Tambah trade</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                PROFIT/LOSS dan BALANCE dihitung otomatis dari NET P/L.
              </p>
            </div>
            <form onSubmit={addTrade} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Input
                aria-label="Tanggal trade"
                type="datetime-local"
                value={tradeDate}
                onChange={(event) => setTradeDate(event.target.value)}
                required
              />
              <select
                aria-label="Sesi trade"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={session}
                onChange={(event) => setSession(event.target.value as BacktestTrade["session"])}
              >
                {SESSION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Pips"
                type="number"
                step="any"
                placeholder="PIPS (opsional)"
                value={pips}
                onChange={(event) => setPips(event.target.value)}
              />
              <Input
                aria-label="Net profit loss"
                type="number"
                step="0.01"
                placeholder="NET P/L"
                value={netPl}
                onChange={(event) => setNetPl(event.target.value)}
                required
              />
              <Button
                type="submit"
                disabled={saving}
                className="gradient-primary text-primary-foreground lg:col-span-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah trade
              </Button>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Jurnal trade</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Profit/loss ditentukan dari NET P/L; balance bergerak mengikuti urutan tanggal
                trade.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Profit/Loss</th>
                    <th className="px-4 py-3 text-right">Pips</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-right">Net P/L</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.trades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        Belum ada trade. Tambahkan trade pertama di atas.
                      </td>
                    </tr>
                  ) : (
                    detail.trades.map((trade) => (
                      <tr key={trade.id} className="border-t border-border/70">
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(trade.tradeDate).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          {SESSION_OPTIONS.find((option) => option.value === trade.session)
                            ?.label ?? trade.session}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              trade.result === "PROFIT"
                                ? "text-success"
                                : trade.result === "LOSS"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {trade.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {trade.pips === null ? "—" : Number(trade.pips).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {money(trade.balance, selectedJournal?.currency ?? "USD")}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium tabular-nums ${
                            Number(trade.netPl) >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {money(trade.netPl, selectedJournal?.currency ?? "USD")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Hapus trade"
                            onClick={() => void deleteTrade(trade)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
