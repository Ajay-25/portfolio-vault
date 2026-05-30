"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  evaluateShriramAlert,
  SHRIRAM_CONFIG,
  type AlertsPageData,
  type ShriramCheckResult,
} from "@/lib/alerts";
import { formatINR } from "@/lib/utils/finance";

interface StockAlertsViewProps {
  data: AlertsPageData;
}

export function StockAlertsView({ data }: StockAlertsViewProps) {
  const router = useRouter();
  const [priceInput, setPriceInput] = useState(
    data.shriramLivePrice ? String(Math.round(data.shriramLivePrice)) : "",
  );
  const [checkResult, setCheckResult] = useState<ShriramCheckResult | null>(null);
  const [alertSym, setAlertSym] = useState("");
  const [alertCmp, setAlertCmp] = useState("");
  const [alertTgt, setAlertTgt] = useState("");
  const [saving, setSaving] = useState(false);

  const shriram = data.shriram;
  const sharesNeeded = shriram
    ? Math.max(0, SHRIRAM_CONFIG.targetShares - shriram.qty)
    : 0;

  const runCheck = () => {
    const cmp = parseFloat(priceInput);
    if (isNaN(cmp) || !shriram) return;
    setCheckResult(evaluateShriramAlert(cmp, shriram.qty, shriram.avgPrice));
  };

  const addAlert = async () => {
    const cmp = parseFloat(alertCmp);
    const tgt = parseFloat(alertTgt);
    if (!alertSym.trim() || isNaN(cmp) || isNaN(tgt)) return;

    setSaving(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: alertSym.trim().toUpperCase(),
          type: tgt > cmp ? "price_above" : "price_below",
          target: tgt,
          message: `Track ${alertSym} · CMP ₹${cmp}`,
        }),
      });
      setAlertSym("");
      setAlertCmp("");
      setAlertTgt("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const removeAlert = async (id: string) => {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        {/* Shriram Finance */}
        <div className="card animate-slide-up">
          <div
            className="flex items-center justify-between px-[18px] py-[13px]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
              Shriram Finance (SHRIRAMFIN)
            </div>
            <span className="badge badge-gold">HIGH CONVICTION</span>
          </div>
          <div className="px-[18px] py-4">
            {shriram ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {[
                    { label: "YOUR AVG COST", value: `₹${shriram.avgPrice.toLocaleString("en-IN")}` },
                    { label: "CURRENT SHARES", value: String(shriram.qty) },
                    { label: "MUFG FLOOR", value: `₹${SHRIRAM_CONFIG.mufgFloor}`, color: "var(--teal)" },
                    { label: "ANALYST TARGET", value: `₹${SHRIRAM_CONFIG.analystTarget.toLocaleString("en-IN")}`, color: "var(--gold-l)" },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="stat-label mb-1">{stat.label}</div>
                      <div
                        className="font-mono text-xl font-bold"
                        style={{ color: stat.color ?? "var(--text)" }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    className="input-field font-mono flex-1"
                    placeholder="Enter current price ₹"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runCheck()}
                  />
                  <button
                    type="button"
                    onClick={runCheck}
                    className="px-4 py-2 rounded-md text-sm font-bold font-mono"
                    style={{ background: "var(--gold)", color: "#111" }}
                  >
                    CHECK
                  </button>
                </div>

                {data.shriramLivePrice && (
                  <button
                    type="button"
                    className="text-[11px] font-mono mb-3 hover:opacity-80"
                    style={{ color: "var(--gold)" }}
                    onClick={() => {
                      setPriceInput(String(Math.round(data.shriramLivePrice!)));
                      setCheckResult(
                        evaluateShriramAlert(
                          data.shriramLivePrice!,
                          shriram.qty,
                          shriram.avgPrice,
                        ),
                      );
                    }}
                  >
                    Use live price ₹{Math.round(data.shriramLivePrice).toLocaleString("en-IN")}
                  </button>
                )}

                {checkResult && (
                  <div
                    className={`alert-card alert-${checkResult.variant === "bull" ? "bull" : checkResult.variant === "bear" ? "bear" : "neutral"}`}
                  >
                    <div className="font-mono text-[22px] font-bold" style={{ color: "var(--gold-l)" }}>
                      ₹{checkResult.cmp.toLocaleString("en-IN")}{" "}
                      <span
                        className="text-sm"
                        style={{ color: checkResult.pnl >= 0 ? "var(--teal)" : "var(--red)" }}
                      >
                        P&L: ₹{Math.round(checkResult.pnl).toLocaleString("en-IN")} (
                        {checkResult.pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="text-[13px] mt-2">{checkResult.action}</div>
                    <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                      MUFG floor: ₹{SHRIRAM_CONFIG.mufgFloor} · Analyst target: ₹
                      {SHRIRAM_CONFIG.analystTarget} · Your avg: ₹{shriram.avgPrice}
                    </div>
                  </div>
                )}

                <div
                  className="mt-3 px-3 py-3 rounded-lg"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
                >
                  <div className="stat-label mb-1.5">
                    BUY PLAN — {sharesNeeded} MORE SHARES NEEDED (Target:{" "}
                    {SHRIRAM_CONFIG.targetShares})
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                    Next 30 shares: if price hits ₹920-930
                    <br />
                    Final 30 shares: if price hits ₹900-920
                    <br />
                    2-3 Year target: ₹2,000 → 110% upside
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
                SHRIRAMFIN holding not found in portfolio.
              </div>
            )}
          </div>
        </div>

        {/* Custom alerts */}
        <div className="card animate-slide-up stagger-2">
          <div
            className="px-[18px] py-[13px] text-[13px] font-semibold"
            style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}
          >
            Custom Price Tracker
          </div>
          <div className="px-[18px] py-4">
            <div
              className="grid gap-2 items-end mb-3"
              style={{ gridTemplateColumns: "1fr 1fr 1fr auto" }}
            >
              <div>
                <div className="stat-label mb-1">STOCK</div>
                <input
                  className="input-field font-mono"
                  placeholder="e.g. LT"
                  value={alertSym}
                  onChange={(e) => setAlertSym(e.target.value)}
                />
              </div>
              <div>
                <div className="stat-label mb-1">CURRENT ₹</div>
                <input
                  type="number"
                  className="input-field font-mono"
                  placeholder="CMP"
                  value={alertCmp}
                  onChange={(e) => setAlertCmp(e.target.value)}
                />
              </div>
              <div>
                <div className="stat-label mb-1">TARGET ₹</div>
                <input
                  type="number"
                  className="input-field font-mono"
                  placeholder="Target"
                  value={alertTgt}
                  onChange={(e) => setAlertTgt(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={addAlert}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm font-bold font-mono mt-5"
                style={{ background: "var(--gold)", color: "#111" }}
              >
                ADD
              </button>
            </div>

            <div className="mt-2">
              {data.alerts.length === 0 ? (
                <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                  No alerts added yet
                </div>
              ) : (
                data.alerts.map((a) => {
                  const cmp = a.currentPrice ?? (parseFloat(alertCmp) || 0);
                  const diff = cmp > 0 ? ((a.target - cmp) / cmp) * 100 : 0;
                  const up = a.target > cmp;
                  return (
                    <div
                      key={a.id}
                      className="flex justify-between items-center py-2 gap-2"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <div>
                        <span className="font-mono font-semibold">{a.symbol}</span>
                        {a.currentPrice && (
                          <span className="text-[11px] ml-2" style={{ color: "var(--text-dim)" }}>
                            Live: ₹{Math.round(a.currentPrice)}
                          </span>
                        )}
                      </div>
                      <span
                        className="font-mono text-xs"
                        style={{ color: up ? "var(--teal)" : "var(--red)" }}
                      >
                        {up ? "↑" : "↓"} ₹{a.target.toLocaleString("en-IN")} (
                        {up ? "+" : ""}
                        {diff.toFixed(1)}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAlert(a.id)}
                        className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{
                          background: "rgba(245,56,89,0.15)",
                          border: "1px solid rgba(245,56,89,0.3)",
                          color: "var(--red)",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Indian stocks table */}
      <div className="card animate-slide-up stagger-3">
        <div
          className="px-[18px] py-[13px] text-[13px] font-semibold"
          style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}
        >
          Your Indian Stock Portfolio
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Avg ₹</th>
                <th style={{ textAlign: "right" }}>CMP ₹</th>
                <th style={{ textAlign: "right" }}>Invested</th>
                <th style={{ textAlign: "right" }}>Value</th>
                <th style={{ textAlign: "right" }}>P&L ₹</th>
                <th style={{ textAlign: "right" }}>%</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.indianStocks.map((s) => (
                <tr key={s.symbol}>
                  <td>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {s.displayName ?? s.symbol}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {s.symbol}
                    </div>
                  </td>
                  <td className="font-mono text-right text-sm">{s.qty}</td>
                  <td className="font-mono text-right text-sm">
                    ₹{s.avgPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="font-mono text-right text-sm">
                    {s.cmp !== null ? `₹${Math.round(s.cmp).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="font-mono text-right text-sm">
                    {formatINR(s.invested, true)}
                  </td>
                  <td className="font-mono text-right text-sm" style={{ color: "var(--gold-l)" }}>
                    {s.value !== null ? formatINR(s.value, true) : "—"}
                  </td>
                  <td
                    className="font-mono text-right text-sm"
                    style={{
                      color:
                        s.pnl === null
                          ? "var(--text-muted)"
                          : s.pnl >= 0
                            ? "var(--teal)"
                            : "var(--red)",
                    }}
                  >
                    {s.pnl !== null ? formatINR(s.pnl, true) : "—"}
                  </td>
                  <td
                    className="font-mono text-right text-sm"
                    style={{
                      color:
                        s.pct === null
                          ? "var(--text-muted)"
                          : s.pct >= 0
                            ? "var(--teal)"
                            : "var(--red)",
                    }}
                  >
                    {s.pct !== null ? `${s.pct >= 0 ? "+" : ""}${s.pct.toFixed(1)}%` : "—"}
                  </td>
                  <td>
                    {s.action && (
                      <span className="font-mono text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {s.action}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bg-2)" }}>
                <td colSpan={4} className="font-mono font-bold" style={{ color: "var(--gold-l)" }}>
                  TOTAL
                </td>
                <td className="font-mono text-right font-bold">
                  {formatINR(data.totals.invested, true)}
                </td>
                <td className="font-mono text-right font-bold" style={{ color: "var(--teal)" }}>
                  {formatINR(data.totals.value, true)}
                </td>
                <td
                  className="font-mono text-right font-bold"
                  style={{ color: data.totals.pnl >= 0 ? "var(--teal)" : "var(--red)" }}
                >
                  {formatINR(data.totals.pnl, true)}
                </td>
                <td
                  className="font-mono text-right font-bold"
                  style={{ color: data.totals.pct >= 0 ? "var(--teal)" : "var(--red)" }}
                >
                  {data.totals.pct >= 0 ? "+" : ""}
                  {data.totals.pct.toFixed(1)}%
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
