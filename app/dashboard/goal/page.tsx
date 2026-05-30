import { TopBar } from "@/components/layout/top-bar";
import { GoalTrackerView } from "@/components/dashboard/goal-tracker-view";
import { getGoalTrackerData } from "@/lib/goals";

export const revalidate = 300;

export default async function GoalPage() {
  const data = await getGoalTrackerData();

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

        <GoalTrackerView data={data} />
      </main>
    </div>
  );
}
