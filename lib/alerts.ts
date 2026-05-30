import { prisma } from "@/lib/prisma";
import { fetchStockPrice } from "@/lib/apis/prices";

export const SHRIRAM_CONFIG = {
  symbol: "SHRIRAMFIN",
  mufgFloor: 841,
  analystTarget: 1175,
  targetShares: 142,
  buyZoneLow: 900,
  buyZoneHigh: 930,
  profitBookLevel: 1150,
};

export type ShriramHolding = {
  qty: number;
  avgPrice: number;
  displayName: string | null;
  action: string | null;
};

export type ShriramCheckResult = {
  cmp: number;
  pnl: number;
  pct: number;
  action: string;
  variant: "bull" | "bear" | "neutral";
};

export type IndianStockRow = {
  symbol: string;
  displayName: string | null;
  qty: number;
  avgPrice: number;
  cmp: number | null;
  invested: number;
  value: number | null;
  pnl: number | null;
  pct: number | null;
  action: string | null;
};

export type AlertRow = {
  id: string;
  symbol: string;
  exchange: string;
  type: string;
  target: number;
  message: string | null;
  currentPrice: number | null;
};

export type AlertsPageData = {
  shriram: ShriramHolding | null;
  shriramLivePrice: number | null;
  indianStocks: IndianStockRow[];
  alerts: AlertRow[];
  totals: {
    invested: number;
    value: number;
    pnl: number;
    pct: number;
  };
};

export function evaluateShriramAlert(
  cmp: number,
  qty: number,
  avg: number,
): ShriramCheckResult {
  const pnl = (cmp - avg) * qty;
  const pct = ((cmp - avg) / avg) * 100;
  const { buyZoneLow, buyZoneHigh, profitBookLevel } = SHRIRAM_CONFIG;

  if (cmp <= 910) {
    return {
      cmp,
      pnl,
      pct,
      action: "BUY IMMEDIATELY — 30 shares · price near your next target zone ₹910-920",
      variant: "bull",
    };
  }
  if (cmp <= 940) {
    return {
      cmp,
      pnl,
      pct,
      action: "BUY — 30 shares · Good entry. Price in ₹920-940 target zone.",
      variant: "bull",
    };
  }
  if (cmp <= 970) {
    return {
      cmp,
      pnl,
      pct,
      action: "WATCH — slightly above buy zone. Wait for dip to ₹920-930.",
      variant: "neutral",
    };
  }
  if (cmp >= profitBookLevel) {
    return {
      cmp,
      pnl,
      pct,
      action: "NEAR 1Y TARGET (₹1,175) — Consider partial profit booking.",
      variant: "neutral",
    };
  }
  return {
    cmp,
    pnl,
    pct,
    action: `HOLD — No immediate action. Current holding: ${qty} shares.`,
    variant: "neutral",
  };
}

export async function getAlertsPageData(): Promise<AlertsPageData> {
  const [holdings, alerts] = await Promise.all([
    prisma.stockHolding.findMany({
      where: { portfolioId: "portfolio-primary", exchange: "NSE", currency: "INR" },
      orderBy: { symbol: "asc" },
    }),
    prisma.alert.findMany({
      where: { ownerId: "primary", active: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const shriramHolding = holdings.find((h) => h.symbol === SHRIRAM_CONFIG.symbol);

  const priceResults = await Promise.all(
    holdings.map((h) => fetchStockPrice(h.symbol, h.exchange)),
  );

  const shriramPrice = priceResults.find(
    (_, i) => holdings[i]?.symbol === SHRIRAM_CONFIG.symbol,
  );

  const indianStocks: IndianStockRow[] = holdings.map((h, i) => {
    const cmp = priceResults[i]?.price ?? null;
    const invested = h.qty * h.avgPrice;
    const value = cmp !== null ? h.qty * cmp : null;
    const pnl = value !== null ? value - invested : null;
    const pct = pnl !== null && invested > 0 ? (pnl / invested) * 100 : null;

    return {
      symbol: h.symbol,
      displayName: h.displayName,
      qty: h.qty,
      avgPrice: h.avgPrice,
      cmp,
      invested,
      value,
      pnl,
      pct,
      action: h.action,
    };
  });

  const alertRows: AlertRow[] = await Promise.all(
    alerts.map(async (a) => {
      const price = await fetchStockPrice(a.symbol, a.exchange);
      return {
        id: a.id,
        symbol: a.symbol,
        exchange: a.exchange,
        type: a.type,
        target: a.target,
        message: a.message,
        currentPrice: price?.price ?? null,
      };
    }),
  );

  const totalInvested = indianStocks.reduce((s, r) => s + r.invested, 0);
  const totalValue = indianStocks.reduce((s, r) => s + (r.value ?? 0), 0);
  const totalPnl = totalValue - totalInvested;

  return {
    shriram: shriramHolding
      ? {
          qty: shriramHolding.qty,
          avgPrice: shriramHolding.avgPrice,
          displayName: shriramHolding.displayName,
          action: shriramHolding.action,
        }
      : null,
    shriramLivePrice: shriramPrice?.price ?? null,
    indianStocks,
    alerts: alertRows,
    totals: {
      invested: totalInvested,
      value: totalValue,
      pnl: totalPnl,
      pct: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
    },
  };
}
