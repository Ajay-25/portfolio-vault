import { notFound } from "next/navigation";
import { WealthSummaryView } from "@/components/dashboard/wealth-summary-view";
import { getWealthSummaryData } from "@/lib/wealth-summary";

/** Heavy: portfolio NAVs + fixed income + action items */
export async function WealthSummaryContent({ ownerSlug }: { ownerSlug: string }) {
  const data = await getWealthSummaryData(ownerSlug);
  if (!data) notFound();
  return <WealthSummaryView data={data} />;
}
