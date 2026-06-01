"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import { epfSplitPct, formatFIDate, maskAccount } from "@/lib/fi-utils";
import { DetailGrid, HeroValue } from "./shared";

export function EPFCard({ holding }: { holding: FIHolding }) {
  const balance = fiValue(holding);
  const empPct = epfSplitPct(holding);
  const erPct = 100 - empPct;
  const monthlyTotal = (holding.employeeMonthly ?? 0) + (holding.employerMonthly ?? 0);
  const projected60 = Math.round(balance * Math.pow(1 + (holding.rate ?? 8.25) / 100, 25));

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-purple">EPF</span>
            {holding.taxBenefit === "EEE" && <span className="badge badge-teal">EEE</span>}
          </div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {holding.label}
          </div>
          <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {holding.employerName ?? holding.institution ?? "—"}
          </div>
        </div>
        <HeroValue label="Total balance" value={formatINR(balance, true)} />
      </div>

      <div className="mb-1 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
        Employee {empPct}% · Employer {erPct}%
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        <div style={{ width: `${empPct}%`, background: "var(--blue)" }} />
        <div style={{ width: `${erPct}%`, background: "var(--teal)" }} />
      </div>

      <DetailGrid
        items={[
          { label: "UAN", value: maskAccount(holding.uan ?? holding.accountNumber) },
          { label: "Rate", value: `${holding.rate ?? "—"}% p.a.` },
          { label: "Employee / mo", value: formatINR(holding.employeeMonthly ?? 0, true) },
          { label: "Employer / mo", value: formatINR(holding.employerMonthly ?? 0, true) },
          { label: "EPS balance", value: formatINR(holding.epsBalance ?? 0, true) },
          { label: "Total contrib / mo", value: formatINR(monthlyTotal, true) },
        ]}
      />

      <div className="mt-3 font-mono text-xs" style={{ color: "var(--teal)" }}>
        Est. corpus at 60: {formatINR(projected60, true)}
      </div>
    </div>
  );
}
