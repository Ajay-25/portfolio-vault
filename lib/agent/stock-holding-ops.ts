import { prisma } from "@/lib/prisma";
import { fetchStockPrice } from "@/lib/apis/prices";
import { parseOptionalNumber } from "@/lib/agent/coerce-tool-input";
import { PORTFOLIO_IDS, type PortfolioKey } from "@/lib/agent/portfolio-scope";

export type StockHoldingPatch = {
  symbol?:       string;
  display_name?: string | null;
  qty?:          number;
  avg_price?:    number;
  action?:       string | null;
};

export type StockHoldingMatch = {
  id:            string;
  symbol:        string;
  displayName:   string | null;
  exchange:      string;
  currency:      string;
  portfolio:     PortfolioKey;
  portfolioName: string;
  qty:           number;
  avgPrice:      number;
  action:        string | null;
};

const PORTFOLIO_NAMES: Record<PortfolioKey, string> = {
  mine:   "mine (primary)",
  mother: "mother (secondary)",
};

function portfolioKeyFromId(id: string): PortfolioKey {
  return id === PORTFOLIO_IDS.mother ? "mother" : "mine";
}

function normalizeCompanyKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toMatch(h: {
  id: string;
  symbol: string;
  displayName: string | null;
  exchange: string;
  currency: string;
  qty: number;
  avgPrice: number;
  action: string | null;
  portfolio: { id: string; name: string };
}): StockHoldingMatch {
  const portfolio = portfolioKeyFromId(h.portfolio.id);
  return {
    id:            h.id,
    symbol:        h.symbol,
    displayName:   h.displayName,
    exchange:      h.exchange,
    currency:      h.currency,
    portfolio,
    portfolioName: h.portfolio.name,
    qty:           h.qty,
    avgPrice:      h.avgPrice,
    action:        h.action,
  };
}

/** Drop empty LLM placeholders — only patch fields that were intentionally set. */
export function cleanStockPatch(patch: StockHoldingPatch): StockHoldingPatch {
  const out: StockHoldingPatch = {};

  if (patch.symbol !== undefined && patch.symbol.trim()) {
    out.symbol = patch.symbol.trim().toUpperCase();
  }

  if (patch.display_name !== undefined) {
    if (patch.display_name === null) {
      out.display_name = null;
    } else if (patch.display_name.trim()) {
      out.display_name = patch.display_name.trim();
    }
  }

  const qty = patch.qty !== undefined ? parseOptionalNumber(patch.qty) : undefined;
  if (qty !== undefined) out.qty = qty;

  const avg = patch.avg_price !== undefined ? parseOptionalNumber(patch.avg_price) : undefined;
  if (avg !== undefined) out.avg_price = avg;

  if (patch.action !== undefined) {
    if (patch.action === null) {
      out.action = null;
    } else if (patch.action.trim()) {
      out.action = patch.action.trim();
    }
  }

  return out;
}

export function formatStockHoldingLine(h: StockHoldingMatch): string {
  const name = h.displayName ?? h.symbol;
  const px = h.currency === "USD" ? "$" : "₹";
  return `  • [${h.symbol}] ${name} (${h.exchange}, ${h.portfolioName} / ${h.portfolio}): ${h.qty} @ ${px}${h.avgPrice}`;
}

export function formatStockOptionsList(rows: StockHoldingMatch[]): string {
  return rows
    .map((h, i) => `${i + 1}. [${h.symbol}] ${h.displayName ?? h.symbol} — ${h.qty} @ ₹${h.avgPrice} (${h.exchange}, ${h.portfolio})`)
    .join("\n");
}

export async function findStockHoldings(params: {
  portfolio?: "mine" | "mother" | "both";
  symbol?:    string;
  keyword?:   string;
  exchange?:  string;
}): Promise<StockHoldingMatch[]> {
  const portfolio = params.portfolio ?? "both";
  const ids =
    portfolio === "both" ? Object.values(PORTFOLIO_IDS) : [PORTFOLIO_IDS[portfolio]];

  const holdings = await prisma.stockHolding.findMany({
    where: {
      portfolioId: { in: ids },
      ...(params.exchange?.trim() ? { exchange: params.exchange.trim().toUpperCase() } : {}),
      ...(params.symbol?.trim()
        ? { symbol: { equals: params.symbol.trim(), mode: "insensitive" } }
        : {}),
    },
    include: { portfolio: { select: { id: true, name: true } } },
    orderBy: [{ portfolioId: "asc" }, { symbol: "asc" }],
  });

  let filtered = holdings;
  if (params.keyword?.trim() && !params.symbol?.trim()) {
    const kw = params.keyword.trim().toLowerCase();
    const kwKey = normalizeCompanyKey(kw);
    filtered = holdings.filter((h) => {
      const sym = h.symbol.toLowerCase();
      const name = (h.displayName ?? "").toLowerCase();
      return (
        sym.includes(kw) ||
        name.includes(kw) ||
        normalizeCompanyKey(h.displayName ?? h.symbol).includes(kwKey)
      );
    });
  }

  return filtered.map(toMatch);
}

export function formatFindStockHoldingsText(
  rows: StockHoldingMatch[],
  query: { portfolio?: string; symbol?: string; keyword?: string; exchange?: string },
): string {
  if (!rows.length) {
    const hint = query.symbol
      ? `symbol ${query.symbol}`
      : query.keyword
        ? `keyword "${query.keyword}"`
        : "query";
    return `No stock holdings found for ${hint}.`;
  }

  if (rows.length > 1) {
    return (
      `Found ${rows.length} stock holdings — ask the user which one:\n` +
      `${formatStockOptionsList(rows)}\n` +
      "Then call update_stock_holding with the exact symbol + exchange + portfolio from the chosen row."
    );
  }

  const h = rows[0];
  return (
    `Found 1 stock holding:\n${formatStockHoldingLine(h)}\n\n` +
    `Next step: call update_stock_holding with symbol="${h.symbol}", exchange="${h.exchange}", portfolio="${h.portfolio}" and ONLY the fields to change. Do NOT call find_stock_holdings again.`
  );
}

export async function resolveStockHoldingTarget(params: {
  portfolio: PortfolioKey;
  exchange:  string;
  symbol?:   string;
  keyword?:  string;
}): Promise<
  | { holding: StockHoldingMatch }
  | { error: string; options: StockHoldingMatch[] }
> {
  const exchange = params.exchange.trim().toUpperCase();
  const pid = PORTFOLIO_IDS[params.portfolio];
  const otherKey: PortfolioKey = params.portfolio === "mine" ? "mother" : "mine";
  const sym = params.symbol?.trim().toUpperCase();

  if (sym) {
    const target = await prisma.stockHolding.findFirst({
      where: {
        portfolioId: pid,
        exchange,
        symbol:      { equals: sym, mode: "insensitive" },
      },
      include: { portfolio: { select: { id: true, name: true } } },
    });
    if (target) return { holding: toMatch(target) };

    const other = await prisma.stockHolding.findFirst({
      where: {
        portfolioId: PORTFOLIO_IDS[otherKey],
        exchange,
        symbol:      { equals: sym, mode: "insensitive" },
      },
      include: { portfolio: { select: { id: true, name: true } } },
    });
    if (other) {
      return {
        error:   `Not in ${PORTFOLIO_NAMES[params.portfolio]} — this stock is in ${PORTFOLIO_NAMES[otherKey]}. Use portfolio "${otherKey}" or confirm with the user.`,
        options: [toMatch(other)],
      };
    }
  }

  const searchTerm = params.keyword?.trim() || sym;
  if (searchTerm) {
    const matches = await findStockHoldings({
      portfolio: params.portfolio,
      exchange,
      keyword:   searchTerm,
    });
    if (matches.length === 1) return { holding: matches[0] };
    if (matches.length > 1) {
      return {
        error:   `Multiple stocks match "${searchTerm}" in ${PORTFOLIO_NAMES[params.portfolio]}. Ask the user to pick one:`,
        options: matches,
      };
    }
  }

  return {
    error:   `No stock holding found on ${exchange} in ${PORTFOLIO_NAMES[params.portfolio]}. Call find_stock_holdings with keyword e.g. company name.`,
    options: [],
  };
}

export async function patchStockHolding(params: {
  portfolio: PortfolioKey;
  exchange:  string;
  patch:       StockHoldingPatch;
  symbol?:     string;
  keyword?:    string;
}): Promise<string> {
  const patch = cleanStockPatch(params.patch);
  const keys = Object.keys(patch) as (keyof StockHoldingPatch)[];
  if (keys.length === 0) {
    return "No fields to update. Pass avg_price, qty, new_symbol, display_name, or action — omit fields you are not changing.";
  }

  if (!params.symbol?.trim() && !params.keyword?.trim()) {
    return "Provide symbol or keyword to identify the holding. Call find_stock_holdings first if unsure.";
  }

  const resolved = await resolveStockHoldingTarget({
    portfolio: params.portfolio,
    exchange:  params.exchange,
    symbol:    params.symbol,
    keyword:   params.keyword,
  });

  if ("error" in resolved) {
    const opts = resolved.options.length
      ? `\n${formatStockOptionsList(resolved.options)}`
      : "";
    return resolved.error + opts;
  }

  const row = await prisma.stockHolding.findUnique({
    where: { id: resolved.holding.id },
    include: { portfolio: { select: { id: true, name: true } } },
  });
  if (!row) return "Holding not found after resolve.";

  const before = toMatch(row);
  const pid = PORTFOLIO_IDS[params.portfolio];
  const exchange = params.exchange.trim().toUpperCase();
  const nextSymbol = patch.symbol !== undefined ? patch.symbol : row.symbol.toUpperCase();

  if (!nextSymbol) return "Refused: new symbol cannot be empty.";

  if (nextSymbol !== row.symbol.toUpperCase()) {
    const conflict = await prisma.stockHolding.findFirst({
      where: {
        portfolioId: pid,
        symbol:      nextSymbol,
        exchange,
        NOT:         { id: row.id },
      },
    });
    if (conflict) {
      return [
        `Refused: ${nextSymbol} already exists on ${exchange} in ${PORTFOLIO_NAMES[params.portfolio]}.`,
        formatStockHoldingLine(toMatch({ ...conflict, portfolio: row.portfolio })),
        "Merge or delete the duplicate manually.",
      ].join("\n");
    }

    const verified = await fetchStockPrice(
      nextSymbol,
      exchange,
      patch.display_name ?? row.displayName,
    );
    if (!verified) {
      return `Refused: could not verify live price for ${nextSymbol}. Run lookup_stock_symbol first.`;
    }
  }

  const nextDisplayName = patch.display_name !== undefined ? patch.display_name : row.displayName;
  const nextQty = patch.qty !== undefined ? patch.qty : row.qty;
  const nextAvg = patch.avg_price !== undefined ? patch.avg_price : row.avgPrice;
  const nextAction = patch.action !== undefined ? patch.action : row.action;

  await prisma.stockHolding.update({
    where: { id: row.id },
    data:  {
      symbol:      nextSymbol,
      displayName: nextDisplayName,
      qty:         nextQty,
      avgPrice:    nextAvg,
      action:      nextAction,
    },
  });

  if (nextSymbol !== row.symbol) {
    await prisma.priceCache.deleteMany({
      where: { symbol: row.symbol, exchange },
    }).catch(() => undefined);
  }

  const changes: string[] = [];
  if (nextSymbol !== row.symbol) changes.push(`symbol ${row.symbol}→${nextSymbol}`);
  if (nextDisplayName !== row.displayName) {
    changes.push(`name ${row.displayName ?? "—"}→${nextDisplayName ?? "—"}`);
  }
  if (nextQty !== row.qty) changes.push(`qty ${row.qty}→${nextQty}`);
  if (nextAvg !== row.avgPrice) changes.push(`avg ${row.avgPrice}→${nextAvg}`);
  if (nextAction !== row.action) changes.push(`action ${row.action ?? "—"}→${nextAction ?? "—"}`);

  return `Updated [${nextSymbol}] ${nextDisplayName ?? nextSymbol} on ${exchange} in ${PORTFOLIO_NAMES[params.portfolio]}: ${changes.join("; ")}`;
}

export async function createStockHolding(params: {
  portfolio:    PortfolioKey;
  symbol:       string;
  exchange:     string;
  qty:          number;
  avg_price:    number;
  display_name?: string | null;
  action?:      string | null;
}): Promise<string> {
  const pid = PORTFOLIO_IDS[params.portfolio];
  const symbol = params.symbol.trim().toUpperCase();
  const exchange = params.exchange.trim().toUpperCase();
  const displayName = params.display_name?.trim() || null;

  const existing = await prisma.stockHolding.findFirst({
    where: { portfolioId: pid, symbol, exchange },
    include: { portfolio: { select: { id: true, name: true } } },
  });

  if (existing) {
    return [
      `Refused: [${symbol}] already exists on ${exchange} in ${PORTFOLIO_NAMES[params.portfolio]}.`,
      formatStockHoldingLine(toMatch(existing)),
      "Use update_stock_holding to change avg_price, qty, or symbol — do NOT use add_or_update_stock again.",
    ].join("\n");
  }

  if (displayName) {
    const key = normalizeCompanyKey(displayName);
    const peers = await prisma.stockHolding.findMany({
      where:   { portfolioId: pid, exchange },
      include: { portfolio: { select: { id: true, name: true } } },
    });
    const dup = peers.find(
      (p) => normalizeCompanyKey(p.displayName ?? p.symbol) === key,
    );
    if (dup) {
      return [
        `Refused: a matching stock already exists under symbol [${dup.symbol}].`,
        formatStockHoldingLine(toMatch(dup)),
        `Use update_stock_holding on [${dup.symbol}] instead of creating [${symbol}].`,
      ].join("\n");
    }
  }

  const currency = exchange === "NSE" ? "INR" : "USD";
  await prisma.stockHolding.create({
    data: {
      portfolioId: pid,
      symbol,
      displayName,
      exchange,
      currency,
      qty:      params.qty,
      avgPrice: params.avg_price,
      action:   params.action?.trim() || null,
    },
  });

  const px = currency === "USD" ? "$" : "₹";
  return `Created [${symbol}] ${displayName ?? symbol} on ${exchange} in ${PORTFOLIO_NAMES[params.portfolio]}: ${params.qty} @ ${px}${params.avg_price}.`;
}

export function buildStockPatchFromInput(input: Record<string, unknown>): StockHoldingPatch {
  const patch: StockHoldingPatch = {};

  if (input.new_symbol !== undefined && String(input.new_symbol).trim()) {
    patch.symbol = String(input.new_symbol).trim();
  }

  if (input.display_name !== undefined) {
    patch.display_name = input.display_name as string | null;
  }

  const qty = parseOptionalNumber(input.qty);
  if (qty !== undefined) patch.qty = qty;

  const avg = parseOptionalNumber(input.avg_price);
  if (avg !== undefined) patch.avg_price = avg;

  if (input.action !== undefined) {
    patch.action = input.action as string | null;
  }

  return patch;
}
