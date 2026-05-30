import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { InsuranceView } from "@/components/dashboard/insurance-view";
import { WealthSubNav } from "@/components/dashboard/wealth-sub-nav";
import { getInsurancePolicies, getInsuranceSummary } from "@/lib/insurance-data";
import {
  resolveOwner,
  wealthTopBarTitle,
  type WealthOwnerSlug,
} from "@/lib/wealth-config";

export const revalidate = 0;

export default async function InsurancePage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner: ownerSlug } = await params;
  const owner = resolveOwner(ownerSlug);
  if (!owner) notFound();

  const slug = owner.slug as WealthOwnerSlug;

  const [policies, summary] = await Promise.all([
    getInsurancePolicies(owner.portfolioId),
    getInsuranceSummary(owner.portfolioId),
  ]);

  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title={wealthTopBarTitle(slug, "insurance")} />
      <main className="min-w-0 p-4 md:p-6">
        <WealthSubNav owner={slug} />
        <InsuranceView
          policies={policies}
          summary={summary}
          owner={slug}
          portfolioId={owner.portfolioId}
        />
      </main>
    </div>
  );
}
