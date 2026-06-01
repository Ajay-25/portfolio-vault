/**
 * Maps NSE portfolio symbols to Yahoo Finance tickers (suffix .NS added separately).
 * Portfolio DB may store NSE codes, abbreviations, or company names from Excel imports.
 */

/** Keys are uppercased with spaces removed. Values are Yahoo base tickers (no .NS). */
const NSE_YAHOO_SYMBOL: Record<string, string> = {
  LTFH:               "LTF",
  "L&TFH":            "LTF",
  LG:                 "LGEINDIA",
  BHARATELECTRONICS:  "BEL",
  HINDAERONAUTICS:    "HAL",
  HINDUSTANAERONAUTICS: "HAL",
  LTE:                "LT",
  TATAMOTORS:         "TMPV",
  TATAAML:            "TASILVINAV",
};

function normalizeSymbolKey(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9&]/g, "");
}

function lookupAlias(symbol: string): string | undefined {
  const raw = symbol.trim();
  return (
    NSE_YAHOO_SYMBOL[raw] ??
    NSE_YAHOO_SYMBOL[raw.toUpperCase()] ??
    NSE_YAHOO_SYMBOL[normalizeSymbolKey(raw)]
  );
}

/** Yahoo chart tickers to try (with .NS), in priority order. */
export function yahooTickersForStock(
  symbol: string,
  exchange: string,
  extraBases: string[] = [],
): string[] {
  const sym = symbol.trim();
  if (exchange !== "NSE") return [sym];

  const bases: string[] = [];

  const alias = lookupAlias(sym);
  if (alias) bases.push(alias);

  for (const base of extraBases) {
    const b = base.trim();
    if (b) bases.push(b);
  }

  bases.push(sym);

  const seen = new Set<string>();
  const tickers: string[] = [];
  for (const base of bases) {
    const t = `${base.replace(/\.NS$/i, "")}.NS`;
    if (!seen.has(t)) {
      seen.add(t);
      tickers.push(t);
    }
  }
  return tickers;
}

/** Safe query params for /api/market/stock */
export function stockPriceQuery(
  symbol: string,
  exchange: string,
  displayName?: string | null,
): string {
  const params = new URLSearchParams({ symbol, exchange });
  const name = displayName?.trim();
  if (name) params.set("name", name);
  return params.toString();
}

export { lookupAlias, normalizeSymbolKey };
