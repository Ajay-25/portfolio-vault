export type StockExchange = "NSE" | "NYSE";

/** Groq often sends wrong/missing exchange values — normalize before DB use. */
export function normalizeExchange(
  raw: unknown,
  defaultExchange: StockExchange = "NSE",
): StockExchange {
  if (raw == null) return defaultExchange;
  const s = String(raw).trim().toUpperCase();
  if (!s) return defaultExchange;

  if (s === "NYSE" || s === "US" || s === "NASDAQ" || s === "NASDQ" || s === "NY") {
    return "NYSE";
  }
  if (s === "NSE" || s === "IN" || s === "INDIA" || s === "BSE" || s === "INR") {
    return "NSE";
  }

  return defaultExchange;
}

export function optionalExchange(raw: unknown): StockExchange | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  return normalizeExchange(s);
}

export function normalizePortfolioScope(
  raw: unknown,
  defaultScope: "mine" | "mother" | "both" = "both",
): "mine" | "mother" | "both" {
  if (raw == null) return defaultScope;
  const s = String(raw).trim().toLowerCase();
  if (s === "mine" || s === "primary" || s === "my" || s === "me") return "mine";
  if (s === "mother" || s === "mom" || s === "mothers" || s === "secondary") return "mother";
  if (s === "both" || s === "all") return "both";
  return defaultScope;
}

export function normalizePortfolioKey(
  raw: unknown,
  defaultKey: "mine" | "mother" = "mine",
): "mine" | "mother" {
  const scope = normalizePortfolioScope(raw, defaultKey);
  return scope === "mother" ? "mother" : "mine";
}
