import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_SYMBOLS, TradingViewChart, useIsDarkMode } from "@/components/tradingview-widget";

export const Route = createFileRoute("/trader/chart")({
  component: ChartPage,
});

function ChartPage() {
  const [active, setActive] = useState(CHART_SYMBOLS[0].code);
  const isDark = useIsDarkMode();
  const current = CHART_SYMBOLS.find((s) => s.code === active) ?? CHART_SYMBOLS[0];

  return (
    <>
      <PageHeader
        eyebrow="Trading Desk"
        title="Live Chart"
        description="Pantau pergerakan harga secara live sambil eksekusi sinyal."
        actions={
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live feed
          </Badge>
        }
      />

      <Card className="p-4">
        <Tabs value={active} onValueChange={setActive}>
          <TabsList>
            {CHART_SYMBOLS.map((s) => (
              <TabsTrigger key={s.code} value={s.code}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
          <TradingViewChart
            symbol={current.tvSymbol}
            theme={isDark ? "dark" : "light"}
            height={560}
          />
        </div>
      </Card>
    </>
  );
}
