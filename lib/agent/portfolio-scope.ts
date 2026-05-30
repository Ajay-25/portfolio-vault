export const PORTFOLIO_IDS = {
  mine:   "portfolio-primary",
  mother: "portfolio-mom",
} as const;

export type PortfolioScope = "mine" | "mother" | "both";
export type ReturnFilter = "all" | "negative" | "positive";
export type PortfolioKey = "mine" | "mother";

export function portfolioIds(scope: PortfolioScope): string[] {
  return scope === "both" ? Object.values(PORTFOLIO_IDS) : [PORTFOLIO_IDS[scope]];
}

export function toPortfolioKey(portfolioId: string): PortfolioKey {
  return portfolioId === PORTFOLIO_IDS.mother ? "mother" : "mine";
}

export function formatInrSigned(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function filterByReturn<T extends { gainPct: number | null }>(
  rows: T[],
  filter: ReturnFilter,
): T[] {
  if (filter === "negative") {
    return rows.filter((r) => r.gainPct !== null && r.gainPct < 0);
  }
  if (filter === "positive") {
    return rows.filter((r) => r.gainPct !== null && r.gainPct > 0);
  }
  return rows;
}

export function sortByGainAsc<T extends { gainPct: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.gainPct ?? 0) - (b.gainPct ?? 0));
}

export function formatReturnHeader(label: string, filter: ReturnFilter): string {
  if (filter === "negative") return `${label} with negative returns:`;
  if (filter === "positive") return `${label} with positive returns:`;
  return `${label} (all):`;
}

export function emptyReturnMessage(label: string, filter: ReturnFilter): string {
  if (filter === "negative") return `No ${label} with negative returns found.`;
  if (filter === "positive") return `No ${label} with positive returns found.`;
  return `No ${label} found.`;
}
