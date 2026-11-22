import { createFileRoute } from "@tanstack/react-router";
import { BacktestPage } from "@/components/backtest-page";

export const Route = createFileRoute("/trader/backtest")({
  component: BacktestPage,
});
