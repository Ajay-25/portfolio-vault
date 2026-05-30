import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { PortfolioView } from "@/components/dashboard/portfolio-view";
import { WealthMarketTabs, WealthSubNav } from "@/components/dashboard/wealth-sub-nav";
import { getPortfolioPageData } from "@/lib/portfolio-data";
import {
  resolveOwner,
  stockViewFromMarket,
  wealthPath,
  wealthTopBarTitle,
  type WealthOwnerSlug,
  type StockMarket,
} from "@/lib/wealth-config";

export const revalidate = 300;

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
  const data = await getPortfolioPageData(owner.portfolioId, market);
  if (!data) notFound();

  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title={wealthTopBarTitle(slug, "stocks", market as StockMarket)} />
      <main className="min-w-0 p-4 md:p-6">
        <WealthSubNav owner={slug} />
        <WealthMarketTabs owner={slug} />
        <PortfolioView data={data} />
      </main>
    </div>
  );
}
