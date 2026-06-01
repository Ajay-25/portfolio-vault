import { prisma } from "@/lib/prisma";
import { resolveOwner, type WealthOwnerSlug } from "@/lib/wealth-config";

export type FIHolding = Awaited<ReturnType<typeof getFixedIncomeHoldings>>[number];

export const GOVT_FI_TYPES = ["ppf", "epf", "nps_tier1", "nps_tier2", "scss"] as const;
export const DEPOSIT_FI_TYPES = ["fd", "rd"] as const;
export const BOND_FI_TYPES = ["bond", "nsc"] as const;
export const LIQUID_FI_TYPES = ["liquid", "sweep_fd"] as const;

export const ALL_FI_TYPES = [
  ...GOVT_FI_TYPES,
  ...DEPOSIT_FI_TYPES,
  ...BOND_FI_TYPES,
  ...LIQUID_FI_TYPES,
] as const;

export type FIType = (typeof ALL_FI_TYPES)[number];

export function fiValue(h: Pick<FIHolding, "currentValue" | "principal">): number {
  return h.currentValue ?? h.principal;
}

export async function getFixedIncomeHoldings(portfolioId: string) {
  return prisma.fixedIncomeHolding.findMany({
    where:   { portfolioId, isActive: true },
    orderBy: [{ type: "asc" }, { maturityDate: "asc" }],
  });
}

export type FISummary = {
  total:            number;
  govtSchemesTotal: number;
  depositsTotal:    number;
  bondsTotal:       number;
  liquidTotal:      number;
  weightedRate:     number;
  nextMaturity:     {
    label:       string;
    institution: string;
    daysLeft:    number;
    value:       number;
  } | null;
  deductionUsed80C: number;
  deductionUsedNPS: number;
};

export async function getFixedIncomeSummary(portfolioId: string): Promise<FISummary> {
  const holdings = await getFixedIncomeHoldings(portfolioId);

  const govtSchemesTotal = holdings
    .filter((h) => GOVT_FI_TYPES.includes(h.type as (typeof GOVT_FI_TYPES)[number]))
    .reduce((s, h) => s + fiValue(h), 0);
  const depositsTotal = holdings
    .filter((h) => DEPOSIT_FI_TYPES.includes(h.type as (typeof DEPOSIT_FI_TYPES)[number]))
    .reduce((s, h) => s + fiValue(h), 0);
  const bondsTotal = holdings
    .filter((h) => BOND_FI_TYPES.includes(h.type as (typeof BOND_FI_TYPES)[number]))
    .reduce((s, h) => s + fiValue(h), 0);
  const liquidTotal = holdings
    .filter((h) => LIQUID_FI_TYPES.includes(h.type as (typeof LIQUID_FI_TYPES)[number]))
    .reduce((s, h) => s + fiValue(h), 0);
  const total = govtSchemesTotal + depositsTotal + bondsTotal + liquidTotal;

  const ratedHoldings = holdings.filter((h) => h.rate);
  const ratedTotal = ratedHoldings.reduce((s, h) => s + fiValue(h), 0);
  const weightedRate = ratedTotal > 0
    ? ratedHoldings.reduce((s, h) => s + (h.rate ?? 0) * fiValue(h), 0) / ratedTotal
    : 0;

  const now = new Date();
  const upcoming = holdings
    .filter((h) => h.maturityDate && h.maturityDate > now)
    .sort((a, b) => a.maturityDate!.getTime() - b.maturityDate!.getTime());
  const next = upcoming[0];
  const nextMaturity = next
    ? {
        label:       next.label,
        institution: next.institution ?? "",
        daysLeft:    Math.ceil((next.maturityDate!.getTime() - now.getTime()) / 86400000),
        value:       next.maturityAmount ?? fiValue(next),
      }
    : null;

  const deductionUsed80C = holdings
    .filter((h) => h.taxBenefit === "80C" || h.taxBenefit === "EEE")
    .reduce((s, h) => s + (h.annualContrib ?? h.principal), 0);

  const deductionUsedNPS = holdings
    .filter((h) => h.taxBenefit === "80CCD")
    .reduce((s, h) => s + (h.annualContrib ?? 0), 0);

  return {
    total,
    govtSchemesTotal,
    depositsTotal,
    bondsTotal,
    liquidTotal,
    weightedRate,
    nextMaturity,
    deductionUsed80C,
    deductionUsedNPS,
  };
}

export function ppfProjectedMaturity(
  currentBalance: number,
  annualDeposit: number,
  yearsRemaining: number,
  rate = 0.071,
): number {
  let balance = currentBalance;
  for (let i = 0; i < yearsRemaining; i++) {
    balance = (balance + annualDeposit) * (1 + rate);
  }
  return Math.round(balance);
}

export function fdMaturityAmount(
  principal: number,
  annualRate: number,
  tenureYears: number,
  freq: "monthly" | "quarterly" | "annual" | "on_maturity" = "quarterly",
): number {
  const n = freq === "monthly" ? 12 : freq === "quarterly" ? 4 : 1;
  const r = annualRate / 100;
  return Math.round(principal * Math.pow(1 + r / n, n * tenureYears));
}

/** Net-worth aggregation across legacy + new FI types. */
export function aggregateFixedIncome(
  holdings: { type: string; principal: number; currentValue?: number | null }[],
) {
  let ppf = 0;
  let epf = 0;
  let nps = 0;
  let liquid = 0;
  let fdBondTotal = 0;

  for (const h of holdings) {
    const v = h.currentValue ?? h.principal;
    switch (h.type) {
      case "ppf":
        ppf += v;
        break;
      case "epf":
        epf += v;
        break;
      case "nps":
      case "nps_tier1":
      case "nps_tier2":
        nps += v;
        break;
      case "liquid":
      case "sweep_fd":
        liquid += v;
        break;
      case "fd":
      case "rd":
      case "bond":
      case "nsc":
      case "scss":
        fdBondTotal += v;
        break;
      default:
        break;
    }
  }

  return {
    ppf,
    epf,
    nps,
    liquid,
    motherFixedIncome: fdBondTotal,
    fdBondTotal,
    debtTotal: ppf + epf + nps,
  };
}

export async function getUpcomingFixedIncomeMaturities(days = 30, limit = 3) {
  const now = new Date();
  const until = new Date(Date.now() + days * 86400000);
  return prisma.fixedIncomeHolding.findMany({
    where: {
      isActive:     true,
      maturityDate: { gte: now, lte: until },
    },
    orderBy: { maturityDate: "asc" },
    take:    limit,
  });
}

export async function getFixedIncomePageData(ownerSlug: string) {
  const owner = resolveOwner(ownerSlug);
  if (!owner) return null;

  const [holdings, summary] = await Promise.all([
    getFixedIncomeHoldings(owner.portfolioId),
    getFixedIncomeSummary(owner.portfolioId),
  ]);

  return {
    ownerSlug:   owner.slug as WealthOwnerSlug,
    ownerLabel:  owner.label,
    portfolioId: owner.portfolioId,
    holdings,
    summary,
  };
}
