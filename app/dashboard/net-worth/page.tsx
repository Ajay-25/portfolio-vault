import { Suspense } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { NetWorthContent } from "@/components/dashboard/net-worth-content";
import { NetWorthFallback } from "@/components/dashboard/suspense-fallbacks";

export const revalidate = 300;

export default function NetWorthPage() {
  return (
    <div>
      <TopBar title="Overview · Net Worth" />
      <main className="p-6">
        <div
          className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          Complete Picture
        </div>
        <h1
          className="font-display text-3xl font-normal leading-tight mb-6 animate-slide-up"
          style={{ color: "var(--text)" }}
        >
          Total <em style={{ color: "var(--gold)" }}>net worth aggregator</em>
        </h1>

        <Suspense fallback={<NetWorthFallback />}>
          <NetWorthContent />
        </Suspense>
      </main>
    </div>
  );
}
