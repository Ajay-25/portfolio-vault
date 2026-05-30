import Link from "next/link";
import { getMFHoldings } from "@/lib/data/portfolio";
import { getCachedNAVs } from "@/lib/data/nav-server";
import type { NavResult } from "@/lib/apis/amfi";
import { formatINR } from "@/lib/utils/finance";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";

interface MFHoldingsPreviewProps {
  portfolioId: string;
}

export async function MFHoldingsPreview({ portfolioId }: MFHoldingsPreviewProps) {
  const mfHoldings = await getMFHoldings(portfolioId);

  if (mfHoldings.length === 0) {
    return null;
  }

  const codes = [...new Set(mfHoldings.map((h) => h.schemeCode))];
  const navsObj = await getCachedNAVs(codes);
  const navMap = new Map(Object.entries(navsObj) as [string, NavResult][]);

  return (
    <div className="card animate-slide-up stagger-6 overflow-hidden">
      <div
        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <div className="stat-label mb-0.5">Live NAVs</div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            My Mutual Fund Holdings
          </div>
        </div>
        <Link
          href="/dashboard/wealth/mine/mf"
          className="font-mono text-xs hover:opacity-80 transition-opacity"
          style={{ color: "var(--gold)" }}
        >
          VIEW ALL →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fund</th>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Units</th>
              <th style={{ textAlign: "right" }}>NAV · Date</th>
              <th style={{ textAlign: "right" }}>Value</th>
              <th style={{ textAlign: "right" }}>SIP/mo</th>
            </tr>
          </thead>
          <tbody>
            {mfHoldings.slice(0, 6).map((h) => {
              const navResult = navMap.get(h.schemeCode);
              const nav = navResult?.nav;
              const navDate = navResult?.date;
              const value = nav ? h.units * nav : null;
              return (
                <tr key={h.id}>
                  <td>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {formatMFSchemeName(navResult?.schemeName ?? h.schemeName)}
                    </div>
                    <div
                      className="font-mono text-[10px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h.schemeCode}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${h.category}`}>{h.category}</span>
                  </td>
                  <td
                    className="font-mono text-right text-sm"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {h.units.toLocaleString("en-IN")}
                  </td>
                  <td className="font-mono text-right" style={{ color: "var(--text)" }}>
                    <div className="text-sm font-medium">
                      {nav ? `₹${nav.toFixed(2)}` : "—"}
                    </div>
                    {navDate && (
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {navDate}
                      </div>
                    )}
                  </td>
                  <td
                    className="font-mono text-right text-sm"
                    style={{ color: "var(--gold-l)", fontWeight: 500 }}
                  >
                    {value ? formatINR(value, true) : "—"}
                  </td>
                  <td className="font-mono text-right text-sm" style={{ color: "var(--teal)" }}>
                    {h.sipAmount ? formatINR(h.sipAmount) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
