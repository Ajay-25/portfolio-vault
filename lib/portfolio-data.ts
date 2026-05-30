import { prisma } from "@/lib/prisma";
import { fetchBulkNAVs } from "@/lib/apis/amfi";
import { fetchStockPrice, fetchUSDINR } from "@/lib/apis/prices";
import { absoluteReturn } from "@/lib/utils/finance";

export type MfRow = {
  id: string;
  schemeCode: string;
  schemeName: string;
  units: number;
  avgNAV: number | null;
  sipAmount: number | null;
  sipDate: number | null;
  category: string | null;
  status: string;
  nav: number | null;
  navDate: string | null;
  value: number;
  gain: number | null;
};

export type StockRow = {
  id: string;
  symbol: string;
  displayName: string | null;
  exchange: string;
  currency: string;
  qty: number;
  avgPrice: number;
  action: string | null;
  cmp: number | null;
  changePct: number | null;
  investedInr: number;
  value: number;
  gain: number | null;
};

export type PortfolioPageData = {
  portfolioId: string;
  portfolioName: string;
  view?: string;
  pageTitle: string;
  showMf: boolean;
  showStocks: boolean;
  displayTotal: number;
  mfTotal: number;
  mfGain: number;
  sipTotal: number;
  stockTotal: number;
  stockGainPct: number | null;
  mfRows: MfRow[];
  stockRows: StockRow[];
  filteredStockRows: StockRow[];
  filteredStockTotal: number;
};

export async function getPortfolioPageData(
  id: string,
  view?: string,
): Promise<PortfolioPageData | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    include: { mfHoldings: true, stockHoldings: true },
  });

  if (!portfolio) return null;

  const codes = [...new Set(portfolio.mfHoldings.map((h) => h.schemeCode))];
  const [navMap, usdInr] = await Promise.all([fetchBulkNAVs(codes), fetchUSDINR()]);

  const priceResults = await Promise.all(
    portfolio.stockHoldings.map((s) => fetchStockPrice(s.symbol, s.exchange)),
  );

  const mfRows: MfRow[] = portfolio.mfHoldings.map((h) => {
    const navResult = navMap.get(h.schemeCode);
    const nav       = navResult?.nav ?? null;
    const navDate   = navResult?.date ?? null;
    const value     = nav ? h.units * nav : 0;
    const gain      = h.avgNAV ? absoluteReturn(h.units * h.avgNAV, value) : null;
    return {
      id: h.id,
      schemeCode: h.schemeCode,
      schemeName: h.schemeName,
      units: h.units,
      avgNAV: h.avgNAV,
      sipAmount: h.sipAmount,
      sipDate: h.sipDate,
      category: h.category,
      status: h.status,
      nav,
      navDate,
      value,
      gain,
    };
  });

  const stockRows: StockRow[] = portfolio.stockHoldings.map((s, i) => {
    const live = priceResults[i];
    const cmp = live?.price ?? null;
    const fxRate = s.currency === "USD" ? usdInr : 1;
    const investedInr = s.qty * s.avgPrice * fxRate;
    const value =
      cmp !== null ? s.qty * cmp * fxRate : investedInr;
    const gain =
      cmp !== null && investedInr > 0
        ? absoluteReturn(investedInr, value)
        : null;

    return {
      id: s.id,
      symbol: s.symbol,
      displayName: s.displayName,
      exchange: s.exchange,
      currency: s.currency,
      qty: s.qty,
      avgPrice: s.avgPrice,
      action: s.action,
      cmp,
      changePct: live?.changePct ?? null,
      investedInr,
      value,
      gain,
    };
  });

  const mfTotal = mfRows.reduce((s, h) => s + h.value, 0);
  const stockTotal = stockRows.reduce((s, h) => s + h.value, 0);
  const total = mfTotal + stockTotal;

  const mfInvested = mfRows.reduce(
    (s, h) => s + (h.avgNAV ? h.units * h.avgNAV : 0),
    0,
  );
  const mfGain = mfInvested > 0 ? absoluteReturn(mfInvested, mfTotal) : 0;
  const sipTotal = portfolio.mfHoldings.reduce(
    (s, h) => s + (h.sipAmount ?? 0),
    0,
  );

  const stockInvested = stockRows.reduce((s, h) => s + h.investedInr, 0);
  const stockGainPct =
    stockInvested > 0
      ? absoluteReturn(stockInvested, stockTotal) * 100
      : null;

  const showMf = !view || view === "mf" || view === "all";
  const showStocks = !view || view === "all" || view === "us" || view === "in";

  const filteredStockRows =
    view === "us"
      ? stockRows.filter((s) => s.currency === "USD")
      : view === "in"
        ? stockRows.filter((s) => s.currency === "INR")
        : stockRows;

  const filteredStockTotal = filteredStockRows.reduce((s, h) => s + h.value, 0);

  const displayTotal =
    view === "mf"
      ? mfTotal
      : view === "us" || view === "in"
        ? filteredStockTotal
        : total;

  const pageTitle =
    view === "mf"
      ? "MF Portfolio"
      : view === "us"
        ? "US Stocks"
        : view === "in"
          ? "Indian Stocks"
          : portfolio.name;

  return {
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    view,
    pageTitle,
    showMf,
    showStocks,
    displayTotal,
    mfTotal,
    mfGain,
    sipTotal,
    stockTotal,
    stockGainPct,
    mfRows,
    stockRows,
    filteredStockRows,
    filteredStockTotal,
  };
}
