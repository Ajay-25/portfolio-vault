/**
 * lib/apis/prices.ts
 * Server-side price fetching via Yahoo chart API (primary) and yahoo-finance2 (fallback).
 * All calls happen server-side — zero CORS issues.
 */

import yahooFinance from "yahoo-finance2";
import { prisma } from "@/lib/prisma";
import { yahooTickersForStock } from "@/lib/utils/stock-ticker";

const PRICE_TTL_MS  = 5 * 60 * 1000;  // 5 minutes
const FX_TTL_MS     = 10 * 60 * 1000; // 10 minutes

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type YahooChartMeta = {
  regularMarketPrice:   number;
  previousClose?:       number;
  chartPreviousClose?:  number;
  currency?:            string;
  fiftyTwoWeekHigh?:    number;
  fiftyTwoWeekLow?:     number;
};

async function fetchYahooChartMeta(ticker: string): Promise<YahooChartMeta | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: {
          "User-Agent": YAHOO_UA,
          Accept:       "application/json",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta as YahooChartMeta | undefined;
    if (!meta?.regularMarketPrice) return null;

    return meta;
  } catch {
    return null;
  }
}

function changePctFromMeta(meta: YahooChartMeta): number {
  const price = meta.regularMarketPrice;
  const prev  = meta.previousClose ?? meta.chartPreviousClose ?? price;
  return prev ? ((price - prev) / prev) * 100 : 0;
}

// ── Nifty 50 ──────────────────────────────────────────────────────────────

export type NiftyData = {
  price:     number;
  changePct: number;
  high52w:   number;
  low52w:    number;
  cached?:   boolean;
};

export async function fetchNifty(): Promise<NiftyData | null> {
  const meta = await fetchYahooChartMeta("^NSEI");
  if (meta) {
    return {
      price:     meta.regularMarketPrice,
      changePct: changePctFromMeta(meta),
      high52w:   meta.fiftyTwoWeekHigh ?? 0,
      low52w:    meta.fiftyTwoWeekLow ?? 0,
    };
  }

  // Fallback: NSE India official API (most reliable for Indian indices)
  try {
    const res = await fetch("https://www.nseindia.com/api/allIndices", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.nseindia.com",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`NSE status: ${res.status}`);
    const data = await res.json();
    const nifty = data.data.find((i: { index: string }) => i.index === "NIFTY 50");
    if (!nifty) throw new Error("NIFTY 50 not found in NSE response");

    return {
      price:     nifty.last,
      changePct: nifty.percentChange,
      high52w:   nifty.yearHigh,
      low52w:    nifty.yearLow,
    };
  } catch (err) {
    console.error("fetchNifty NSE fallback also failed:", err);
    return null;
  }
}

// ── Stock Price ───────────────────────────────────────────────────────────

export type StockPrice = {
  symbol:    string;
  exchange:  string;
  price:     number;
  changePct: number;
  currency:  string;
};

/**
 * Fetches a stock price with caching.
 * For NSE stocks, appends .NS (e.g. "RELIANCE.NS")
 * For NYSE/NASDAQ stocks, uses symbol as-is (e.g. "NVDA")
 */
export async function fetchStockPrice(
  symbol:   string,
  exchange: string
): Promise<StockPrice | null> {
  // Check cache
  const cached = await prisma.priceCache.findUnique({
    where: { symbol_exchange: { symbol, exchange } },
  });
  if (cached && Date.now() - cached.updatedAt.getTime() < PRICE_TTL_MS) {
    return { symbol, exchange, price: cached.price, changePct: cached.changePct, currency: cached.currency };
  }

  const tickers = yahooTickersForStock(symbol, exchange);
  const defaultCurrency = exchange === "NSE" ? "INR" : "USD";

  for (const ticker of tickers) {
    const chartMeta = await fetchYahooChartMeta(ticker);
    if (chartMeta) {
      const price     = chartMeta.regularMarketPrice;
      const changePct = changePctFromMeta(chartMeta);
      const currency  = chartMeta.currency ?? defaultCurrency;

      await prisma.priceCache.upsert({
        where:  { symbol_exchange: { symbol, exchange } },
        update: { price, changePct, currency },
        create: { symbol, exchange, price, changePct, currency },
      });

      return { symbol, exchange, price, changePct, currency };
    }
  }

  for (const ticker of tickers) {
    try {
      const quote     = await yahooFinance.quote(ticker);
      const price     = quote.regularMarketPrice ?? 0;
      if (!price) continue;
      const changePct = quote.regularMarketChangePercent ?? 0;
      const currency  = quote.currency ?? defaultCurrency;

      await prisma.priceCache.upsert({
        where:  { symbol_exchange: { symbol, exchange } },
        update: { price, changePct, currency },
        create: { symbol, exchange, price, changePct, currency },
      });

      return { symbol, exchange, price, changePct, currency };
    } catch {
      /* try next ticker candidate */
    }
  }

  console.warn(`fetchStockPrice failed for ${symbol} (${exchange}), tried: ${tickers.join(", ")}`);
  return cached
    ? { symbol, exchange, price: cached.price, changePct: cached.changePct, currency: cached.currency }
    : null;
}

// ── USD/INR ───────────────────────────────────────────────────────────────

export async function fetchUSDINR(): Promise<number> {
  // Check cache
  const cached = await prisma.fxCache.findUnique({ where: { pair: "USDINR" } });
  if (cached && Date.now() - cached.updatedAt.getTime() < FX_TTL_MS) {
    return cached.rate;
  }

  try {
    // Frankfurter is a reliable free FX API
    const res  = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR");
    const data = await res.json();
    const rate = data.rates.INR as number;

    await prisma.fxCache.upsert({
      where:  { pair: "USDINR" },
      update: { rate },
      create: { pair: "USDINR", rate },
    });

    return rate;
  } catch {
    return cached?.rate ?? 84;
  }
}
