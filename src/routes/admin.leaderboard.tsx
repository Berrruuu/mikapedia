import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Trophy, Medal } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { reportsApi, type LeaderboardEntry } from "@/lib/api";

export const Route = createFileRoute("/admin/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [ranked, setRanked] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await reportsApi.leaderboard("daily");
        setRanked(data);
      } catch (error) {
        console.error("Failed to load leaderboard", error);
      } finally {
        setLoading(false);
      }
    };

    void loadLeaderboard();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Discipline Leaderboard"
        description="Ranked by SOP adherence and execution consistency."
      />

      {loading ? (
        <div className="rounded-lg border border-border/60 bg-muted/50 p-10 text-center text-sm text-muted-foreground">Loading leaderboard…</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {ranked.slice(0, 3).map((t, i) => (
              <Card key={t.id} className={`relative overflow-hidden p-5 ${i === 0 ? "border-warning/40 gradient-primary text-primary-foreground" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? "bg-white/20 text-white" : "bg-muted/80 text-muted-foreground"}`}>
                    <Medal className="h-3 w-3" /> Rank #{t.rank}
                  </span>
                  <Trophy className={`h-6 w-6 ${i === 0 ? "text-warning" : i === 1 ? "text-muted-foreground" : "text-orange-500"}`} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className={i === 0 ? "bg-white/20 text-white" : "gradient-primary text-primary-foreground"}>
                      {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-bold">{t.name}</div>
                    <div className={`text-xs ${i === 0 ? "text-white/70" : "text-muted-foreground"}`}>{t.accountNumber || "No account"}</div>
                  </div>
                </div>
                <div className="mt-4 text-3xl font-bold">{t.executionRate}%</div>
                <div className={`text-[11px] uppercase tracking-wider ${i === 0 ? "text-white/70" : "text-muted-foreground"}`}>Execution rate</div>
              </Card>
            ))}
          </div>

          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-4 font-semibold">Rank</th>
                  <th className="p-4 font-semibold">Trader</th>
                  <th className="p-4 font-semibold">Execution</th>
                  <th className="p-4 font-semibold">Entry Accuracy</th>
                  <th className="p-4 font-semibold">Timing</th>
                  <th className="p-4 font-semibold">Compliance</th>
                  <th className="p-4 font-semibold text-right">Late Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ranked.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">No leaderboard records available.</td>
                  </tr>
                ) : ranked.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40">
                    <td className="p-4 font-mono font-bold text-muted-foreground">#{t.rank}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
                            {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{t.name}</div>
                      </div>
                    </td>
                    <td className="p-4 w-40">
                      <Progress value={t.executionRate} className="h-1.5" />
                      <div className="mt-1 text-xs font-mono font-semibold">{t.executionRate}%</div>
                    </td>
                    <td className="p-4 w-40">
                      <Progress value={t.entryAccuracy} className="h-1.5" />
                      <div className="mt-1 text-xs font-mono font-semibold">{t.entryAccuracy}%</div>
                    </td>
                    <td className="p-4 w-40">
                      <Progress value={t.timingAccuracy} className="h-1.5" />
                      <div className="mt-1 text-xs font-mono font-semibold">{t.timingAccuracy}%</div>
                    </td>
                    <td className="p-4 w-40">
                      <Progress value={t.complianceScore} className="h-1.5" />
                      <div className="mt-1 text-xs font-mono font-semibold">{t.complianceScore}%</div>
                    </td>
                    <td className="p-4 text-right font-mono font-semibold">{t.lateEntries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
