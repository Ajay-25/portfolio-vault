import { prisma } from "@/lib/prisma";
import {
  type PortfolioKey,
  type PortfolioScope,
  portfolioIds,
  toPortfolioKey,
} from "@/lib/agent/portfolio-scope";

export type FixedIncomeMatch = {
  id:            string;
  type:          string;
  label:         string;
  institution:   string | null;
  principal:     number;
  rate:          number | null;
  portfolio:     PortfolioKey;
  portfolioName: string;
};

const PORTFOLIO_NAMES: Record<PortfolioKey, string> = {
  mine:   "mine (primary)",
  mother: "mother (secondary)",
};

function formatPrincipalL(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)}L`;
}

function toMatch(h: {
  id: string;
  type: string;
  label: string;
  institution: string | null;
  principal: number;
  rate: number | null;
  portfolio: { id: string; name: string };
}): FixedIncomeMatch {
  return {
    id:            h.id,
    type:          h.type,
    label:         h.label,
    institution:   h.institution,
    principal:     h.principal,
    rate:          h.rate,
    portfolio:     toPortfolioKey(h.portfolio.id),
    portfolioName: h.portfolio.name,
  };
}

export function formatFixedIncomeHoldingLine(h: FixedIncomeMatch): string {
  const rate = h.rate != null ? ` · ${h.rate}% p.a.` : "";
  return `  • [${h.type}] ${h.label}: ${formatPrincipalL(h.principal)}${rate} (${h.portfolioName} / ${h.portfolio})`;
}

export function formatFixedIncomeOptionsList(rows: FixedIncomeMatch[]): string {
  return rows
    .map((h, i) => `${i + 1}. [${h.type}] ${h.label} — ${formatPrincipalL(h.principal)} (${h.portfolio})`)
    .join("\n");
}

export async function findFixedIncomeHoldings(params: {
  portfolio?: PortfolioScope;
  type?:      string;
  label?:     string;
  keyword?:   string;
}): Promise<FixedIncomeMatch[]> {
  const portfolio = params.portfolio ?? "both";

  const holdings = await prisma.fixedIncomeHolding.findMany({
    where:   { portfolioId: { in: portfolioIds(portfolio) }, isActive: true },
    include: { portfolio: { select: { id: true, name: true } } },
    orderBy: [{ portfolioId: "asc" }, { type: "asc" }, { label: "asc" }],
  });

  let filtered = holdings;

  if (params.type?.trim()) {
    const t = params.type.trim().toLowerCase();
    filtered = filtered.filter((h) => h.type.toLowerCase() === t);
  }

  const search = params.keyword?.trim() || params.label?.trim();
  if (search) {
    const kw = search.toLowerCase();
    filtered = filtered.filter(
      (h) =>
        h.label.toLowerCase().includes(kw) ||
        h.type.toLowerCase().includes(kw) ||
        (h.institution ?? "").toLowerCase().includes(kw),
    );
  }

  return filtered.map(toMatch);
}

export function formatFindFixedIncomeText(
  rows: FixedIncomeMatch[],
  query: { portfolio?: string; type?: string; label?: string; keyword?: string },
): string {
  if (!rows.length) {
    const hint = query.type
      ? `type ${query.type}`
      : query.label || query.keyword
        ? `"${query.label ?? query.keyword}"`
        : "query";
    return `No fixed income holdings found for ${hint}.`;
  }

  if (rows.length > 1) {
    return (
      `Found ${rows.length} fixed income holdings — ask the user which one:\n` +
      `${formatFixedIncomeOptionsList(rows)}\n` +
      "Then call delete_fixed_income or update_fixed_income with type/label + portfolio from the chosen row."
    );
  }

  const h = rows[0];
  return (
    `Found 1 fixed income holding:\n${formatFixedIncomeHoldingLine(h)}\n\n` +
    `To remove: delete_fixed_income with type="${h.type}", label="${h.label}", portfolio="${h.portfolio}" (preview first, then confirmed:true).`
  );
}

export async function resolveFixedIncomeTarget(params: {
  portfolio: PortfolioKey;
  type?:     string;
  label?:    string;
  keyword?:  string;
}): Promise<
  | { holding: FixedIncomeMatch }
  | { error: string; options: FixedIncomeMatch[] }
> {
  const matches = await findFixedIncomeHoldings({
    portfolio: params.portfolio,
    type:      params.type,
    label:     params.label,
    keyword:   params.keyword,
  });

  if (matches.length === 1) return { holding: matches[0] };

  if (matches.length > 1) {
    return {
      error:   `Multiple fixed income holdings match in ${PORTFOLIO_NAMES[params.portfolio]}. Ask the user to pick one:`,
      options: matches,
    };
  }

  return {
    error:   `No fixed income holding found in ${PORTFOLIO_NAMES[params.portfolio]}. Call find_fixed_income_holdings first.`,
    options: [],
  };
}

export type FixedIncomePatch = {
  label?:        string;
  principal?:    number;
  rate?:         number | null;
  institution?:  string | null;
  notes?:        string | null;
};

export async function patchFixedIncomeHolding(params: {
  portfolio: PortfolioKey;
  type?:     string;
  label?:    string;
  keyword?:  string;
  patch:     FixedIncomePatch;
}): Promise<string> {
  const patch = params.patch;
  const keys = Object.keys(patch).filter(
    (k) => patch[k as keyof FixedIncomePatch] !== undefined,
  );
  if (keys.length === 0) {
    return "No fields to update. Pass principal, rate, label, institution, or notes.";
  }

  const resolved = await resolveFixedIncomeTarget({
    portfolio: params.portfolio,
    type:      params.type,
    label:     params.label,
    keyword:   params.keyword,
  });

  if ("error" in resolved) {
    const opts = resolved.options.length
      ? `\n${formatFixedIncomeOptionsList(resolved.options)}`
      : "";
    return resolved.error + opts;
  }

  const row = resolved.holding;
  await prisma.fixedIncomeHolding.update({
    where: { id: row.id },
    data:  {
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.principal !== undefined ? { principal: patch.principal } : {}),
      ...(patch.rate !== undefined ? { rate: patch.rate } : {}),
      ...(patch.institution !== undefined ? { institution: patch.institution } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    },
  });

  const parts: string[] = [];
  if (patch.principal !== undefined) {
    parts.push(`principal ${formatPrincipalL(row.principal)} → ${formatPrincipalL(patch.principal)}`);
  }
  if (patch.rate !== undefined) {
    parts.push(`rate ${row.rate ?? "n/a"} → ${patch.rate ?? "n/a"}`);
  }
  if (patch.label !== undefined) parts.push(`label → ${patch.label}`);

  return `Updated [${row.type}] ${patch.label ?? row.label} (${row.portfolio}): ${parts.join(", ") || "saved"}.`;
}
