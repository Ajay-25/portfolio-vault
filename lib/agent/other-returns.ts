import { prisma } from "@/lib/prisma";
import {
  type PortfolioScope,
  type ReturnFilter,
  type PortfolioKey,
  portfolioIds,
  toPortfolioKey,
  filterByReturn,
  sortByGainAsc,
  formatInrSigned,
  formatReturnHeader,
  emptyReturnMessage,
} from "@/lib/agent/portfolio-scope";
import { fetchMfReturns, formatMfReturnsText } from "@/lib/agent/mf-returns";

function estimateAccruedValue(
  principal: number,
  rate: number | null,
  startDate: Date | null,
): number | null {
  if (!rate || !startDate) return null;
  const years = (Date.now() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 0) return principal;
  return principal * Math.pow(1 + rate / 100, years);
}

// ── Fixed income ──────────────────────────────────────────────────────────

export type FixedIncomeReturnRow = {
  type:            string;
  label:           string;
  institution:     string | null;
  portfolioName:   string;
  portfolioKey:    PortfolioKey;
  principal:       number;
  rate:            number | null;
  maturityDate:    string | null;
  estimatedValue:  number | null;
  gainInr:         number | null;
  gainPct:         number | null;
  isEstimate:      boolean;
};

export async function fetchFixedIncomeReturns(options: {
  portfolio?: PortfolioScope;
  filter?:    ReturnFilter;
  type?:      string;
} = {}): Promise<FixedIncomeReturnRow[]> {
  const { portfolio = "both", filter = "all", type } = options;

  const portfolios = await prisma.portfolio.findMany({
    where:   { id: { in: portfolioIds(portfolio) } },
    include: { fixedIncomeHoldings: true },
  });

  let rows: FixedIncomeReturnRow[] = portfolios.flatMap((p) =>
    p.fixedIncomeHoldings.filter((h) => h.isActive).map((h) => {
      const estimated = estimateAccruedValue(h.principal, h.rate, h.startDate);
      const current   = h.currentValue ?? estimated ?? h.principal;
      const gainInr   = h.currentValue != null || estimated != null ? current - h.principal : null;
      const gainPct   =
        gainInr != null && h.principal > 0 ? (gainInr / h.principal) * 100 : null;

      return {
        type:           h.type,
        label:          h.label,
        institution:    h.institution,
        portfolioName:  p.name,
        portfolioKey:   toPortfolioKey(p.id),
        principal:      h.principal,
        rate:           h.rate,
        maturityDate:   h.maturityDate?.toISOString().slice(0, 10) ?? null,
        estimatedValue: estimated,
        gainInr,
        gainPct,
        isEstimate:     estimated != null && h.currentValue == null,
      };
    }),
  );

  if (type) {
    rows = rows.filter((r) => r.type.toLowerCase() === type.toLowerCase());
  }

  return sortByGainAsc(filterByReturn(rows, filter));
}

export function formatFixedIncomeReturnLine(r: FixedIncomeReturnRow): string {
  const rateStr = r.rate != null ? `${r.rate}% p.a.` : "rate n/a";
  const matStr  = r.maturityDate ? ` · matures ${r.maturityDate}` : "";

  if (r.gainPct == null) {
    return `  • ${r.label} (${r.type.toUpperCase()}, ${r.portfolioName}): ${formatInrSigned(r.principal)} principal · ${rateStr}${matStr}`;
  }

  const sign = r.gainPct >= 0 ? "+" : "";
  const estNote = r.isEstimate ? " (est. accrued)" : "";
  return `  • ${r.label} (${r.type.toUpperCase()}, ${r.portfolioName}): ${formatInrSigned(r.principal)} → ${formatInrSigned(r.estimatedValue!)}${estNote} | ${sign}${r.gainPct.toFixed(2)}% (${formatInrSigned(r.gainInr!)}) · ${rateStr}${matStr}`;
}

export function formatFixedIncomeReturnsText(
  rows: FixedIncomeReturnRow[],
  filter: ReturnFilter = "all",
): string {
  if (!rows.length) return emptyReturnMessage("fixed income holdings", filter);
  return `${formatReturnHeader("Fixed income (PPF/EPF/FD/NPS etc.)", filter)}\n${rows.map(formatFixedIncomeReturnLine).join("\n")}`;
}

// ── Insurance (investment-linked) ─────────────────────────────────────────

export type InsuranceInvestmentRow = {
  planName:        string;
  insurer:         string;
  type:            string;
  portfolioName:   string;
  portfolioKey:    PortfolioKey;
  premiumPaid:     number | null;
  fundValue:       number | null;
  fundValueAsOf:   string | null;
  guaranteedValue: number | null;
  gainInr:         number | null;
  gainPct:         number | null;
};

export async function fetchInsuranceInvestmentReturns(options: {
  portfolio?: PortfolioScope;
  filter?:    ReturnFilter;
} = {}): Promise<InsuranceInvestmentRow[]> {
  const { portfolio = "both", filter = "all" } = options;

  const portfolios = await prisma.portfolio.findMany({
    where:   { id: { in: portfolioIds(portfolio) } },
    include: { insurancePolicies: true },
  });

  const rows: InsuranceInvestmentRow[] = portfolios.flatMap((p) =>
    p.insurancePolicies
      .filter((pol) => pol.isInvestmentLinked || pol.type === "endowment" || pol.type === "money_back")
      .map((pol) => {
        const invested = pol.totalPremiumPaid ?? 0;
        const current  = pol.currentFundValue ?? pol.guaranteedMaturity ?? null;
        const gainInr  =
          current != null && invested > 0 ? current - invested : null;
        const gainPct  =
          gainInr != null && invested > 0 ? (gainInr / invested) * 100 : null;

        return {
          planName:        pol.planName,
          insurer:         pol.insurer,
          type:            pol.type,
          portfolioName:   p.name,
          portfolioKey:    toPortfolioKey(p.id),
          premiumPaid:     pol.totalPremiumPaid,
          fundValue:       pol.currentFundValue,
          fundValueAsOf:   pol.fundValueAsOf?.toISOString().slice(0, 10) ?? null,
          guaranteedValue: pol.guaranteedMaturity,
          gainInr,
          gainPct,
        };
      }),
  );

  return sortByGainAsc(filterByReturn(rows, filter));
}

export function formatInsuranceInvestmentLine(r: InsuranceInvestmentRow): string {
  const valueStr =
    r.fundValue != null
      ? `fund ₹${(r.fundValue / 100000).toFixed(2)}L${r.fundValueAsOf ? ` (${r.fundValueAsOf})` : ""}`
      : r.guaranteedValue != null
        ? `guaranteed ₹${(r.guaranteedValue / 100000).toFixed(2)}L`
        : "value n/a";

  const paidStr =
    r.premiumPaid != null && r.premiumPaid > 0
      ? `premium paid ₹${(r.premiumPaid / 100000).toFixed(2)}L`
      : "premium paid n/a";

  if (r.gainPct == null) {
    return `  • ${r.planName} (${r.insurer}, ${r.type}, ${r.portfolioName}): ${valueStr} · ${paidStr}`;
  }

  const sign = r.gainPct >= 0 ? "+" : "";
  return `  • ${r.planName} (${r.insurer}, ${r.type}, ${r.portfolioName}): ${paidStr} → ${valueStr} | ${sign}${r.gainPct.toFixed(2)}% (${formatInrSigned(r.gainInr!)})`;
}

export function formatInsuranceInvestmentReturnsText(
  rows: InsuranceInvestmentRow[],
  filter: ReturnFilter = "all",
): string {
  if (!rows.length) return emptyReturnMessage("investment-linked insurance policies", filter);
  return `${formatReturnHeader("ULIP / endowment / money-back policies", filter)}\n${rows.map(formatInsuranceInvestmentLine).join("\n")}`;
}

// ── Unified cross-asset view ──────────────────────────────────────────────

export type AssetClass = "all" | "stocks" | "mf" | "fixed_income" | "insurance";

export async function fetchAllInvestmentReturns(options: {
  portfolio?:   PortfolioScope;
  filter?:      ReturnFilter;
  asset_class?: AssetClass;
} = {}): Promise<string> {
  const { portfolio = "both", filter = "all", asset_class = "all" } = options;
  const sections: string[] = [];

  if (asset_class === "all" || asset_class === "stocks") {
    const { fetchStockReturns, formatStockReturnsText } = await import("@/lib/agent/stock-returns");
    sections.push(formatStockReturnsText(await fetchStockReturns({ portfolio, filter }), filter));
  }
  if (asset_class === "all" || asset_class === "mf") {
    sections.push(formatMfReturnsText(await fetchMfReturns({ portfolio, filter }), filter));
  }
  if (asset_class === "all" || asset_class === "fixed_income") {
    sections.push(formatFixedIncomeReturnsText(await fetchFixedIncomeReturns({ portfolio, filter }), filter));
  }
  if (asset_class === "all" || asset_class === "insurance") {
    sections.push(formatInsuranceInvestmentReturnsText(await fetchInsuranceInvestmentReturns({ portfolio, filter }), filter));
  }

  const body = sections.filter((s) => !s.match(/^No .+ found/)).join("\n\n");
  return body || "No investments match the filter.";
}
