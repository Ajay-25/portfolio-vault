import { GoalTrackerView } from "@/components/dashboard/goal-tracker-view";
import { getGoalTrackerData } from "@/lib/goals";

/** Heavy: bulk NAV fetch for corpus calculation */
export async function GoalTrackerContent() {
  const data = await getGoalTrackerData();
  return <GoalTrackerView data={data} />;
}
