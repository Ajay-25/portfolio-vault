import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils/finance";
import { TopBar } from "@/components/layout/top-bar";
import { HistoryChart } from "@/components/dashboard/history-chart";
import { buildHistoryChartData } from "@/lib/history-chart";

export const revalidate = 0;

export default async function HistoryPage() {
  const [portfolios, snapshots, chartSnapshots] = await Promise.all([
    prisma.portfolio.findMany({ select: { id: true, name: true, type: true } }),
    prisma.snapshot.findMany({
      include: { portfolio: { select: { name: true, type: true } } },
      orderBy: { date: "desc" },
      take: 36,
    }),
    prisma.snapshot.findMany({
      include: { portfolio: { select: { type: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const chartData = buildHistoryChartData(chartSnapshots);

  const grouped = snapshots.reduce<Record<string, typeof snapshots>>((acc, s) => {
    const month = s.date.toISOString().slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(s);
    return acc;
  }, {});

  return (
    <div>
      <TopBar title="Analytics · Portfolio History" />
      <main className="p-6 space-y-5">

        {chartData.length > 0 && <HistoryChart data={chartData} />}

        {/* Log new snapshot */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="stat-label mb-4">Log Monthly Snapshot</div>
          <form action="/api/snapshot" method="POST" className="grid grid-cols-4 gap-4">
            <div>
              <div className="stat-label mb-1.5">Date</div>
              <input
                type="date"
                name="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                className="input-field"
              />
            </div>
            <div>
              <div className="stat-label mb-1.5">Portfolio</div>
              <select name="portfolioId" className="input-field" style={{ fontFamily: "Outfit" }}>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="stat-label mb-1.5">Total Value (₹)</div>
              <input type="number" name="totalValue" placeholder="e.g. 5200000" className="input-field font-mono" />
            </div>
            <div>
              <div className="stat-label mb-1.5">Total Invested (₹)</div>
              <input type="number" name="totalInvested" placeholder="e.g. 4080000" className="input-field font-mono" />
            </div>
            <div className="col-span-4 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--gold)", color: "#111", fontFamily: "IBM Plex Mono" }}
              >
                Save Snapshot
              </button>
            </div>
          </form>
        </div>

        {/* Snapshot history */}
        {Object.entries(grouped).map(([month, entries]) => (
          <div key={month} className="card">
            <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="font-mono text-xs tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                {new Date(month + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" })}
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Portfolio</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Value</th>
                  <th style={{ textAlign: "right" }}>Invested</th>
                  <th style={{ textAlign: "right" }}>Gain %</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((s) => {
                  const gain = s.totalInvested > 0 ? ((s.totalValue - s.totalInvested) / s.totalInvested) * 100 : null;
                  return (
                    <tr key={s.id}>
                      <td className="text-sm" style={{ color: "var(--text)" }}>{s.portfolio.name}</td>
                      <td className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                        {s.date.toLocaleDateString("en-IN")}
                      </td>
                      <td className="font-mono text-right text-sm font-medium" style={{ color: "var(--gold-l)" }}>
                        {formatINR(s.totalValue, true)}
                      </td>
                      <td className="font-mono text-right text-sm" style={{ color: "var(--text-dim)" }}>
                        {formatINR(s.totalInvested, true)}
                      </td>
                      <td
                        className="font-mono text-right text-sm"
                        style={{ color: gain === null ? "var(--text-muted)" : gain >= 0 ? "var(--teal)" : "var(--red)" }}
                      >
                        {gain !== null ? `${gain >= 0 ? "+" : ""}${gain.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {snapshots.length === 0 && (
          <div
            className="card text-center py-16"
            style={{ color: "var(--text-muted)" }}
          >
            <div className="font-mono text-3xl mb-3">◷</div>
            <div className="text-sm">No history yet. Log your first monthly snapshot above.</div>
          </div>
        )}
      </main>
    </div>
  );
}
