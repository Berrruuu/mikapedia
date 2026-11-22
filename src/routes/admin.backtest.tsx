import { createFileRoute } from "@tanstack/react-router";
import { BacktestPage } from "@/components/backtest-page";

export const Route = createFileRoute("/admin/backtest")({
  component: BacktestPage,
});
