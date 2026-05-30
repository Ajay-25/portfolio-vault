"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/utils/finance";
import {
  type NetWorthData,
  type NetWorthPersonFilter,
  type NetWorthSlice,
} from "@/lib/net-worth";
import { wealthPath } from "@/lib/wealth-config";

interface NetWorthViewProps {
  initial: NetWorthData;
}

const FILTERS: { key: NetWorthPersonFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "mother", label: "Mother's" },
];

function StatCard({
  accent,
  label,
  value,
  sub,
  valueColor,
}: {
  accent: string;
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div className="stat-card animate-slide-up" style={{ "--accent": accent } as React.CSSProperties}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: valueColor ?? "var(--text)" }}>
        {value}
      </div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function NetWorthView({ initial }: NetWorthViewProps) {
  const [filter, setFilter] = useState<NetWorthPersonFilter>("all");
  const [indianStocks, setIndianStocks] = useState(initial.indianStocksEditable);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slice: NetWorthSlice = useMemo(() => {
    if (filter === "mine") {
      const mine = initial.byPerson.mine;
      const adjusted = {
        ...mine,
        indianStocks: indianStocks,
      };
      const total =
        adjusted.mfTotal +
        adjusted.indianStocks +
        adjusted.usStocks +
        adjusted.debtTotal +
        adjusted.liquid +
        adjusted.fdBondTotal +
        adjusted.insuranceInvestments;
      const segments = mine.segments.map((seg) => {
        const value =
          seg.key === "stocks" ? indianStocks : seg.value;
        return {
          ...seg,
          value,
          pct: total > 0 ? (value / total) * 100 : 0,
        };
      });
      return { ...adjusted, total, segments };
    }
    return initial.byPerson[filter];
  }, [filter, initial, indianStocks]);

  const persistIndianStocks = useCallback(async (value: number) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/net-worth/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indianStocks: value }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, []);

  const updateIndianStocks = (raw: string) => {
    const value = Math.max(0, parseInt(raw, 10) || 0);
    setIndianStocks(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistIndianStocks(value), 600);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const indianSub =
    filter === "mother"
      ? slice.indianStockSymbols
        ? `${slice.indianStockSymbols} etc.`
        : "NSE holdings"
      : initial.indianStockSymbols
        ? `${initial.indianStockSymbols} etc.`
        : "NSE holdings · editable override";

  const mfSub =
    filter === "all" ? "Your + Mother's" : filter === "mine" ? "Primary portfolio" : "Mother's portfolio";

  const showIndianEditor = filter === "all" || filter === "mine";

  return (
    <div className="space-y-5">
      {/* Person filter */}
      <div
        className="flex flex-wrap gap-1 p-1 rounded-lg w-fit"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      >
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded-md text-xs font-mono transition-colors"
            style={{
              background: filter === key ? "rgba(201,168,76,0.12)" : "transparent",
              color: filter === key ? "var(--gold-l)" : "var(--text-dim)",
              border:
                filter === key
                  ? "1px solid rgba(201,168,76,0.25)"
                  : "1px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))" }}>
        <StatCard
          accent="var(--gold)"
          label="Total Net Worth"
          value={formatINR(slice.total, true)}
          sub={filter === "all" ? "Household rollup" : filter === "mine" ? "My assets" : "Mother's assets"}
          valueColor="var(--gold-l)"
        />
        <StatCard
          accent="var(--blue)"
          label="Indian MFs"
          value={formatINR(slice.mfTotal, true)}
          sub={mfSub}
          valueColor="var(--blue)"
        />
        <StatCard
          accent="var(--teal)"
          label="Indian Stocks"
          value={formatINR(slice.indianStocks, true)}
          sub={indianSub}
          valueColor="var(--teal)"
        />
        {(filter === "all" || filter === "mine") && slice.usStocks > 0 && (
          <StatCard
            accent="var(--purple)"
            label="US Stocks (INR)"
            value={formatINR(slice.usStocks, true)}
            sub={`${slice.usStockCount} US holdings`}
            valueColor="var(--purple)"
          />
        )}
        {slice.debtTotal > 0 && (
          <StatCard
            accent="var(--cyan)"
            label="PPF + EPF + NPS"
            value={formatINR(slice.debtTotal, true)}
            sub="Debt anchor"
            valueColor="var(--cyan)"
          />
        )}
        {slice.liquid > 0 && (
          <StatCard
            accent="var(--orange)"
            label="Liquid / Arbitrage"
            value={formatINR(slice.liquid, true)}
            sub="Deployment ready"
            valueColor="var(--orange)"
          />
        )}
        {slice.fdBondTotal > 0 && (
          <StatCard
            accent="var(--gold)"
            label="FD & Bonds"
            value={formatINR(slice.fdBondTotal, true)}
            sub={filter === "mother" ? "Fixed income" : "Includes mother's FDs"}
            valueColor="var(--gold-l)"
          />
        )}
        {slice.insuranceInvestments > 0 && (
          <Link
            href={wealthPath(filter === "mother" ? "mother" : "mine", "insurance")}
            className="block hover:opacity-90 transition-opacity"
            style={{ textDecoration: "none" }}
          >
            <StatCard
              accent="var(--orange)"
              label="Insurance investments"
              value={formatINR(slice.insuranceInvestments, true)}
              sub="ULIP + endowment · view policies"
              valueColor="var(--orange)"
            />
          </Link>
        )}
      </div>

      {/* Breakdown bar */}
      <div className="card animate-slide-up stagger-2">
        <div
          className="flex items-center justify-between px-[18px] py-[13px]"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
            Net Worth Breakdown
          </div>
        </div>
        <div className="px-[18px] py-4">
          {slice.total > 0 ? (
            <>
              <div className="net-worth-bar">
                {slice.segments.map((seg) => (
                  <div
                    key={seg.key}
                    className="nw-seg"
                    style={{
                      width: `${seg.pct}%`,
                      background: seg.color,
                      color: seg.pct > 6 ? "#fff" : "transparent",
                    }}
                    title={`${seg.label} ${formatINR(seg.value, true)}`}
                  >
                    {seg.pct > 6 ? seg.shortLabel : ""}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-1">
                {slice.segments.map((seg) => (
                  <div
                    key={seg.key}
                    className="flex items-center gap-1.5 text-[11px]"
                    style={{ color: "var(--text-dim)" }}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: seg.color }}
                    />
                    {seg.href ? (
                      <Link href={seg.href} className="hover:opacity-80 transition-opacity">
                        {seg.label} {seg.pct.toFixed(1)}%
                      </Link>
                    ) : (
                      <span>
                        {seg.label} {seg.pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
              No assets in this view yet
            </div>
          )}
        </div>
      </div>

      {/* Editor — indianStocks override only; fixed income edited on wealth pages */}
      <div className="card animate-slide-up stagger-3">
        <div
          className="flex items-center justify-between px-[18px] py-[13px]"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
            Manual Overrides
          </div>
          {saveState === "saving" && (
            <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="font-mono text-[10px]" style={{ color: "var(--teal)" }}>
              Saved
            </span>
          )}
          {saveState === "error" && (
            <span className="font-mono text-[10px]" style={{ color: "var(--red)" }}>
              Save failed
            </span>
          )}
        </div>
        <div className="px-[18px] py-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {showIndianEditor && (
              <div>
                <div className="stat-label mb-1.5">INDIAN STOCKS OVERRIDE (₹)</div>
                <input
                  type="number"
                  min={0}
                  className="input-field font-mono"
                  value={indianStocks}
                  onChange={(e) => updateIndianStocks(e.target.value)}
                />
              </div>
            )}

            <div>
              <div className="stat-label mb-1.5">USD/INR RATE</div>
              <div
                className="rounded-md px-2.5 py-[7px] flex justify-between items-center"
                style={{
                  background: "var(--bg-3)",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="font-mono text-sm" style={{ color: "var(--gold-l)" }}>
                  ₹{initial.usdInr.toFixed(2)}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  frankfurter.app
                </span>
              </div>
            </div>
          </div>

          <div
            className="mt-3.5 px-3 py-3 rounded-lg font-mono text-xs leading-relaxed space-y-2"
            style={{
              background: "var(--bg-2)",
              color: "var(--text-dim)",
            }}
          >
            <p>
              MF values update automatically when you Refresh NAVs in the sidebar. US stock
              values use holdings × live USD/INR.
            </p>
            <p>
              PPF, EPF, NPS, liquid, and FD balances are managed on Fixed income pages —{" "}
              <Link href={wealthPath("mine", "fixed-income")} style={{ color: "var(--gold)" }}>
                My wealth → Fixed income
              </Link>
              {" · "}
              <Link href={wealthPath("mother", "fixed-income")} style={{ color: "var(--gold)" }}>
                Mother&apos;s wealth → Fixed income
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
