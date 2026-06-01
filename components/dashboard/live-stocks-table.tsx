"use client";

import { useMemo, useState } from "react";
import { useLivePrices } from "@/hooks/use-live-prices";
import { formatINR } from "@/lib/utils/finance";

type StockHolding = {
  id: string;
  symbol: string;
  displayName?: string | null;
  exchange: string;
  currency: string;
  qty: number;
  avgPrice: number;
  action?: string | null;
};

type StockSortKey =
  | "company"
  | "exchange"
  | "qty"
  | "avgPrice"
  | "cmp"
  | "value"
  | "dayPnl"
  | "pnl"
  | "action";

type SortDir = "asc" | "desc";

type EnrichedRow = StockHolding & {
  livePrice:   number | null;
  dayPnl:      number | null;
  dayPct:      number | null;
  investedInr: number;
  value:       number;
  pnl:         number | null;
  gain:        number | null;
};

function holdingDayPnl(
  qty: number,
  price: number,
  changePct: number,
  fxRate: number,
): number {
  return (qty * price * changePct * fxRate) / (100 + changePct);
}

function enrichRow(h: StockHolding, usdInr: number, prices: ReturnType<typeof useLivePrices>["prices"]): EnrichedRow {
  const key = `${h.symbol}:${h.exchange}`;
  const live = prices[key];
  const livePrice = live?.price ?? null;
  const fxRate = h.currency === "USD" ? usdInr : 1;
  const investedInr = h.qty * h.avgPrice * fxRate;
  const value = livePrice ? h.qty * livePrice * fxRate : investedInr;
  const pnl = livePrice ? value - investedInr : null;
  const gain = livePrice && investedInr > 0 ? (value - investedInr) / investedInr : null;

  const dayPct = live?.changePct ?? null;
  const dayPnl =
    livePrice != null && dayPct != null
      ? holdingDayPnl(h.qty, livePrice, dayPct, fxRate)
      : null;

  return {
    ...h,
    livePrice,
    dayPnl,
    dayPct,
    investedInr,
    value,
    pnl,
    gain,
  };
}

export function LiveStocksTable({
  holdings,
  usdInr,
  editMode = false,
  onDelete,
  prices: externalPrices,
  loading: externalLoading,
}: {
  holdings: StockHolding[];
  usdInr:   number;
  editMode?: boolean;
  onDelete?: (id: string) => void;
  prices?:  ReturnType<typeof useLivePrices>["prices"];
  loading?: boolean;
}) {
  const internal = useLivePrices(
    externalPrices ? [] : holdings.map((h) => ({ symbol: h.symbol, exchange: h.exchange })),
  );
  const prices = externalPrices ?? internal.prices;
  const loading = externalLoading ?? internal.loading;

  const [sortKey, setSortKey] = useState<StockSortKey>("dayPnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: StockSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "company" || key === "exchange" || key === "action" ? "asc" : "desc",
      );
    }
  };

  const enrichedRows = useMemo(
    () => holdings.map((h) => enrichRow(h, usdInr, prices)),
    [holdings, usdInr, prices],
  );

  const sortedRows = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;

    const str = (a: string | null | undefined, b: string | null | undefined) =>
      mul * (a ?? "").localeCompare(b ?? "", "en", { sensitivity: "base" });

    const num = (a: number | null | undefined, b: number | null | undefined) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return mul * (a - b);
    };

    return [...enrichedRows].sort((a, b) => {
      switch (sortKey) {
        case "company":
          return str(a.displayName ?? a.symbol, b.displayName ?? b.symbol);
        case "exchange":
          return str(a.exchange, b.exchange);
        case "action":
          return str(a.action, b.action);
        case "qty":
          return num(a.qty, b.qty);
        case "avgPrice":
          return num(a.avgPrice, b.avgPrice);
        case "cmp":
          return num(a.livePrice, b.livePrice);
        case "value":
          return num(a.value, b.value);
        case "dayPnl":
          return num(a.dayPnl, b.dayPnl);
        case "pnl":
          return num(a.pnl, b.pnl);
        default:
          return 0;
      }
    });
  }, [enrichedRows, sortKey, sortDir]);

  const SortableTh = ({
    label,
    column,
    align = "left",
  }: {
    label:  string;
    column: StockSortKey;
    align?: "left" | "right" | "center";
  }) => {
    const active = sortKey === column;
    return (
      <th style={{ textAlign: align }}>
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="inline-flex items-center gap-1 bg-transparent p-0 font-inherit uppercase tracking-wider"
          style={{
            color:          active ? "var(--gold-l)" : "var(--text-muted)",
            cursor:         "pointer",
            justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
            width:          align === "right" ? "100%" : undefined,
          }}
          aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        >
          <span>{label}</span>
          <span className="font-mono text-[9px]" style={{ opacity: active ? 1 : 0.45 }}>
            {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <table className="data-table min-w-[720px]">
      <thead>
        <tr>
          <SortableTh label="Company" column="company" />
          <SortableTh label="Exchange" column="exchange" />
          <SortableTh label="Qty" column="qty" align="right" />
          <SortableTh label="Avg Price" column="avgPrice" align="right" />
          <SortableTh label="CMP" column="cmp" align="right" />
          <SortableTh label="Value (₹)" column="value" align="right" />
          <SortableTh label="Day" column="dayPnl" align="right" />
          <SortableTh label="P&L" column="pnl" align="right" />
          <SortableTh label="Action" column="action" />
          {editMode && <th />}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((h) => (
          <tr key={h.id}>
            <td>
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {h.displayName ?? h.symbol}
              </div>
              <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {h.symbol}
              </div>
            </td>
            <td>
              <span className={`badge ${h.exchange === "NSE" ? "badge-blue" : "badge-purple"}`}>
                {h.exchange}
              </span>
            </td>
            <td className="font-mono text-right text-sm" style={{ color: "var(--text-dim)" }}>
              {h.qty}
            </td>
            <td className="font-mono text-right text-sm" style={{ color: "var(--text-dim)" }}>
              {h.currency === "USD" ? "$" : "₹"}
              {h.avgPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </td>
            <td className="font-mono text-right text-sm" style={{ color: "var(--text)" }}>
              {loading ? (
                <span className="spinner" style={{ width: 10, height: 10 }} />
              ) : h.livePrice ? (
                <>
                  {h.currency === "USD" ? "$" : "₹"}
                  {h.livePrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>—</span>
              )}
            </td>
            <td className="font-mono text-right text-sm font-medium" style={{ color: "var(--gold-l)" }}>
              {formatINR(h.value, true)}
            </td>
            <td
              className="font-mono text-right text-sm"
              style={{
                color:
                  h.dayPnl === null
                    ? "var(--text-muted)"
                    : h.dayPnl >= 0
                      ? "var(--teal)"
                      : "var(--red)",
              }}
            >
              {loading ? (
                <span className="spinner" style={{ width: 10, height: 10 }} />
              ) : h.dayPnl !== null ? (
                <>
                  {formatINR(h.dayPnl, true)}
                  {h.dayPct != null && (
                    <span className="text-[10px] block">
                      {h.dayPct >= 0 ? "+" : ""}
                      {h.dayPct.toFixed(1)}%
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </td>
            <td
              className="font-mono text-right text-sm"
              style={{
                color:
                  h.pnl === null
                    ? "var(--text-muted)"
                    : h.pnl >= 0
                      ? "var(--teal)"
                      : "var(--red)",
              }}
            >
              {h.pnl !== null ? (
                <>
                  {formatINR(h.pnl, true)}
                  {h.gain !== null && (
                    <span className="text-[10px] block">
                      {h.gain >= 0 ? "+" : ""}
                      {(h.gain * 100).toFixed(1)}%
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </td>
            <td>
              {h.action && (
                <span className="font-mono text-[10px]" style={{ color: "var(--text-dim)" }}>
                  {h.action}
                </span>
              )}
            </td>
            {editMode && onDelete && (
              <td>
                <button
                  type="button"
                  onClick={() => onDelete(h.id)}
                  className="text-[10px] font-mono px-2 py-1 rounded"
                  style={{ color: "var(--red)" }}
                >
                  Delete
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
