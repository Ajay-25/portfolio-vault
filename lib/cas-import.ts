/**
 * lib/cas-import.ts
 * Import MF holdings from casparser JSON or Vaulted CSV.
 */

import { prisma } from "@/lib/prisma";

export const VALID_PORTFOLIO_IDS = ["portfolio-primary", "portfolio-mom"] as const;
export type ValidPortfolioId = (typeof VALID_PORTFOLIO_IDS)[number];

export type ParsedMFHolding = {
  schemeCode: string;
  schemeName: string;
  units: number;
  avgNAV: number | null;
  matchMethod: "amfi" | "existing" | "rta" | "isin" | "unresolved" | "manual";
};

export type PreviewMFHolding = ParsedMFHolding & {
  schemeInNavCache: boolean;
  rowWarning?: string;
};

export type ImportPreviewResult = {
  holdings: PreviewMFHolding[];
  warnings: string[];
  errors: string[];
  casType?: string;
  statementPeriod?: { from?: string; to?: string };
  investorName?: string;
};

export type CasImportSummary = {
  updated: number;
  created: number;
  skipped: number;
  holdings: Array<{
    schemeCode: string;
    schemeName: string;
    units: number;
    action: "created" | "updated";
  }>;
  warnings: string[];
  errors: string[];
  casType?: string;
  statementPeriod?: { from?: string; to?: string };
  investorName?: string;
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveSchemeCode(
  schemeName: string,
  candidates: { amfi?: string; rta?: string; isin?: string },
  existingByCode: Map<string, { schemeName: string }>,
  existingByName: Map<string, string>,
): { schemeCode: string; matchMethod: ParsedMFHolding["matchMethod"] } | null {
  const amfi = candidates.amfi?.trim();
  if (amfi) {
    return { schemeCode: amfi.replace(/^0+/, "") || amfi, matchMethod: "amfi" };
  }

  const normalized = normalizeName(schemeName);
  const byName = existingByName.get(normalized);
  if (byName) {
    return { schemeCode: byName, matchMethod: "existing" };
  }

  const rta = candidates.rta?.trim();
  if (rta) {
    for (const [code] of existingByCode) {
      if (code === rta || code.endsWith(rta)) {
        return { schemeCode: code, matchMethod: "rta" };
      }
    }
    return { schemeCode: rta, matchMethod: "rta" };
  }

  const isin = candidates.isin?.trim();
  if (isin) {
    return { schemeCode: isin, matchMethod: "isin" };
  }

  return null;
}

function mergeHolding(
  map: Map<string, ParsedMFHolding>,
  incoming: ParsedMFHolding,
): void {
  const existing = map.get(incoming.schemeCode);
  if (!existing) {
    map.set(incoming.schemeCode, incoming);
    return;
  }

  map.set(incoming.schemeCode, {
    ...existing,
    units: existing.units + incoming.units,
    schemeName: existing.schemeName || incoming.schemeName,
    avgNAV: incoming.avgNAV ?? existing.avgNAV,
  });
}

/** Upsert parsed holdings into MFHolding for the given portfolio. */
export async function upsertCasHoldings(
  portfolioId: ValidPortfolioId,
  holdings: ParsedMFHolding[],
): Promise<CasImportSummary> {
  const summary: CasImportSummary = {
    updated: 0,
    created: 0,
    skipped: 0,
    holdings: [],
    warnings: [],
    errors: [],
  };

  const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
  if (!portfolio) {
    summary.errors.push(`Portfolio "${portfolioId}" not found.`);
    return summary;
  }

  for (const h of holdings) {
    if (!h.schemeCode.trim()) {
      summary.skipped++;
      summary.warnings.push(`Skipped "${h.schemeName}" — scheme code is required.`);
      continue;
    }

    if (h.units <= 0) {
      summary.skipped++;
      continue;
    }

    try {
      const existing = await prisma.mFHolding.findUnique({
        where: {
          portfolioId_schemeCode: { portfolioId, schemeCode: h.schemeCode },
        },
      });

      const data = {
        schemeName: h.schemeName,
        units: h.units,
        ...(h.avgNAV != null ? { avgNAV: h.avgNAV } : {}),
      };

      if (existing) {
        await prisma.mFHolding.update({
          where: { id: existing.id },
          data,
        });
        summary.updated++;
        summary.holdings.push({
          schemeCode: h.schemeCode,
          schemeName: h.schemeName,
          units: h.units,
          action: "updated",
        });
      } else {
        await prisma.mFHolding.create({
          data: {
            portfolioId,
            schemeCode: h.schemeCode,
            ...data,
          },
        });
        summary.created++;
        summary.holdings.push({
          schemeCode: h.schemeCode,
          schemeName: h.schemeName,
          units: h.units,
          action: "created",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      summary.errors.push(`Failed to upsert "${h.schemeName}": ${msg}`);
      summary.skipped++;
    }
  }

  return summary;
}

function buildExistingMaps(existingHoldings: Array<{ schemeCode: string; schemeName: string }>) {
  const existingByCode = new Map(
    existingHoldings.map((h) => [h.schemeCode, { schemeName: h.schemeName }]),
  );
  const existingByName = new Map(
    existingHoldings.map((h) => [normalizeName(h.schemeName), h.schemeCode]),
  );
  return { existingByCode, existingByName };
}

type CasparserScheme = {
  scheme?: string;
  amfi?: string;
  rta_code?: string;
  isin?: string;
  close?: number;
  close_calculated?: number;
  nav?: number;
};

type VaultedHoldingRow = {
  schemeCode?: string;
  schemeName?: string;
  units?: number;
  avgNAV?: number | null;
};

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

type ExtractOptions = {
  includeUnresolved?: boolean;
};

function extractFromCasparserFolios(
  folios: unknown[],
  existingHoldings: Array<{ schemeCode: string; schemeName: string }>,
  options?: ExtractOptions,
): { holdings: ParsedMFHolding[]; warnings: string[]; errors: string[] } {
  const includeUnresolved = options?.includeUnresolved ?? false;
  const warnings: string[] = [];
  const errors: string[] = [];
  const aggregated = new Map<string, ParsedMFHolding>();
  const { existingByCode, existingByName } = buildExistingMaps(existingHoldings);

  for (const folio of folios) {
    if (!folio || typeof folio !== "object") continue;
    const schemes = (folio as { schemes?: unknown[] }).schemes ?? [];
    for (const raw of schemes) {
      if (!raw || typeof raw !== "object") continue;
      const scheme = raw as CasparserScheme;

      const units = parseNumber(scheme.close_calculated) ?? parseNumber(scheme.close) ?? 0;
      if (units <= 0) continue;

      const schemeName = scheme.scheme?.trim();
      if (!schemeName) {
        warnings.push("Skipped a scheme with no name in casparser JSON.");
        continue;
      }

      const resolved = resolveSchemeCode(
        schemeName,
        { amfi: scheme.amfi, rta: scheme.rta_code, isin: scheme.isin },
        existingByCode,
        existingByName,
      );

      if (!resolved) {
        warnings.push(`Could not resolve scheme code for "${schemeName}".`);
        if (includeUnresolved) {
          mergeHolding(aggregated, {
            schemeCode: "",
            schemeName,
            units,
            avgNAV: parseNumber(scheme.nav),
            matchMethod: "unresolved",
          });
        }
        continue;
      }

      if (resolved.matchMethod === "isin") {
        warnings.push(
          `"${schemeName}" matched by ISIN only (${resolved.schemeCode}). NAV lookup may not work until scheme code is corrected.`,
        );
      }

      mergeHolding(aggregated, {
        schemeCode: resolved.schemeCode,
        schemeName,
        units,
        avgNAV: parseNumber(scheme.nav),
        matchMethod: resolved.matchMethod,
      });
    }
  }

  if (aggregated.size === 0) {
    warnings.push("No mutual fund holdings with units > 0 were found in this file.");
  }

  return { holdings: [...aggregated.values()], warnings, errors };
}

function extractFromVaultedRows(
  rows: VaultedHoldingRow[],
): { holdings: ParsedMFHolding[]; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const aggregated = new Map<string, ParsedMFHolding>();

  rows.forEach((row, index) => {
    const schemeCode = row.schemeCode?.trim();
    const schemeName = row.schemeName?.trim();
    const units = parseNumber(row.units) ?? 0;

    if (!schemeCode) {
      errors.push(`Row ${index + 1}: schemeCode is required.`);
      return;
    }
    if (!schemeName) {
      errors.push(`Row ${index + 1}: schemeName is required.`);
      return;
    }
    if (units <= 0) {
      warnings.push(`Row ${index + 1}: skipped "${schemeName}" (units <= 0).`);
      return;
    }

    mergeHolding(aggregated, {
      schemeCode: schemeCode.replace(/^0+/, "") || schemeCode,
      schemeName,
      units,
      avgNAV: parseNumber(row.avgNAV),
      matchMethod: "amfi",
    });
  });

  if (aggregated.size === 0 && errors.length === 0) {
    warnings.push("No importable holdings found in this file.");
  }

  return { holdings: [...aggregated.values()], warnings, errors };
}

/** Parse casparser CLI JSON or a simple Vaulted holdings array. */
export function extractMFHoldingsFromCasparserJson(
  data: unknown,
  existingHoldings: Array<{ schemeCode: string; schemeName: string }>,
  options?: ExtractOptions,
): { holdings: ParsedMFHolding[]; warnings: string[]; errors: string[] } {
  if (data == null || typeof data !== "object") {
    return {
      holdings: [],
      warnings: [],
      errors: ["Invalid JSON: expected an object or array."],
    };
  }

  if (Array.isArray(data)) {
    return extractFromVaultedRows(data as VaultedHoldingRow[]);
  }

  const record = data as Record<string, unknown>;
  if (Array.isArray(record.folios)) {
    return extractFromCasparserFolios(record.folios, existingHoldings, options);
  }

  if (Array.isArray(record.holdings)) {
    return extractFromVaultedRows(record.holdings as VaultedHoldingRow[]);
  }

  return {
    holdings: [],
    warnings: [],
    errors: [
      'Unrecognized JSON shape. Expected casparser output ({ "folios": [...] }) or an array of { schemeCode, schemeName, units, avgNAV }.',
    ],
  };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

/** Parse a simple CSV with schemeCode, schemeName, units, avgNAV headers. */
export function extractMFHoldingsFromCsv(
  text: string,
): { holdings: ParsedMFHolding[]; warnings: string[]; errors: string[] } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { holdings: [], warnings: [], errors: ["CSV file is empty."] };
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return {
      holdings: [],
      warnings: [],
      errors: ["CSV must include a header row and at least one data row."],
    };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const schemeCodeIdx = headers.indexOf("schemecode");
  const schemeNameIdx = headers.indexOf("schemename");
  const unitsIdx = headers.indexOf("units");
  const avgNavIdx = headers.indexOf("avgnav");

  if (schemeCodeIdx === -1 || schemeNameIdx === -1 || unitsIdx === -1) {
    return {
      holdings: [],
      warnings: [],
      errors: ["CSV headers must include schemeCode, schemeName, and units."],
    };
  }

  const rows: VaultedHoldingRow[] = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return {
      schemeCode: cells[schemeCodeIdx],
      schemeName: cells[schemeNameIdx],
      units: parseNumber(cells[unitsIdx]) ?? undefined,
      avgNAV: avgNavIdx >= 0 ? parseNumber(cells[avgNavIdx]) : null,
    };
  });

  return extractFromVaultedRows(rows);
}

function extractCasMetadata(data: unknown): Pick<
  ImportPreviewResult,
  "casType" | "statementPeriod" | "investorName"
> {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const record = data as Record<string, unknown>;
  const meta: Pick<ImportPreviewResult, "casType" | "statementPeriod" | "investorName"> = {};

  const casType = record.cas_type ?? record.casType;
  if (typeof casType === "string" && casType.trim()) {
    meta.casType = casType.trim();
  }

  const period = record.statement_period ?? record.statementPeriod;
  if (period && typeof period === "object") {
    const p = period as Record<string, unknown>;
    const from = typeof p.from === "string" ? p.from : undefined;
    const to = typeof p.to === "string" ? p.to : undefined;
    if (from || to) {
      meta.statementPeriod = { from, to };
    }
  }

  const investor = record.investor;
  if (investor && typeof investor === "object") {
    const name = (investor as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) {
      meta.investorName = name.trim();
    }
  }

  return meta;
}

async function enrichHoldingsForPreview(
  holdings: ParsedMFHolding[],
): Promise<PreviewMFHolding[]> {
  const codes = [...new Set(holdings.map((h) => h.schemeCode.trim()).filter(Boolean))];
  const navEntries =
    codes.length > 0
      ? await prisma.navCache.findMany({
          where: { schemeCode: { in: codes } },
          select: { schemeCode: true },
        })
      : [];
  const navSet = new Set(navEntries.map((n) => n.schemeCode));

  return holdings.map((h) => {
    const code = h.schemeCode.trim();
    let rowWarning: string | undefined;

    if (!code) {
      rowWarning = "Scheme code missing — edit before import.";
    } else if (h.matchMethod === "unresolved") {
      rowWarning = "Could not auto-resolve scheme code.";
    } else if (h.matchMethod === "isin") {
      rowWarning = "Matched by ISIN only — NAV lookup may fail until AMFI code is set.";
    } else if (!navSet.has(code)) {
      rowWarning = "Scheme not in NAV cache — verify AMFI code.";
    }

    return {
      ...h,
      schemeCode: code,
      schemeInNavCache: code ? navSet.has(code) : false,
      rowWarning,
    };
  });
}

async function loadExistingHoldings(portfolioId: ValidPortfolioId) {
  return prisma.mFHolding.findMany({
    where: { portfolioId },
    select: { schemeCode: true, schemeName: true },
  });
}

/** Parse JSON and resolve schemes without writing to the database. */
export async function previewJsonImport(
  portfolioId: ValidPortfolioId,
  data: unknown,
): Promise<ImportPreviewResult> {
  const existingHoldings = await loadExistingHoldings(portfolioId);
  const parsed = extractMFHoldingsFromCasparserJson(data, existingHoldings, {
    includeUnresolved: true,
  });
  const holdings = await enrichHoldingsForPreview(parsed.holdings);

  return {
    holdings,
    warnings: parsed.warnings,
    errors: parsed.errors,
    ...extractCasMetadata(data),
  };
}

/** Parse CSV and resolve schemes without writing to the database. */
export async function previewCsvImport(
  portfolioId: ValidPortfolioId,
  text: string,
): Promise<ImportPreviewResult> {
  void portfolioId;
  const parsed = extractMFHoldingsFromCsv(text);
  const holdings = await enrichHoldingsForPreview(parsed.holdings);

  return {
    holdings,
    warnings: parsed.warnings,
    errors: parsed.errors,
  };
}

/** Upsert parsed holdings and merge parse-level warnings/errors into the summary. */
export async function importMFHoldings(
  portfolioId: ValidPortfolioId,
  holdings: ParsedMFHolding[],
  parseMeta?: { warnings?: string[]; errors?: string[] },
): Promise<CasImportSummary> {
  const summary = await upsertCasHoldings(portfolioId, holdings);
  return {
    ...summary,
    warnings: [...(parseMeta?.warnings ?? []), ...summary.warnings],
    errors: [...(parseMeta?.errors ?? []), ...summary.errors],
  };
}

