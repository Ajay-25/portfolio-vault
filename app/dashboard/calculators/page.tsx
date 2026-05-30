"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { computeXIRR, calcStepUp, formatINR } from "@/lib/utils/finance";

type CalcTab = "xirr" | "stepup";

// ── XIRR Calculator ────────────────────────────────────────────────────────

function XirrCalc() {
  const [rows, setRows]     = useState([
    { date: "2023-04-01", value: "-125000" },
    { date: new Date().toISOString().split("T")[0], value: "408000" },
  ]);
  const [result, setResult] = useState<number | null | "error">(null);

  const addRow = () =>
    setRows((r) => [...r, { date: new Date().toISOString().split("T")[0], value: "" }]);

  const updateRow = (i: number, key: "date" | "value", val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));

  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const calc = () => {
    const flows = rows
      .map((r) => ({ date: new Date(r.date), value: parseFloat(r.value) }))
      .filter((f) => !isNaN(f.value) && f.date instanceof Date);
    if (flows.length < 2) { setResult("error"); return; }
    const xirr = computeXIRR(flows);
    setResult(xirr ?? "error");
  };

  const pct = typeof result === "number" ? result * 100 : null;

  return (
    <div className="card" style={{ padding: "24px" }}>
      <div className="stat-label mb-1">XIRR Calculator</div>
      <div className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
        Enter cash flows (negative = investment, positive = redemption/current value)
      </div>

      <div className="space-y-2 mb-4">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="date"
              value={row.date}
              onChange={(e) => updateRow(i, "date", e.target.value)}
              className="input-field"
              style={{ width: "160px" }}
            />
            <input
              type="number"
              value={row.value}
              placeholder="Amount (negative = outflow)"
              onChange={(e) => updateRow(i, "value", e.target.value)}
              className="input-field font-mono"
            />
            <button
              onClick={() => removeRow(i)}
              className="px-3 py-2 rounded-lg text-xs transition-colors"
              style={{ background: "rgba(245,56,89,0.1)", color: "var(--red)", border: "1px solid rgba(245,56,89,0.2)", flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={addRow}
          className="px-4 py-2 rounded-lg text-sm transition-all"
          style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
        >
          + Add Row
        </button>
        <button
          onClick={calc}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: "var(--gold)", color: "#111", fontFamily: "IBM Plex Mono" }}
        >
          Calculate XIRR
        </button>
      </div>

      {result !== null && (
        <div
          className="rounded-xl p-6 text-center"
          style={{
            background: result === "error" ? "rgba(245,56,89,0.06)" : "rgba(0,200,150,0.06)",
            border:     `1px solid ${result === "error" ? "rgba(245,56,89,0.2)" : "rgba(0,200,150,0.2)"}`,
          }}
        >
          {result === "error" ? (
            <div className="font-mono text-base" style={{ color: "var(--red)" }}>
              Could not compute — check inputs
            </div>
          ) : pct !== null ? (
            <>
              <div
                className="font-display mb-2"
                style={{
                  fontSize:  "56px",
                  fontWeight: 600,
                  color:     pct > 18 ? "var(--teal)" : pct > 12 ? "var(--gold-l)" : "var(--orange)",
                  lineHeight: 1,
                }}
              >
                {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
              </div>
              <div className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                {pct > 18 ? "Excellent returns! 🚀" : pct > 14 ? "Very Good" : pct > 12 ? "Good" : "Below benchmark"}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── SIP Step-Up Calculator ─────────────────────────────────────────────────

function StepUpCalc() {
  const [sip,    setSip]    = useState(125000);
  const [step,   setStep]   = useState(10);
  const [cagr,   setCagr]   = useState(16);
  const [corpus, setCorpus] = useState(4080000);
  const [years,  setYears]  = useState(7);

  const rows = calcStepUp(sip, step / 100, cagr / 100, corpus, years);
  const last = rows[rows.length - 1];

  return (
    <div className="card" style={{ padding: "24px" }}>
      <div className="stat-label mb-1">SIP Step-Up Projection</div>
      <div className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
        Annual step-up simulation with existing corpus
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: "Monthly SIP (₹)",   value: sip,    set: (v: number) => setSip(v),    min: 0 },
          { label: "Annual Step-Up %",  value: step,   set: (v: number) => setStep(v),   min: 0, max: 50  },
          { label: "CAGR %",            value: cagr,   set: (v: number) => setCagr(v),   min: 1, max: 30  },
          { label: "Current Corpus (₹)", value: corpus, set: (v: number) => setCorpus(v), min: 0 },
          { label: "Years",             value: years,  set: (v: number) => setYears(v),  min: 1, max: 30  },
        ].map(({ label, value, set, ...rest }) => (
          <div key={label}>
            <div className="stat-label mb-1.5">{label}</div>
            <input
              type="number"
              value={value}
              onChange={(e) => set(parseFloat(e.target.value) || 0)}
              className="input-field font-mono"
              {...rest}
            />
          </div>
        ))}
        {last && (
          <div className="flex items-center">
            <div>
              <div className="stat-label mb-1">Final Corpus</div>
              <div className="font-display text-2xl text-gold-gradient" style={{ fontWeight: 600 }}>
                {formatINR(last.value, true)}
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--teal)" }}>
                {last.multiple.toFixed(2)}x on invested
              </div>
            </div>
          </div>
        )}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Year</th>
            <th style={{ textAlign: "right" }}>Monthly SIP</th>
            <th style={{ textAlign: "right" }}>Total Invested</th>
            <th style={{ textAlign: "right" }}>Portfolio Value</th>
            <th style={{ textAlign: "right" }}>Multiple</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Year {row.year}</td>
              <td className="font-mono text-right text-sm" style={{ color: "var(--teal)" }}>
                {formatINR(row.sip)}
              </td>
              <td className="font-mono text-right text-sm" style={{ color: "var(--text-dim)" }}>
                {formatINR(row.invested, true)}
              </td>
              <td className="font-mono text-right text-sm font-medium" style={{ color: "var(--gold-l)" }}>
                {formatINR(row.value, true)}
              </td>
              <td className="font-mono text-right text-sm" style={{ color: "var(--gold)" }}>
                {row.multiple.toFixed(2)}x
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CalculatorsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const initialTab: CalcTab = tabParam === "stepup" ? "stepup" : "xirr";
  const [tab, setTab] = useState<CalcTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const selectTab = (next: CalcTab) => {
    setTab(next);
    router.replace(`/dashboard/calculators?tab=${next}`, { scroll: false });
  };

  return (
    <div>
      <TopBar title="Analytics · Calculators" />
      <main className="p-6">
        <div className="flex gap-2 mb-6">
          {(["xirr", "stepup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => selectTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t ? "rgba(201,168,76,0.12)" : "var(--bg-2)",
                border:     `1px solid ${tab === t ? "rgba(201,168,76,0.3)" : "var(--border)"}`,
                color:      tab === t ? "var(--gold-l)" : "var(--text-dim)",
              }}
            >
              {t === "xirr" ? "XIRR Calculator" : "SIP Step-Up"}
            </button>
          ))}
        </div>
        {tab === "xirr" ? <XirrCalc /> : <StepUpCalc />}
      </main>
    </div>
  );
}
