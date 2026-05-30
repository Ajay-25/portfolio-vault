import type { HistoryChartPoint } from "@/components/dashboard/history-chart";

type SnapshotRow = {
  date: Date;
  totalValue: number;
  portfolio: { type: string };
};

export function buildHistoryChartData(snapshots: SnapshotRow[]): HistoryChartPoint[] {
  const byDate = new Map<
    string,
    { date: Date; primary: number | null; mother: number | null }
  >();

  for (const s of snapshots) {
    const key = s.date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? {
      date: s.date,
      primary: null,
      mother: null,
    };

    if (s.portfolio.type === "primary") entry.primary = s.totalValue;
    if (s.portfolio.type === "secondary") entry.mother = s.totalValue;

    byDate.set(key, entry);
  }

  return [...byDate.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      label: row.date.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      }),
      primary: row.primary !== null ? row.primary / 100000 : null,
      mother: row.mother !== null ? row.mother / 100000 : null,
      combined: ((row.primary ?? 0) + (row.mother ?? 0)) / 100000,
    }));
}
