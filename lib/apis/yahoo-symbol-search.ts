const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type YahooSearchQuote = {
  symbol?:     string;
  shortname?:  string;
  longname?:   string;
  exchange?:   string;
  exchDisp?:   string;
  quoteType?:  string;
  score?:      number;
};

export async function searchYahooQuotes(
  query: string,
  limit = 8,
): Promise<YahooSearchQuote[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${limit}&newsCount=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
      cache:    "no-store",
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { quotes?: YahooSearchQuote[] };
    return data.quotes ?? [];
  } catch {
    return [];
  }
}

function stripSuffix(ticker: string): string {
  return ticker.replace(/\.(NS|BO)$/i, "");
}

export function pickBestNseQuote(quotes: YahooSearchQuote[]): string | null {
  const nse = quotes.filter((q) => q.symbol?.endsWith(".NS"));
  if (!nse.length) return null;

  const ranked = [...nse].sort((a, b) => {
    const typeScore = (q: YahooSearchQuote) => {
      if (q.quoteType === "EQUITY") return 0;
      if (q.quoteType === "ETF") return 1;
      return 2;
    };
    const diff = typeScore(a) - typeScore(b);
    if (diff !== 0) return diff;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return stripSuffix(ranked[0].symbol!);
}

/** Resolve an NSE symbol or company name to a Yahoo base ticker (without .NS). */
export async function searchNseYahooBase(query: string): Promise<string | null> {
  const quotes = await searchYahooQuotes(query, 8);
  return pickBestNseQuote(quotes);
}

export function pickBestUsQuote(quotes: YahooSearchQuote[]): string | null {
  const us = quotes.filter(
    (q) =>
      q.symbol &&
      !q.symbol.includes(".") &&
      (q.exchange === "NYQ" ||
        q.exchange === "NMS" ||
        q.exchange === "NGM" ||
        q.exchange === "NCM" ||
        q.exchDisp?.toLowerCase().includes("nasdaq") ||
        q.exchDisp?.toLowerCase().includes("nyse")),
  );
  if (!us.length) return null;

  const ranked = [...us].sort((a, b) => {
    const typeScore = (q: YahooSearchQuote) => (q.quoteType === "EQUITY" ? 0 : 1);
    const diff = typeScore(a) - typeScore(b);
    if (diff !== 0) return diff;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return ranked[0].symbol!.toUpperCase();
}
