import { prisma } from "@/lib/prisma";
import { ppfProjectedMaturity } from "@/lib/fixed-income-data";
import { confirmationRequired, isDeleteConfirmed } from "@/lib/agent/delete-confirmation";
import { normalizePortfolioKey, normalizePortfolioScope } from "@/lib/agent/normalize-input";
import { parseOptionalNumber } from "@/lib/agent/coerce-tool-input";
import { PORTFOLIO_IDS, type PortfolioKey, type PortfolioScope, portfolioIds } from "@/lib/agent/portfolio-scope";
import type { FixedIncomeHolding } from "@prisma/client";

function lakhs(n: number): string {
  return `₹${(n / 100000).toFixed(2)}L`;
}

function fiVal(h: Pick<FixedIncomeHolding, "currentValue" | "principal">): number {
  return h.currentValue ?? h.principal;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN");
}

function portfolioScopeFromInput(raw: unknown): PortfolioScope {
  return normalizePortfolioScope(raw, "mine");
}

function searchFields(h: FixedIncomeHolding): string[] {
  return [
    h.label,
    h.institution,
    h.accountNumber,
    h.uan,
    h.pran,
    h.type,
    h.employerName,
    h.isin,
    h.fundManager,
  ].filter(Boolean) as string[];
}

function matchesKeyword(h: FixedIncomeHolding, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  return searchFields(h).some((f) => f.toLowerCase().includes(kw));
}

async function findByKeyword(params: {
  keyword: string;
  portfolio: PortfolioKey;
  type?: string;
  activeOnly?: boolean;
}): Promise<FixedIncomeHolding[]> {
  const all = await prisma.fixedIncomeHolding.findMany({
    where: {
      portfolioId: PORTFOLIO_IDS[params.portfolio],
      ...(params.activeOnly !== false ? { isActive: true } : {}),
      ...(params.type ? { type: params.type } : {}),
    },
  });
  return all.filter((h) => matchesKeyword(h, params.keyword));
}

async function resolveRecord(params: {
  id?: string;
  keyword?: string;
  portfolio: PortfolioKey;
  type?: string;
  activeOnly?: boolean;
}): Promise<
  | { record: FixedIncomeHolding }
  | { error: string; options?: FixedIncomeHolding[] }
> {
  if (params.id?.trim()) {
    const record = await prisma.fixedIncomeHolding.findUnique({ where: { id: params.id.trim() } });
    if (!record) return { error: `No instrument with ID "${params.id}".` };
    return { record };
  }

  const keyword = params.keyword?.trim();
  if (!keyword) {
    return { error: "Provide id or keyword to identify the instrument. Use find_fi_holding first." };
  }

  const matches = await findByKeyword({
    keyword,
    portfolio: params.portfolio,
    type: params.type,
    activeOnly: params.activeOnly,
  });

  if (matches.length === 0) {
    return { error: `No instrument found matching "${keyword}". Try list_fi_holdings.` };
  }
  if (matches.length > 1) {
    return {
      error: `Found ${matches.length} instruments matching "${keyword}". Specify the ID:`,
      options: matches,
    };
  }
  return { record: matches[0] };
}

function formatOptions(rows: FixedIncomeHolding[]): string {
  return rows
    .map(
      (h) =>
        `• [${h.id}] ${h.type.toUpperCase()} — ${h.label}` +
        (h.institution ? ` (${h.institution})` : "") +
        ` · ${lakhs(fiVal(h))}`,
    )
    .join("\n");
}

export async function listFiHoldings(input: Record<string, unknown>): Promise<string> {
  const scope = portfolioScopeFromInput(input.portfolio ?? "mine");
  const typeFilter = input.type_filter as string | undefined;

  const holdings = await prisma.fixedIncomeHolding.findMany({
    where: {
      portfolioId: { in: portfolioIds(scope) },
      isActive: true,
      ...(typeFilter?.trim() ? { type: typeFilter.trim() } : {}),
    },
    include: { portfolio: { select: { name: true } } },
    orderBy: [{ type: "asc" }, { maturityDate: "asc" }],
  });

  if (!holdings.length) {
    return `No fixed income instruments found${typeFilter ? ` of type '${typeFilter}'` : ""}.`;
  }

  const lines = holdings.map((h) => {
    const parts = [
      `[${h.id}]`,
      h.type.toUpperCase().replace(/_/g, " "),
      `· ${h.label}`,
      h.institution ? `(${h.institution})` : "",
      `· ${lakhs(fiVal(h))}`,
      h.rate ? `@ ${h.rate}%` : "",
      h.maturityDate ? `→ matures ${formatDate(h.maturityDate)}` : "",
      `[${h.portfolio.name}]`,
    ];
    return parts.filter(Boolean).join(" ");
  });

  return `Fixed income holdings:\n${lines.join("\n")}`;
}

export async function findFiHolding(input: Record<string, unknown>): Promise<string> {
  const keyword = (input.keyword as string | undefined)?.trim() ?? "";
  const typeF = (input.type as string | undefined)?.trim();
  const scope = portfolioScopeFromInput(input.portfolio ?? "mine");

  const all = await prisma.fixedIncomeHolding.findMany({
    where: { portfolioId: { in: portfolioIds(scope) }, isActive: true },
  });

  const matches = all.filter((h) => {
    const typeMatch = !typeF || h.type === typeF;
    const kwMatch = !keyword || matchesKeyword(h, keyword);
    return typeMatch && kwMatch;
  });

  if (!matches.length) {
    return (
      `No fixed income holding found matching "${keyword || typeF || "your query"}". ` +
      `Try list_fi_holdings to see all instruments.`
    );
  }

  if (matches.length === 1) {
    const h = matches[0];
    const lines = [
      `Found: [ID: ${h.id}]`,
      `Type: ${h.type.toUpperCase()}`,
      `Label: ${h.label}`,
      h.institution ? `Institution: ${h.institution}` : "",
      h.accountNumber ? `Account: ${h.accountNumber}` : "",
      h.uan ? `UAN: ${h.uan}` : "",
      h.pran ? `PRAN: ${h.pran}` : "",
      `Balance: ${lakhs(fiVal(h))}`,
      h.rate ? `Rate: ${h.rate}%` : "",
      h.maturityDate ? `Matures: ${formatDate(h.maturityDate)}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }

  return (
    `Found ${matches.length} matching instruments. Which one did you mean?\n` +
    `${formatOptions(matches)}\n\nPlease confirm the ID or give more detail.`
  );
}

const CREATE_DEFAULTS: Record<string, Record<string, unknown>> = {
  ppf: { rate: 7.1, taxBenefit: "EEE", institution: "SBI Bank", annualContrib: 150000 },
  epf: { rate: 8.25, taxBenefit: "EEE", institution: "EPFO" },
  nps_tier1: {
    taxBenefit: "80CCD",
    institution: "PFRDA",
    equityPct: 60,
    corpBondPct: 30,
    govtSecPct: 10,
    altPct: 0,
    investmentChoice: "active",
  },
  nps_tier2: { taxBenefit: "none", institution: "PFRDA" },
  fd: { compoundingFreq: "quarterly", interestPayout: "cumulative", taxBenefit: "taxable" },
  nsc: { rate: 7.7, taxBenefit: "80C", institution: "Post Office", couponFrequency: "annual" },
  scss: { rate: 8.2, taxBenefit: "80C", couponFrequency: "quarterly" },
  bond: { taxBenefit: "taxable" },
  liquid: { taxBenefit: "taxable" },
  sweep_fd: { taxBenefit: "taxable" },
};

function parseDateField(raw: unknown): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBool(raw: unknown, defaultVal = false): boolean {
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  return defaultVal;
}

export async function createFiHolding(input: Record<string, unknown>): Promise<string> {
  const portfolio = normalizePortfolioKey(input.portfolio);
  const portfolioId = PORTFOLIO_IDS[portfolio];
  const type = String(input.type ?? "").trim();
  if (!type) return "type is required.";

  const principal = parseOptionalNumber(input.principal);
  if (principal === undefined) return "principal is required.";

  const defaults = CREATE_DEFAULTS[type] ?? {};

  let maturityDate = parseDateField(input.maturityDate);
  const startDate = parseDateField(input.startDate);
  if (type === "ppf" && startDate && !maturityDate) {
    maturityDate = new Date(startDate);
    maturityDate.setFullYear(maturityDate.getFullYear() + 15);
  }

  const e = parseOptionalNumber(input.equityPct) ?? (defaults.equityPct as number) ?? 60;
  const c = parseOptionalNumber(input.corpBondPct) ?? (defaults.corpBondPct as number) ?? 30;
  const g = parseOptionalNumber(input.govtSecPct) ?? (defaults.govtSecPct as number) ?? 10;
  const a = parseOptionalNumber(input.altPct) ?? (defaults.altPct as number) ?? 0;

  if (type.startsWith("nps") && Math.round(e + c + g + a) !== 100) {
    return `NPS allocation must sum to 100%. You provided E=${e}% + C=${c}% + G=${g}% + A=${a}% = ${e + c + g + a}%.`;
  }

  const currentValue = parseOptionalNumber(input.currentValue);

  const created = await prisma.fixedIncomeHolding.create({
    data: {
      portfolioId,
      type,
      label: (input.label as string)?.trim() || `${type.toUpperCase()} Account`,
      institution: (input.institution as string)?.trim() || (defaults.institution as string) || null,
      accountNumber: (input.accountNumber as string)?.trim() || null,
      principal,
      currentValue: currentValue ?? null,
      valueAsOf: currentValue != null ? new Date() : null,
      rate: parseOptionalNumber(input.rate) ?? (defaults.rate as number) ?? null,
      startDate,
      maturityDate,
      annualContrib:
        parseOptionalNumber(input.annualContrib) ?? (defaults.annualContrib as number) ?? null,
      monthlyContrib: parseOptionalNumber(input.monthlyContrib) ?? null,
      maturityAmount: parseOptionalNumber(input.maturityAmount) ?? null,
      compoundingFreq:
        (input.compoundingFreq as string) || (defaults.compoundingFreq as string) || null,
      interestPayout:
        (input.interestPayout as string) || (defaults.interestPayout as string) || null,
      autoRenewal: parseBool(input.autoRenewal),
      isTaxSaving: parseBool(input.isTaxSaving),
      uan: (input.uan as string)?.trim() || null,
      employerName: (input.employerName as string)?.trim() || null,
      employeeMonthly: parseOptionalNumber(input.employeeMonthly) ?? null,
      employerMonthly: parseOptionalNumber(input.employerMonthly) ?? null,
      epsBalance: parseOptionalNumber(input.epsBalance) ?? null,
      pran: (input.pran as string)?.trim() || null,
      fundManager: (input.fundManager as string)?.trim() || null,
      investmentChoice:
        (input.investmentChoice as string) || (defaults.investmentChoice as string) || null,
      equityPct: type.startsWith("nps") ? e : parseOptionalNumber(input.equityPct) ?? null,
      corpBondPct: type.startsWith("nps") ? c : parseOptionalNumber(input.corpBondPct) ?? null,
      govtSecPct: type.startsWith("nps") ? g : parseOptionalNumber(input.govtSecPct) ?? null,
      altPct: type.startsWith("nps") ? a : parseOptionalNumber(input.altPct) ?? null,
      extensionCount: parseOptionalNumber(input.extensionCount) ?? 0,
      isin: (input.isin as string)?.trim() || null,
      couponFrequency:
        (input.couponFrequency as string) || (defaults.couponFrequency as string) || null,
      rating: (input.rating as string)?.trim() || null,
      nextCouponDate: parseDateField(input.nextCouponDate),
      taxBenefit: (input.taxBenefit as string) || (defaults.taxBenefit as string) || "taxable",
      notes: (input.notes as string)?.trim() || null,
      isActive: true,
    },
  });

  return (
    `Created ${type.toUpperCase()}: "${created.label}"\n` +
    `Portfolio: ${portfolio}\n` +
    `Principal: ${lakhs(created.principal)}\n` +
    (created.rate ? `Rate: ${created.rate}%\n` : "") +
    (created.maturityDate ? `Maturity: ${formatDate(created.maturityDate)}\n` : "") +
    (created.taxBenefit ? `Tax benefit: ${created.taxBenefit}\n` : "") +
    `ID: ${created.id}`
  );
}

export async function updateFiBalance(input: Record<string, unknown>): Promise<string> {
  const newValue = parseOptionalNumber(input.new_value);
  if (newValue === undefined) return "new_value is required.";

  const asOf = parseDateField(input.as_of_date) ?? new Date();
  const portfolio = normalizePortfolioKey(input.portfolio);

  const resolved = await resolveRecord({
    id: input.id as string | undefined,
    keyword: input.keyword as string | undefined,
    portfolio,
  });

  if ("error" in resolved) {
    return resolved.options?.length
      ? `${resolved.error}\n${formatOptions(resolved.options)}`
      : resolved.error;
  }

  const record = resolved.record;
  const prev = fiVal(record);
  const diff = newValue - prev;

  await prisma.fixedIncomeHolding.update({
    where: { id: record.id },
    data: { currentValue: newValue, valueAsOf: asOf },
  });

  const changeStr =
    diff >= 0
      ? `+${lakhs(diff)}`
      : `-${lakhs(Math.abs(diff))}`;

  return (
    `Updated balance for "${record.label}" (${record.type.toUpperCase()}):\n` +
    `Previous: ${lakhs(prev)}\n` +
    `New:      ${lakhs(newValue)}\n` +
    `Change:   ${changeStr}\n` +
    `As of:    ${formatDate(asOf)}`
  );
}

const UPDATABLE_FIELDS = new Set([
  "label", "institution", "accountNumber", "principal", "currentValue", "rate",
  "startDate", "maturityDate", "annualContrib", "monthlyContrib", "maturityAmount",
  "compoundingFreq", "interestPayout", "autoRenewal", "isTaxSaving", "uan", "employerName",
  "employeeMonthly", "employerMonthly", "epsBalance", "pran", "fundManager", "investmentChoice",
  "equityPct", "corpBondPct", "govtSecPct", "altPct", "extensionCount", "isin",
  "couponFrequency", "rating", "nextCouponDate", "taxBenefit", "notes",
]);

const DATE_FIELDS = new Set(["startDate", "maturityDate", "nextCouponDate", "valueAsOf"]);

export async function updateFiHolding(input: Record<string, unknown>): Promise<string> {
  let fields = input.fields_to_update as Record<string, unknown> | undefined;

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    fields = {};
    for (const [key, val] of Object.entries(input)) {
      if (["id", "keyword", "portfolio", "fields_to_update"].includes(key)) continue;
      if (UPDATABLE_FIELDS.has(key) && val !== undefined) fields[key] = val;
    }
  }

  if (!Object.keys(fields).length) {
    return "No fields provided to update. Pass fields_to_update or individual fields.";
  }

  const portfolio = normalizePortfolioKey(input.portfolio);
  const resolved = await resolveRecord({
    id: input.id as string | undefined,
    keyword: input.keyword as string | undefined,
    portfolio,
  });

  if ("error" in resolved) {
    return resolved.options?.length
      ? `${resolved.error}\n${formatOptions(resolved.options)}`
      : resolved.error;
  }

  const record = resolved.record;
  const updateData: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(fields)) {
    if (!UPDATABLE_FIELDS.has(key) || val === undefined || val === null) continue;
    if (DATE_FIELDS.has(key) && typeof val === "string") {
      updateData[key] = parseDateField(val);
    } else if (["autoRenewal", "isTaxSaving"].includes(key)) {
      updateData[key] = parseBool(val);
    } else if (
      typeof val === "string" &&
      !["label", "institution", "notes", "taxBenefit", "accountNumber", "uan", "pran", "isin", "fundManager", "investmentChoice", "compoundingFreq", "interestPayout", "couponFrequency", "rating"].includes(key)
    ) {
      const n = parseOptionalNumber(val);
      updateData[key] = n !== undefined ? n : val;
    } else {
      updateData[key] = val;
    }
  }

  if ("currentValue" in updateData) updateData.valueAsOf = new Date();

  if (
    "equityPct" in updateData ||
    "corpBondPct" in updateData ||
    "govtSecPct" in updateData ||
    "altPct" in updateData
  ) {
    const e = (updateData.equityPct as number) ?? record.equityPct ?? 0;
    const c = (updateData.corpBondPct as number) ?? record.corpBondPct ?? 0;
    const g = (updateData.govtSecPct as number) ?? record.govtSecPct ?? 0;
    const a = (updateData.altPct as number) ?? record.altPct ?? 0;
    if (Math.round(e + c + g + a) !== 100) {
      return `NPS allocation must sum to 100%. Proposed: E=${e}+C=${c}+G=${g}+A=${a}=${e + c + g + a}%.`;
    }
  }

  await prisma.fixedIncomeHolding.update({ where: { id: record.id }, data: updateData });

  const changedSummary = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return `Updated "${record.label}" (${record.type.toUpperCase()}):\n${changedSummary}`;
}

export async function updateNpsAllocation(input: Record<string, unknown>): Promise<string> {
  const portfolio = normalizePortfolioKey(input.portfolio);
  const portfolioId = PORTFOLIO_IDS[portfolio];

  let record: FixedIncomeHolding | null = null;
  if (input.id) {
    record = await prisma.fixedIncomeHolding.findUnique({ where: { id: input.id as string } });
  } else {
    record =
      (await prisma.fixedIncomeHolding.findFirst({
        where: { portfolioId, type: "nps_tier1", isActive: true },
      })) ??
      (await prisma.fixedIncomeHolding.findFirst({
        where: { portfolioId, type: { startsWith: "nps" }, isActive: true },
      }));
  }

  if (!record) return `NPS account not found in ${portfolio} portfolio.`;

  const e = parseOptionalNumber(input.equity_pct) ?? record.equityPct ?? 60;
  const c = parseOptionalNumber(input.corp_bond_pct) ?? record.corpBondPct ?? 30;
  const g = parseOptionalNumber(input.govt_sec_pct) ?? record.govtSecPct ?? 10;
  const a = parseOptionalNumber(input.alt_pct) ?? record.altPct ?? 0;

  if (Math.round(e + c + g + a) !== 100) {
    return (
      `NPS allocation must sum to 100%. ` +
      `E=${e}% + C=${c}% + G=${g}% + A=${a}% = ${e + c + g + a}%. Alternative assets max 5%.`
    );
  }
  if (a > 5) return `Alternative assets (A) cannot exceed 5%. You specified ${a}%.`;

  const updateData: Record<string, unknown> = {
    equityPct: e,
    corpBondPct: c,
    govtSecPct: g,
    altPct: a,
  };
  if (input.fund_manager) updateData.fundManager = input.fund_manager;
  if (input.investment_choice) updateData.investmentChoice = input.investment_choice;

  await prisma.fixedIncomeHolding.update({ where: { id: record.id }, data: updateData });

  return (
    `NPS allocation updated for "${record.label}":\n` +
    `Equity (E): ${e}%\nCorporate bonds (C): ${c}%\nGovt securities (G): ${g}%\nAlternative (A): ${a}%` +
    (input.fund_manager ? `\nFund manager: ${input.fund_manager}` : "") +
    (input.investment_choice ? `\nInvestment choice: ${input.investment_choice}` : "")
  );
}

export async function extendPpf(input: Record<string, unknown>): Promise<string> {
  const portfolio = normalizePortfolioKey(input.portfolio);
  const portfolioId = PORTFOLIO_IDS[portfolio];
  const withDeposits = parseBool(input.with_deposits);

  let record: FixedIncomeHolding | null = null;
  if (input.id) {
    record = await prisma.fixedIncomeHolding.findUnique({ where: { id: input.id as string } });
  } else {
    record = await prisma.fixedIncomeHolding.findFirst({
      where: { portfolioId, type: "ppf", isActive: true },
    });
  }

  if (!record) return `PPF account not found in ${portfolio} portfolio.`;

  const currentMaturity = record.maturityDate ?? new Date();
  const newMaturity = new Date(currentMaturity);
  newMaturity.setFullYear(newMaturity.getFullYear() + 5);

  const extNum = (record.extensionCount ?? 0) + 1;
  const noteSuffix = `Extension ${extNum}: ${withDeposits ? "with" : "without"} deposits from ${new Date().getFullYear()}`;

  const updateData: Record<string, unknown> = {
    maturityDate: newMaturity,
    extensionCount: extNum,
    notes: record.notes ? `${record.notes}; ${noteSuffix}` : noteSuffix,
  };

  if (!withDeposits) {
    updateData.annualContrib = 0;
  } else {
    const newAnnual = parseOptionalNumber(input.annual_contrib_if_continuing);
    if (newAnnual !== undefined) updateData.annualContrib = newAnnual;
  }

  await prisma.fixedIncomeHolding.update({ where: { id: record.id }, data: updateData });

  return (
    `PPF extended for "${record.label}":\n` +
    `Previous maturity: ${formatDate(currentMaturity)}\n` +
    `New maturity: ${formatDate(newMaturity)}\n` +
    `Extension count: ${extNum}\n` +
    `Deposits: ${withDeposits ? "Continuing" : "Stopped (passive extension)"}`
  );
}

export async function renewFd(input: Record<string, unknown>): Promise<string> {
  const portfolio = normalizePortfolioKey(input.portfolio);
  const newMaturity = parseDateField(input.new_maturity_date);
  if (!newMaturity) return "new_maturity_date is required (ISO date).";

  const resolved = await resolveRecord({
    id: input.id as string | undefined,
    keyword: input.keyword as string | undefined,
    portfolio,
    type: "fd",
  });

  if ("error" in resolved) {
    return resolved.options?.length
      ? `${resolved.error}\n${formatOptions(resolved.options)}`
      : resolved.error;
  }

  const record = resolved.record;
  const newRate = parseOptionalNumber(input.new_rate);
  const newPrincipal = parseOptionalNumber(input.new_principal);

  const updateData: Record<string, unknown> = { maturityDate: newMaturity };
  if (newRate !== undefined) updateData.rate = newRate;
  if (newPrincipal !== undefined) updateData.principal = newPrincipal;

  await prisma.fixedIncomeHolding.update({ where: { id: record.id }, data: updateData });

  return (
    `FD renewed: "${record.label}" (${record.institution ?? "—"})\n` +
    `Previous maturity: ${formatDate(record.maturityDate)}\n` +
    `New maturity: ${formatDate(newMaturity)}\n` +
    (newRate !== undefined ? `New rate: ${newRate}%\n` : `Rate unchanged: ${record.rate}%\n`) +
    (newPrincipal !== undefined
      ? `New principal: ${lakhs(newPrincipal)}\n`
      : `Principal unchanged: ${lakhs(record.principal)}`)
  );
}

export async function closeFiHolding(input: Record<string, unknown>): Promise<string> {
  const portfolio = normalizePortfolioKey(input.portfolio);
  const resolved = await resolveRecord({
    id: input.id as string | undefined,
    keyword: input.keyword as string | undefined,
    portfolio,
    activeOnly: true,
  });

  if ("error" in resolved) {
    return resolved.options?.length
      ? `${resolved.error}\n${formatOptions(resolved.options)}`
      : resolved.error;
  }

  const record = resolved.record;
  const preview = [
    `[${record.type.toUpperCase()}] ${record.label} — ${lakhs(fiVal(record))}` +
      (record.institution ? ` (${record.institution})` : ""),
  ];

  if (!isDeleteConfirmed(input)) {
    return confirmationRequired(
      "Mark this fixed income instrument as closed (keeps history)?",
      preview,
    );
  }

  const finalValue = parseOptionalNumber(input.final_value);

  await prisma.fixedIncomeHolding.update({
    where: { id: record.id },
    data: {
      isActive: false,
      currentValue: finalValue ?? record.currentValue,
      valueAsOf: new Date(),
      notes:
        (record.notes ? `${record.notes}; ` : "") +
        `Closed ${formatDate(new Date())}` +
        (input.notes ? `: ${input.notes}` : ""),
    },
  });

  return (
    `Marked as closed: "${record.label}" (${record.type.toUpperCase()})\n` +
    (finalValue !== undefined ? `Final value: ${lakhs(finalValue)}\n` : "") +
    `Record retained in history.`
  );
}

export async function deleteFiHolding(input: Record<string, unknown>): Promise<string> {
  const id = input.id as string | undefined;

  if (!id?.trim()) {
    return "delete_fi_holding requires id from find_fi_holding. For matured instruments use close_fi_holding.";
  }

  const record = await prisma.fixedIncomeHolding.findUnique({ where: { id: id.trim() } });
  if (!record) return `No instrument with ID "${id}" found.`;

  const preview = [
    `[${record.type.toUpperCase()}] ${record.label} — ${lakhs(fiVal(record))} (${record.institution ?? "—"})`,
  ];

  if (!isDeleteConfirmed(input)) {
    return confirmationRequired(
      "Permanently delete this fixed income record? Use close_fi_holding for matured instruments.",
      preview,
    );
  }

  await prisma.fixedIncomeHolding.delete({ where: { id: record.id } });

  return `Deleted "${record.label}" (${record.type.toUpperCase()}, ${record.institution ?? "—"}) permanently.`;
}

export async function calculateFiProjection(input: Record<string, unknown>): Promise<string> {
  let record: FixedIncomeHolding | null = null;

  if (input.id) {
    record = await prisma.fixedIncomeHolding.findUnique({ where: { id: input.id as string } });
  } else if (input.keyword) {
    const portfolio = normalizePortfolioKey(input.portfolio);
    const resolved = await resolveRecord({
      keyword: input.keyword as string,
      portfolio,
    });
    if ("error" in resolved) {
      return resolved.options?.length
        ? `${resolved.error}\n${formatOptions(resolved.options)}`
        : resolved.error;
    }
    record = resolved.record;
  }

  const type = record?.type ?? (input.type as string) ?? "fd";
  const balance = record
    ? fiVal(record)
    : parseOptionalNumber(input.principal) ?? 0;
  const rate = record?.rate ?? parseOptionalNumber(input.rate) ?? 7;
  const annualAddition = record?.annualContrib ?? parseOptionalNumber(input.annual_addition) ?? 0;

  let years = parseOptionalNumber(input.years);
  if (years === undefined && record?.maturityDate) {
    years = Math.max(0, (record.maturityDate.getTime() - Date.now()) / (365.25 * 86400000));
  }
  if (years === undefined) {
    return "How many years should I project? (Couldn't determine tenure from the record.)";
  }

  const r = rate / 100;
  let projected: number;
  let explanation: string;

  if (type === "ppf") {
    projected = ppfProjectedMaturity(balance, annualAddition, Math.round(years), r);
    explanation =
      `PPF: ${lakhs(balance)} at ${rate}% for ${years.toFixed(1)} yrs` +
      (annualAddition ? ` + ${lakhs(annualAddition)}/yr deposits` : "");
  } else if (type === "fd") {
    projected = Math.round(balance * Math.pow(1 + r / 4, 4 * years));
    explanation = `FD: ${lakhs(balance)} at ${rate}% for ${years.toFixed(1)} yrs (quarterly compounding)`;
  } else if (type.startsWith("nps")) {
    const ep = (record?.equityPct ?? 60) / 100;
    const cp = (record?.corpBondPct ?? 30) / 100;
    const gp = (record?.govtSecPct ?? 10) / 100;
    const blended = ep * 0.12 + cp * 0.08 + gp * 0.08;
    let val = balance;
    const monthly = record?.monthlyContrib ?? 0;
    for (let i = 0; i < years; i++) val = (val + monthly * 12) * (1 + blended);
    projected = Math.round(val);
    explanation = `NPS blended ~${(blended * 100).toFixed(1)}% return`;
  } else {
    projected = Math.round(balance * Math.pow(1 + r, years));
    explanation = `${type.toUpperCase()}: ${lakhs(balance)} at ${rate}% for ${years.toFixed(1)} yrs`;
  }

  return (
    `Projection for ${record?.label ?? type.toUpperCase()}:\n` +
    `${explanation}\n\n` +
    `Projected value: ${lakhs(projected)} (₹${projected.toLocaleString("en-IN")})\n\n` +
    `Note: Estimate assuming constant rate. Actual returns may vary.`
  );
}

export async function legacyUpdateFixedIncome(input: Record<string, unknown>): Promise<string> {
  const fields: Record<string, unknown> = {};
  if (input.principal !== undefined) fields.principal = input.principal;
  if (input.rate !== undefined) fields.rate = input.rate;
  if (input.new_label !== undefined) fields.label = input.new_label;
  if (input.institution !== undefined) fields.institution = input.institution;
  if (input.notes !== undefined) fields.notes = input.notes;
  if (input.currentValue !== undefined) fields.currentValue = input.currentValue;
  return updateFiHolding({ ...input, fields_to_update: fields });
}

export async function legacyDeleteFixedIncome(input: Record<string, unknown>): Promise<string> {
  if (input.id) return deleteFiHolding(input);
  const portfolio = normalizePortfolioKey(input.portfolio);
  const resolved = await resolveRecord({
    keyword:
      (input.keyword as string) ||
      (input.label as string) ||
      (input.type as string) ||
      "",
    portfolio,
    type: input.type as string | undefined,
  });
  if ("error" in resolved) {
    return resolved.options?.length
      ? `${resolved.error}\n${formatOptions(resolved.options)}`
      : resolved.error;
  }
  return deleteFiHolding({ id: resolved.record.id, confirmed: input.confirmed });
}
