import { prisma } from "@/lib/prisma";
import { getCachedNAVs } from "@/lib/data/nav-server";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";
import {
  type PortfolioScope,
  type ReturnFilter,
  type PortfolioKey,
  portfolioIds,
  toPortfolioKey,
  filterByReturn,
  sortByGainAsc,
  formatInrSigned,
  formatReturnHeader,
  emptyReturnMessage,
} from "@/lib/agent/portfolio-scope";

export type MfReturnRow = {
  schemeCode:      string;
  schemeName:      string;
  category:        string | null;
  portfolioName:   string;
  portfolioKey:    PortfolioKey;
  units:           number;
  avgNav:          number | null;
  liveNav:         number | null;
  navDate:         string | null;
  investedInr:     number;
  currentValueInr: number;
  gainInr:         number | null;
  gainPct:         number | null;
  sipAmount:       number | null;
  sipDate:         number | null;
};

export async function fetchMfReturns(options: {
  portfolio?: PortfolioScope;
  filter?:    ReturnFilter;
} = {}): Promise<MfReturnRow[]> {
  const { portfolio = "both", filter = "all" } = options;

  const portfolios = await prisma.portfolio.findMany({
    where:   { id: { in: portfolioIds(portfolio) } },
    include: { mfHoldings: true },
  });

  const codes = [
    ...new Set(portfolios.flatMap((p) => p.mfHoldings.map((h) => h.schemeCode))),
  ];
  const navs = codes.length > 0 ? await getCachedNAVs(codes) : {};

  const rows: MfReturnRow[] = portfolios.flatMap((p) =>
    p.mfHoldings.map((h) => {
      const navResult = navs[h.schemeCode];
      const liveNav   = navResult?.nav ?? null;
      const invested  = h.avgNAV ? h.units * h.avgNAV : 0;
      const current   = liveNav ? h.units * liveNav : invested;
      const gainInr   = h.avgNAV && liveNav ? current - invested : null;
      const gainPct   =
        gainInr != null && invested > 0 ? (gainInr / invested) * 100 : null;

      return {
        schemeCode:      h.schemeCode,
        schemeName:      formatMFSchemeName(navResult?.schemeName ?? h.schemeName),
        category:        h.category,
        portfolioName:   p.name,
        portfolioKey:    toPortfolioKey(p.id),
        units:           h.units,
        avgNav:          h.avgNAV,
        liveNav,
        navDate:         navResult?.date ?? null,
        investedInr:     invested,
        currentValueInr: current,
        gainInr,
        gainPct,
        sipAmount:       h.sipAmount,
        sipDate:         h.sipDate,
      };
    }),
  );

  return sortByGainAsc(filterByReturn(rows, filter));
}

export function formatMfReturnLine(r: MfReturnRow): string {
  const navStr = r.liveNav != null
    ? `NAV ₹${r.liveNav.toFixed(4)}${r.navDate ? ` (${r.navDate})` : ""}`
    : "NAV unavailable";

  const sip = r.sipAmount ? ` | SIP ₹${r.sipAmount}/mo on ${r.sipDate ?? "?"}th` : "";

  if (r.gainPct == null) {
    return `  • ${r.schemeName} [${r.schemeCode}] (${r.portfolioName}): ${r.units} units — ${navStr} = ${formatInrSigned(r.currentValueInr)}${sip}`;
  }

  const sign = r.gainPct >= 0 ? "+" : "";
  return `  • ${r.schemeName} [${r.schemeCode}] (${r.portfolioName}): ${r.units} units @ ₹${r.avgNav!.toFixed(2)} avg → ${navStr} | ${sign}${r.gainPct.toFixed(2)}% (${formatInrSigned(r.gainInr!)})${sip}`;
}

export function formatMfReturnsText(
  rows: MfReturnRow[],
  filter: ReturnFilter = "all",
): string {
  if (!rows.length) return emptyReturnMessage("mutual fund holdings", filter);
  return `${formatReturnHeader("Mutual funds (live NAV vs avg buy)", filter)}\n${rows.map(formatMfReturnLine).join("\n")}`;
}
