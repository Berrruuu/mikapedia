import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import {
  CalendarClock, MapPin, Camera, CheckCircle2, Clock,
  XCircle, RefreshCw, ShieldCheck, AlertTriangle, Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatCard } from "@/components/stat-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/auth";
import { useWSEvent } from "@/lib/ws-context";

export const Route = createFileRoute("/admin/attendance")({
  component: AttendancePage,
});

interface AttendanceUser {
  id: string; name: string; email: string; avatar: string | null;
}

interface AttendanceRecord {
  id: number;
  user: AttendanceUser;
  date: string;
  status: "Present" | "Late" | "Absent";
  checkInTime: string | null;
  selfieUrl: string | null;
  gpsValid: boolean;
  gpsDistanceM: number | null;
  gpsAccuracyM: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  ipAddress: string | null;
  deviceInfo: string;
  browser: string;
  os: string;
  isValidated: boolean;
  validatedBy: AttendanceUser | null;
  validatedAt: string | null;
  adminNote: string;
}

interface Summary {
  date: string;
  totalTraders: number;
  present: number;
  late: number;
  absent: number;
  records: AttendanceRecord[];
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const STATUS_TONE: Record<string, string> = {
  Present: "bg-success/10 text-success border-success/20",
  Late:    "bg-warning/10 text-warning border-warning/20",
  Absent:  "bg-destructive/10 text-destructive border-destructive/20",
};

function AttendancePage() {
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch]     = useState("");

  // Validate modal
  const [validateModal, setValidateModal] = useState(false);
  const [selected, setSelected]           = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus]         = useState<"Present"|"Late"|"Absent">("Present");
  const [adminNote, setAdminNote]         = useState("");
  const [validating, setValidating]       = useState(false);

  // Selfie modal
  const [selfieModal, setSelfieModal] = useState(false);
  const [selfieSrc, setSelfieSrc]     = useState("");

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await api.get<Summary>(`/attendance/summary/?date=${date}`);
      setSummary(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchSummary(); }, [date]);

  // WebSocket: live attendance push
  useWSEvent("attendance_update", (data: unknown) => {
    const rec = data as AttendanceRecord & { date?: string };
    if (!rec?.id) return;
    const recDate = rec.date ?? date;
    if (recDate !== date) return;
    setSummary((prev) => {
      if (!prev) return prev;
      const exists = prev.records.find((r) => r.id === rec.id);
      const records = exists
        ? prev.records.map((r) => r.id === rec.id ? rec : r)
        : [...prev.records, rec];
      const present = records.filter((r) => r.status === "Present").length;
      const late    = records.filter((r) => r.status === "Late").length;
      return { ...prev, records, present, late, absent: Math.max(prev.totalTraders - present - late, 0) };
    });
  });

  function openValidate(r: AttendanceRecord) {
    setSelected(r);
    setNewStatus(r.status);
    setAdminNote(r.adminNote ?? "");
    setValidateModal(true);
  }

  async function handleValidate() {
    if (!selected) return;
    setValidating(true);
    try {
      const updated = await api.patch<AttendanceRecord>(
        `/attendance/${selected.id}/validate/`,
        { status: newStatus, admin_note: adminNote }
      );
      setSummary((prev) => prev ? {
        ...prev,
        records: prev.records.map((r) => r.id === selected.id ? updated : r),
        present: prev.records.filter((r) => r.id === selected.id ? updated.status === "Present" : r.status === "Present").length,
        late:    prev.records.filter((r) => r.id === selected.id ? updated.status === "Late"    : r.status === "Late").length,
      } : prev);
      toast.success(`Attendance ${updated.user.name} → ${updated.status}`);
      setValidateModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setValidating(false);
    }
  }

  const filtered = summary?.records.filter((r) =>
    !search || r.user.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Attendance Monitoring"
        description="Selfie check-in, GPS validation, dan office radius enforcement."
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
              className="h-9 w-40 text-sm" />
            <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Present"  value={summary?.present ?? 0}       icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Late"     value={summary?.late ?? 0}           icon={<Clock className="h-5 w-5" />}       accent="warning" />
        <StatCard label="Absent"   value={summary?.absent ?? 0}         icon={<XCircle className="h-5 w-5" />}     accent="destructive" />
        <StatCard label="Total"    value={summary?.totalTraders ?? 0}   hint="Registered traders" icon={<CalendarClock className="h-5 w-5" />} accent="primary" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 p-4 flex-wrap gap-3">
          <div className="text-sm font-semibold">Check-in Records — {date}</div>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari trader…" className="pl-9 h-9 text-sm" value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-4 font-semibold">Trader</th>
                  <th className="p-4 font-semibold">Selfie</th>
                  <th className="p-4 font-semibold">Check-in</th>
                  <th className="p-4 font-semibold">GPS</th>
                  <th className="p-4 font-semibold">IP</th>
                  <th className="p-4 font-semibold">Device</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Validasi</th>
                  <th className="p-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {r.user.avatar && <AvatarImage src={`${API_BASE.replace("/api","")}${r.user.avatar}`} />}
                          <AvatarFallback className="gradient-primary text-primary-foreground text-xs">{initials(r.user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{r.user.name}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      {r.selfieUrl ? (
                        <button onClick={() => { setSelfieSrc(r.selfieUrl!); setSelfieModal(true); }}>
                          <img src={r.selfieUrl} alt="selfie" className="h-9 w-9 rounded-lg object-cover border border-border hover:border-primary/40 transition" />
                        </button>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border/60">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono text-xs">{r.checkInTime ?? "—"}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className={r.gpsValid ? "bg-success/10 text-success border-success/20 text-[10px]" : "bg-warning/10 text-warning border-warning/20 text-[10px]"}>
                          <MapPin className="mr-1 h-2.5 w-2.5" />
                          {r.gpsValid ? `✓ ${r.gpsDistanceM}m` : r.gpsDistanceM ? `${r.gpsDistanceM}m` : "No GPS"}
                        </Badge>
                        {r.gpsAccuracyM && <span className="text-[10px] font-mono text-muted-foreground">±{r.gpsAccuracyM.toFixed(0)}m acc</span>}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">{r.ipAddress ?? "—"}</td>
                    <td className="p-4 text-xs text-muted-foreground">{r.deviceInfo || "—"}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={STATUS_TONE[r.status]}>{r.status}</Badge>
                    </td>
                    <td className="p-4">
                      {r.isValidated ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 text-[10px]">
                          <ShieldCheck className="h-3 w-3" />Validated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">Pending</Badge>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => openValidate(r)}>
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />Validasi
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Tidak ada data check-in untuk tanggal ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Validate Modal */}
      <Dialog open={validateModal} onOpenChange={(o) => !o && setValidateModal(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Validasi Attendance — {selected?.user.name}</DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="grid gap-4 py-2">
            {selected?.selfieUrl && (
              <img src={selected.selfieUrl} alt="selfie" className="w-full max-h-48 object-cover rounded-lg border border-border" />
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-muted-foreground">Check-in</div>
                <div className="font-mono font-semibold">{selected?.checkInTime ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-muted-foreground">GPS</div>
                <div className={`font-semibold ${selected?.gpsValid ? "text-success" : "text-warning"}`}>
                  {selected?.gpsValid ? "Valid" : "Invalid"} · {selected?.gpsDistanceM}m
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-muted-foreground">IP</div>
                <div className="font-mono">{selected?.ipAddress ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <div className="text-muted-foreground">Device</div>
                <div>{selected?.deviceInfo ?? "—"}</div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Override Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as typeof newStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Catatan Admin (opsional)</Label>
              <Textarea value={adminNote} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAdminNote(e.target.value)}
                placeholder="Alasan perubahan status…" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateModal(false)}>Batal</Button>
            <Button className="gradient-primary text-primary-foreground" disabled={validating} onClick={handleValidate}>
              {validating ? "Menyimpan…" : "Konfirmasi Validasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selfie lightbox */}
      <Dialog open={selfieModal} onOpenChange={setSelfieModal}>
        <DialogContent className="sm:max-w-lg p-2">
          <img src={selfieSrc} alt="Selfie" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}
