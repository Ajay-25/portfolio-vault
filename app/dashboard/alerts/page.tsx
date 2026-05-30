import { Suspense } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { StockAlertsContent } from "@/components/dashboard/stock-alerts-content";
import { StockAlertsFallback } from "@/components/dashboard/suspense-fallbacks";

export const revalidate = 300;

export default function AlertsPage() {
  return (
    <div>
      <TopBar title="Planning · Stock Alerts" />
      <main className="p-6">
        <div
          className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          Watch List
        </div>
        <h1
          className="font-display text-3xl font-normal leading-tight mb-6 animate-slide-up"
          style={{ color: "var(--text)" }}
        >
          Stock <em style={{ color: "var(--gold)" }}>price alerts</em>
        </h1>

        <Suspense fallback={<StockAlertsFallback />}>
          <StockAlertsContent />
        </Suspense>
      </main>
    </div>
  );
}
