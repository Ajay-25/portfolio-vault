"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import { formatFIDate, maskAccount } from "@/lib/fi-utils";
import { DetailGrid, HeroValue } from "./shared";

const SEGMENTS = [
  { key: "equityPct", label: "E", color: "var(--blue)" },
  { key: "corpBondPct", label: "C", color: "var(--teal)" },
  { key: "govtSecPct", label: "G", color: "var(--gold)" },
  { key: "altPct", label: "A", color: "var(--purple)" },
] as const;

export function NPSCard({ holding, tier }: { holding: FIHolding; tier: 1 | 2 }) {
  const balance = fiValue(holding);
  const isAuto = holding.investmentChoice?.startsWith("auto");
  const choiceLabel = isAuto
    ? `Auto (${holding.investmentChoice?.replace("auto_", "").toUpperCase() ?? "age-based"})`
    : "Active choice";

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="badge badge-gold">NPS Tier {tier}</span>
            {holding.taxBenefit === "80CCD" && <span className="badge badge-purple">80CCD</span>}
          </div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {holding.label}
          </div>
          <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {holding.fundManager ?? holding.institution ?? "—"}
          </div>
        </div>
        <HeroValue label="Corpus" value={formatINR(balance, true)} />
      </div>

      {!isAuto && (
        <>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-2">
            {SEGMENTS.map((seg) => {
              const pct = (holding[seg.key] as number | null) ?? 0;
              if (pct <= 0) return null;
              return (
                <div key={seg.key} style={{ width: `${pct}%`, background: seg.color }} title={`${seg.label}: ${pct}%`} />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
            {SEGMENTS.map((seg) => (
              <span key={seg.key} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: seg.color }} />
                {seg.label} {(holding[seg.key] as number | null) ?? 0}%
              </span>
            ))}
          </div>
        </>
      )}

      {isAuto && (
        <div className="badge badge-muted mb-3">{choiceLabel}</div>
      )}

      <DetailGrid
        items={[
          { label: "PRAN", value: maskAccount(holding.pran) },
          { label: "Choice", value: choiceLabel },
          { label: "Monthly", value: formatINR(holding.monthlyContrib ?? 0, true) },
          { label: "Annual", value: formatINR(holding.annualContrib ?? 0, true) },
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
