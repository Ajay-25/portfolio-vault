import { prisma } from "@/lib/prisma";
import { fetchBulkNAVs } from "@/lib/apis/amfi";
import { formatINR } from "@/lib/utils/finance";

export const GOAL_TARGET_YEAR = 2031;
export const GOAL_PROJECTION_YEARS = 7;
export const GOAL_RATES = { bear: 0.12, base: 0.16, bull: 0.2 } as const;
export const MOM_GOAL_RATE = 0.15;
export const MOM_GOAL_YEARS = 10;

export type GoalChartPoint = {
  label: string;
  bear: number;
  base: number;
  bull: number;
};

export type GoalMilestone = {
  label: string;
  eta: string;
  progressPct: number;
  accent?: "gold";
};

export type GoalTrackerData = {
  corpus: number;
  monthlySip: number;
  momCorpus: number;
  momMonthlySip: number;
  baseTarget: number;
  bullTarget: number;
  bearTarget: number;
  momTarget: number;
  familyCombined: number;
  yearsRemainingLabel: string;
  chartData: GoalChartPoint[];
  milestones: GoalMilestone[];
};

/** Future value: corpus + level annual SIP, compounded at `annualRate` per year */
export function projectPortfolioSeries(
  corpus: number,
  monthlySip: number,
  annualRate: number,
  years: number,
): number[] {
  return Array.from({ length: years + 1 }, (_, year) => {
    if (year === 0) return corpus;
    const fvCorpus = corpus * Math.pow(1 + annualRate, year);
    const fvSip =
      annualRate === 0
        ? monthlySip * 12 * year
        : (monthlySip * 12 * (Math.pow(1 + annualRate, year) - 1)) / annualRate;
    return fvCorpus + fvSip;
  });
}

export function finalProjectedValue(
  corpus: number,
  monthlySip: number,
  annualRate: number,
  years: number,
): number {
  const series = projectPortfolioSeries(corpus, monthlySip, annualRate, years);
  return series[series.length - 1] ?? corpus;
}

export function toLakhsDisplay(value: number): number {
  return Math.round(value / 100000) / 10;
}

export function buildGoalChartData(
  corpus: number,
  monthlySip: number,
  years: number = GOAL_PROJECTION_YEARS,
): GoalChartPoint[] {
  const bear = projectPortfolioSeries(corpus, monthlySip, GOAL_RATES.bear, years);
  const base = projectPortfolioSeries(corpus, monthlySip, GOAL_RATES.base, years);
  const bull = projectPortfolioSeries(corpus, monthlySip, GOAL_RATES.bull, years);

  return Array.from({ length: years + 1 }, (_, i) => ({
    label: i === 0 ? "Now" : `Year ${i}`,
    bear: toLakhsDisplay(bear[i] ?? 0),
    base: toLakhsDisplay(base[i] ?? 0),
    bull: toLakhsDisplay(bull[i] ?? 0),
  }));
}

export function buildMilestones(
  corpus: number,
  baseTarget: number,
): GoalMilestone[] {
  return [
    {
      label: "₹1 Cr",
      eta: "~2yr",
      progressPct: Math.min(100, Math.round((corpus / 10000000) * 100)),
    },
    {
      label: "₹2 Cr",
      eta: "~4yr",
      progressPct: Math.min(100, Math.round((corpus / 20000000) * 100)),
    },
    {
      label: formatINR(baseTarget, true),
      eta: `${GOAL_PROJECTION_YEARS}yr`,
      progressPct: Math.min(100, Math.round((corpus / baseTarget) * 100)),
      accent: "gold",
    },
  ];
}

export function getYearsRemainingLabel(targetYear: number = GOAL_TARGET_YEAR): string {
  const now = new Date();
  const yearsLeft = targetYear - now.getFullYear();
  if (yearsLeft <= 0) return "Reached";
  return `~${yearsLeft} years`;
}

function mfValue(
  portfolio: { mfHoldings: { schemeCode: string; units: number }[] } | undefined,
  navMap: Map<string, { nav: number }>,
): number {
  if (!portfolio) return 0;
  return portfolio.mfHoldings.reduce((sum, h) => {
    const nav = navMap.get(h.schemeCode)?.nav ?? 0;
    return sum + h.units * nav;
  }, 0);
}

function monthlySip(
  portfolio: { mfHoldings: { sipAmount: number | null }[] } | undefined,
): number {
  if (!portfolio) return 0;
  return portfolio.mfHoldings.reduce((sum, h) => sum + (h.sipAmount ?? 0), 0);
}

export async function getGoalTrackerData(): Promise<GoalTrackerData> {
  const portfolios = await prisma.portfolio.findMany({
    include: { mfHoldings: true },
    orderBy: { type: "asc" },
  });

  const primary = portfolios.find((p) => p.type === "primary");
  const mom = portfolios.find((p) => p.type === "secondary");

  const codes = [
    ...new Set(portfolios.flatMap((p) => p.mfHoldings.map((h) => h.schemeCode))),
  ];
  const navMap = await fetchBulkNAVs(codes);

  const corpus = mfValue(primary, navMap);
  const primarySip = monthlySip(primary);
  const momCorpus = mfValue(mom, navMap);
  const momSip = monthlySip(mom);

  const baseTarget = finalProjectedValue(
    corpus,
    primarySip,
    GOAL_RATES.base,
    GOAL_PROJECTION_YEARS,
  );
  const bullTarget = finalProjectedValue(
    corpus,
    primarySip,
    GOAL_RATES.bull,
    GOAL_PROJECTION_YEARS,
  );
  const bearTarget = finalProjectedValue(
    corpus,
    primarySip,
    GOAL_RATES.bear,
    GOAL_PROJECTION_YEARS,
  );
  const momTarget = finalProjectedValue(
    momCorpus,
    momSip,
    MOM_GOAL_RATE,
    MOM_GOAL_YEARS,
  );

  return {
    corpus,
    monthlySip: primarySip,
    momCorpus,
    momMonthlySip: momSip,
    baseTarget,
    bullTarget,
    bearTarget,
    momTarget,
    familyCombined: baseTarget + momTarget,
    yearsRemainingLabel: getYearsRemainingLabel(),
    chartData: buildGoalChartData(corpus, primarySip),
    milestones: buildMilestones(corpus, baseTarget),
  };
}
