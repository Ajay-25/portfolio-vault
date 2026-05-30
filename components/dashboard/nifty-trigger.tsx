"use client";

import { useEffect, useState } from "react";

type Trigger = {
  id: string; label: string; niftyLevel: number; deployAmount: number;
};

export function NiftyTrigger({ triggers }: { triggers: Trigger[] }) {
  const [nifty, setNifty]     = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/market/nifty")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => setNifty(ok && typeof d.price === "number" ? d.price : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  // Determine which triggers are active
  const activeCount = triggers.filter((t) => nifty !== null && nifty <= t.niftyLevel).length;

  const triggerColors = ["var(--teal)", "var(--gold)", "var(--red)"];

  return (
    <div className="card animate-slide-up stagger-3" style={{ padding: "20px 24px" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="stat-label mb-1">Nifty Trigger Gauge</div>
          <div
            className="font-display text-2xl"
            style={{ color: "var(--text)", fontWeight: 600 }}
          >
            {loading ? "—" : nifty ? nifty.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}
          </div>
        </div>
        {activeCount > 0 && (
          <div className="badge badge-red">
            {activeCount} TRIGGER{activeCount > 1 ? "S" : ""} HIT
          </div>
        )}
      </div>

      <div className="space-y-3 mt-2">
        {triggers.map((trigger, i) => {
          const isHit   = nifty !== null && nifty <= trigger.niftyLevel;
          const pct     = nifty ? Math.max(0, Math.min(100, (nifty / trigger.niftyLevel) * 100)) : 0;
          const color   = triggerColors[i] ?? "var(--gold)";

          return (
            <div key={trigger.id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: isHit ? color : "var(--bg-3)",
                      border:     `1px solid ${color}`,
                      boxShadow:  isHit ? `0 0 8px ${color}` : "none",
                      transition: "all 0.3s",
                    }}
                  />
                  <span className="font-mono text-[11px]" style={{ color: "var(--text-dim)" }}>
                    {trigger.label}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                    @ {trigger.niftyLevel.toLocaleString("en-IN")}
                  </span>
                </div>
                <span className="font-mono text-[11px] flex-shrink-0" style={{ color: isHit ? color : "var(--text-dim)" }}>
                  {formatINR(trigger.deployAmount)}
                </span>
              </div>
              <div className="progress-track" style={{ height: "4px" }}>
                <div
                  className="progress-fill"
                  style={{
                    width:      `${Math.min(100, pct)}%`,
                    background: color,
                    opacity:    isHit ? 1 : 0.4,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div
        className="mt-4 rounded-lg px-3 py-2.5 text-xs font-medium"
        style={{
          background: activeCount > 0 ? "rgba(245,56,89,0.08)" : "rgba(0,200,150,0.06)",
          border:     `1px solid ${activeCount > 0 ? "rgba(245,56,89,0.2)" : "rgba(0,200,150,0.15)"}`,
          color:      activeCount > 0 ? "var(--red)"  : "var(--teal)",
        }}
      >
        {activeCount > 0
          ? `🔔 Deploy funds — ${activeCount} level${activeCount > 1 ? "s" : ""} breached`
          : "✓ Market above all trigger levels — hold steady"}
      </div>
    </div>
  );
}
