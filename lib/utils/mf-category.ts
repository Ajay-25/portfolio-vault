/**
 * MF category inference (sync) — registry persistence lives in mf-categories-server.ts.
 */

export const DEFAULT_MF_CATEGORIES = [
  "Flexi",
  "Mid",
  "Small",
  "Large",
  "Index",
  "Gold",
  "Hybrid",
  "BAF",
  "Debt",
  "Liquid",
  "Arbitrage",
  "FOF",
] as const;

/** @deprecated use listMfCategoryLabels() for the live registry */
export const MF_CATEGORIES = DEFAULT_MF_CATEGORIES;

const ALIASES: Record<string, string> = {
  flexi:         "Flexi",
  flexicap:      "Flexi",
  mid:           "Mid",
  midcap:        "Mid",
  small:         "Small",
  smallcap:      "Small",
  large:         "Large",
  largecap:      "Large",
  index:         "Index",
  gold:          "Gold",
  hybrid:        "Hybrid",
  baf:           "BAF",
  balanced:      "BAF",
  debt:          "Debt",
  bond:          "Debt",
  corporatebond: "Debt",
  liquid:        "Liquid",
  arbitrage:     "Arbitrage",
  fof:           "FOF",
  fundoffunds:   "FOF",
};

type CategoryRule = {
  category: string;
  patterns: RegExp[];
};

const INFERENCE_RULES: CategoryRule[] = [
  { category: "Arbitrage", patterns: [/\barbitrage\b/i] },
  { category: "Liquid", patterns: [/\b(liquid|overnight|money market|ultra short)\b/i] },
  {
    category: "Debt",
    patterns: [
      /\b(corporate bond|credit risk|banking.?&.?psu|gilt|bond|debt|income|duration)\b/i,
    ],
  },
  { category: "Gold", patterns: [/\bgold\b/i] },
  { category: "BAF", patterns: [/\b(balanced advantage|dynamic asset|multi asset allocation)\b/i] },
  {
    category: "Hybrid",
    patterns: [/\b(equity.?&.?debt|hybrid|aggressive hybrid|conservative hybrid)\b/i],
  },
  { category: "Flexi", patterns: [/\bflexi\s*cap\b/i] },
  { category: "Mid", patterns: [/\bmid\s*cap\b/i] },
  { category: "Small", patterns: [/\bsmall\s*cap\b/i] },
  { category: "Large", patterns: [/\b(large\s*cap|bluechip|blue chip)\b/i] },
  { category: "Index", patterns: [/\b(index|nifty|sensex|bse\s*\d+|etf\b)/i] },
  { category: "FOF", patterns: [/\b(fund of fund|fof)\b/i] },
];

const SKIP_HINTS = new Set([
  "not available",
  "n/a",
  "na",
  "unknown",
  "none",
  "-",
  "",
]);

export function toMfCategorySlug(label: string): string {
  return label.replace(/[^a-zA-Z0-9]+/g, "") || "Other";
}

export function titleCaseCategory(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function inferMfCategory(schemeName: string): string | null {
  const name = schemeName.trim();
  if (!name) return null;

  for (const { category, patterns } of INFERENCE_RULES) {
    if (patterns.some((p) => p.test(name))) return category;
  }

  return null;
}

/** Map a spreadsheet hint to a known canonical label without DB. */
export function mapCategoryHint(hint?: string | null): string | null {
  const raw = hint?.trim();
  if (!raw || SKIP_HINTS.has(raw.toLowerCase())) return null;

  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (ALIASES[key]) return ALIASES[key];

  const exact = DEFAULT_MF_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  return titleCaseCategory(raw);
}

export function mfCategoryBadgeClass(label: string | null | undefined): string {
  if (!label) return "badge-muted";
  const builtIn = new Set<string>(DEFAULT_MF_CATEGORIES);
  return builtIn.has(label) ? `badge-${label}` : "badge-muted";
}

export const MF_CATEGORY_HINT =
  "Optional category label from Excel or fund type — auto-inferred from name; new labels are registered automatically";
