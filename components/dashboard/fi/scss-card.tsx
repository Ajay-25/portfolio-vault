"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import { formatFIDate, quarterlyPayout } from "@/lib/fi-utils";
import { DetailGrid, HeroValue } from "./shared";

export function SCSSCard({ holding }: { holding: FIHolding }) {
  const payout = quarterlyPayout(holding);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-purple">SCSS</span>
            {holding.taxBenefit === "80C" && <span className="badge badge-gold">80C</span>}
          </div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {holding.label}
          </div>
          <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {holding.institution ?? "Post Office"}
          </div>
        </div>
        <HeroValue label="Principal" value={formatINR(fiValue(holding), true)} />
      </div>

      <DetailGrid
        items={[
          { label: "Rate", value: `${holding.rate ?? 8.2}% p.a.` },
          { label: "Quarterly payout", value: formatINR(payout, true) },
          { label: "Started", value: formatFIDate(holding.startDate) },
          { label: "Maturity", value: formatFIDate(holding.maturityDate) },
        ]}
      />

      {holding.notes && (
        <div className="mt-3 font-mono text-[10px]" style={{ color: "var(--text-dim)" }}>
          {holding.notes}
        </div>
      )}
    </div>
  );
}
