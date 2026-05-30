import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { WealthSubNav } from "@/components/dashboard/wealth-sub-nav";
import { FixedIncomeContent } from "@/components/dashboard/fixed-income-content";
import { FixedIncomeFallback } from "@/components/dashboard/suspense-fallbacks";
import {
  resolveOwner,
  wealthTopBarTitle,
  type WealthOwnerSlug,
} from "@/lib/wealth-config";

export const revalidate = 3600;

export default async function WealthFixedIncomePage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner: ownerSlug } = await params;
  const owner = resolveOwner(ownerSlug);
  if (!owner) notFound();

  const slug = owner.slug as WealthOwnerSlug;

  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title={wealthTopBarTitle(slug, "fixed-income")} />
      <main className="min-w-0 p-4 md:p-6">
        <WealthSubNav owner={slug} />
        <Suspense fallback={<FixedIncomeFallback />}>
          <FixedIncomeContent ownerSlug={ownerSlug} />
        </Suspense>
      </main>
    </div>
  );
}
