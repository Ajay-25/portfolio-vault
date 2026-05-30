import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { WealthSubNav } from "@/components/dashboard/wealth-sub-nav";
import { WealthPortfolioContent } from "@/components/dashboard/wealth-portfolio-content";
import { PortfolioContentFallback } from "@/components/dashboard/suspense-fallbacks";
import {
  resolveOwner,
  wealthTopBarTitle,
  type WealthOwnerSlug,
} from "@/lib/wealth-config";

export const revalidate = 300;

export default async function WealthMfPage({
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
      <TopBar title={wealthTopBarTitle(slug, "mf")} />
      <main className="min-w-0 p-4 md:p-6">
        <WealthSubNav owner={slug} />
        <Suspense fallback={<PortfolioContentFallback />}>
          <WealthPortfolioContent portfolioId={owner.portfolioId} view="mf" />
        </Suspense>
      </main>
    </div>
  );
}
