/**
 * lib/apis/prices.ts
 * Server-side price fetching via yahoo-finance2.
 * All calls happen server-side — zero CORS issues.
 */

import yahooFinance from "yahoo-finance2";
import { prisma } from "@/lib/prisma";

const PRICE_TTL_MS  = 5 * 60 * 1000;  // 5 minutes
const FX_TTL_MS     = 10 * 60 * 1000; // 10 minutes

// ── Nifty 50 ──────────────────────────────────────────────────────────────

export type NiftyData = {
  price:     number;
  changePct: number;
  high52w:   number;
  low52w:    number;
  cached?:   boolean;
};

export async function fetchNifty(): Promise<NiftyData | null> {
  // Source 1: Yahoo Finance chart API (bypasses yahoo-finance2 rate limits)
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) throw new Error(`Yahoo status: ${res.status}`);
    const data = await res.json();
    const meta = data.chart.result[0].meta;

    return {
      price:     meta.regularMarketPrice ?? 0,
      changePct: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      high52w:   meta.fiftyTwoWeekHigh ?? 0,
      low52w:    meta.fiftyTwoWeekLow  ?? 0,
    };
  } catch (err) {
    console.warn("fetchNifty Yahoo failed, trying NSE fallback:", err);
  }

  // Source 2: NSE India official API (most reliable for Indian indices)
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

  const ticker = exchange === "NSE" ? `${symbol}.NS` : symbol;
  try {
    const quote    = await yahooFinance.quote(ticker);
    const price    = quote.regularMarketPrice ?? 0;
    const changePct = quote.regularMarketChangePercent ?? 0;
    const currency = quote.currency ?? (exchange === "NSE" ? "INR" : "USD");

    await prisma.priceCache.upsert({
      where:  { symbol_exchange: { symbol, exchange } },
      update: { price, changePct, currency },
      create: { symbol, exchange, price, changePct, currency },
    });

    return { symbol, exchange, price, changePct, currency };
  } catch {
    return cached
      ? { symbol, exchange, price: cached.price, changePct: cached.changePct, currency: cached.currency }
      : null;
  }
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
