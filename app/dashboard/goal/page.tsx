import { Suspense } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { GoalTrackerContent } from "@/components/dashboard/goal-tracker-content";
import { GoalTrackerFallback } from "@/components/dashboard/suspense-fallbacks";

export const revalidate = 300;

export default function GoalPage() {
  return (
    <div>
      <TopBar title="Overview · Goal Tracker" />
      <main className="p-6">
        <div
          className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          Wealth Target
        </div>
        <h1
          className="font-display text-3xl font-normal leading-tight mb-6 animate-slide-up"
          style={{ color: "var(--text)" }}
        >
          Goal <em style={{ color: "var(--gold)" }}>progress tracker</em>
        </h1>

        <Suspense fallback={<GoalTrackerFallback />}>
          <GoalTrackerContent />
        </Suspense>
      </main>
    </div>
  );
}
