import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: number;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
  className?: string;
}

const accentMap = {
  primary: "text-primary bg-primary/10 border-primary/20",
  success: "text-success bg-success/10 border-success/20",
  warning: "text-warning bg-warning/10 border-warning/20",
  destructive: "text-destructive bg-destructive/10 border-destructive/20",
  info: "text-info bg-info/10 border-info/20",
};

export function StatCard({ label, value, hint, icon, trend, accent = "primary", className }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden border-border/60 p-5 transition-all hover:shadow-elevated hover:-translate-y-0.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", accentMap[accent])}>
            {icon}
          </div>
        )}
      </div>
      {typeof trend === "number" && (
        <div className={cn("mt-3 inline-flex items-center gap-1 text-xs font-medium",
          trend >= 0 ? "text-success" : "text-destructive")}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs last session
        </div>
      )}
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-40",
        accent === "primary" && "bg-primary/10",
        accent === "success" && "bg-success/10",
        accent === "warning" && "bg-warning/10",
        accent === "destructive" && "bg-destructive/10",
        accent === "info" && "bg-info/10",
      )} />
    </Card>
  );
}
