"use client";

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

export function LiveStocksTable({
  holdings,
  usdInr,
  editMode = false,
  onDelete,
}: {
  holdings: StockHolding[];
  usdInr:   number;
  editMode?: boolean;
  onDelete?: (id: string) => void;
}) {
  const { prices, loading } = useLivePrices(
    holdings.map((h) => ({ symbol: h.symbol, exchange: h.exchange })),
  );

  return (
    <table className="data-table min-w-[640px]">
      <thead>
        <tr>
          <th>Company</th>
          <th>Exchange</th>
          <th style={{ textAlign: "right" }}>Qty</th>
          <th style={{ textAlign: "right" }}>Avg Price</th>
          <th style={{ textAlign: "right" }}>CMP</th>
          <th style={{ textAlign: "right" }}>Value (₹)</th>
          <th style={{ textAlign: "right" }}>P&L</th>
          <th>Action</th>
          {editMode && <th />}
        </tr>
      </thead>
      <tbody>
        {holdings.map((h) => {
          const key       = `${h.symbol}:${h.exchange}`;
          const live      = prices[key];
          const livePrice = live?.price;
          const fxRate    = h.currency === "USD" ? usdInr : 1;
          const investedInr = h.qty * h.avgPrice * fxRate;
          const value     = livePrice
            ? h.qty * livePrice * fxRate
            : investedInr;
          const pnl       = livePrice ? value - investedInr : null;
          const gain      =
            livePrice && investedInr > 0
              ? (value - investedInr) / investedInr
              : null;

          return (
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
                ) : livePrice ? (
                  <>
                    {h.currency === "USD" ? "$" : "₹"}
                    {livePrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    {live.changePct !== undefined && (
                      <span
                        className="text-[10px] ml-1"
                        style={{ color: live.changePct >= 0 ? "var(--teal)" : "var(--red)" }}
                      >
                        {live.changePct >= 0 ? "+" : ""}
                        {live.changePct.toFixed(1)}%
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </td>
              <td className="font-mono text-right text-sm font-medium" style={{ color: "var(--gold-l)" }}>
                {formatINR(value, true)}
              </td>
              <td
                className="font-mono text-right text-sm"
                style={{
                  color:
                    pnl === null
                      ? "var(--text-muted)"
                      : pnl >= 0
                        ? "var(--teal)"
                        : "var(--red)",
                }}
              >
                {pnl !== null ? (
                  <>
                    {formatINR(pnl, true)}
                    {gain !== null && (
                      <span className="text-[10px] block">
                        {gain >= 0 ? "+" : ""}
                        {(gain * 100).toFixed(1)}%
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
          );
        })}
      </tbody>
    </table>
  );
}
