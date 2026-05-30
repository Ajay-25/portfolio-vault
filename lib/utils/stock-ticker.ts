/**
 * Maps NSE portfolio symbols to Yahoo Finance tickers (suffix .NS added separately).
 * Portfolio DB keeps the NSE symbol; price fetch uses the Yahoo equivalent.
 */
const NSE_YAHOO_SYMBOL: Record<string, string> = {
  "L&TFH": "LTF",      // merged into L&T Finance Ltd (NSE: LTF)
  LG:      "LGEINDIA", // LG Electronics India
};

/** Yahoo chart tickers to try, in order, for a portfolio symbol. */
export function yahooTickersForStock(symbol: string, exchange: string): string[] {
  const sym = symbol.trim();
  if (exchange !== "NSE") return [sym];

  const seen = new Set<string>();
  const add = (base: string) => {
    const t = `${base}.NS`;
    if (!seen.has(t)) seen.add(t);
  };

  const alias = NSE_YAHOO_SYMBOL[sym] ?? NSE_YAHOO_SYMBOL[sym.toUpperCase()];
  if (alias) add(alias);

  add(sym);

  return [...seen];
}

/** Safe query params for /api/market/stock */
export function stockPriceQuery(symbol: string, exchange: string): string {
  return new URLSearchParams({ symbol, exchange }).toString();
}
