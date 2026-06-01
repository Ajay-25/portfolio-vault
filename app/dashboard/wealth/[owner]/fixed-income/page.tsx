import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { WealthSubNav } from "@/components/dashboard/wealth-sub-nav";
import { FixedIncomeDashboard } from "@/components/dashboard/fixed-income-dashboard";
import { getFixedIncomeHoldings, getFixedIncomeSummary } from "@/lib/fixed-income-data";
import { resolveOwner, wealthTopBarTitle, type WealthOwnerSlug } from "@/lib/wealth-config";

export const revalidate = 0;

export default async function WealthFixedIncomePage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner: ownerSlug } = await params;
  const owner = resolveOwner(ownerSlug);
  if (!owner) notFound();

  const slug = owner.slug as WealthOwnerSlug;

  const [holdings, summary] = await Promise.all([
    getFixedIncomeHoldings(owner.portfolioId),
    getFixedIncomeSummary(owner.portfolioId),
  ]);

  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title={wealthTopBarTitle(slug, "fixed-income")} />
      <main className="min-w-0 p-4 md:p-6">
        <WealthSubNav owner={slug} />
        <FixedIncomeDashboard
          holdings={holdings}
          summary={summary}
          portfolioId={owner.portfolioId}
        />
      </main>
    </div>
  );
}
