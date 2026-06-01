"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";

export function LiquidSection({
  items,
  onAdd,
}: {
  items:       FIHolding[];
  portfolioId: string;
  onAdd:       () => void;
}) {
  if (!items.length) {
    return (
      <div className="card p-8 text-center">
        <div className="text-sm mb-3" style={{ color: "var(--text-dim)" }}>No liquid holdings yet.</div>
        <button type="button" onClick={onAdd} className="font-mono text-xs px-4 py-2 rounded-lg" style={{ background: "var(--gold)", color: "#111" }}>
          + Add liquid
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.id} className="card p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span className="badge badge-muted mb-2 inline-block">LIQUID</span>
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{item.label}</div>
              <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {item.institution ?? "—"}
              </div>
            </div>
            <span className="badge badge-teal">T+1</span>
          </div>
          <div className="font-display text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>
            {formatINR(fiValue(item), true)}
          </div>
          <div className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
            {item.rate != null ? `${item.rate}% p.a.` : "Rate n/a"}
          </div>
          {item.notes && (
            <div className="font-mono text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
              {item.notes}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
