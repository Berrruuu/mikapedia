import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Sparkles } from "lucide-react";

interface ModulePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  icon?: ReactNode;
}

export function ModulePlaceholder({ eyebrow, title, description, features, icon }: ModulePlaceholderProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card className="relative overflow-hidden p-8 md:p-10 border-border/60">
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
          background: "radial-gradient(circle at 20% 20%, var(--color-primary) 0%, transparent 40%), radial-gradient(circle at 80% 60%, var(--color-success) 0%, transparent 45%)",
          filter: "blur(60px)",
        }} />
        <div className="relative">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-elevated text-primary-foreground">
            {icon ?? <Sparkles className="h-6 w-6" />}
          </div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Module ready</Badge>
            <Badge variant="outline">Wired for backend integration</Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Enterprise-grade {title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            This module is wired into the MIKAPEDIA TOMS architecture and is prepared for connection to Django REST Framework, PostgreSQL, TradingView Webhooks, and MetaTrader 5 API endpoints.
          </p>
          <div className="mt-6 grid gap-2 md:grid-cols-2">
            {features.map((f) => (
              <div key={f} className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-sm text-foreground">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
