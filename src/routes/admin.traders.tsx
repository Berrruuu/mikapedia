import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, Plus, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  usersApi,
  mt5Api,
  attendanceApi,
  type UserSummary,
  type MT5Account,
  type AttendanceShift,
  type AttendanceSchedule,
  type AttendanceScheduleEntry,
  type AttendanceRecord,
} from "@/lib/api";

export const Route = createFileRoute("/admin/traders")({
  component: TradersPage,
});

type TraderRow = {
  id: string;
  name: string;
  email: string;
  attendance: "Present" | "Late" | "Absent";
  presence: string;
  status: string;
  accountNumber: string;
  openPositions: number;
  balance: number;
  equity: number;
  floatingPnl: number;
  executionRate: number;
  complianceScore: number;
  scheduleName: string;
  scheduleActive: boolean;
  scheduleNotes: string;
};

function TradersPage() {
  const [traders, setTraders] = useState<TraderRow[]>([]);
  const [traderUsers, setTraderUsers] = useState<UserSummary[]>([]);
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [schedules, setSchedules] = useState<Record<string, AttendanceSchedule>>({});
  const [dailyAssignments, setDailyAssignments] = useState<Record<string, AttendanceScheduleEntry>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<UserSummary | null>(null);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleActive, setScheduleActive] = useState(true);
  const [entryDate, setEntryDate] = useState("");
  const [entryAssignmentType, setEntryAssignmentType] = useState("regular");
  const [entryCoverForId, setEntryCoverForId] = useState<string | null>(null);
  const [entryShiftId, setEntryShiftId] = useState<number | null>(null);
  const [entryNotes, setEntryNotes] = useState("");
  const [entryId, setEntryId] = useState<number | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingSwap, setSavingSwap] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        const [users, accounts, shiftList, scheduleList, scheduleEntryList, attendanceRecords] =
          await Promise.all([
            usersApi.list({ role: "trader", page_size: 200 }),
            mt5Api.list(),
            attendanceApi.listShifts(),
            attendanceApi.listSchedules(),
            attendanceApi.listScheduleEntries({ date: today }),
            attendanceApi.list({ date: today }),
          ]);

        const accountList = Array.isArray(accounts) ? accounts : (accounts.results ?? []);
        const scheduleMap = Object.fromEntries(
          scheduleList.map((schedule) => [String(schedule.user.id), schedule]),
        );
        const entryMap = Object.fromEntries(
          scheduleEntryList.map((entry) => [String(entry.user.id), entry]),
        );
        const attendanceMap = Object.fromEntries(
          attendanceRecords.map((record) => [String(record.user.id), record]),
        );

        setTraderUsers(users);
        setShifts(shiftList);
        setSchedules(scheduleMap);
        setDailyAssignments(entryMap);

        const rows = users.map((user) => {
          const account = accountList.find((acc) => String(acc.user?.id) === String(user.id));
          const attendanceRecord = attendanceMap[String(user.id)];
          const schedule = scheduleMap[String(user.id)];
          const dailyEntry = entryMap[String(user.id)];
          const attendance = attendanceRecord ? attendanceRecord.status : "Absent";
          const presence =
            user.status === "active" ? "Online" : user.status === "suspended" ? "Away" : "Offline";

          const dailyAssignmentLabel = dailyEntry
            ? dailyEntry.assignmentType === "off"
              ? "Off today"
              : dailyEntry.assignmentType === "cover"
                ? `Cover ${dailyEntry.coverFor?.name ?? dailyEntry.coverFor?.email ?? "unknown"}`
                : dailyEntry.shift
                  ? dailyEntry.shift.name
                  : "Assigned"
            : null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            status: user.status ?? "unknown",
            attendance,
            presence,
            accountNumber: account?.accountNumber ? `MT5-${account.accountNumber}` : "N/A",
            openPositions: account?.openPositions ?? 0,
            balance: account?.balance ?? 0,
            equity: account?.equity ?? 0,
            floatingPnl: account?.floatingPnl ?? 0,
            executionRate: user.executionRate ?? 0,
            complianceScore: user.complianceScore ?? 0,
            scheduleName:
              dailyAssignmentLabel ??
              (schedule
                ? `${schedule.shift.name} ${schedule.startDate} → ${schedule.endDate}`
                : "No schedule"),
            scheduleActive: schedule ? schedule.is_active : false,
            scheduleNotes: dailyAssignmentLabel
              ? "Daily assignment override"
              : schedule
                ? schedule.notes
                : "",
          };
        });

        setTraders(rows);
      } catch (error) {
        console.error("Failed to load traders", error);
        toast.error(error instanceof Error ? error.message : "Failed to load traders");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const openScheduleDialog = (trader: UserSummary) => {
    const schedule = schedules[trader.id];
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);

    setSelectedTrader(trader);
    setScheduleId(schedule?.id ?? null);
    setSelectedShiftId(schedule?.shift?.id ?? null);
    setScheduleNotes(schedule?.notes ?? "");
    setScheduleActive(schedule?.is_active ?? true);
    setScheduleStartDate(schedule?.startDate ?? today.toISOString().slice(0, 10));
    setScheduleEndDate(schedule?.endDate ?? nextMonth.toISOString().slice(0, 10));
    setScheduleOpen(true);
  };

  const openEntryDialog = (trader: UserSummary) => {
    const today = new Date().toISOString().slice(0, 10);
    const existingEntry = dailyAssignments[trader.id];
    setSelectedTrader(trader);
    setEntryId(existingEntry?.id ?? null);
    setEntryDate(existingEntry?.date ?? today);
    setEntryAssignmentType(existingEntry?.assignmentType ?? "regular");
    setEntryCoverForId(existingEntry?.coverFor?.id ?? null);
    setEntryShiftId(existingEntry?.shift?.id ?? null);
    setEntryNotes(existingEntry?.notes ?? "");
    setEntryOpen(true);
  };

  const openSwapDialog = (trader: UserSummary) => {
    setSelectedTrader(trader);
    setSwapTargetId(null);
    setSwapOpen(true);
  };

  const saveSchedule = async () => {
    if (!selectedTrader || selectedShiftId == null) {
      toast.error("Please select a session first.");
      return;
    }

    setSavingSchedule(true);
    try {
      const payload = {
        userId: selectedTrader.id,
        shiftId: selectedShiftId,
        startDate: scheduleStartDate,
        endDate: scheduleEndDate,
        notes: scheduleNotes,
        is_active: scheduleActive,
      };

      const saved = scheduleId
        ? await attendanceApi.updateSchedule(scheduleId, payload)
        : await attendanceApi.createSchedule(payload);

      setSchedules((prev) => ({ ...prev, [String(selectedTrader.id)]: saved }));
      setTraders((prev) =>
        prev.map((row) =>
          row.id === selectedTrader.id
            ? {
                ...row,
                scheduleName: `${saved.shift.name} ${saved.startDate} → ${saved.endDate}`,
                scheduleActive: saved.is_active,
                scheduleNotes: saved.notes,
              }
            : row,
        ),
      );

      toast.success(`Schedule saved for ${selectedTrader.name}`);
      setScheduleOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Trader Management"
        description="Manage trader schedules, MT5 accounts and attendance in one view."
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" className="h-9 pl-8 w-56" disabled />
          </div>
        }
      />

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-semibold">Trader</th>
                <th className="p-4 font-semibold">MT5 Account</th>
                <th className="p-4 font-semibold">Schedule</th>
                <th className="p-4 font-semibold">Attendance</th>
                <th className="p-4 font-semibold">Balance / Equity</th>
                <th className="p-4 font-semibold">Floating</th>
                <th className="p-4 font-semibold">Execution</th>
                <th className="p-4 font-semibold">Compliance</th>
                <th className="p-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">
                    Loading traders…
                  </td>
                </tr>
              ) : traders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">
                    No trader accounts found.
                  </td>
                </tr>
              ) : (
                traders.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
                              {t.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                              t.presence === "Online"
                                ? "bg-success"
                                : t.presence === "Away"
                                  ? "bg-warning"
                                  : "bg-muted-foreground"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{t.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {t.presence} · {t.openPositions} Open
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs">{t.accountNumber}</td>
                    <td className="p-4">
                      <div className="space-y-1 text-xs">
                        <div>{t.scheduleName}</div>
                        <div
                          className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${t.scheduleActive ? "bg-success/10 text-success border border-success/20" : "bg-muted text-muted-foreground border border-border"}`}
                        >
                          {t.scheduleActive ? "Active" : "Inactive"}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={
                          t.attendance === "Present"
                            ? "bg-success/10 text-success border-success/20"
                            : t.attendance === "Late"
                              ? "bg-warning/10 text-warning border-warning/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {t.attendance}
                      </Badge>
                    </td>
                    <td className="p-4 font-mono text-xs">
                      <div>${t.balance.toLocaleString()}</div>
                      <div className="text-muted-foreground">${t.equity.toLocaleString()}</div>
                    </td>
                    <td
                      className={`p-4 font-mono text-xs font-semibold ${t.floatingPnl >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {t.floatingPnl >= 0 ? "+" : ""}${t.floatingPnl.toFixed(2)}
                    </td>
                    <td className="p-4 min-w-[10rem]">
                      <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                        {t.executionRate.toFixed(0)}%
                      </div>
                      <Progress
                        value={Math.min(Math.max(t.executionRate, 0), 100)}
                        className="h-2"
                      />
                    </td>
                    <td className="p-4 min-w-[10rem]">
                      <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                        {t.complianceScore.toFixed(0)}%
                      </div>
                      <Progress
                        value={Math.min(Math.max(t.complianceScore, 0), 100)}
                        className="h-2"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            openScheduleDialog({
                              id: t.id,
                              name: t.name,
                              email: t.email,
                              role: "trader",
                              status: t.status,
                            })
                          }
                        >
                          Schedule
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            openEntryDialog({
                              id: t.id,
                              name: t.name,
                              email: t.email,
                              role: "trader",
                              status: t.status,
                            })
                          }
                        >
                          Daily
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openSwapDialog({
                              id: t.id,
                              name: t.name,
                              email: t.email,
                              role: "trader",
                              status: t.status,
                            })
                          }
                        >
                          Swap
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTrader ? `Schedule ${selectedTrader.name}` : "Trader Schedule"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Session</Label>
                <Select
                  value={selectedShiftId ? String(selectedShiftId) : ""}
                  onValueChange={(value) => setSelectedShiftId(value ? Number(value) : null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose session" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={String(shift.id)}>
                        {shift.name} · {shift.startTime} - {shift.endTime}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Active range</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    type="date"
                    value={scheduleStartDate}
                    onChange={(event) => setScheduleStartDate(event.target.value)}
                  />
                  <Input
                    type="date"
                    value={scheduleEndDate}
                    onChange={(event) => setScheduleEndDate(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                value={scheduleNotes}
                onChange={(event) => setScheduleNotes(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <div className="text-sm font-semibold">Schedule active</div>
                <div className="text-xs text-muted-foreground">
                  Disable schedule untuk menghentikan shift assignment.
                </div>
              </div>
              <Switch checked={scheduleActive} onCheckedChange={setScheduleActive} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScheduleOpen(false)}
              disabled={savingSchedule}
            >
              Cancel
            </Button>
            <Button onClick={saveSchedule} disabled={savingSchedule || selectedShiftId == null}>
              {savingSchedule ? "Saving…" : "Save Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTrader ? `Daily Assignment ${selectedTrader.name}` : "Daily Assignment"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Assignment type</Label>
                <Select
                  value={entryAssignmentType}
                  onValueChange={(value) => setEntryAssignmentType(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {entryAssignmentType !== "off" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Session</Label>
                  <Select
                    value={entryShiftId ? String(entryShiftId) : ""}
                    onValueChange={(value) => setEntryShiftId(value ? Number(value) : null)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose session" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((shift) => (
                        <SelectItem key={shift.id} value={String(shift.id)}>
                          {shift.name} · {shift.startTime} - {shift.endTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {entryAssignmentType === "cover" ? (
                  <div className="grid gap-2">
                    <Label>Cover trader</Label>
                    <Select
                      value={entryCoverForId || ""}
                      onValueChange={(value) => setEntryCoverForId(value || null)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose trader" />
                      </SelectTrigger>
                      <SelectContent>
                        {traderUsers
                          .filter((user) => user.id !== selectedTrader?.id)
                          .map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} · {user.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input value={entryNotes} onChange={(event) => setEntryNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryOpen(false)} disabled={savingEntry}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedTrader) {
                  toast.error("Please select a trader.");
                  return;
                }
                if (!entryDate) {
                  toast.error("Please select a date.");
                  return;
                }
                if (entryAssignmentType !== "off" && !entryShiftId) {
                  toast.error("Please select a session.");
                  return;
                }
                if (entryAssignmentType === "cover" && !entryCoverForId) {
                  toast.error("Please select the trader you are covering.");
                  return;
                }
                setSavingEntry(true);
                try {
                  const payload = {
                    userId: selectedTrader.id,
                    date: entryDate,
                    assignmentType: entryAssignmentType,
                    shiftId: entryAssignmentType === "off" ? null : entryShiftId,
                    coverForId: entryAssignmentType === "cover" ? entryCoverForId : null,
                    notes: entryNotes,
                  };
                  const saved = entryId
                    ? await attendanceApi.updateScheduleEntry(entryId, payload)
                    : await attendanceApi.createScheduleEntry(payload);
                  setEntryId(saved.id);
                  setDailyAssignments((prev) => ({ ...prev, [String(selectedTrader.id)]: saved }));
                  setTraders((prev) =>
                    prev.map((row) =>
                      row.id === selectedTrader.id
                        ? {
                            ...row,
                            scheduleName:
                              saved.assignmentType === "off"
                                ? "Off today"
                                : saved.assignmentType === "cover"
                                  ? `Cover ${saved.coverFor?.name ?? saved.coverFor?.email ?? "unknown"}`
                                  : saved.shift
                                    ? saved.shift.name
                                    : "Assigned",
                            scheduleNotes: saved.notes || "Daily assignment override",
                          }
                        : row,
                    ),
                  );
                  toast.success("Daily schedule entry saved.");
                  setEntryOpen(false);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Failed to save daily assignment",
                  );
                } finally {
                  setSavingEntry(false);
                }
              }}
              disabled={savingEntry}
            >
              {savingEntry ? "Saving…" : "Save Daily Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTrader ? `Swap schedule for ${selectedTrader.name}` : "Swap Schedule"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Swap with trader</Label>
              <Select
                value={swapTargetId || ""}
                onValueChange={(value) => setSwapTargetId(value || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose trader" />
                </SelectTrigger>
                <SelectContent>
                  {traderUsers
                    .filter((user) => user.id !== selectedTrader?.id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} · {user.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOpen(false)} disabled={savingSwap}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedTrader || !swapTargetId) {
                  toast.error("Please choose another trader to swap with.");
                  return;
                }
                setSavingSwap(true);
                try {
                  const result = await attendanceApi.swapSchedules(selectedTrader.id, swapTargetId);
                  const updatedSchedules = Array.isArray(result.schedules) ? result.schedules : [];
                  const newScheduleMap = { ...schedules };
                  updatedSchedules.forEach((schedule) => {
                    newScheduleMap[String(schedule.user.id)] = schedule;
                  });
                  setSchedules(newScheduleMap);
                  setTraders((prev) =>
                    prev.map((row) => {
                      const schedule = newScheduleMap[String(row.id)];
                      return {
                        ...row,
                        scheduleName: schedule
                          ? `${schedule.shift.name} ${schedule.startDate} → ${schedule.endDate}`
                          : "No schedule",
                        scheduleActive: schedule ? schedule.is_active : false,
                        scheduleNotes: schedule ? schedule.notes : "",
                      };
                    }),
                  );
                  toast.success("Schedules swapped successfully.");
                  setSwapOpen(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to swap schedules");
                } finally {
                  setSavingSwap(false);
                }
              }}
              disabled={savingSwap || !swapTargetId}
            >
              {savingSwap ? "Swapping…" : "Swap Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
