import { computeXIRR, type CashFlow } from "@/lib/utils/finance";

export type MfHoldingForStats = {
  units:     number;
  avgNAV:    number | null;
  sipAmount: number | null;
  sipDate:   number | null;
  value:     number;
};

export type UpcomingSipInfo = {
  day:       number;
  daysUntil: number;
  amount:    number;
  fundCount: number;
  label:     string;
};

export type MfPortfolioStats = {
  invested:           number;
  marketValue:        number;
  gainAbs:            number | null;
  gainPct:            number | null;
  xirr:               number | null;
  fundsWithCostBasis: number;
  fundsMissingCost:   number;
  fundCount:          number;
  monthlySipTotal:    number;
  upcomingSip:        UpcomingSipInfo | null;
};

function daysUntilSipDay(today: Date, sipDay: number): number {
  const day = today.getDate();
  if (day < sipDay) return sipDay - day;
  const next = new Date(today.getFullYear(), today.getMonth() + 1, sipDay);
  return Math.max(1, Math.ceil((next.getTime() - today.getTime()) / 86_400_000));
}

export function getUpcomingSip(
  holdings: Array<{ sipDate: number | null; sipAmount: number | null }>,
  today = new Date(),
): UpcomingSipInfo | null {
  const active = holdings.filter((h) => (h.sipAmount ?? 0) > 0 && h.sipDate);
  if (!active.length) return null;

  const byDay = new Map<number, { amount: number; count: number }>();
  for (const h of active) {
    const d = h.sipDate!;
    const prev = byDay.get(d) ?? { amount: 0, count: 0 };
    byDay.set(d, {
      amount: prev.amount + (h.sipAmount ?? 0),
      count:  prev.count + 1,
    });
  }

  let best: UpcomingSipInfo | null = null;
  for (const [sipDay, { amount, count }] of byDay) {
    const daysUntil = daysUntilSipDay(today, sipDay);
    const candidate: UpcomingSipInfo = {
      day:       sipDay,
      daysUntil,
      amount,
      fundCount: count,
      label:     `${sipDay}${sipDay === 1 ? "st" : sipDay === 2 ? "nd" : sipDay === 3 ? "rd" : "th"}`,
    };
    if (!best || daysUntil < best.daysUntil) best = candidate;
  }

  return best;
}

/** Estimate cash flows from SIP schedule + lump sums for portfolio XIRR. */
export function estimateMfPortfolioCashFlows(
  rows: MfHoldingForStats[],
  today = new Date(),
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const row of rows) {
    if (!row.avgNAV || row.avgNAV <= 0 || row.units <= 0) continue;

    const invested = row.units * row.avgNAV;
    if (invested <= 0) continue;

    if (row.sipAmount && row.sipAmount > 0) {
      let remaining = invested;
      let monthOffset = 0;
      while (remaining > 1 && monthOffset < 480) {
        const d = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
        const sipDay = row.sipDate ?? 7;
        d.setDate(Math.min(sipDay, 28));
        const amount = Math.min(row.sipAmount, remaining);
        flows.push({ date: d, value: -amount });
        remaining -= amount;
        monthOffset++;
      }
    } else {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 24);
      flows.push({ date: d, value: -invested });
    }
  }

  const marketValue = rows.reduce((s, r) => s + r.value, 0);
  if (marketValue > 0) {
    flows.push({ date: new Date(today), value: marketValue });
  }

  return flows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function computeMfPortfolioStats(
  rows: MfHoldingForStats[],
  today = new Date(),
): MfPortfolioStats {
  const fundCount = rows.length;
  const fundsWithCostBasis = rows.filter((r) => r.avgNAV != null && r.avgNAV > 0).length;
  const fundsMissingCost = fundCount - fundsWithCostBasis;

  const invested = rows.reduce(
    (s, r) => s + (r.avgNAV != null && r.avgNAV > 0 ? r.units * r.avgNAV : 0),
    0,
  );
  const marketValue = rows.reduce((s, r) => s + r.value, 0);

  let gainAbs: number | null = null;
  let gainPct: number | null = null;
  if (invested > 0 && fundsWithCostBasis > 0) {
    gainAbs = marketValue - invested;
    gainPct = gainAbs / invested;
  }

  const cashFlows = estimateMfPortfolioCashFlows(rows, today);
  const xirr =
    invested > 0 && cashFlows.length >= 2 ? computeXIRR(cashFlows) : null;

  const monthlySipTotal = rows.reduce((s, r) => s + (r.sipAmount ?? 0), 0);
  const upcomingSip = getUpcomingSip(rows, today);

  return {
    invested,
    marketValue,
    gainAbs,
    gainPct,
    xirr,
    fundsWithCostBasis,
    fundsMissingCost,
    fundCount,
    monthlySipTotal,
    upcomingSip,
  };
}
