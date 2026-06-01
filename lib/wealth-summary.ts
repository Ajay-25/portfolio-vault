import { getPortfolioPageData } from "@/lib/portfolio-data";
import { getActionItemsByOwner } from "@/lib/data/portfolio";
import { absoluteReturn } from "@/lib/utils/finance";
import {
  fiValue,
  getFixedIncomeHoldings,
  getFixedIncomeSummary,
} from "@/lib/fixed-income-data";
import {
  resolveOwner,
  type WealthOwnerSlug,
  wealthPath,
} from "@/lib/wealth-config";

export type AllocationSegment = {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
  href: string;
};

export type UpcomingMaturity = {
  label: string;
  maturityDate: Date;
  principal: number;
};

export type WealthSummaryData = {
  owner: WealthOwnerSlug;
  label: string;
  mfTotal: number;
  stockTotal: number;
  fixedIncomeTotal: number;
  fixedIncomeRate:  number;
  total: number;
  invested: number;
  gainPct: number | null;
  sipTotal: number;
  allocationSegments: AllocationSegment[];
  upcomingMaturities: UpcomingMaturity[];
  actionItems: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: string;
  }>;
  quickLinks: Array<{ label: string; href: string }>;
};

export async function getWealthSummaryData(
  ownerSlug: string,
): Promise<WealthSummaryData | null> {
  const owner = resolveOwner(ownerSlug);
  if (!owner) return null;

  const [portfolioData, fixedIncomeHoldings, fiSummary, actionItems] = await Promise.all([
    getPortfolioPageData(owner.portfolioId),
    getFixedIncomeHoldings(owner.portfolioId),
    getFixedIncomeSummary(owner.portfolioId),
    getActionItemsByOwner(owner.ownerId, 5),
  ]);

  if (!portfolioData) return null;

  const fixedIncomeTotal = fixedIncomeHoldings.reduce((sum, h) => sum + fiValue(h), 0);

  const mfTotal = portfolioData.mfTotal;
  const stockTotal = portfolioData.stockTotal;
  const total = mfTotal + stockTotal + fixedIncomeTotal;

  const mfInvested = portfolioData.mfRows.reduce(
    (s, h) => s + (h.avgNAV ? h.units * h.avgNAV : 0),
    0,
  );
  const stockInvested = portfolioData.stockRows.reduce(
    (s, h) => s + h.investedInr,
    0,
  );
  const invested = mfInvested + stockInvested + fixedIncomeTotal;
  const gainPct =
    invested > 0 ? absoluteReturn(invested, total) * 100 : null;

  const rawSegments = [
    {
      key: "mf",
      label: "Mutual Funds",
      value: mfTotal,
      color: "var(--blue)",
      href: wealthPath(owner.slug, "mf"),
    },
    {
      key: "stocks",
      label: "Stocks",
      value: stockTotal,
      color: "var(--purple)",
      href: wealthPath(owner.slug, "stocks"),
    },
    {
      key: "fixed-income",
      label: "Fixed income",
      value: fixedIncomeTotal,
      color: "var(--cyan)",
      href: wealthPath(owner.slug, "fixed-income"),
    },
  ];

  const allocationSegments: AllocationSegment[] = rawSegments
    .filter((s) => s.value > 0)
    .map((s) => ({
      ...s,
      pct: total > 0 ? (s.value / total) * 100 : 0,
    }));

  const now = Date.now();
  const upcomingMaturities: UpcomingMaturity[] = fixedIncomeHoldings
    .filter((h) => h.maturityDate && h.maturityDate.getTime() >= now)
    .slice(0, 3)
    .map((h) => ({
      label: h.label,
      maturityDate: h.maturityDate!,
      principal: h.maturityAmount ?? fiValue(h),
    }));

  const quickLinks = [
    { label: "MF", href: wealthPath(owner.slug, "mf") },
    {
      label: "Stocks",
      href: wealthPath(owner.slug, "stocks"),
    },
    { label: "Fixed income", href: wealthPath(owner.slug, "fixed-income") },
  ];

  return {
    owner: owner.slug,
    label: owner.label,
    mfTotal,
    stockTotal,
    fixedIncomeTotal,
    fixedIncomeRate:  fiSummary.weightedRate,
    total,
    invested,
    gainPct,
    sipTotal: portfolioData.sipTotal,
    allocationSegments,
    upcomingMaturities,
    actionItems: actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      priority: a.priority,
    })),
    quickLinks,
  };
}
