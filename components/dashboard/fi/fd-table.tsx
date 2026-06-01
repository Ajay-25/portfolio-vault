"use client";

import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue } from "@/lib/fixed-income-data";
import { formatINR } from "@/lib/utils/finance";
import {
  daysUntil,
  fdTenureProgress,
  formatFIDate,
  maturityBarColor,
  maturityColor,
} from "@/lib/fi-utils";

export function FDTable({
  fds,
  onAdd,
}: {
  fds:      FIHolding[];
  portfolioId: string;
  onAdd:    () => void;
}) {
  if (!fds.length) {
    return (
      <div className="card p-8 text-center">
        <div className="text-sm mb-3" style={{ color: "var(--text-dim)" }}>No fixed deposits yet.</div>
        <button type="button" onClick={onAdd} className="font-mono text-xs px-4 py-2 rounded-lg" style={{ background: "var(--gold)", color: "#111" }}>
          + Add FD
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="data-table min-w-[800px]">
        <thead>
          <tr>
            <th>Institution</th>
            <th className="text-right">Principal</th>
            <th className="text-right">Rate</th>
            <th>Start → Maturity</th>
            <th className="text-right">Days left</th>
            <th className="text-right">Maturity value</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {fds.map((fd) => {
            const days = daysUntil(fd.maturityDate);
            const barPct = fdTenureProgress(fd);
            return (
              <tr key={fd.id}>
                <td>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{fd.label}</div>
                  <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{fd.institution ?? "—"}</div>
                </td>
                <td className="font-mono text-right text-sm">{formatINR(fiValue(fd), true)}</td>
                <td className="font-mono text-right text-sm">{fd.rate != null ? `${fd.rate}%` : "—"}</td>
                <td className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                  {formatFIDate(fd.startDate)} → {formatFIDate(fd.maturityDate)}
                </td>
                <td className="text-right">
                  <div className="font-mono text-sm" style={{ color: maturityColor(days) }}>
                    {days != null ? `${days}d` : "—"}
                  </div>
                  <div className="mt-1 h-1 rounded-full overflow-hidden mx-auto max-w-[80px]" style={{ background: "var(--bg-3)" }}>
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: maturityBarColor(days) }} />
                  </div>
                </td>
                <td className="font-mono text-right text-sm" style={{ color: "var(--teal)" }}>
                  {fd.maturityAmount ? formatINR(fd.maturityAmount, true) : "—"}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {fd.isTaxSaving && <span className="badge badge-gold">80C</span>}
                    {fd.autoRenewal && <span className="badge badge-muted">↺ Auto</span>}
                    {fd.rating && <span className="badge badge-teal">{fd.rating}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
