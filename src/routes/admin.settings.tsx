import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type ChangeEvent, type ReactNode } from "react";
import { Save, Eye, EyeOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface SystemSettings {
  companyName: string;
  timezone: string;
  logoUrl: string;
  tvWebhookUrl: string;
  mt5BridgeHost: string;
  telegramBotToken: string;
  smtpHost: string;
  sessionOpenUtc: string;
  sessionCloseUtc: string;
  attendanceCutoff: string;
  officeGpsRadiusM: number;
  fibEntryA: number;
  fibEntryB: number;
  fibEntryC: number;
  takeProfitFib: number;
  maxEntryDelayMinutes: number;
  maxLotPerTrade: number;
  autoRejectWrongDirection: boolean;
  notifyOnMissedSignal: boolean;
}

const DEFAULTS: SystemSettings = {
  companyName: "MIKAPEDIA Capital",
  timezone: "Asia/Jakarta",
  logoUrl: "",
  tvWebhookUrl: "",
  mt5BridgeHost: "",
  telegramBotToken: "",
  smtpHost: "",
  sessionOpenUtc: "07:00",
  sessionCloseUtc: "21:00",
  attendanceCutoff: "09:15",
  officeGpsRadiusM: 120,
  fibEntryA: 0.236,
  fibEntryB: 0.500,
  fibEntryC: 0.618,
  takeProfitFib: -0.27,
  maxEntryDelayMinutes: 5,
  maxLotPerTrade: 0.50,
  autoRejectWrongDirection: true,
  notifyOnMissedSignal: true,
};

// ── UI helpers ────────────────────────────────────────────────────────────────
function Section({ title, description, children }: {
  title: string; description: string; children: ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Separator className="my-4" />
      <div className="grid gap-4">{children}</div>
    </Card>
  );
}

function Field({ label, value, onChange, hint, type = "text", readOnly }: {
  label: string; value: string; onChange?: (v: string) => void;
  hint?: string; type?: string; readOnly?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
          type={isPassword && !show ? "password" : "text"}
          className={`${isPassword ? "pr-10" : ""} ${readOnly ? "bg-muted/40 cursor-not-allowed" : ""}`}
          readOnly={readOnly}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  // Load settings from API
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<SystemSettings>("/settings/");
        setSettings({ ...DEFAULTS, ...data });
      } catch (err) {
        toast.error("Gagal memuat settings: " + (err instanceof Error ? err.message : "unknown"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  function set<K extends keyof SystemSettings>(key: K, val: SystemSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch("/settings/", settings);
      toast.success("Pengaturan berhasil disimpan.");
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />Memuat settings…
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="System Settings"
        description="Konfigurasi operasional seluruh perusahaan. SOP di sini digunakan oleh compliance engine secara otomatis."
        actions={
          <Button size="sm" className="gradient-primary text-primary-foreground"
            onClick={handleSave} disabled={saving}>
            {saving
              ? <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />Menyimpan…</>
              : <><Save className="mr-1.5 h-3.5 w-3.5" />Simpan Semua</>
            }
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Company Profile */}
        <Section title="Company Profile" description="Branding yang digunakan di laporan dan portal.">
          <Field label="Company Name" value={settings.companyName}
            onChange={(v) => set("companyName", v)} />
          <Field label="Timezone" value={settings.timezone}
            onChange={(v) => set("timezone", v)}
            hint="Contoh: Asia/Jakarta, UTC, America/New_York" />
          <Field label="Company Logo URL" value={settings.logoUrl}
            onChange={(v) => set("logoUrl", v)} />
        </Section>

        {/* Integrations */}
        <Section title="Integrations" description="Webhooks, APIs, dan layanan eksternal.">
          <Field label="TradingView Webhook URL" value={settings.tvWebhookUrl}
            onChange={(v) => set("tvWebhookUrl", v)} />
          <Field label="MetaTrader 5 Bridge Host" value={settings.mt5BridgeHost}
            onChange={(v) => set("mt5BridgeHost", v)} />
          <Field label="Telegram Bot Token" value={settings.telegramBotToken}
            onChange={(v) => set("telegramBotToken", v)} type="password" />
          <Field label="SMTP Host" value={settings.smtpHost}
            onChange={(v) => set("smtpHost", v)} />
        </Section>

        {/* Trading Sessions */}
        <Section title="Trading Sessions"
          description="Jendela waktu yang mengatur kehadiran dan kelayakan sinyal.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Session Open (UTC)" value={settings.sessionOpenUtc}
              onChange={(v) => set("sessionOpenUtc", v)} hint="Format HH:MM" />
            <Field label="Session Close (UTC)" value={settings.sessionCloseUtc}
              onChange={(v) => set("sessionCloseUtc", v)} hint="Format HH:MM" />
            <Field label="Attendance Cutoff" value={settings.attendanceCutoff}
              onChange={(v) => set("attendanceCutoff", v)} hint="Batas check-in terlambat" />
            <Field label="Office GPS Radius (m)" value={String(settings.officeGpsRadiusM)}
              onChange={(v) => set("officeGpsRadiusM", parseInt(v) || 120)}
              hint="Jarak maksimal dari kantor untuk check-in valid." />
          </div>
        </Section>

        {/* SOP Rules — ini yang dipakai compliance engine */}
        <Section title="SOP Rules — Compliance Engine"
          description="Parameter ini langsung digunakan untuk mengevaluasi setiap trade trader. Ubah di sini akan langsung berpengaruh ke scoring.">

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
            <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
            Nilai di bawah ini dibaca real-time oleh compliance engine saat mengevaluasi trade trader.
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Fib Entry Level A" value={String(settings.fibEntryA)}
              onChange={(v) => set("fibEntryA", parseFloat(v) || 0.236)}
              hint="Entry 1 — default 0.236" />
            <Field label="Fib Entry Level B" value={String(settings.fibEntryB)}
              onChange={(v) => set("fibEntryB", parseFloat(v) || 0.500)}
              hint="Entry 2 — default 0.500" />
            <Field label="Fib Entry Level C" value={String(settings.fibEntryC)}
              onChange={(v) => set("fibEntryC", parseFloat(v) || 0.618)}
              hint="Entry 3 — default 0.618" />
            <Field label="Take Profit (Fib Extension)" value={String(settings.takeProfitFib)}
              onChange={(v) => set("takeProfitFib", parseFloat(v) || -0.27)}
              hint="Level TP — default -0.27" />
            <Field label="Max Entry Delay (menit)" value={String(settings.maxEntryDelayMinutes)}
              onChange={(v) => set("maxEntryDelayMinutes", parseInt(v) || 10)}
              hint="Trader harus entry dalam X menit (default: 5)" />
            <Field label="Max Lot per Trade" value={String(settings.maxLotPerTrade)}
              onChange={(v) => set("maxLotPerTrade", parseFloat(v) || 0.5)}
              hint="Melebihi ini → pelanggaran lot size" />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <div className="text-sm font-medium">Auto-reject wrong direction</div>
              <div className="text-xs text-muted-foreground">
                Compliance engine langsung tandai sebagai pelanggaran saat arah berlawanan.
              </div>
            </div>
            <Switch checked={settings.autoRejectWrongDirection}
              onCheckedChange={(v) => set("autoRejectWrongDirection", v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <div className="text-sm font-medium">Notifikasi saat signal dilewati</div>
              <div className="text-xs text-muted-foreground">
                Kirim peringatan ke trader dan admin via notifikasi in-app.
              </div>
            </div>
            <Switch checked={settings.notifyOnMissedSignal}
              onCheckedChange={(v) => set("notifyOnMissedSignal", v)} />
          </div>

          {/* Live preview of active SOP rules */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2">
              Aturan SOP Aktif
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Entry 1: Fib {settings.fibEntryA}
              </Badge>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Entry 2: Fib {settings.fibEntryB}
              </Badge>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Entry 3: Fib {settings.fibEntryC}
              </Badge>
              <Badge variant="outline">TP: Fib {settings.takeProfitFib}</Badge>
              <Badge variant="outline">Max delay: {settings.maxEntryDelayMinutes} menit</Badge>
              <Badge variant="outline" className={settings.maxLotPerTrade > 0.5 ? "bg-warning/10 text-warning border-warning/20" : ""}>
                Max lot: {settings.maxLotPerTrade}
              </Badge>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
