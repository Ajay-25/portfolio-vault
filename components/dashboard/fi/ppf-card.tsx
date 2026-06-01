"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue, ppfProjectedMaturity } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import { formatFIDate, ppfProgress } from "@/lib/fi-utils";
import { DetailGrid, HeroValue, ProgressBar, ProjectedValue } from "./shared";

export function PPFCard({ holding }: { holding: FIHolding }) {
  const { yearsCompleted, totalYears, pct } = ppfProgress(holding);
  const balance = fiValue(holding);
  const yearsRemaining = Math.max(0, totalYears - yearsCompleted);
  const projected = ppfProjectedMaturity(
    balance,
    holding.annualContrib ?? 0,
    yearsRemaining,
    (holding.rate ?? 7.1) / 100,
  );
  const canPartial = yearsCompleted >= 7;
  const canLoan = yearsCompleted >= 3 && yearsCompleted <= 6;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-blue">PPF</span>
            {holding.taxBenefit === "EEE" && <span className="badge badge-teal">EEE</span>}
          </div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {holding.label}
          </div>
          <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {holding.institution ?? "—"}
          </div>
        </div>
        <HeroValue label="Current balance" value={formatINR(balance, true)} sub={holding.valueAsOf ? `as of ${formatFIDate(holding.valueAsOf)}` : undefined} />
      </div>

      <ProgressBar
        pct={pct}
        color="var(--blue)"
        label={`Year ${yearsCompleted} of ${totalYears}`}
        right={holding.maturityDate ? formatFIDate(holding.maturityDate) : "—"}
      />

      <DetailGrid
        items={[
          { label: "Rate", value: `${holding.rate ?? "—"}% p.a.` },
          { label: "Annual deposit", value: formatINR(holding.annualContrib ?? 0, true) },
          { label: "Started", value: formatFIDate(holding.startDate) },
          { label: "Extensions", value: String(holding.extensionCount ?? 0) },
        ]}
      />

      <ProjectedValue amount={projected} />

      <div className="flex flex-wrap gap-2 mt-4">
        {canPartial && <span className="badge badge-teal">Partial withdrawal eligible</span>}
        {canLoan && <span className="badge badge-gold">Loan eligible (yr 3–6)</span>}
        {!canPartial && !canLoan && yearsCompleted < 3 && (
          <span className="badge badge-muted">Locked — partial after yr 7</span>
        )}
      </div>
    </div>
  );
}
