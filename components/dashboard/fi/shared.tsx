"use client";

import type { ReactNode } from "react";
import { formatINR } from "@/lib/utils/finance";

export function StatCard({
  label,
  value,
  sub,
  urgent,
}: {
  label:  string;
  value:  string;
  sub:    string;
  urgent?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding:    "16px 18px",
        borderColor: urgent ? "rgba(226,75,74,0.35)" : undefined,
      }}
    >
      <div className="stat-label mb-2">{label}</div>
      <div
        className="font-display text-xl font-semibold"
        style={{ color: urgent ? "var(--orange)" : "var(--text)" }}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
        {sub}
      </div>
    </div>
  );
}

export function EmptyState({ type, onAdd }: { type: string; onAdd: () => void }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-sm mb-3" style={{ color: "var(--text-dim)" }}>
        No {type} instruments yet.
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="font-mono text-xs px-4 py-2 rounded-lg"
        style={{ background: "var(--gold)", color: "#111" }}
      >
        + Add instrument
      </button>
    </div>
  );
}

export function ProgressBar({
  pct,
  color = "var(--blue)",
  label,
  right,
}: {
  pct:    number;
  color?: string;
  label?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div>
      {(label || right) && (
        <div className="flex justify-between mb-1.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span>{label}</span>
          <span>{right}</span>
        </div>
      )}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function HeroValue({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="stat-label mb-1">{label}</div>
      <div className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function DetailGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="stat-label mb-1">{item.label}</div>
          <div className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectedValue({ amount }: { amount: number }) {
  return (
    <div className="mt-3 font-mono text-xs" style={{ color: "var(--teal)" }}>
      Projected: {formatINR(amount, true)}
    </div>
  );
}
