/**
 * React.cache() deduplicates calls within a single server render.
 * If dashboard/page.tsx and wealth/mine/page.tsx both call getPortfolio()
 * with the same ID in the same request, Prisma is only hit once.
 */
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getPortfolio = cache(async (portfolioId: string) => {
  return prisma.portfolio.findUnique({
    where:   { id: portfolioId },
    include: { mfHoldings: true, stockHoldings: true, sipSchedules: true },
  });
});

export const getAllPortfolios = cache(async () => {
  return prisma.portfolio.findMany({
    include: { mfHoldings: true, stockHoldings: true },
    orderBy: { type: "asc" },
  });
});

export const getPortfoliosLight = cache(async () => {
  return prisma.portfolio.findMany({
    select: { id: true, name: true, type: true },
  });
});

export const getMFHoldings = cache(async (portfolioId: string) => {
  return prisma.mFHolding.findMany({
    where:   { portfolioId },
    orderBy: { category: "asc" },
  });
});

export const getStockHoldings = cache(async (portfolioId: string) => {
  return prisma.stockHolding.findMany({
    where: { portfolioId },
  });
});

export const getFixedIncomeHoldings = cache(async (portfolioId: string) => {
  return prisma.fixedIncomeHolding.findMany({
    where:   { portfolioId },
    orderBy: { maturityDate: "asc" },
  });
});

export const getInsurancePolicies = cache(async (portfolioId: string) => {
  return prisma.insurancePolicy.findMany({
    where:   { portfolioId },
    orderBy: { type: "asc" },
  });
});

export const getAllInsurancePolicies = cache(async () => {
  return prisma.insurancePolicy.findMany({
    include: { portfolio: { select: { name: true, type: true } } },
    orderBy: [{ type: "asc" }, { nextPremiumDate: "asc" }],
  });
});

export const getTriggers = cache(async () => {
  return prisma.trigger.findMany({ orderBy: { label: "asc" } });
});

export const getActionItems = cache(async (limit = 5) => {
  return prisma.actionItem.findMany({
    where:   { completed: false },
    orderBy: { priority: "asc" },
    take:    limit,
  });
});

export const getActionItemsByOwner = cache(async (ownerId: string, limit = 5) => {
  return prisma.actionItem.findMany({
    where:   { ownerId, completed: false },
    orderBy: { priority: "asc" },
    take:    limit,
  });
});

export const getSnapshots = cache(async (portfolioId: string, take = 36) => {
  return prisma.snapshot.findMany({
    where:   { portfolioId },
    orderBy: { date: "desc" },
    take,
  });
});
