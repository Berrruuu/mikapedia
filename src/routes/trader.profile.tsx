import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type ChangeEvent } from "react";
import {
  User, KeyRound, Save, Upload, Building2, Briefcase,
  Phone, Mail, CandlestickChart, CheckCircle2, AlertTriangle,
  ShieldCheck, TrendingUp, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth, API_BASE, getAccessToken } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/trader/profile")({
  component: ProfilePage,
});

interface SOPWarning {
  id: number;
  violation_type: string;
  severity: "warning" | "danger";
  message: string;
  acknowledged: boolean;
  created_at: string;
}

const VIOLATION_LABELS: Record<string, string> = {
  missed_signal:     "Signal Dilewati",
  wrong_direction:   "Arah Salah",
  late_entry:        "Entry Terlambat",
  no_stop_loss:      "Tidak Ada SL",
  no_take_profit:    "Tidak Ada TP",
  wrong_lot_size:    "Lot Size Salah",
  entry_out_of_zone: "Entry di Luar Zona",
  multiple:          "Beberapa Pelanggaran",
};

interface TraderStats {
  complianceScore: number;
  executionRate: number;
  entryAccuracy: number;
  timingAccuracy: number;
  lateEntries: number;
}

function ProfilePage() {
  const { user, changePassword } = useAuth();

  const [warnings, setWarnings] = useState<SOPWarning[]>([]);
  const [meStats, setMeStats]   = useState<TraderStats | null>(null);

  // profile form
  const parts = (user?.name ?? "").split(" ");
  const [fFirst, setFFirst] = useState(parts[0] ?? "");
  const [fLast,  setFLast]  = useState(parts.slice(1).join(" ") ?? "");
  const [fPhone, setFPhone] = useState(user?.phone ?? "");
  const [fDept,  setFDept]  = useState(user?.department ?? "");
  const [fPos,   setFPos]   = useState(user?.position ?? "");
  const [profileBusy, setProfileBusy] = useState(false);

  // password form
  const [oldPw,  setOldPw]  = useState("");
  const [newPw,  setNewPw]  = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const initials = (user?.name ?? "MK").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const load = async () => {
      try {
        const [warnData, userData] = await Promise.all([
          api.get<{ results?: SOPWarning[] } | SOPWarning[]>("/compliance/warnings/?acknowledged=false"),
          api.get<TraderStats & { id: string }>(`/users/${user?.id}/`),
        ]);
        const warns = Array.isArray(warnData)
          ? warnData
          : (warnData as { results: SOPWarning[] })?.results ?? [];
        setWarnings(warns);
        if (userData) {
          setMeStats({
            complianceScore: userData.complianceScore ?? 0,
            executionRate:   userData.executionRate ?? 0,
            entryAccuracy:   userData.entryAccuracy ?? 0,
            timingAccuracy:  userData.timingAccuracy ?? 0,
            lateEntries:     userData.lateEntries ?? 0,
          });
        }
      } catch { /* silent */ }
    };
    if (user?.id) void load();
  }, [user?.id]);

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    try {
      await api.patch(`/users/${user?.id}/`, {
        first_name: fFirst, last_name: fLast,
        phone: fPhone, department: fDept, position: fPos,
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    const token = getAccessToken();
    try {
      const res = await fetch(`${API_BASE}/users/${user?.id}/avatar/`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("Photo updated — refresh to see changes");
    } catch {
      toast.error("Failed to upload photo");
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confPw) { toast.error("Passwords do not match"); return; }
    if (newPw.length < 8) { toast.error("Minimum 8 characters"); return; }
    setPwBusy(true);
    try {
      await changePassword(oldPw, newPw);
      setPwDone(true);
      setOldPw(""); setNewPw(""); setConfPw("");
      toast.success("Password berhasil diubah");
      setTimeout(() => setPwDone(false), 4000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal ubah password");
    } finally {
      setPwBusy(false);
    }
  }

  async function acknowledgeWarning(id: number) {
    try {
      await api.patch(`/compliance/warnings/${id}/`, { acknowledged: true });
      setWarnings((prev) => prev.filter((w) => w.id !== id));
      toast.success("Peringatan ditandai sudah dipahami");
    } catch {
      toast.error("Gagal update peringatan");
    }
  }

  const unackDanger = warnings.filter((w) => w.severity === "danger").length;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My Profile"
        description="Informasi akun, performa trading, dan peringatan SOP kamu."
      />

      {/* SOP Warnings Banner */}
      {warnings.length > 0 && (
        <div className="mb-4 space-y-2">
          {warnings.map((w) => (
            <div
              key={w.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                w.severity === "danger"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-warning/30 bg-warning/5"
              }`}
            >
              <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${
                w.severity === "danger" ? "text-destructive" : "text-warning"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${
                    w.severity === "danger" ? "text-destructive" : "text-warning"
                  }`}>
                    {w.severity === "danger" ? "🔴 Peringatan Serius" : "⚠️ Peringatan SOP"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {VIOLATION_LABELS[w.violation_type] ?? w.violation_type}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{w.message}</p>
                <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                  {new Date(w.created_at).toLocaleString("id-ID")}
                </div>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 text-xs"
                onClick={() => acknowledgeWarning(w.id)}>
                Pahami & Tutup
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: Avatar + Scorecard */}
        <div className="space-y-4">
          <Card className="p-6 flex flex-col items-center text-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {user?.avatar && (
                  <AvatarImage src={`${API_BASE.replace("/api", "")}${user.avatar}`} />
                )}
                <AvatarFallback className="gradient-primary text-primary-foreground text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated hover:opacity-90 transition">
                <Upload className="h-4 w-4" />
                <input
                  type="file" accept="image/*" className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatar(f); }}
                />
              </label>
            </div>
            <div>
              <div className="font-bold text-lg">{user?.name}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
            <div className="w-full space-y-2 text-sm">
              {user?.employeeId && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Employee ID</span>
                  <span className="font-mono font-semibold text-foreground">{user.employeeId}</span>
                </div>
              )}
              {user?.department && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /><span>{user.department}</span>
                </div>
              )}
              {user?.position && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" /><span>{user.position}</span>
                </div>
              )}
              <Separator />
              <Badge variant="outline" className="gap-1 w-full justify-center bg-primary/10 text-primary border-primary/20">
                {user?.role === "admin" ? "Administrator" : "Trader"}
              </Badge>
              {unackDanger > 0 && (
                <Badge variant="outline" className="gap-1 w-full justify-center bg-destructive/10 text-destructive border-destructive/20">
                  <AlertTriangle className="h-3 w-3" />{unackDanger} peringatan serius
                </Badge>
              )}
            </div>
          </Card>

          {/* Execution Scorecard */}
          {meStats && (
            <Card className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Execution Scorecard
              </div>
              <div className="space-y-3">
                {[
                  {
                    label: "Compliance Score",
                    value: meStats.complianceScore,
                    icon: ShieldCheck,
                    color: meStats.complianceScore >= 80 ? "text-success"
                         : meStats.complianceScore >= 50 ? "text-warning"
                         : "text-destructive",
                  },
                  {
                    label: "Execution Rate",
                    value: meStats.executionRate,
                    icon: TrendingUp,
                    color: meStats.executionRate >= 80 ? "text-success" : "text-warning",
                  },
                  {
                    label: "Entry Accuracy",
                    value: meStats.entryAccuracy,
                    icon: CheckCircle2,
                    color: "text-primary",
                  },
                  {
                    label: "Timing Accuracy",
                    value: meStats.timingAccuracy,
                    icon: Clock,
                    color: "text-info",
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />{label}
                      </div>
                      <span className={`text-xs font-mono font-bold ${color}`}>
                        {value.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={value} className="h-1.5" />
                  </div>
                ))}
                {meStats.lateEntries > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-warning/5 border border-warning/20 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 text-warning">
                      <Clock className="h-3.5 w-3.5" />Entry Terlambat (30 hari)
                    </div>
                    <span className="font-mono font-bold text-warning">{meStats.lateEntries}x</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right column: Forms */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <div className="mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Personal Info</div>
              <div className="text-lg font-bold">Edit Profile</div>
            </div>
            <form onSubmit={handleProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={fFirst}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFFirst(e.target.value)}
                      className="pl-9" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Last Name</Label>
                  <Input value={fLast}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFLast(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={user?.email ?? ""} disabled className="pl-9 bg-muted/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={fPhone}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFPhone(e.target.value)}
                      className="pl-9" placeholder="+62 xxx xxxx xxxx" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Department</Label>
                  <Input value={fDept}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFDept(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Position</Label>
                <Input value={fPos}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFPos(e.target.value)} />
              </div>

              {user?.accountNumber && (
                <>
                  <Separator />
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                      <CandlestickChart className="h-3.5 w-3.5" /> MT5 Account
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div>
                        <div className="text-muted-foreground">Account</div>
                        <div className="font-semibold">{user.accountNumber}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Broker</div>
                        <div className="font-semibold">{user.brokerName || "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Server</div>
                        <div className="font-semibold">{user.brokerServer || "—"}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" disabled={profileBusy} className="gradient-primary text-primary-foreground">
                <Save className="mr-1.5 h-4 w-4" />
                {profileBusy ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Security</div>
              <div className="text-lg font-bold">Change Password</div>
            </div>
            {pwDone ? (
              <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Password berhasil diubah.
              </div>
            ) : (
              <form onSubmit={handlePassword} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label>Password Saat Ini</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="password" value={oldPw}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setOldPw(e.target.value)}
                      className="pl-9" required />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Password Baru</Label>
                  <Input type="password" value={newPw}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPw(e.target.value)}
                    placeholder="Min. 8 karakter" required />
                </div>
                <div className="grid gap-1.5">
                  <Label>Konfirmasi Password Baru</Label>
                  <Input type="password" value={confPw}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setConfPw(e.target.value)}
                    placeholder="Ulangi password baru" required />
                </div>
                <Button type="submit" disabled={pwBusy} className="gradient-primary text-primary-foreground">
                  <KeyRound className="mr-1.5 h-4 w-4" />
                  {pwBusy ? "Mengubah…" : "Ubah Password"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
