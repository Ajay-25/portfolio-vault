import type { PriceMap } from "@/hooks/use-live-prices";

export type StockHoldingForStats = {
  symbol:   string;
  exchange: string;
  currency: string;
  qty:      number;
  avgPrice: number;
};

export type StockPortfolioStats = {
  invested:      number;
  marketValue:   number;
  gainAbs:       number | null;
  gainPct:       number | null;
  dayPnl:        number | null;
  dayPnlPct:     number | null;
  holdingsCount: number;
  pricedCount:   number;
  gainers:       number;
  losers:        number;
  unchanged:     number;
};

function fxRate(currency: string, usdInr: number): number {
  return currency === "USD" ? usdInr : 1;
}

function priceKey(symbol: string, exchange: string): string {
  return `${symbol}:${exchange}`;
}

export function computeStockPortfolioStats(
  holdings: StockHoldingForStats[],
  prices: PriceMap,
  usdInr: number,
): StockPortfolioStats {
  const holdingsCount = holdings.length;
  let invested = 0;
  let marketValue = 0;
  let pricedCount = 0;
  let gainers = 0;
  let losers = 0;
  let unchanged = 0;
  let dayPnl = 0;
  let prevCloseValue = 0;
  let hasDayPnl = false;

  for (const h of holdings) {
    const fx = fxRate(h.currency, usdInr);
    const cost = h.qty * h.avgPrice * fx;
    invested += cost;

    const live = prices[priceKey(h.symbol, h.exchange)];
    if (!live?.price) continue;

    pricedCount++;
    const value = h.qty * live.price * fx;
    marketValue += value;

    if (live.changePct > 0.05) gainers++;
    else if (live.changePct < -0.05) losers++;
    else unchanged++;

    const holdingDayPnl = (value * live.changePct) / (100 + live.changePct);
    dayPnl += holdingDayPnl;
    prevCloseValue += value - holdingDayPnl;
    hasDayPnl = true;
  }

  // Fall back to cost for holdings without live CMP yet
  if (pricedCount < holdingsCount) {
    for (const h of holdings) {
      const live = prices[priceKey(h.symbol, h.exchange)];
      if (live?.price) continue;
      marketValue += h.qty * h.avgPrice * fxRate(h.currency, usdInr);
    }
  }

  let gainAbs: number | null = null;
  let gainPct: number | null = null;
  if (invested > 0 && pricedCount > 0) {
    gainAbs = marketValue - invested;
    gainPct = gainAbs / invested;
  }

  let dayPnlPct: number | null = null;
  if (hasDayPnl && prevCloseValue > 0) {
    dayPnlPct = dayPnl / prevCloseValue;
  }

  return {
    invested,
    marketValue,
    gainAbs,
    gainPct,
    dayPnl:    hasDayPnl ? dayPnl : null,
    dayPnlPct,
    holdingsCount,
    pricedCount,
    gainers,
    losers,
    unchanged,
  };
}
