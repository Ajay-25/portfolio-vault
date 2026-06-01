"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue, ppfProjectedMaturity } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import { formatFIDate, maskAccount, ppfProgress } from "@/lib/fi-utils";
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
  const withdrawalAvailable = holding.ppfWithdrawalAvailable;
  const partialEligible = yearsCompleted >= 7;
  const hasWithdrawalAmount = withdrawalAvailable != null && withdrawalAvailable > 0;

  const withdrawalDetail = hasWithdrawalAmount
    ? formatINR(withdrawalAvailable, true)
    : partialEligible
      ? "Eligible — amount not set"
      : yearsCompleted < 3
        ? "After year 7"
        : `Partial after year 7 (yr ${yearsCompleted}/7)`;

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
          {holding.accountNumber && (
            <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              A/c {maskAccount(holding.accountNumber)}
            </div>
          )}
        </div>
        <HeroValue
          label="Current balance"
          value={formatINR(balance, true)}
          sub={holding.valueAsOf ? `as of ${formatFIDate(holding.valueAsOf)}` : undefined}
        />
      </div>

      <ProgressBar
        pct={pct}
        color="var(--blue)"
        label={`Year ${yearsCompleted} of ${totalYears}`}
        right={holding.maturityDate ? formatFIDate(holding.maturityDate) : "—"}
      />

      <DetailGrid
        items={[
          { label: "Bank", value: holding.institution ?? "—" },
          { label: "Opening date", value: formatFIDate(holding.startDate) },
          { label: "Maturity date", value: formatFIDate(holding.maturityDate) },
          { label: "ROI", value: holding.rate != null ? `${holding.rate}% p.a.` : "—" },
          { label: "Annual deposit", value: formatINR(holding.annualContrib ?? 0, true) },
          { label: "Withdrawal available", value: withdrawalDetail },
          { label: "Extensions", value: String(holding.extensionCount ?? 0) },
        ]}
      />

      <ProjectedValue amount={projected} />

      {(hasWithdrawalAmount || (partialEligible && !hasWithdrawalAmount)) && (
        <div
          className="mt-4 pt-3 flex flex-wrap items-center gap-x-3 gap-y-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {hasWithdrawalAmount && (
            <>
              <span className="badge badge-teal">Partial withdrawal available</span>
              <span className="font-mono text-sm font-medium" style={{ color: "var(--teal)" }}>
                {formatINR(withdrawalAvailable, true)}
              </span>
            </>
          )}
          {partialEligible && !hasWithdrawalAmount && (
            <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              Partial withdrawal eligible — add withdrawal limit from your passbook
            </span>
          )}
        </div>
      )}
      {!partialEligible && yearsCompleted < 3 && (
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="badge badge-muted">Locked — partial withdrawal after year 7</span>
        </div>
      )}
    </div>
  );
}
