/**
 * Resolve AMFI scheme codes from ISIN or fund name using the official NAVAll.txt file.
 */

import { unstable_cache } from "next/cache";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";

const AMFI_BULK_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

export type AmfiSchemeEntry = {
  schemeCode:    string;
  schemeName:    string;
  isinDivPayout: string;
  isinGrowth:    string;
  nav:           number;
  date:          string;
};

export type MfSchemeMatch = {
  schemeCode:    string;
  schemeName:    string;
  isinGrowth:    string | null;
  isinDivPayout: string | null;
  matchMethod:   "isin" | "code" | "name";
  confidence:    "high" | "medium" | "low";
  score:         number;
};

type AmfiIndex = {
  byIsin: Map<string, AmfiSchemeEntry>;
  byCode: Map<string, AmfiSchemeEntry>;
  all:    AmfiSchemeEntry[];
};

function normalizeIsin(isin: string): string {
  return isin.trim().toUpperCase();
}

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(direct\)|\(regular\)|direct plan|regular plan|growth option|growth plan/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

function isDirectGrowth(name: string): boolean {
  const lower = name.toLowerCase();
  const isDirect = lower.includes("direct");
  const isGrowth = lower.includes("growth");
  const isIdcw = /\b(idcw|dividend|payout)\b/i.test(name);
  return isDirect && isGrowth && !isIdcw;
}

function scoreNameMatch(query: string, entry: AmfiSchemeEntry): number {
  const qKey = normalizeNameKey(query);
  const nKey = normalizeNameKey(entry.schemeName);
  if (!qKey || !nKey) return 0;

  if (qKey === nKey) return 95;
  if (nKey.includes(qKey) || qKey.includes(nKey)) {
    const ratio = Math.min(qKey.length, nKey.length) / Math.max(qKey.length, nKey.length);
    let score = 70 + ratio * 20;
    if (isDirectGrowth(entry.schemeName)) score += 8;
    if (/\b(idcw|dividend|payout)\b/i.test(entry.schemeName)) score -= 15;
    return Math.min(score, 92);
  }

  const qTokens = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const nameLower = entry.schemeName.toLowerCase();
  const hits = qTokens.filter((t) => nameLower.includes(t)).length;
  if (hits === 0) return 0;

  let score = (hits / qTokens.length) * 65;
  if (isDirectGrowth(entry.schemeName)) score += 10;
  if (/\b(idcw|dividend|payout)\b/i.test(entry.schemeName)) score -= 12;
  return Math.min(score, 88);
}

async function fetchAmfiIndexFromNetwork(): Promise<AmfiIndex> {
  const res = await fetch(AMFI_BULK_URL, {
    cache:   "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
    signal:  AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`AMFI bulk file returned ${res.status}`);

  const byIsin = new Map<string, AmfiSchemeEntry>();
  const byCode = new Map<string, AmfiSchemeEntry>();
  const all: AmfiSchemeEntry[] = [];

  for (const line of (await res.text()).split("\n")) {
    const parts = line.trim().split(";");
    if (parts.length !== 6) continue;

    const [code, isinDiv, isinGrowth, name, navStr, date] = parts;
    const schemeCode = code.trim();
    const nav = parseFloat(navStr.trim());
    if (!schemeCode || isNaN(nav) || nav <= 0) continue;

    const entry: AmfiSchemeEntry = {
      schemeCode,
      schemeName:    name.trim(),
      isinDivPayout: isinDiv.trim(),
      isinGrowth:    isinGrowth.trim(),
      nav,
      date:          date.trim(),
    };

    all.push(entry);
    byCode.set(schemeCode, entry);

    for (const isin of [entry.isinGrowth, entry.isinDivPayout]) {
      if (isin) byIsin.set(normalizeIsin(isin), entry);
    }
  }

  return { byIsin, byCode, all };
}

export const getAmfiSchemeIndex = unstable_cache(
  fetchAmfiIndexFromNetwork,
  ["amfi-scheme-index-v1"],
  { revalidate: 86400, tags: ["amfi-scheme-index"] },
);

function toMatch(
  entry: AmfiSchemeEntry,
  matchMethod: MfSchemeMatch["matchMethod"],
  score: number,
): MfSchemeMatch {
  let confidence: MfSchemeMatch["confidence"] = "low";
  if (matchMethod === "isin" || matchMethod === "code" || score >= 90) confidence = "high";
  else if (score >= 75) confidence = "medium";

  return {
    schemeCode:    entry.schemeCode,
    schemeName:    formatMFSchemeName(entry.schemeName),
    isinGrowth:    entry.isinGrowth || null,
    isinDivPayout: entry.isinDivPayout || null,
    matchMethod,
    confidence,
    score,
  };
}

export async function lookupMfSchemes(options: {
  isin?:       string;
  name?:       string;
  schemeCode?: string;
  limit?:      number;
}): Promise<MfSchemeMatch[]> {
  const index = await getAmfiSchemeIndex();
  const limit = options.limit ?? 8;
  const matches: MfSchemeMatch[] = [];

  const code = options.schemeCode?.trim().replace(/^0+/, "") || options.schemeCode?.trim();
  if (code) {
    const entry = index.byCode.get(code);
    if (entry) matches.push(toMatch(entry, "code", 100));
  }

  const isin = options.isin ? normalizeIsin(options.isin) : "";
  if (isin) {
    const entry = index.byIsin.get(isin);
    if (entry) matches.push(toMatch(entry, "isin", 100));
  }

  const name = options.name?.trim();
  if (name) {
    const scored = index.all
      .map((entry) => ({ entry, score: scoreNameMatch(name, entry) }))
      .filter((r) => r.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    for (const { entry, score } of scored) {
      if (matches.some((m) => m.schemeCode === entry.schemeCode)) continue;
      matches.push(toMatch(entry, "name", score));
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Best single match for auto-import; null if ambiguous or not found. */
export async function resolveMfScheme(options: {
  isin?:       string;
  name?:       string;
  schemeCode?: string;
}): Promise<{ match: MfSchemeMatch | null; alternatives: MfSchemeMatch[] }> {
  const matches = await lookupMfSchemes({ ...options, limit: 5 });
  if (!matches.length) return { match: null, alternatives: [] };

  const best = matches[0];
  const second = matches[1];

  if (best.matchMethod === "isin" || best.matchMethod === "code") {
    return { match: best, alternatives: matches.slice(1) };
  }

  if (best.confidence === "high" && (!second || best.score - second.score >= 8)) {
    return { match: best, alternatives: matches.slice(1) };
  }

  if (best.confidence === "medium" && (!second || best.score - second.score >= 15)) {
    return { match: best, alternatives: matches.slice(1) };
  }

  return { match: null, alternatives: matches };
}

export function formatMfSchemeLookupText(
  matches: MfSchemeMatch[],
  query: { isin?: string; name?: string; schemeCode?: string },
): string {
  const label = query.isin
    ? `ISIN ${query.isin}`
    : query.schemeCode
      ? `code ${query.schemeCode}`
      : `"${query.name}"`;

  if (!matches.length) return `No AMFI scheme found for ${label}.`;

  const lines = matches.map(
    (m) =>
      `  • [${m.schemeCode}] ${m.schemeName} (${m.matchMethod}, ${m.confidence})` +
      (m.isinGrowth ? ` · Growth ISIN ${m.isinGrowth}` : ""),
  );

  return `Matches for ${label}:\n${lines.join("\n")}`;
}

export type BulkMfRowInput = {
  scheme_name:  string;
  units:        number;
  isin?:        string;
  scheme_code?: string;
  avg_nav?:     number;
  sip_amount?:  number;
  sip_date?:    number;
  category?:    string;
};

export async function resolveBulkMfRow(
  row: BulkMfRowInput,
): Promise<{ schemeCode: string; schemeName: string } | { error: string; alternatives?: MfSchemeMatch[] }> {
  const code = row.scheme_code?.trim().replace(/^0+/, "") || row.scheme_code?.trim();
  if (code) {
    const index = await getAmfiSchemeIndex();
    const entry = index.byCode.get(code);
    return {
      schemeCode: code,
      schemeName: entry ? formatMFSchemeName(entry.schemeName) : formatMFSchemeName(row.scheme_name),
    };
  }

  const { match, alternatives } = await resolveMfScheme({
    isin: row.isin,
    name: row.scheme_name,
  });

  if (match) {
    return { schemeCode: match.schemeCode, schemeName: match.schemeName };
  }

  if (alternatives.length) {
    const alt = alternatives
      .slice(0, 3)
      .map((a) => `[${a.schemeCode}] ${a.schemeName}`)
      .join("; ");
    return {
      error:      `Ambiguous match for "${row.scheme_name}"${row.isin ? ` (${row.isin})` : ""}. Possibilities: ${alt}`,
      alternatives,
    };
  }

  return {
    error: `Could not resolve AMFI code for "${row.scheme_name}"${row.isin ? ` (ISIN ${row.isin})` : ""}.`,
  };
}
