import { prisma } from "@/lib/prisma";
import { lookupMfSchemes } from "@/lib/apis/mf-scheme-lookup";
import { resolveMfCategoryForHolding } from "@/lib/data/mf-categories-server";
import { PORTFOLIO_IDS, type PortfolioKey } from "@/lib/agent/portfolio-scope";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";

export type MfHoldingPatch = {
  units?:     number;
  avgNAV?:    number | null;
  sipAmount?: number | null;
  sipDate?:   number | null;
  category?:  string | null;
};

export type MfHoldingMatch = {
  schemeCode:    string;
  schemeName:    string;
  portfolio:     PortfolioKey;
  portfolioName: string;
  units:         number;
  avgNAV:        number | null;
  sipAmount:     number | null;
  sipDate:       number | null;
  category:      string | null;
};

const PORTFOLIO_NAMES: Record<PortfolioKey, string> = {
  mine:   "mine (primary)",
  mother: "mother (secondary)",
};

export function normalizeFundNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(direct\)|\(regular\)|direct plan|regular plan|growth option|growth plan/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

function portfolioKeyFromId(id: string): PortfolioKey {
  return id === PORTFOLIO_IDS.mother ? "mother" : "mine";
}

function toMatch(
  h: {
    schemeCode: string;
    schemeName: string;
    units: number;
    avgNAV: number | null;
    sipAmount: number | null;
    sipDate: number | null;
    category: string | null;
    portfolio: { id: string; name: string };
  },
): MfHoldingMatch {
  const portfolio = portfolioKeyFromId(h.portfolio.id);
  return {
    schemeCode:    h.schemeCode,
    schemeName:    formatMFSchemeName(h.schemeName),
    portfolio,
    portfolioName: h.portfolio.name,
    units:         h.units,
    avgNAV:        h.avgNAV,
    sipAmount:     h.sipAmount,
    sipDate:       h.sipDate,
    category:      h.category,
  };
}

export function formatMfHoldingLine(h: MfHoldingMatch): string {
  const sip =
    h.sipAmount && h.sipAmount > 0
      ? ` · SIP ₹${h.sipAmount.toLocaleString("en-IN")}${h.sipDate ? ` on ${h.sipDate}th` : ""}`
      : "";
  const avg = h.avgNAV != null ? ` · avg ₹${h.avgNAV.toFixed(2)}` : "";
  return `  • [${h.schemeCode}] ${h.schemeName} (${h.portfolioName} / ${h.portfolio}): ${h.units} units${avg}${sip}`;
}

export async function findMfHoldings(params: {
  portfolio?:  "mine" | "mother" | "both";
  scheme_code?: string;
  keyword?:    string;
  isin?:       string;
}): Promise<MfHoldingMatch[]> {
  const portfolio = params.portfolio ?? "both";
  const ids =
    portfolio === "both" ? Object.values(PORTFOLIO_IDS) : [PORTFOLIO_IDS[portfolio]];

  let schemeCodes: string[] | undefined;
  if (params.scheme_code?.trim()) {
    schemeCodes = [params.scheme_code.trim().replace(/^0+/, "") || params.scheme_code.trim()];
  } else if (params.isin?.trim()) {
    const matches = await lookupMfSchemes({ isin: params.isin, limit: 1 });
    if (matches[0]) schemeCodes = [matches[0].schemeCode];
    else return [];
  }

  const holdings = await prisma.mFHolding.findMany({
    where: {
      portfolioId: { in: ids },
      ...(schemeCodes ? { schemeCode: { in: schemeCodes } } : {}),
    },
    include: { portfolio: { select: { id: true, name: true } } },
    orderBy: [{ portfolioId: "asc" }, { schemeName: "asc" }],
  });

  let filtered = holdings;
  if (params.keyword?.trim() && !schemeCodes) {
    const kw = params.keyword.trim().toLowerCase();
    const kwKey = normalizeFundNameKey(kw);
    filtered = holdings.filter((h) => {
      const name = h.schemeName.toLowerCase();
      return name.includes(kw) || normalizeFundNameKey(h.schemeName).includes(kwKey);
    });
  }

  return filtered.map(toMatch);
}

export async function findMfHoldingStrict(params: {
  portfolio:    PortfolioKey;
  scheme_code:  string;
}): Promise<
  | { holding: MfHoldingMatch; otherPortfolio?: MfHoldingMatch }
  | { error: string; suggestions?: MfHoldingMatch[] }
> {
  const code = params.scheme_code.trim().replace(/^0+/, "") || params.scheme_code.trim();
  const pid = PORTFOLIO_IDS[params.portfolio];

  const target = await prisma.mFHolding.findFirst({
    where:   { portfolioId: pid, schemeCode: code },
    include: { portfolio: { select: { id: true, name: true } } },
  });

  if (target) {
    return { holding: toMatch(target) };
  }

  const otherKey: PortfolioKey = params.portfolio === "mine" ? "mother" : "mine";
  const other = await prisma.mFHolding.findFirst({
    where:   { portfolioId: PORTFOLIO_IDS[otherKey], schemeCode: code },
    include: { portfolio: { select: { id: true, name: true } } },
  });

  if (other) {
    return {
      error:           `Not in ${PORTFOLIO_NAMES[params.portfolio]} — this fund is in ${PORTFOLIO_NAMES[otherKey]}. Use portfolio "${otherKey}" or confirm with the user.`,
      suggestions:     [toMatch(other)],
    };
  }

  const fuzzy = await findMfHoldings({ portfolio: params.portfolio, keyword: code });
  if (fuzzy.length) {
    return {
      error:        `No holding with scheme code ${code} in ${PORTFOLIO_NAMES[params.portfolio]}. Did you mean one of these? Ask the user to confirm scheme_code + portfolio.`,
      suggestions: fuzzy.slice(0, 5),
    };
  }

  return {
    error: `No MF holding found for scheme code ${code} in ${PORTFOLIO_NAMES[params.portfolio]}. Call find_mf_holdings first.`,
  };
}

async function findSameFundDuplicate(
  portfolioId: string,
  schemeCode: string,
  schemeName: string,
): Promise<MfHoldingMatch | null> {
  const key = normalizeFundNameKey(schemeName);
  if (!key) return null;

  const peers = await prisma.mFHolding.findMany({
    where:   { portfolioId, schemeCode: { not: schemeCode } },
    include: { portfolio: { select: { id: true, name: true } } },
  });

  const dup = peers.find((h) => normalizeFundNameKey(h.schemeName) === key);
  return dup ? toMatch(dup) : null;
}

function formatPatchSummary(before: MfHoldingMatch, after: MfHoldingMatch, fields: string[]): string {
  const lines = fields.map((f) => {
    switch (f) {
      case "units":
        return `units ${before.units} → ${after.units}`;
      case "avgNAV":
        return `avg NAV ${before.avgNAV ?? "—"} → ${after.avgNAV ?? "—"}`;
      case "sipAmount":
        return `SIP ₹${before.sipAmount ?? 0} → ₹${after.sipAmount ?? 0}`;
      case "sipDate":
        return `SIP date ${before.sipDate ?? "—"} → ${after.sipDate ?? "—"}`;
      case "category":
        return `category ${before.category ?? "—"} → ${after.category ?? "—"}`;
      default:
        return f;
    }
  });
  return lines.join(" · ");
}

export async function patchMfHolding(params: {
  portfolio:   PortfolioKey;
  scheme_code: string;
  patch:       MfHoldingPatch;
}): Promise<string> {
  const keys = Object.keys(params.patch) as (keyof MfHoldingPatch)[];
  if (keys.length === 0) {
    return "No fields to update. Pass only the fields you want to change (units, avg_nav, sip_amount, sip_date, category).";
  }

  const resolved = await findMfHoldingStrict({
    portfolio:   params.portfolio,
    scheme_code: params.scheme_code,
  });

  if ("error" in resolved) {
    const hint = resolved.suggestions?.length
      ? `\n${resolved.suggestions.map(formatMfHoldingLine).join("\n")}`
      : "";
    return resolved.error + hint;
  }

  const before = resolved.holding;
  const pid = PORTFOLIO_IDS[params.portfolio];
  const row = await prisma.mFHolding.findFirst({
    where: { portfolioId: pid, schemeCode: before.schemeCode },
  });
  if (!row) return `Holding not found: ${before.schemeCode}`;

  const next = {
    units:     params.patch.units !== undefined ? params.patch.units : row.units,
    avgNAV:    params.patch.avgNAV !== undefined ? params.patch.avgNAV : row.avgNAV,
    sipAmount: params.patch.sipAmount !== undefined ? params.patch.sipAmount : row.sipAmount,
    sipDate:   params.patch.sipDate !== undefined ? params.patch.sipDate : row.sipDate,
    category:  row.category,
  };

  if (params.patch.category !== undefined) {
    const { label } = await resolveMfCategoryForHolding({
      categoryHint: params.patch.category,
      schemeName:   row.schemeName,
    });
    next.category = label;
  }

  await prisma.mFHolding.update({
    where: { id: row.id },
    data:  next,
  });

  const after: MfHoldingMatch = {
    ...before,
    units:     next.units,
    avgNAV:    next.avgNAV,
    sipAmount: next.sipAmount,
    sipDate:   next.sipDate,
    category:  next.category,
  };

  return `Updated ${before.schemeName} [${before.schemeCode}] in ${PORTFOLIO_NAMES[params.portfolio]}: ${formatPatchSummary(before, after, keys)}`;
}

export async function createMfHolding(params: {
  portfolio:   PortfolioKey;
  schemeCode:  string;
  schemeName:  string;
  units:       number;
  avgNAV?:     number | null;
  sipAmount?:  number | null;
  sipDate?:    number | null;
  category?:   string | null;
}): Promise<string> {
  const pid = PORTFOLIO_IDS[params.portfolio];
  const code = params.schemeCode.trim().replace(/^0+/, "") || params.schemeCode.trim();

  const existing = await prisma.mFHolding.findFirst({
    where: { portfolioId: pid, schemeCode: code },
    include: { portfolio: { select: { id: true, name: true } } },
  });

  if (existing) {
    const match = toMatch(existing);
    return [
      `Refused: [${code}] already exists in ${PORTFOLIO_NAMES[params.portfolio]}.`,
      formatMfHoldingLine(match),
      "Use update_mf_holding to change units/SIP — do NOT call add_mf_holding again.",
    ].join("\n");
  }

  const duplicate = await findSameFundDuplicate(pid, code, params.schemeName);
  if (duplicate) {
    return [
      `Refused: a matching fund already exists under a different scheme code in ${PORTFOLIO_NAMES[params.portfolio]}.`,
      formatMfHoldingLine(duplicate),
      `Requested: [${code}] ${params.schemeName}`,
      "These appear to be the same fund. Use update_mf_holding on the existing code — do not create a duplicate.",
    ].join("\n");
  }

  const { label: category } = await resolveMfCategoryForHolding({
    categoryHint: params.category,
    schemeName:   params.schemeName,
  });

  await prisma.mFHolding.create({
    data: {
      portfolioId: pid,
      schemeCode:  code,
      schemeName:  params.schemeName,
      units:       params.units,
      avgNAV:      params.avgNAV ?? null,
      sipAmount:   params.sipAmount ?? null,
      sipDate:     params.sipDate ?? null,
      category,
    },
  });

  return `Added ${formatMFSchemeName(params.schemeName)} [${code}] to ${PORTFOLIO_NAMES[params.portfolio]}. Units: ${params.units}`;
}

export function formatFindMfHoldingsText(
  rows: MfHoldingMatch[],
  query: { portfolio?: string; scheme_code?: string; keyword?: string; isin?: string },
): string {
  const label = [
    query.scheme_code && `code ${query.scheme_code}`,
    query.isin && `ISIN ${query.isin}`,
    query.keyword && `"${query.keyword}"`,
    query.portfolio && `portfolio ${query.portfolio}`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!rows.length) return `No MF holdings found${label ? ` for ${label}` : ""}.`;

  return `MF holdings${label ? ` (${label})` : ""} — ${rows.length} match(es):\n${rows.map(formatMfHoldingLine).join("\n")}`;
}

export function buildPatchFromInput(input: Record<string, unknown>): MfHoldingPatch {
  const patch: MfHoldingPatch = {};
  if (input.units !== undefined) patch.units = input.units as number;
  if (input.new_units !== undefined) patch.units = input.new_units as number;
  if (input.avg_nav !== undefined) patch.avgNAV = input.avg_nav as number | null;
  if (input.sip_amount !== undefined) patch.sipAmount = input.sip_amount as number | null;
  if (input.sip_date !== undefined) patch.sipDate = input.sip_date as number | null;
  if (input.category !== undefined) patch.category = input.category as string | null;
  return patch;
}

export function buildPatchFromBulkRow(row: {
  units?:        number;
  avg_nav?:      number;
  sip_amount?:   number;
  sip_date?:     number;
  category?:     string;
}): MfHoldingPatch {
  const patch: MfHoldingPatch = {};
  if (row.units !== undefined) patch.units = row.units;
  if (row.avg_nav !== undefined) patch.avgNAV = row.avg_nav;
  if (row.sip_amount !== undefined) patch.sipAmount = row.sip_amount;
  if (row.sip_date !== undefined) patch.sipDate = row.sip_date;
  if (row.category !== undefined) patch.category = row.category;
  return patch;
}
