import { prisma } from "@/lib/prisma";
import { fetchStockPrice } from "@/lib/apis/prices";
import { getUSDINR } from "@/lib/data/fx-server";
import {
  PORTFOLIO_IDS,
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

export { PORTFOLIO_IDS };

export type StockReturnFilter = ReturnFilter;

export type StockReturnRow = {
  symbol:          string;
  displayName:     string | null;
  exchange:        string;
  currency:        string;
  portfolioName:   string;
  portfolioKey:    PortfolioKey;
  qty:             number;
  avgPrice:        number;
  livePrice:       number | null;
  dayChangePct:    number | null;
  investedInr:     number;
  currentValueInr: number;
  gainInr:         number | null;
  gainPct:         number | null;
};

export async function fetchStockReturns(options: {
  portfolio?: PortfolioScope;
  filter?:    ReturnFilter;
} = {}): Promise<StockReturnRow[]> {
  const { portfolio = "both", filter = "all" } = options;

  const portfolios = await prisma.portfolio.findMany({
    where:   { id: { in: portfolioIds(portfolio) } },
    include: { stockHoldings: true },
  });

  const usdInr = await getUSDINR();

  const holdings = portfolios.flatMap((p) =>
    p.stockHoldings.map((h) => ({
      ...h,
      portfolioName: p.name,
      portfolioKey:  toPortfolioKey(p.id),
    })),
  );

  if (!holdings.length) return [];

  const prices = await Promise.all(
    holdings.map((h) => fetchStockPrice(h.symbol, h.exchange, h.displayName)),
  );

  const rows: StockReturnRow[] = holdings.map((h, i) => {
    const live = prices[i];
    const fx   = h.currency === "USD" ? usdInr : 1;
    const investedInr     = h.qty * h.avgPrice * fx;
    const livePrice       = live?.price ?? null;
    const currentValueInr = livePrice ? h.qty * livePrice * fx : investedInr;
    const gainInr         = livePrice ? currentValueInr - investedInr : null;
    const gainPct         =
      livePrice && investedInr > 0 ? (gainInr! / investedInr) * 100 : null;

    return {
      symbol:          h.symbol,
      displayName:     h.displayName,
      exchange:        h.exchange,
      currency:        h.currency,
      portfolioName:   h.portfolioName,
      portfolioKey:    h.portfolioKey,
      qty:             h.qty,
      avgPrice:        h.avgPrice,
      livePrice,
      dayChangePct:    live?.changePct ?? null,
      investedInr,
      currentValueInr,
      gainInr,
      gainPct,
    };
  });

  return sortByGainAsc(filterByReturn(rows, filter));
}

function priceLabel(currency: string, price: number): string {
  return currency === "USD" ? `$${price.toFixed(2)}` : `₹${price.toLocaleString("en-IN")}`;
}

export function formatStockReturnLine(r: StockReturnRow): string {
  const name = r.displayName ?? r.symbol;
  const cmp  = r.livePrice != null
    ? priceLabel(r.currency, r.livePrice)
    : "CMP unavailable";

  if (r.gainPct == null) {
    return `  • ${name} [${r.symbol}:${r.exchange}] (${r.portfolioName}): ${r.qty} @ ${priceLabel(r.currency, r.avgPrice)} avg — ${cmp}`;
  }

  const sign = r.gainPct >= 0 ? "+" : "";
  return `  • ${name} [${r.symbol}:${r.exchange}] (${r.portfolioName}): ${r.qty} @ ${priceLabel(r.currency, r.avgPrice)} avg → ${cmp} | ${sign}${r.gainPct.toFixed(2)}% (${formatInrSigned(r.gainInr!)})`;
}

export function formatStockReturnsText(
  rows: StockReturnRow[],
  filter: ReturnFilter = "all",
): string {
  if (!rows.length) return emptyReturnMessage("stock holdings", filter);
  return `${formatReturnHeader("Stocks (live CMP vs avg buy)", filter)}\n${rows.map(formatStockReturnLine).join("\n")}`;
}
