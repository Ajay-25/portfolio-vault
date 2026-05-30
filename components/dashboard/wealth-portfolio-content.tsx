import { notFound } from "next/navigation";
import { PortfolioView } from "@/components/dashboard/portfolio-view";
import { getPortfolioPageData } from "@/lib/portfolio-data";

interface WealthPortfolioContentProps {
  portfolioId: string;
  view?: string;
}

/** Heavy: NAV fetch (MF views) + Prisma holdings */
export async function WealthPortfolioContent({
  portfolioId,
  view,
}: WealthPortfolioContentProps) {
  const data = await getPortfolioPageData(portfolioId, view);
  if (!data) notFound();
  return <PortfolioView data={data} />;
}
