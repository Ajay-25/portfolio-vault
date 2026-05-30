import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils/finance";
import { HistoryChart } from "@/components/dashboard/history-chart";
import { buildHistoryChartData } from "@/lib/history-chart";

/** Heavy: full snapshot history + chart aggregation */
export async function HistoryDataContent() {
  const [snapshots, chartSnapshots] = await Promise.all([
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
    <>
      {chartData.length > 0 && <HistoryChart data={chartData} />}

      {Object.entries(grouped).map(([month, entries]) => (
        <div key={month} className="card">
          <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div
              className="font-mono text-xs tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {new Date(month + "-01").toLocaleString("en-IN", {
                month: "long",
                year: "numeric",
              })}
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
                const gain =
                  s.totalInvested > 0
                    ? ((s.totalValue - s.totalInvested) / s.totalInvested) * 100
                    : null;
                return (
                  <tr key={s.id}>
                    <td className="text-sm" style={{ color: "var(--text)" }}>
                      {s.portfolio.name}
                    </td>
                    <td className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                      {s.date.toLocaleDateString("en-IN")}
                    </td>
                    <td
                      className="font-mono text-right text-sm font-medium"
                      style={{ color: "var(--gold-l)" }}
                    >
                      {formatINR(s.totalValue, true)}
                    </td>
                    <td className="font-mono text-right text-sm" style={{ color: "var(--text-dim)" }}>
                      {formatINR(s.totalInvested, true)}
                    </td>
                    <td
                      className="font-mono text-right text-sm"
                      style={{
                        color:
                          gain === null
                            ? "var(--text-muted)"
                            : gain >= 0
                              ? "var(--teal)"
                              : "var(--red)",
                      }}
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
        <div className="card text-center py-16" style={{ color: "var(--text-muted)" }}>
          <div className="font-mono text-3xl mb-3">◷</div>
          <div className="text-sm">No history yet. Log your first monthly snapshot above.</div>
        </div>
      )}
    </>
  );
}
