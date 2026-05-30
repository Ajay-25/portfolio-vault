/**
 * lib/utils/finance.ts
 * Pure financial calculation utilities — no side effects.
 */

// ── XIRR ──────────────────────────────────────────────────────────────────

export type CashFlow = { date: Date; value: number };

export function computeXIRR(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  const d0     = flows[0].date;
  const years  = flows.map((f) => (f.date.getTime() - d0.getTime()) / (365.25 * 86400 * 1000));
  const values = flows.map((f) => f.value);

  const npv  = (r: number) => values.reduce((s, v, i) => s + v / Math.pow(1 + r, years[i]), 0);
  const dnpv = (r: number) => values.reduce((s, v, i) => s - (years[i] * v) / Math.pow(1 + r, years[i] + 1), 0);

  let r = 0.1;
  for (let i = 0; i < 200; i++) {
    const n = npv(r), d = dnpv(r);
    if (Math.abs(d) < 1e-12) break;
    const nr = r - n / d;
    if (Math.abs(nr - r) < 1e-8) return nr;
    r = nr;
    if (r < -0.999 || r > 100) return null;
  }
  return Math.abs(npv(r)) < 1 ? r : null;
}

// ── CAGR ──────────────────────────────────────────────────────────────────

export function calcCAGR(start: number, end: number, years: number): number {
  if (start <= 0 || years <= 0) return 0;
  return Math.pow(end / start, 1 / years) - 1;
}

// ── Absolute Return ────────────────────────────────────────────────────────

export function absoluteReturn(invested: number, current: number): number {
  if (invested <= 0) return 0;
  return (current - invested) / invested;
}

// ── SIP Step-Up Projection ────────────────────────────────────────────────

export type StepUpRow = {
  year:      number;
  sip:       number;
  invested:  number;
  value:     number;
  multiple:  number;
};

export function calcStepUp(
  initialSIP:  number,
  stepPct:     number,   // annual step-up as decimal (e.g. 0.10)
  annualCagr:  number,   // e.g. 0.16
  corpusStart: number,   // existing portfolio value
  years:       number
): StepUpRow[] {
  let portVal    = corpusStart;
  let totalInv   = 0;
  let currentSIP = initialSIP;
  const rows: StepUpRow[] = [];

  for (let y = 1; y <= years; y++) {
    totalInv += currentSIP * 12;
    portVal   = (portVal + currentSIP * 12) * (1 + annualCagr);
    rows.push({
      year:     y,
      sip:      currentSIP,
      invested: totalInv,
      value:    portVal,
      multiple: totalInv > 0 ? portVal / totalInv : 0,
    });
    currentSIP = Math.round((currentSIP * (1 + stepPct)) / 1000) * 1000;
  }
  return rows;
}

// ── LTCG Estimation ───────────────────────────────────────────────────────

/** Equity LTCG: 10% on gains above ₹1L exemption */
export function estimateLTCG(gain: number, exemptionUsed = 0): number {
  const exemptionLimit = 100000;
  const remaining      = Math.max(0, exemptionLimit - exemptionUsed);
  const taxableGain    = Math.max(0, gain - remaining);
  return taxableGain * 0.10;
}

// ── Number formatting ─────────────────────────────────────────────────────

export function formatINR(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000)   return `₹${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000)     return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function formatPct(val: number, decimals = 2): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(decimals)}%`;
}
