import { lookupAlias, normalizeSymbolKey } from "@/lib/utils/stock-ticker";
import {
  pickBestNseQuote,
  pickBestUsQuote,
  searchYahooQuotes,
  type YahooSearchQuote,
} from "@/lib/apis/yahoo-symbol-search";

export type StockSymbolMatch = {
  symbol:      string;
  exchange:    "NSE" | "NYSE";
  yahooTicker: string;
  companyName: string;
  quoteType:   string;
  confidence:  "high" | "medium" | "low";
  score:       number;
  livePrice:   number | null;
  changePct:   number | null;
  currency:    string | null;
  priceStatus: "live" | "unavailable";
};

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function stripSuffix(ticker: string): string {
  return ticker.replace(/\.(NS|BO)$/i, "");
}

function companyName(q: YahooSearchQuote): string {
  return q.longname ?? q.shortname ?? q.symbol ?? "";
}

function isNseQuote(q: YahooSearchQuote): boolean {
  return Boolean(q.symbol?.endsWith(".NS") || q.exchange === "NSI" || q.exchDisp === "NSE");
}

function isUsQuote(q: YahooSearchQuote): boolean {
  if (!q.symbol || q.symbol.includes(".")) return false;
  return (
    q.exchange === "NYQ" ||
    q.exchange === "NMS" ||
    q.exchange === "NGM" ||
    q.exchange === "NCM" ||
    Boolean(q.exchDisp?.match(/nasdaq|nyse|new york/i))
  );
}

function confidenceFromScore(score: number, quoteType: string): "high" | "medium" | "low" {
  let adj = score;
  if (quoteType === "EQUITY") adj += 5;
  if (quoteType === "ETF") adj -= 3;
  if (adj >= 85) return "high";
  if (adj >= 60) return "medium";
  return "low";
}

async function verifyYahooPrice(
  yahooTicker: string,
  exchange: "NSE" | "NYSE",
): Promise<{ price: number | null; changePct: number | null; currency: string | null }> {
  const ticker = exchange === "NSE" && !yahooTicker.endsWith(".NS")
    ? `${yahooTicker}.NS`
    : yahooTicker;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
        cache:    "no-store",
      },
    );
    if (!res.ok) return { price: null, changePct: null, currency: null };

    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta as {
      regularMarketPrice?: number;
      previousClose?: number;
      chartPreviousClose?: number;
      currency?: string;
    } | undefined;

    if (!meta?.regularMarketPrice) return { price: null, changePct: null, currency: null };

    const price = meta.regularMarketPrice;
    const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;

    return {
      price,
      changePct,
      currency: meta.currency ?? (exchange === "NSE" ? "INR" : "USD"),
    };
  } catch {
    return { price: null, changePct: null, currency: null };
  }
}

function quoteToCandidate(
  q: YahooSearchQuote,
  exchange: "NSE" | "NYSE",
): { symbol: string; yahooTicker: string; quoteType: string; score: number; companyName: string } | null {
  if (exchange === "NSE") {
    if (!isNseQuote(q) || !q.symbol) return null;
    const symbol = stripSuffix(q.symbol).toUpperCase();
    return {
      symbol,
      yahooTicker: q.symbol,
      quoteType:   q.quoteType ?? "UNKNOWN",
      score:       q.score ?? 50,
      companyName: companyName(q),
    };
  }

  if (!isUsQuote(q) || !q.symbol) return null;
  const symbol = q.symbol.toUpperCase();
  return {
    symbol,
    yahooTicker: symbol,
    quoteType:   q.quoteType ?? "UNKNOWN",
    score:       q.score ?? 50,
    companyName: companyName(q),
  };
}

function dedupeCandidates(
  items: Array<{ symbol: string; yahooTicker: string; quoteType: string; score: number; companyName: string }>,
): typeof items {
  const seen = new Set<string>();
  const out: typeof items = [];
  for (const item of items.sort((a, b) => b.score - a.score)) {
    const key = item.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function lookupStockSymbols(options: {
  query?:       string;
  name?:        string;
  exchange?:    "NSE" | "NYSE";
  limit?:       number;
}): Promise<StockSymbolMatch[]> {
  const exchange = options.exchange ?? "NSE";
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 8);
  const queries = [options.query, options.name]
    .map((q) => q?.trim())
    .filter((q): q is string => Boolean(q));

  if (!queries.length) return [];

  const rawCandidates: Array<{
    symbol: string;
    yahooTicker: string;
    quoteType: string;
    score: number;
    companyName: string;
  }> = [];

  for (const q of queries) {
    const alias = lookupAlias(q);
    if (alias) {
      rawCandidates.push({
        symbol:      alias.toUpperCase(),
        yahooTicker: exchange === "NSE" ? `${alias}.NS` : alias,
        quoteType:   "EQUITY",
        score:       99,
        companyName: q,
      });
    }

    const quotes = await searchYahooQuotes(q, 10);
    for (const quote of quotes) {
      const c = quoteToCandidate(quote, exchange);
      if (c) rawCandidates.push(c);
    }

    if (exchange === "NSE") {
      const best = pickBestNseQuote(quotes);
      if (best && !rawCandidates.some((c) => c.symbol === best.toUpperCase())) {
        rawCandidates.push({
          symbol:      best.toUpperCase(),
          yahooTicker: `${best}.NS`,
          quoteType:   "EQUITY",
          score:       90,
          companyName: q,
        });
      }
    } else {
      const best = pickBestUsQuote(quotes);
      if (best && !rawCandidates.some((c) => c.symbol === best.toUpperCase())) {
        rawCandidates.push({
          symbol:      best.toUpperCase(),
          yahooTicker: best,
          quoteType:   "EQUITY",
          score:       90,
          companyName: q,
        });
      }
    }
  }

  const candidates = dedupeCandidates(rawCandidates).slice(0, limit);
  const matches: StockSymbolMatch[] = [];

  for (const c of candidates) {
    const verified = await verifyYahooPrice(c.yahooTicker, exchange);
    matches.push({
      symbol:      c.symbol,
      exchange,
      yahooTicker: c.yahooTicker,
      companyName: c.companyName,
      quoteType:   c.quoteType,
      confidence:  confidenceFromScore(c.score, c.quoteType),
      score:       c.score,
      livePrice:   verified.price,
      changePct:   verified.changePct,
      currency:    verified.currency,
      priceStatus: verified.price != null ? "live" : "unavailable",
    });
  }

  return matches.sort((a, b) => {
    if (a.priceStatus === "live" && b.priceStatus !== "live") return -1;
    if (b.priceStatus === "live" && a.priceStatus !== "live") return 1;
    return b.score - a.score;
  });
}

export function formatStockSymbolLookupText(
  matches: StockSymbolMatch[],
  query: { query?: string; name?: string; exchange?: string },
): string {
  const parts = [query.query, query.name].filter(Boolean);
  const label = parts.length ? parts.map((p) => `"${p}"`).join(" / ") : "query";
  const exch = query.exchange ?? "NSE";

  if (!matches.length) {
    return `No ${exch} ticker found for ${label}. Try the full company name or a different spelling.`;
  }

  const lines = matches.map((m) => {
    const price =
      m.livePrice != null
        ? ` · CMP ${m.currency === "USD" ? "$" : "₹"}${m.livePrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${m.changePct != null ? ` (${m.changePct >= 0 ? "+" : ""}${m.changePct.toFixed(1)}% today)` : ""}`
        : " · CMP unavailable";
    return (
      `  • [${m.symbol}] ${m.companyName} (${m.quoteType}, ${m.confidence}${price})` +
      `\n    → use symbol ${m.symbol} on ${m.exchange} with update_stock_holding after user confirms`
    );
  });

  return (
    `${exch} ticker matches for ${label}:\n${lines.join("\n")}\n` +
    "Confirm the correct symbol with the user before calling update_stock_holding."
  );
}

export function normalizeStockSymbolKey(symbol: string): string {
  return normalizeSymbolKey(symbol);
}
