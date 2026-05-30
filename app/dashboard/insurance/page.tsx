import { Suspense } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { InsuranceOverviewContent } from "@/components/dashboard/insurance-overview-content";
import { InsuranceFallback } from "@/components/dashboard/suspense-fallbacks";

export const revalidate = 3600;

export default function InsuranceOverviewPage() {
  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title="Household · Insurance overview" />
      <main className="p-4 md:p-6 space-y-5">
        <Suspense fallback={<InsuranceFallback />}>
          <InsuranceOverviewContent />
        </Suspense>
      </main>
    </div>
  );
}
