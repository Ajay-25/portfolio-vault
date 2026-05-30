import { prisma } from "@/lib/prisma";
import { resolveOwner, type WealthOwnerSlug } from "@/lib/wealth-config";

export const FIXED_INCOME_TYPES = [
  "ppf",
  "epf",
  "nps",
  "fd",
  "bond",
  "liquid",
  "sweep_fd",
] as const;

export type FixedIncomeType = (typeof FIXED_INCOME_TYPES)[number];

export interface FixedIncomeRow {
  id: string;
  portfolioId: string;
  type: FixedIncomeType;
  label: string;
  issuer: string | null;
  principal: number;
  rate: number | null;
  startDate: string | null;
  maturityDate: string | null;
  taxBenefit: string | null;
  notes: string | null;
}

export interface FixedIncomePageData {
  ownerSlug: WealthOwnerSlug;
  ownerLabel: string;
  portfolioId: string;
  rows: FixedIncomeRow[];
  totalPrincipal: number;
  weightedAvgRate: number | null;
  nextMaturity: { label: string; date: string; principal: number } | null;
}

function toRow(h: {
  id: string;
  portfolioId: string;
  type: string;
  label: string;
  issuer: string | null;
  principal: number;
  rate: number | null;
  startDate: Date | null;
  maturityDate: Date | null;
  taxBenefit: string | null;
  notes: string | null;
}): FixedIncomeRow {
  return {
    id: h.id,
    portfolioId: h.portfolioId,
    type: h.type as FixedIncomeType,
    label: h.label,
    issuer: h.issuer,
    principal: h.principal,
    rate: h.rate,
    startDate: h.startDate?.toISOString() ?? null,
    maturityDate: h.maturityDate?.toISOString() ?? null,
    taxBenefit: h.taxBenefit,
    notes: h.notes,
  };
}

export async function getFixedIncomePageData(
  ownerSlug: string,
): Promise<FixedIncomePageData | null> {
  const owner = resolveOwner(ownerSlug);
  if (!owner) return null;

  const holdings = await prisma.fixedIncomeHolding.findMany({
    where: { portfolioId: owner.portfolioId },
    orderBy: [{ maturityDate: "asc" }, { label: "asc" }],
  });

  const rows = holdings.map(toRow);
  const totalPrincipal = rows.reduce((sum, r) => sum + r.principal, 0);

  const rated = rows.filter((r) => r.rate != null && r.rate > 0);
  const weightedAvgRate =
    rated.length > 0 && totalPrincipal > 0
      ? rated.reduce((sum, r) => sum + r.principal * (r.rate ?? 0), 0) /
        rated.reduce((sum, r) => sum + r.principal, 0)
      : null;

  const now = Date.now();
  const upcoming = rows
    .filter((r) => r.maturityDate && new Date(r.maturityDate).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.maturityDate!).getTime() - new Date(b.maturityDate!).getTime(),
    );

  const next = upcoming[0];
  const nextMaturity = next?.maturityDate
    ? { label: next.label, date: next.maturityDate, principal: next.principal }
    : null;

  return {
    ownerSlug: owner.slug,
    ownerLabel: owner.label,
    portfolioId: owner.portfolioId,
    rows,
    totalPrincipal,
    weightedAvgRate,
    nextMaturity,
  };
}

export function aggregateFixedIncome(holdings: { type: string; principal: number }[]) {
  let ppf = 0;
  let epf = 0;
  let nps = 0;
  let liquid = 0;
  let motherFixedIncome = 0;

  for (const h of holdings) {
    switch (h.type) {
      case "ppf":
        ppf += h.principal;
        break;
      case "epf":
        epf += h.principal;
        break;
      case "nps":
        nps += h.principal;
        break;
      case "liquid":
      case "sweep_fd":
        liquid += h.principal;
        break;
      case "fd":
      case "bond":
        motherFixedIncome += h.principal;
        break;
      default:
        break;
    }
  }

  return { ppf, epf, nps, liquid, motherFixedIncome, debtTotal: ppf + epf + nps };
}
