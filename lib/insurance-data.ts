import { prisma } from "@/lib/prisma";

export type InsuranceSummary = {
  termSumAssured: number;
  healthSumInsured: number;
  investmentFundValue: number;
  investmentCostBasis: number;
  annualPremiumOutflow: number;
  renewalsSoon: RenewalAlert[];
  maturitiesSoon: MaturityAlert[];
};

export type RenewalAlert = {
  id: string;
  planName: string;
  insurer: string;
  type: string;
  premium: number;
  daysLeft: number;
  date: Date;
};

export type MaturityAlert = {
  id: string;
  planName: string;
  insurer: string;
  type: string;
  value: number | null;
  guaranteed: number | null;
  daysLeft: number;
  date: Date;
};

export async function getInsurancePolicies(portfolioId: string) {
  return prisma.insurancePolicy.findMany({
    where: { portfolioId },
    orderBy: { type: "asc" },
  });
}

export async function getInsuranceSummary(portfolioId: string): Promise<InsuranceSummary> {
  const policies = await getInsurancePolicies(portfolioId);
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const termSumAssured = policies
    .filter((p) => p.type === "term" || p.type === "ulip")
    .reduce((s, p) => s + (p.sumAssured ?? 0), 0);

  const healthSumInsured = policies
    .filter((p) => p.type === "health")
    .reduce((s, p) => s + (p.sumAssured ?? 0), 0);

  const investmentFundValue = policies
    .filter((p) => p.isInvestmentLinked)
    .reduce((s, p) => s + (p.currentFundValue ?? 0), 0);

  const investmentCostBasis = policies
    .filter((p) => p.isInvestmentLinked)
    .reduce((s, p) => s + (p.totalPremiumPaid ?? 0), 0);

  const annualPremiumOutflow = policies
    .filter((p) => p.status === "active" && p.premium)
    .reduce((s, p) => {
      const freq = p.premiumFrequency;
      const m =
        freq === "monthly" ? 12 : freq === "quarterly" ? 4 : freq === "annual" ? 1 : 1;
      return s + (p.premium ?? 0) * m;
    }, 0);

  const renewalsSoon: RenewalAlert[] = policies
    .filter((p) => p.nextPremiumDate && p.nextPremiumDate >= now && p.nextPremiumDate <= in90)
    .map((p) => ({
      id: p.id,
      planName: p.planName,
      insurer: p.insurer,
      type: p.type,
      premium: p.premium ?? 0,
      daysLeft: Math.ceil(
        (p.nextPremiumDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      ),
      date: p.nextPremiumDate!,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const maturitiesSoon: MaturityAlert[] = policies
    .filter((p) => p.policyEndDate && p.policyEndDate >= now && p.policyEndDate <= in90)
    .map((p) => ({
      id: p.id,
      planName: p.planName,
      insurer: p.insurer,
      type: p.type,
      value: p.currentFundValue ?? null,
      guaranteed: p.guaranteedMaturity ?? null,
      daysLeft: Math.ceil(
        (p.policyEndDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      ),
      date: p.policyEndDate!,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    termSumAssured,
    healthSumInsured,
    investmentFundValue,
    investmentCostBasis,
    annualPremiumOutflow,
    renewalsSoon,
    maturitiesSoon,
  };
}

export async function getAllInvestmentLinkedInsurance() {
  return prisma.insurancePolicy.findMany({
    where: { isInvestmentLinked: true },
    include: { portfolio: { select: { type: true, name: true } } },
  });
}

export async function getUrgentInsuranceRenewals(days = 30) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.insurancePolicy.findMany({
    where: {
      nextPremiumDate: { gte: now, lte: cutoff },
    },
    orderBy: { nextPremiumDate: "asc" },
    take: 3,
  });
}
