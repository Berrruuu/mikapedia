import { memo, useEffect, useRef, useState } from "react";

// Maps the app's internal pair codes (see src/lib/mock-data.ts) to TradingView
// ticker symbols. Swap the exchange prefix if your broker feed differs.
export interface ChartSymbol {
  code: string;
  label: string;
  tvSymbol: string;
}

export const CHART_SYMBOLS: ChartSymbol[] = [
  { code: "XAUUSD", label: "XAU/USD", tvSymbol: "OANDA:XAUUSD" },
  { code: "EURUSD", label: "EUR/USD", tvSymbol: "OANDA:EURUSD" },
  { code: "GBPJPY", label: "GBP/JPY", tvSymbol: "OANDA:GBPJPY" },
  { code: "USDJPY", label: "USD/JPY", tvSymbol: "OANDA:USDJPY" },
  { code: "BTCUSD", label: "BTC/USD", tvSymbol: "COINBASE:BTCUSD" },
];

/** Tracks the app's dark/light class on <html> so the chart skin follows it. */
export function useIsDarkMode() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

interface TradingViewChartProps {
  /** TradingView ticker, e.g. "OANDA:XAUUSD" — use CHART_SYMBOLS for the app's tracked pairs. */
  symbol: string;
  interval?: string;
  theme?: "light" | "dark";
  height?: number | string;
}

function TradingViewChartImpl({
  symbol,
  interval = "15",
  theme = "dark",
  height = 520,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset before mounting — avoids stacking duplicate iframes on
    // symbol/theme change or when TanStack Router re-renders the route.
    container.innerHTML = "";

    const widgetEl = document.createElement("div");
    widgetEl.className = "tradingview-widget-container__widget";
    widgetEl.style.height = "100%";
    widgetEl.style.width = "100%";
    widgetEl.style.minHeight = "100%";
    widgetEl.style.display = "block";
    container.appendChild(widgetEl);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    const widgetHeight = typeof height === "number" ? height : parseInt(String(height), 10) || 520;
    script.innerHTML = JSON.stringify({
      autosize: true,
      width: "100%",
      height: widgetHeight,
      symbol,
      interval,
      timezone: "Asia/Jakarta",
      theme,
      style: "1",
      locale: "id",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, interval, theme]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container h-full w-full"
      style={{ height }}
    />
  );
}

// TradingView's embed script is not cheap to re-mount — memoize so unrelated
// parent re-renders (notifications, polling, etc.) don't reload the iframe.
export const TradingViewChart = memo(TradingViewChartImpl);
