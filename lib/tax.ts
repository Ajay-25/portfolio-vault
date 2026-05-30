export const LTCG_EXEMPTION_LIMIT = 125_000;

export type LtcgMeter = {
  portfolioId: string;
  name: string;
  used: number;
  remaining: number;
  pctUsed: number;
  label: string;
};

export type TaxSummaryRow = {
  item: string;
  gain: string;
  gainPositive: boolean | null;
  type: string;
  typeBadge: string;
  rate: string;
  tax: string;
  taxNegative: boolean;
};

export type TaxTrackerData = {
  fyLabel: string;
  primary: LtcgMeter;
  mother: LtcgMeter;
  summaryRows: TaxSummaryRow[];
  summaryNote: string;
};

export function getCurrentFYLabel(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  return `FY ${startYear}-${endYear.toString().padStart(2, "0")}`;
}

export function buildLtcgMeter(
  portfolioId: string,
  name: string,
  used: number,
  usedLabel?: string,
): LtcgMeter {
  const remaining = Math.max(0, LTCG_EXEMPTION_LIMIT - used);
  const pctUsed = Math.min(100, (used / LTCG_EXEMPTION_LIMIT) * 100);

  return {
    portfolioId,
    name,
    used,
    remaining,
    pctUsed,
    label: usedLabel ?? (used > 0 ? `Used — ${formatCompact(used)}` : "Used"),
  };
}

function formatCompact(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}K+`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export const TAX_SUMMARY_ROWS: TaxSummaryRow[] = [
  {
    item: "Canara Robeco LTCG",
    gain: "+₹1,07,000",
    gainPositive: true,
    type: "LTCG",
    typeBadge: "gold",
    rate: "0% (exemption)",
    tax: "₹0",
    taxNegative: false,
  },
  {
    item: "Canara Robeco STCG loss",
    gain: "−₹2,460",
    gainPositive: false,
    type: "STCG LOSS",
    typeBadge: "teal",
    rate: "0%",
    tax: "₹0 (offsets)",
    taxNegative: false,
  },
  {
    item: "Today's redemptions STCG (net)",
    gain: "+₹10,729",
    gainPositive: true,
    type: "STCG",
    typeBadge: "orange",
    rate: "20% flat",
    tax: "₹2,146",
    taxNegative: true,
  },
  {
    item: "Debt funds (bonds)",
    gain: "+₹1,670",
    gainPositive: true,
    type: "DEBT SLAB",
    typeBadge: "muted",
    rate: "31.2%",
    tax: "₹521",
    taxNegative: true,
  },
  {
    item: "Exit load — Canara Robeco",
    gain: "—",
    gainPositive: null,
    type: "COST",
    typeBadge: "muted",
    rate: "—",
    tax: "₹1,136",
    taxNegative: true,
  },
];

export function getTaxTrackerData(
  primaryUsed: number,
  motherUsed: number,
): TaxTrackerData {
  return {
    fyLabel: getCurrentFYLabel(),
    primary: buildLtcgMeter(
      "portfolio-primary",
      "Your LTCG Exemption",
      primaryUsed,
      primaryUsed > 0 ? "Used — Canara Robeco" : "Used",
    ),
    mother: buildLtcgMeter(
      "portfolio-mom",
      "Mother's LTCG Exemption",
      motherUsed,
    ),
    summaryRows: TAX_SUMMARY_ROWS,
    summaryNote:
      "Total cost to restructure ₹13.6L portfolio: ₹4,939 (0.36%) — exceptional efficiency.",
  };
}
