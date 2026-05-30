import { notFound } from "next/navigation";
import { FixedIncomeView } from "@/components/dashboard/fixed-income-view";
import { getFixedIncomePageData } from "@/lib/fixed-income-data";

export async function FixedIncomeContent({ ownerSlug }: { ownerSlug: string }) {
  const data = await getFixedIncomePageData(ownerSlug);
  if (!data) notFound();
  return <FixedIncomeView data={data} />;
}
