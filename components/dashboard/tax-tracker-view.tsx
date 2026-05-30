"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getTaxTrackerData,
  LTCG_EXEMPTION_LIMIT,
  type LtcgMeter,
  type TaxTrackerData,
} from "@/lib/tax";
import { formatINR } from "@/lib/utils/finance";

interface TaxTrackerViewProps {
  initial: TaxTrackerData;
}

function LtcgCard({
  meter,
  onUpdate,
}: {
  meter: LtcgMeter;
  onUpdate: (used: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [usedInput, setUsedInput] = useState(String(meter.used));
  const isMother = meter.portfolioId === "portfolio-mom";
  const fullyAvailable = meter.used === 0;

  const save = () => {
    const used = Math.max(0, parseInt(usedInput, 10) || 0);
    onUpdate(used);
    setEditing(false);
  };

  return (
    <div className="card animate-slide-up">
      <div
        className="px-[18px] py-[13px] text-[13px] font-semibold"
        style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}
      >
        {meter.name}
      </div>
      <div className="px-[18px] py-4">
        <div className="label-row">
          <span style={{ color: "var(--text-dim)" }}>{meter.label}</span>
          {editing ? (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                className="input-field font-mono w-28 py-1 text-xs"
                value={usedInput}
                onChange={(e) => setUsedInput(e.target.value)}
              />
              <button
                type="button"
                onClick={save}
                className="text-[10px] font-mono"
                style={{ color: "var(--gold)" }}
              >
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setUsedInput(String(meter.used));
                setEditing(true);
              }}
              className="font-mono text-sm hover:opacity-80"
              style={{ color: meter.used > 0 ? "var(--red)" : "var(--teal)" }}
            >
              {formatINR(meter.used)}
            </button>
          )}
        </div>

        <div className="ltcg-track">
          <div className="ltcg-fill" style={{ width: `${meter.pctUsed}%` }} />
        </div>

        <div
          className="flex justify-between font-mono text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span>₹0</span>
          <span style={{ color: fullyAvailable ? "var(--teal)" : "var(--gold-l)" }}>
            {fullyAvailable
              ? "Fully available"
              : `${formatINR(meter.remaining, true)} left`}
          </span>
          <span>{formatINR(LTCG_EXEMPTION_LIMIT)}</span>
        </div>

        <div
          className="mt-3.5 px-3 py-3 rounded-lg"
          style={
            isMother
              ? {
                  background: "rgba(0,200,150,0.06)",
                  border: "1px solid rgba(0,200,150,0.15)",
                }
              : {
                  background: "var(--bg-2)",
                  borderLeft: "3px solid var(--gold)",
                }
          }
        >
          {isMother ? (
            <>
              <div className="font-mono text-[11px] mb-1" style={{ color: "var(--teal)" }}>
                MARCH HARVEST REMINDER
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Sell ₹1.25L of LTCG gains → immediately rebuy = ₹0 tax. Saves ₹15,625/yr.
                Compounded over 10 years: ₹1.5L+ saved.
              </div>
            </>
          ) : (
            <div className="font-mono text-[22px]" style={{ color: "var(--gold-l)" }}>
              {formatINR(meter.remaining)}{" "}
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                remaining this FY
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaxTrackerView({ initial }: TaxTrackerViewProps) {
  const router = useRouter();
  const [data, setData] = useState(initial);

  const updateLtcg = async (portfolioId: string, ltcgUsed: number) => {
    await fetch("/api/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: portfolioId, ltcgUsed }),
    });

    const primaryUsed =
      portfolioId === "portfolio-primary" ? ltcgUsed : data.primary.used;
    const motherUsed =
      portfolioId === "portfolio-mom" ? ltcgUsed : data.mother.used;

    setData(getTaxTrackerData(primaryUsed, motherUsed));
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        <LtcgCard meter={data.primary} onUpdate={(used) => updateLtcg("portfolio-primary", used)} />
        <LtcgCard meter={data.mother} onUpdate={(used) => updateLtcg("portfolio-mom", used)} />
      </div>

      <div className="card animate-slide-up stagger-3">
        <div
          className="px-[18px] py-[13px] text-[13px] font-semibold"
          style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}
        >
          Tax Summary — {data.fyLabel} Cleanup
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: "right" }}>Gain / Loss</th>
                <th>Type</th>
                <th>Rate</th>
                <th style={{ textAlign: "right" }}>Tax</th>
              </tr>
            </thead>
            <tbody>
              {data.summaryRows.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td
                    className="font-mono text-right text-sm"
                    style={{
                      color:
                        row.gainPositive === null
                          ? "var(--text-dim)"
                          : row.gainPositive
                            ? "var(--teal)"
                            : "var(--red)",
                    }}
                  >
                    {row.gain}
                  </td>
                  <td>
                    <span className={`badge badge-${row.typeBadge}`}>{row.type}</span>
                  </td>
                  <td className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                    {row.rate}
                  </td>
                  <td
                    className="font-mono text-right text-sm"
                    style={{ color: row.taxNegative ? "var(--red)" : "var(--teal)" }}
                  >
                    {row.tax}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "var(--bg-2)" }}>
                <td colSpan={4} className="font-mono font-bold" style={{ color: "var(--gold-l)" }}>
                  TOTAL CLEANUP COST
                </td>
                <td className="font-mono text-right font-bold text-sm" style={{ color: "var(--red)" }}>
                  ₹3,803 + ₹1,136 = ₹4,939
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          className="px-[18px] py-3.5 text-[12.5px]"
          style={{
            background: "var(--bg-2)",
            borderTop: "1px solid var(--border)",
            color: "var(--text-dim)",
          }}
        >
          Total cost to restructure ₹13.6L portfolio:{" "}
          <strong style={{ color: "var(--gold-l)" }}>₹4,939 (0.36%)</strong> — exceptional
          efficiency.
        </div>
      </div>
    </div>
  );
}
