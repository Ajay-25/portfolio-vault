import { notFound } from "next/navigation";
import { FixedIncomeDashboard } from "@/components/dashboard/fixed-income-dashboard";
import { getFixedIncomeHoldings, getFixedIncomeSummary } from "@/lib/fixed-income-data";
import { resolveOwner } from "@/lib/wealth-config";

export async function FixedIncomeContent({ ownerSlug }: { ownerSlug: string }) {
  const owner = resolveOwner(ownerSlug);
  if (!owner) notFound();

  const [holdings, summary] = await Promise.all([
    getFixedIncomeHoldings(owner.portfolioId),
    getFixedIncomeSummary(owner.portfolioId),
  ]);

  return (
    <FixedIncomeDashboard
      holdings={holdings}
      summary={summary}
      portfolioId={owner.portfolioId}
    />
  );
}
