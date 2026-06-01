"use client";

import { useState } from "react";
import type { FIHolding, FISummary } from "@/lib/fixed-income-data";
import {
  BOND_FI_TYPES,
  DEPOSIT_FI_TYPES,
  GOVT_FI_TYPES,
  LIQUID_FI_TYPES,
} from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import { PPFCard } from "./fi/ppf-card";
import { EPFCard } from "./fi/epf-card";
import { NPSCard } from "./fi/nps-card";
import { SCSSCard } from "./fi/scss-card";
import { FDTable } from "./fi/fd-table";
import { BondTable } from "./fi/bond-table";
import { LiquidSection } from "./fi/liquid-section";
import { FIAddModal } from "./fi/fi-add-modal";
import { EmptyState, StatCard } from "./fi/shared";

type Tab = "govt" | "deposits" | "bonds" | "liquid";

const TABS: { id: Tab; label: string }[] = [
  { id: "govt",     label: "Govt schemes" },
  { id: "deposits", label: "Bank deposits" },
  { id: "bonds",    label: "Bonds & NSC" },
  { id: "liquid",   label: "Liquid" },
];

export function FixedIncomeDashboard({
  holdings,
  summary,
  portfolioId,
}: {
  holdings:    FIHolding[];
  summary:     FISummary;
  portfolioId: string;
}) {
  const [tab, setTab] = useState<Tab>("govt");
  const [adding, setAdding] = useState(false);

  const ppf = holdings.find((h) => h.type === "ppf");
  const epf = holdings.find((h) => h.type === "epf");
  const npsTier1 = holdings.find((h) => h.type === "nps_tier1");
  const npsTier2 = holdings.find((h) => h.type === "nps_tier2");
  const scss = holdings.find((h) => h.type === "scss");
  const fds = holdings.filter((h) => DEPOSIT_FI_TYPES.includes(h.type as (typeof DEPOSIT_FI_TYPES)[number]));
  const bonds = holdings.filter((h) => BOND_FI_TYPES.includes(h.type as (typeof BOND_FI_TYPES)[number]));
  const liquid = holdings.filter((h) => LIQUID_FI_TYPES.includes(h.type as (typeof LIQUID_FI_TYPES)[number]));

  const hasGovt = holdings.some((h) => GOVT_FI_TYPES.includes(h.type as (typeof GOVT_FI_TYPES)[number]));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Fixed Income"
          value={formatINR(summary.total, true)}
          sub={`${holdings.length} instruments`}
        />
        <StatCard
          label="Weighted Rate"
          value={`${summary.weightedRate.toFixed(2)}%`}
          sub="blended p.a. return"
        />
        <StatCard
          label="Next Maturity"
          value={summary.nextMaturity ? `${summary.nextMaturity.daysLeft}d` : "—"}
          sub={
            summary.nextMaturity
              ? `${summary.nextMaturity.institution} · ${formatINR(summary.nextMaturity.value, true)}`
              : "No upcoming"
          }
          urgent={!!summary.nextMaturity && summary.nextMaturity.daysLeft < 90}
        />
        <StatCard
          label="80C / 80CCD Used"
          value={formatINR(Math.min(summary.deductionUsed80C, 150000), true)}
          sub={`₹1.5L 80C + ${formatINR(Math.min(summary.deductionUsedNPS, 50000), true)} NPS`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all font-mono"
            style={{
              background: tab === id ? "rgba(201,168,76,0.08)" : "var(--bg-2)",
              border:     `1px solid ${tab === id ? "rgba(201,168,76,0.3)" : "var(--border)"}`,
              color:      tab === id ? "var(--gold-l)" : "var(--text-dim)",
              fontSize:   "12px",
            }}
          >
            <span style={{ fontSize: 14 }}>◈</span>
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono"
          style={{ background: "var(--gold)", color: "#111", fontSize: "12px" }}
        >
          + Add instrument
        </button>
      </div>

      {tab === "govt" && (
        <div className="space-y-4 animate-slide-up">
          {ppf && <PPFCard holding={ppf} />}
          {epf && <EPFCard holding={epf} />}
          {npsTier1 && <NPSCard holding={npsTier1} tier={1} />}
          {npsTier2 && <NPSCard holding={npsTier2} tier={2} />}
          {scss && <SCSSCard holding={scss} />}
          {!hasGovt && <EmptyState type="govt schemes" onAdd={() => setAdding(true)} />}
        </div>
      )}

      {tab === "deposits" && (
        <div className="animate-slide-up">
          <FDTable fds={fds} portfolioId={portfolioId} onAdd={() => setAdding(true)} />
        </div>
      )}

      {tab === "bonds" && (
        <div className="animate-slide-up">
          <BondTable bonds={bonds} portfolioId={portfolioId} onAdd={() => setAdding(true)} />
        </div>
      )}

      {tab === "liquid" && (
        <div className="animate-slide-up">
          <LiquidSection items={liquid} portfolioId={portfolioId} onAdd={() => setAdding(true)} />
        </div>
      )}

      {adding && (
        <FIAddModal portfolioId={portfolioId} onClose={() => setAdding(false)} defaultTab={tab} />
      )}
    </div>
  );
}
