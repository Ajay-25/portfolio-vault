import { InsuranceView } from "@/components/dashboard/insurance-view";
import { getInsurancePolicies, getInsuranceSummary } from "@/lib/insurance-data";
import type { WealthOwnerSlug } from "@/lib/wealth-config";

interface InsuranceOwnerContentProps {
  portfolioId: string;
  owner: WealthOwnerSlug;
}

export async function InsuranceOwnerContent({
  portfolioId,
  owner,
}: InsuranceOwnerContentProps) {
  const [policies, summary] = await Promise.all([
    getInsurancePolicies(portfolioId),
    getInsuranceSummary(portfolioId),
  ]);

  return (
    <InsuranceView
      policies={policies}
      summary={summary}
      owner={owner}
      portfolioId={portfolioId}
    />
  );
}
