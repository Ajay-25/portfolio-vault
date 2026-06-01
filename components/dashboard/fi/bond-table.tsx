"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import { formatFIDate, ratingBadgeClass, typeBadgeClass, typeLabel } from "@/lib/fi-utils";

export function BondTable({
  bonds,
  onAdd,
}: {
  bonds:       FIHolding[];
  portfolioId: string;
  onAdd:       () => void;
}) {
  if (!bonds.length) {
    return (
      <div className="card p-8 text-center">
        <div className="text-sm mb-3" style={{ color: "var(--text-dim)" }}>No bonds or NSC holdings yet.</div>
        <button type="button" onClick={onAdd} className="font-mono text-xs px-4 py-2 rounded-lg" style={{ background: "var(--gold)", color: "#111" }}>
          + Add bond / NSC
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="data-table min-w-[760px]">
        <thead>
          <tr>
            <th>Issuer</th>
            <th>Type</th>
            <th className="text-right">Face value</th>
            <th className="text-right">Coupon</th>
            <th>Next payout</th>
            <th>Maturity</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          {bonds.map((b) => (
            <tr key={b.id}>
              <td>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{b.label}</div>
                <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {b.institution ?? "—"}{b.isin ? ` · ${b.isin}` : ""}
                </div>
              </td>
              <td><span className={`badge ${typeBadgeClass(b.type)}`}>{typeLabel(b.type)}</span></td>
              <td className="font-mono text-right text-sm">{formatINR(fiValue(b), true)}</td>
              <td className="font-mono text-right text-sm">
                {b.rate != null ? `${b.rate}% ${b.couponFrequency ?? "annual"}` : "—"}
              </td>
              <td className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                {formatFIDate(b.nextCouponDate)}
              </td>
              <td className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                {formatFIDate(b.maturityDate)}
              </td>
              <td>
                {b.rating ? (
                  <span className={`badge ${ratingBadgeClass(b.rating)}`}>{b.rating}</span>
                ) : (
                  <span className="badge badge-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
