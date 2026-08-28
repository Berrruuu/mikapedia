import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Camera, MapPin, CheckCircle2, Clock, XCircle,
  CalendarClock, Monitor, Wifi, RefreshCw, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, getAccessToken, API_BASE } from "@/lib/auth";
import type { AttendanceShift } from "@/lib/api";

export const Route = createFileRoute("/trader/attendance")({
  component: TraderAttendance,
});

interface GpsState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  distanceM: number | null;
}

interface AttendanceRecord {
  id: number;
  status: string;
  checkInTime: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gpsDistanceM: number | null;
  gpsAccuracyM: number | null;
  ipAddress: string | null;
  deviceInfo: string;
  browser: string;
  os: string;
  selfieUrl: string | null;
  isValidated: boolean;
  shift?: AttendanceShift | null;
}

interface AttendanceTodayResponse {
  checked_in: boolean;
  records: AttendanceRecord[];
  available_shifts: AttendanceShift[];
}

const OFFICE_LAT = -6.2088;
const OFFICE_LNG = 106.8456;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlam = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function TraderAttendance() {
  const { user } = useAuth();

  // Today's record
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [availableShifts, setAvailableShifts] = useState<AttendanceShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const hasMultipleShifts = availableShifts.length > 1;

  // Selfie
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [stream, setStream]     = useState<MediaStream | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive]   = useState(false);
  const [cameraError, setCameraError]     = useState<string | null>(null);

  // GPS
  const [gps, setGps] = useState<GpsState>({
    lat: null, lng: null, accuracy: null,
    loading: false, error: null, distanceM: null,
  });

  // Device / IP info
  const [ipAddress, setIpAddress] = useState<string>("Detecting…");
  const [deviceInfo] = useState(() => {
    const ua = navigator.userAgent;
    const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Linux";
    const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown";
    return { os, browser, label: `${os} · ${browser}` };
  });

  const [submitting, setSubmitting] = useState(false);

  // ── Load today's record ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchToday = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`${API_BASE}/attendance/today/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json();
        const data = payload?.data as AttendanceTodayResponse | undefined;
        if (data) {
          setRecords(data.records ?? []);
          setAvailableShifts(data.available_shifts ?? []);

          if (data.available_shifts?.length === 1) {
            setSelectedShiftId(data.available_shifts[0].id);
          } else if (data.available_shifts?.length > 1) {
            const checkedShiftIds = new Set(
              (data.records ?? [])
                .map((record) => record.shift?.id)
                .filter((id): id is number => id != null),
            );
            const pending = data.available_shifts.filter((shift) => !checkedShiftIds.has(shift.id));
            if (pending.length === 1) {
              setSelectedShiftId(pending[0].id);
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingRecord(false);
      }
    };
    void fetchToday();
  }, []);

  // ── Detect IP ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d: { ip: string }) => setIpAddress(d.ip))
      .catch(() => setIpAddress("127.0.0.1"));
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const requestGps = () => {
    setGps((p) => ({ ...p, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const dist = haversine(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
        setGps({
          lat: latitude, lng: longitude, accuracy,
          loading: false, error: null,
          distanceM: Math.round(dist),
        });
      },
      (err) => setGps((p) => ({ ...p, loading: false, error: err.message })),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setStream(s);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch {
      setCameraError("Camera access denied. Please allow camera permission.");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setSelfieBlob(blob);
      setSelfiePreview(URL.createObjectURL(blob));
      stopCamera();
      toast.success("Photo captured!");
    }, "image/jpeg", 0.85);
  };

  const retakePhoto = () => {
    setSelfieBlob(null);
    setSelfiePreview(null);
    startCamera();
  };

  // File upload fallback
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieBlob(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  // ── Submit check-in ───────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!selfieBlob) { toast.error("Please capture a selfie first"); return; }
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("selfie", selfieBlob, "selfie.jpg");
      if (gps.lat !== null) formData.append("gps_lat", String(gps.lat));
      if (gps.lng !== null) formData.append("gps_lng", String(gps.lng));
      if (gps.accuracy !== null) formData.append("gps_accuracy_m", String(gps.accuracy));
      if (selectedShiftId !== null) {
        formData.append("shift_id", String(selectedShiftId));
      }

      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/attendance/checkin/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: formData,
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.data?.detail ?? payload?.error?.message ?? "Check-in failed");

      const record = (payload?.data?.record ?? payload?.data) as AttendanceRecord;
      if (!record || typeof record !== "object") {
        throw new Error("Invalid response from check-in.");
      }

      setRecords((prev) => {
        if (prev.some((existing) => existing.id === record.id)) {
          return prev;
        }
        return [...prev, record];
      });

      toast.success(`✓ Check-in recorded · ${record.status} · ${record.checkInTime}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  // ── Already checked in ────────────────────────────────────────────────────
  const pendingShifts = availableShifts.filter(
    (shift) => !records.some((record) => record.shift?.id === shift.id),
  );
  const alreadyCheckedAll =
    availableShifts.length > 0
      ? pendingShifts.length === 0
      : records.length > 0;

  const checkedRecords = records;
  const lastRecord = records[0];

  if (!loadingRecord && alreadyCheckedAll && records.length > 0) {
    return (
      <>
        <PageHeader eyebrow="Personal" title="Attendance Check-in" description="Record kehadiran trading session hari ini." />
        <div className="max-w-lg mx-auto">
          <Card className="p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4 bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div className="text-xl font-bold mb-1">Semua sesi sudah tercatat</div>
            <div className="text-sm text-muted-foreground mb-4">Kamu sudah check-in untuk semua shift yang tersedia hari ini.</div>

            {records.map((savedRecord) => (
              <div key={savedRecord.id} className="mb-6">
                <div className="flex justify-center mb-3">
                  <Badge variant="outline" className={
                    savedRecord.status === "Present" ? "bg-success/10 text-success border-success/20 text-sm px-4 py-1" :
                    savedRecord.status === "Late"    ? "bg-warning/10 text-warning border-warning/20 text-sm px-4 py-1" :
                    "bg-destructive/10 text-destructive border-destructive/20 text-sm px-4 py-1"
                  }>
                    {savedRecord.shift ? `${savedRecord.shift.name} · ${savedRecord.status}` : savedRecord.status}
                  </Badge>
                </div>
                {savedRecord.selfieUrl && (
                  <img src={savedRecord.selfieUrl} alt="Selfie" className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-2 border-border" />
                )}
              </div>
            ))}

            <Separator className="my-4" />
            {lastRecord ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-left">
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">GPS</div>
                  <div className="font-semibold text-success">
                    {lastRecord.gps_lat != null && lastRecord.gps_lng != null ?
                      `${lastRecord.gps_lat.toFixed(5)}, ${lastRecord.gps_lng.toFixed(5)}` :
                      `GPS tercatat · ${lastRecord.gpsDistanceM ?? "—"}m`
                    }
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">IP Address</div>
                  <div className="font-mono font-semibold">{lastRecord.ipAddress}</div>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">Device</div>
                  <div className="font-semibold">{lastRecord.deviceInfo}</div>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">Validasi Admin</div>
                  <div className={`font-semibold ${lastRecord.isValidated ? "text-success" : "text-muted-foreground"}`}>
                    {lastRecord.isValidated ? "✓ Validated" : "Pending"}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Personal"
        title="Attendance Check-in"
        description="Upload selfie di depan chart trading untuk memulai sesi hari ini."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />{timeStr} · {dateStr}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Selfie capture */}
        <Card className="lg:col-span-2 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold">Selfie Capture</div>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span><Camera className="mr-1.5 h-3.5 w-3.5" />Upload foto</span>
              </Button>
              <input type="file" accept="image/*" className="sr-only" onChange={handleFileUpload} />
            </label>
          </div>

          {/* Preview */}
          {availableShifts.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-semibold mb-2">Pilih sesi</div>
              {availableShifts.length === 1 ? (
                <div className="rounded-lg border border-border/60 p-3 text-sm">
                  {availableShifts[0].name} · {availableShifts[0].startTime} - {availableShifts[0].endTime}
                </div>
              ) : (
                <Select value={selectedShiftId !== null ? String(selectedShiftId) : ""} onValueChange={(value) => setSelectedShiftId(value ? Number(value) : null)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih sesi untuk check-in" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShifts.map((shift) => (
                      <SelectItem key={shift.id} value={String(shift.id)}>
                        {shift.name} · {shift.startTime} - {shift.endTime}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {hasMultipleShifts && (
                <div className="text-sm text-muted-foreground mt-2">
                  Dua sesi hanya tersedia jika kamu menggantikan trader lain hari ini.
                </div>
              )}
              {hasMultipleShifts && selectedShiftId === null && (
                <div className="text-sm text-destructive mt-2">
                  Pilih sesi untuk check-in sebelum melanjutkan.
                </div>
              )}
            </div>
          )}

          {selfiePreview ? (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
              <img src={selfiePreview} alt="Selfie preview" className="w-full h-full object-cover" />
              <button onClick={retakePhoto}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-background/90 px-3 py-1.5 text-xs font-medium backdrop-blur border border-border hover:bg-background transition">
                <RefreshCw className="h-3.5 w-3.5" />Ambil ulang
              </button>
            </div>
          ) : cameraActive ? (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <div className="absolute inset-0 flex items-end justify-center pb-4 gap-3">
                <button onClick={capturePhoto}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-elevated hover:scale-105 transition">
                  <div className="h-10 w-10 rounded-full bg-primary" />
                </button>
                <button onClick={stopCamera}
                  className="flex items-center gap-1.5 rounded-lg bg-background/80 px-3 py-1.5 text-xs backdrop-blur border border-border">
                  <XCircle className="h-3.5 w-3.5" />Batal
                </button>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : (
            <div className="aspect-video rounded-xl border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-3">
              {cameraError ? (
                <>
                  <AlertTriangle className="h-10 w-10 text-warning" />
                  <div className="text-sm text-center text-muted-foreground max-w-xs">{cameraError}</div>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span><Camera className="mr-1.5 h-3.5 w-3.5" />Upload foto sebagai gantinya</span>
                    </Button>
                    <input type="file" accept="image/*" className="sr-only" onChange={handleFileUpload} />
                  </label>
                </>
              ) : (
                <>
                  <Camera className="h-12 w-12 text-muted-foreground" />
                  <div className="text-sm font-medium">Posisikan diri di depan chart trading</div>
                  <div className="text-xs text-muted-foreground text-center max-w-sm">
                    Timestamp, GPS, IP, dan informasi device akan dicatat otomatis.
                  </div>
                  <Button className="gradient-primary text-primary-foreground" onClick={startCamera}>
                    <Camera className="mr-1.5 h-4 w-4" />Buka Kamera
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Map placeholder */}
          {gps.lat && gps.lng && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Lokasi GPS</div>
              <div className="rounded-xl overflow-hidden border border-border/60 h-40 bg-muted/30 relative">
                <iframe
                  title="office-map"
                  className="w-full h-full"
                  style={{ border: 0 }}
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${gps.lat},${gps.lng}&z=16&output=embed`}
                />
                <div className="absolute top-2 right-2 rounded-lg bg-background/90 px-2 py-1 text-xs font-mono backdrop-blur border border-border">
                  {gps.lat != null && gps.lng != null ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "GPS belum tersedia"}
                </div>
              </div>
            </div>
          )}

          <Button
            className="mt-4 w-full h-11 gradient-primary text-primary-foreground"
            disabled={submitting || !selfieBlob || (hasMultipleShifts && selectedShiftId === null)}
            onClick={handleCheckIn}
          >
            {submitting ? "Menyimpan…" : "✓ Konfirmasi Check-in"}
          </Button>
        </Card>

        {/* Session context */}
        <Card className="p-6">
          <div className="mb-4 text-sm font-semibold">Session Context</div>
          <div className="space-y-3">

            {/* GPS */}
            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />GPS Lokasi
                </div>
                <button onClick={requestGps} className="text-xs text-primary hover:underline">Refresh</button>
              </div>
              {gps.loading ? (
                <div className="text-xs text-muted-foreground">Mendeteksi lokasi…</div>
              ) : gps.error ? (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  Gagal: {gps.error}
                </Badge>
              ) : gps.lat ? (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    ✓ GPS tercatat
                  </Badge>
                  <div className="text-sm font-semibold">
                    {gps.lat != null && gps.lng != null ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "GPS belum tersedia"}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Akurasi: ±{gps.accuracy != null ? gps.accuracy.toFixed(0) : "—"}m
                  </div>
                </div>
              ) : gps.error ? (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                  GPS tidak tersedia — lokasi opsional. Tekan Refresh jika ingin mencoba lagi.
                </Badge>
              ) : (
                <div className="text-xs text-muted-foreground">Belum ada data GPS</div>
              )}
            </div>

            {/* IP */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Wifi className="h-4 w-4" />IP Address</div>
              <span className="font-mono text-xs">{ipAddress}</span>
            </div>

            {/* Device */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Monitor className="h-4 w-4" />Device</div>
              <span className="text-xs">{deviceInfo.label}</span>
            </div>

            {/* Time */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" />Waktu</div>
              <span className="font-mono text-xs">{timeStr}</span>
            </div>

            <Separator />

            {/* Validation summary */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validasi</div>
              {[
                { label: "Selfie", ok: !!selfieBlob },
                { label: "GPS Lokasi", ok: gps.lat !== null },
                { label: "GPS terkumpul", ok: gps.lat !== null },
                { label: "Session aktif", ok: true },
              ].map((v) => (
                <div key={v.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{v.label}</span>
                  {v.ok
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <XCircle className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
