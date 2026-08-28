import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Radio, CheckCircle2, XCircle, Clock, AlertTriangle, Target, Timer, TrendingUp } from "lucide-react";
import { reportsApi, type SessionReport } from "@/lib/api";

export const Route = createFileRoute("/trader/report")({
  component: SessionReport,
});

function SessionReport() {
  const [session, setSession] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await reportsApi.session();
        if (active) setSession(data);
      } catch (err) {
        console.error("Failed to load session report", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const exportSession = async () => {
    window.open(`/api/reports/export/session/?format=pdf`, "_blank");
  };

  const totalSignals = session?.execution?.totalSignals ?? 0;
  const executed = session?.execution?.executed ?? 0;
  const missed = session?.execution?.missed ?? 0;
  const late = session?.execution?.late ?? 0;
  const wrong = session?.execution?.wrongDirection ?? 0;
  const execRate = session?.execution?.executionRate ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="End of Session" title="Session Report"
        description="Your official daily KPI, auto-generated at market close."
        actions={<Button size="sm" className="gradient-primary text-primary-foreground" onClick={exportSession}><Download className="mr-1.5 h-3.5 w-3.5" />Export PDF</Button>}
      />

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total Signals" value={totalSignals} icon={<Radio className="h-5 w-5" />} accent="primary" />
        <StatCard label="Executed" value={executed} hint={execRate ? `${execRate}%` : undefined} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Missed" value={missed} icon={<XCircle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Late" value={late} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="Wrong Direction" value={wrong} icon={<AlertTriangle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Entry Accuracy" value={`${session?.execution ? Math.round((executed / (totalSignals || 1)) * 100) : 0}%`} icon={<Target className="h-5 w-5" />} accent="success" />
        <StatCard label="Timing Accuracy" value={session?.execution?.timingAccuracy ?? "—"} icon={<Timer className="h-5 w-5" />} accent="info" />
        <StatCard label="Execution Rate" value={`${execRate}%`} trend={Math.round(execRate) - 50} icon={<TrendingUp className="h-5 w-5" />} accent="primary" />
      </div>

      <Card className="mt-6 p-6 gradient-primary text-primary-foreground">
        <div className="text-[11px] uppercase tracking-widest text-primary-foreground/70">Supervisor sign-off</div>
        <div className="mt-2 text-lg font-semibold">{session?.leaderboard && session.leaderboard.length > 0 ? `Top performer: ${session.leaderboard[0].name}` : "Supervisor notes will appear here."}</div>
        <div className="mt-1 text-xs text-primary-foreground/70">{session?.sessionDate ?? ''}</div>
      </Card>
    </>
  );
}
