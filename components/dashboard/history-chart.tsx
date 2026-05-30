"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/utils/finance";

export type HistoryChartPoint = {
  date: string;
  label: string;
  primary: number | null;
  mother: number | null;
  combined: number;
};

interface HistoryChartProps {
  data: HistoryChartPoint[];
}

export function HistoryChart({ data }: HistoryChartProps) {
  if (data.length === 0) return null;

  return (
    <div className="card animate-slide-up" style={{ padding: "24px" }}>
      <div className="stat-label mb-1">Portfolio Value Over Time</div>
      <div className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
        Monthly snapshots · values in ₹L
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}L`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                formatINR(value * 100000, true),
                name,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-dim)" }} />
            <Line
              type="monotone"
              dataKey="combined"
              name="Combined"
              stroke="var(--gold-l)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="primary"
              name="My Portfolio"
              stroke="var(--blue)"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="mother"
              name="Mother's"
              stroke="var(--purple)"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
