import { prisma } from "@/lib/prisma";
import type { NavResult } from "@/lib/apis/amfi";
import { getAllPortfolios } from "@/lib/data/portfolio";
import { getCachedNAVs } from "@/lib/data/nav-server";
import { getUSDINR } from "@/lib/data/fx-server";
import { aggregateFixedIncome } from "@/lib/fixed-income-data";
import { getAllInvestmentLinkedInsurance } from "@/lib/insurance-data";
import { WEALTH_OWNERS, wealthPath, type WealthOwnerSlug } from "@/lib/wealth-config";

export type NetWorthPersonFilter = "all" | "mine" | "mother";

export interface NetWorthSegment {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  color: string;
  pct: number;
  href?: string;
}

export interface NetWorthSlice {
  mfTotal: number;
  indianStocks: number;
  usStocks: number;
  usStockCount: number;
  indianStockSymbols: string;
  ppf: number;
  epf: number;
  nps: number;
  debtTotal: number;
  liquid: number;
  fdBondTotal: number;
  insuranceInvestments: number;
  total: number;
  segments: NetWorthSegment[];
}

export interface NetWorthData {
  mfTotal: number;
  indianStocks: number;
  usStocks: number;
  usStockCount: number;
  indianStockSymbols: string;
  ppf: number;
  epf: number;
  nps: number;
  debtTotal: number;
  liquid: number;
  fdBondTotal: number;
  insuranceInvestments: number;
  total: number;
  usdInr: number;
  segments: NetWorthSegment[];
  indianStocksEditable: number;
  byPerson: Record<NetWorthPersonFilter, NetWorthSlice>;
}

export interface NetWorthConfigInput {
  indianStocks: number;
}

export function buildNetWorthBreakdown(input: {
  mfTotal: number;
  indianStocks: number;
  usStocks: number;
  ppf: number;
  epf: number;
  nps: number;
  liquid: number;
  fdBondTotal?: number;
  insuranceInvestments?: number;
  owner?: WealthOwnerSlug | "all";
}): Pick<NetWorthSlice, "debtTotal" | "total" | "segments"> {
  const debtTotal = input.ppf + input.epf + input.nps;
  const fdBondTotal = input.fdBondTotal ?? 0;
  const insuranceInvestments = input.insuranceInvestments ?? 0;
  const total =
    input.mfTotal +
    input.indianStocks +
    input.usStocks +
    debtTotal +
    input.liquid +
    fdBondTotal +
    insuranceInvestments;

  const owner = input.owner ?? "all";

  const raw: Omit<NetWorthSegment, "pct">[] = [
    {
      key: "mf",
      label: "Indian MFs",
      shortLabel: "MFs",
      value: input.mfTotal,
      color: "var(--blue)",
      href:
        owner === "mine"
          ? wealthPath("mine", "mf")
          : owner === "mother"
            ? wealthPath("mother", "mf")
            : undefined,
    },
    {
      key: "stocks",
      label: "Indian Stocks",
      shortLabel: "Stocks",
      value: input.indianStocks,
      color: "var(--teal)",
      href:
        owner === "mine"
          ? `${wealthPath("mine", "stocks", { market: "in" })}`
          : owner === "mother"
            ? wealthPath("mother", "stocks")
            : undefined,
    },
    {
      key: "us",
      label: "US Stocks",
      shortLabel: "US",
      value: input.usStocks,
      color: "var(--purple)",
      href:
        owner === "mine"
          ? wealthPath("mine", "stocks", { market: "us" })
          : undefined,
    },
    {
      key: "debt",
      label: "PPF+EPF+NPS",
      shortLabel: "Debt",
      value: debtTotal,
      color: "var(--cyan)",
      href:
        owner === "mine" ? wealthPath("mine", "fixed-income") : undefined,
    },
    {
      key: "liquid",
      label: "Liquid",
      shortLabel: "Liq",
      value: input.liquid,
      color: "var(--orange)",
      href:
        owner === "mine" ? wealthPath("mine", "fixed-income") : undefined,
    },
    {
      key: "fdBond",
      label: "FD & Bonds",
      shortLabel: "FD",
      value: fdBondTotal,
      color: "var(--gold)",
      href:
        owner === "mother" || owner === "all"
          ? wealthPath("mother", "fixed-income")
          : owner === "mine"
            ? wealthPath("mine", "fixed-income")
            : undefined,
    },
    {
      key: "insurance",
      label: "Insurance investments",
      shortLabel: "Ins",
      value: insuranceInvestments,
      color: "var(--orange)",
      href:
        owner === "mine" || owner === "all"
          ? wealthPath("mine", "insurance")
          : owner === "mother"
            ? wealthPath("mother", "insurance")
            : undefined,
    },
  ];

  const segments = raw
    .filter((s) => s.value > 0)
    .map((s) => ({
      ...s,
      pct: total > 0 ? (s.value / total) * 100 : 0,
    }));

  return { debtTotal, total, segments };
}

function computeIndianStocksFromHoldings(
  holdings: { symbol: string; qty: number; avgPrice: number }[],
): number {
  return holdings.reduce((sum, h) => sum + h.qty * h.avgPrice, 0);
}

function computeUsStocksFromHoldings(
  holdings: { qty: number; avgPrice: number }[],
  usdInr: number,
): number {
  return holdings.reduce((sum, h) => sum + h.qty * h.avgPrice * usdInr, 0);
}

function buildSlice(input: {
  portfolioIds: string[];
  mfTotal: number;
  indianStocks: number;
  usStocks: number;
  usStockCount: number;
  indianStockSymbols: string;
  fixedIncome: ReturnType<typeof aggregateFixedIncome>;
  insuranceInvestments: number;
  owner: WealthOwnerSlug | "all";
}): NetWorthSlice {
  const { debtTotal, total, segments } = buildNetWorthBreakdown({
    mfTotal: input.mfTotal,
    indianStocks: input.indianStocks,
    usStocks: input.usStocks,
    ppf: input.fixedIncome.ppf,
    epf: input.fixedIncome.epf,
    nps: input.fixedIncome.nps,
    liquid: input.fixedIncome.liquid,
    fdBondTotal: input.fixedIncome.motherFixedIncome,
    insuranceInvestments: input.insuranceInvestments,
    owner: input.owner,
  });

  return {
    mfTotal: input.mfTotal,
    indianStocks: input.indianStocks,
    usStocks: input.usStocks,
    usStockCount: input.usStockCount,
    indianStockSymbols: input.indianStockSymbols,
    ppf: input.fixedIncome.ppf,
    epf: input.fixedIncome.epf,
    nps: input.fixedIncome.nps,
    debtTotal,
    liquid: input.fixedIncome.liquid,
    fdBondTotal: input.fixedIncome.motherFixedIncome,
    insuranceInvestments: input.insuranceInvestments,
    total,
    segments,
  };
}

export async function getNetWorthData(): Promise<NetWorthData> {
  const [portfolios, usdInr, fixedIncomeHoldings, insurancePolicies] = await Promise.all([
    getAllPortfolios(),
    getUSDINR(),
    prisma.fixedIncomeHolding.findMany(),
    getAllInvestmentLinkedInsurance(),
  ]);

  const insuranceFor = (ids: string[]) =>
    insurancePolicies
      .filter((p) => ids.includes(p.portfolioId))
      .reduce((s, p) => s + (p.currentFundValue ?? 0), 0);

  const primaryId = WEALTH_OWNERS.mine.portfolioId;
  const motherId = WEALTH_OWNERS.mother.portfolioId;

  const primaryPortfolio = portfolios.find((p) => p.id === primaryId);
  const motherPortfolio = portfolios.find((p) => p.id === motherId);

  const primaryIndianHoldings =
    primaryPortfolio?.stockHoldings.filter(
      (s) => s.currency === "INR" && s.exchange === "NSE",
    ) ?? [];
  const motherIndianHoldings =
    motherPortfolio?.stockHoldings.filter(
      (s) => s.currency === "INR" && s.exchange === "NSE",
    ) ?? [];
  const allIndianHoldings = portfolios.flatMap((p) =>
    p.stockHoldings.filter((s) => s.currency === "INR" && s.exchange === "NSE"),
  );

  const computedPrimaryIndian =
    computeIndianStocksFromHoldings(primaryIndianHoldings);
  const computedMotherIndian =
    computeIndianStocksFromHoldings(motherIndianHoldings);
  const computedAllIndian = computeIndianStocksFromHoldings(allIndianHoldings);

  let config = await prisma.netWorthConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      indianStocks: computedPrimaryIndian || 696270,
    },
  });

  if (config.indianStocks === 0 && computedPrimaryIndian > 0) {
    config = await prisma.netWorthConfig.update({
      where: { id: "default" },
      data: { indianStocks: computedPrimaryIndian },
    });
  }

  const allCodes = [
    ...new Set(portfolios.flatMap((p) => p.mfHoldings.map((h) => h.schemeCode))),
  ];
  const navsObj = await getCachedNAVs(allCodes);
  const navMap = new Map(Object.entries(navsObj) as [string, NavResult][]);

  const mfFor = (ids: string[]) =>
    portfolios
      .filter((p) => ids.includes(p.id))
      .reduce((sum, portfolio) => {
        return (
          sum +
          portfolio.mfHoldings.reduce((mfSum, h) => {
            const nav = navMap.get(h.schemeCode)?.nav ?? 0;
            return mfSum + h.units * nav;
          }, 0)
        );
      }, 0);

  const usFor = (ids: string[]) => {
    const holdings = portfolios
      .filter((p) => ids.includes(p.id))
      .flatMap((p) => p.stockHoldings.filter((s) => s.currency === "USD"));
    return {
      total: computeUsStocksFromHoldings(holdings, usdInr),
      count: holdings.length,
    };
  };

  const fiFor = (ids: string[]) =>
    aggregateFixedIncome(
      fixedIncomeHoldings.filter((h) => ids.includes(h.portfolioId)),
    );

  const primaryIndianStocks =
    config.indianStocks > 0 ? config.indianStocks : computedPrimaryIndian;
  const primaryUs = usFor([primaryId]);
  const motherUs = usFor([motherId]);
  const allUs = usFor(portfolios.map((p) => p.id));

  const primarySymbols = primaryIndianHoldings
    .slice(0, 3)
    .map((h) => h.symbol)
    .join(", ");
  const motherSymbols = motherIndianHoldings
    .slice(0, 3)
    .map((h) => h.symbol)
    .join(", ");
  const allSymbols = allIndianHoldings
    .slice(0, 3)
    .map((h) => h.symbol)
    .join(", ");

  const byPerson: Record<NetWorthPersonFilter, NetWorthSlice> = {
    mine: buildSlice({
      portfolioIds: [primaryId],
      mfTotal: mfFor([primaryId]),
      indianStocks: primaryIndianStocks,
      usStocks: primaryUs.total,
      usStockCount: primaryUs.count,
      indianStockSymbols: primarySymbols,
      fixedIncome: fiFor([primaryId]),
      insuranceInvestments: insuranceFor([primaryId]),
      owner: "mine",
    }),
    mother: buildSlice({
      portfolioIds: [motherId],
      mfTotal: mfFor([motherId]),
      indianStocks: computedMotherIndian,
      usStocks: motherUs.total,
      usStockCount: motherUs.count,
      indianStockSymbols: motherSymbols,
      fixedIncome: fiFor([motherId]),
      insuranceInvestments: insuranceFor([motherId]),
      owner: "mother",
    }),
    all: buildSlice({
      portfolioIds: portfolios.map((p) => p.id),
      mfTotal: mfFor(portfolios.map((p) => p.id)),
      indianStocks:
        primaryIndianStocks + computedMotherIndian > 0
          ? primaryIndianStocks + computedMotherIndian
          : computedAllIndian,
      usStocks: allUs.total,
      usStockCount: allUs.count,
      indianStockSymbols: allSymbols,
      fixedIncome: fiFor(portfolios.map((p) => p.id)),
      insuranceInvestments: insuranceFor(portfolios.map((p) => p.id)),
      owner: "all",
    }),
  };

  const all = byPerson.all;

  return {
    mfTotal: all.mfTotal,
    indianStocks: all.indianStocks,
    usStocks: all.usStocks,
    usStockCount: all.usStockCount,
    indianStockSymbols: all.indianStockSymbols,
    ppf: all.ppf,
    epf: all.epf,
    nps: all.nps,
    debtTotal: all.debtTotal,
    liquid: all.liquid,
    fdBondTotal: all.fdBondTotal,
    insuranceInvestments: all.insuranceInvestments,
    total: all.total,
    usdInr,
    segments: all.segments,
    indianStocksEditable: primaryIndianStocks,
    byPerson,
  };
}
