import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { WealthMarketTabs, WealthSubNav } from "@/components/dashboard/wealth-sub-nav";
import { WealthPortfolioContent } from "@/components/dashboard/wealth-portfolio-content";
import { PortfolioContentFallback } from "@/components/dashboard/suspense-fallbacks";
import {
  resolveOwner,
  stockViewFromMarket,
  wealthPath,
  wealthTopBarTitle,
  type WealthOwnerSlug,
  type StockMarket,
} from "@/lib/wealth-config";

export const revalidate = 3600;

export default async function WealthStocksPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string }>;
  searchParams: Promise<{ market?: string }>;
}) {
  const { owner: ownerSlug } = await params;
  const { market: marketParam } = await searchParams;
  const owner = resolveOwner(ownerSlug);
  if (!owner) notFound();

  const slug = owner.slug as WealthOwnerSlug;

  if (slug === "mother" && marketParam === "us") {
    redirect(wealthPath("mother", "stocks"));
  }

  const market = stockViewFromMarket(marketParam, slug);

  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title={wealthTopBarTitle(slug, "stocks", market as StockMarket)} />
      <main className="min-w-0 p-4 md:p-6">
        <WealthSubNav owner={slug} />
        <WealthMarketTabs owner={slug} />
        <Suspense fallback={<PortfolioContentFallback />}>
          <WealthPortfolioContent portfolioId={owner.portfolioId} view={market} />
        </Suspense>
      </main>
    </div>
  );
}
