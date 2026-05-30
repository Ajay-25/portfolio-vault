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
import {
  GOAL_PROJECTION_YEARS,
  GOAL_TARGET_YEAR,
  type GoalTrackerData,
} from "@/lib/goals";

interface GoalTrackerViewProps {
  data: GoalTrackerData;
}

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
    <div
      className="stat-card animate-slide-up"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: valueColor ?? "var(--text)" }}>
        {value}
      </div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function MilestoneRow({
  label,
  eta,
  progressPct,
  accent,
}: {
  label: string;
  eta: string;
  progressPct: number;
  accent?: "gold";
}) {
  const isGold = accent === "gold";

  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1 text-xs">
        <span style={{ color: isGold ? "var(--gold-l)" : "var(--text-dim)" }}>
          {label} milestone
        </span>
        <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
          {eta}
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${progressPct}%`,
            background: isGold
              ? "var(--gold)"
              : "linear-gradient(90deg, var(--blue), var(--cyan))",
          }}
        />
      </div>
      <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
        {progressPct}% of the way there
      </div>
    </div>
  );
}

export function GoalTrackerView({ data }: GoalTrackerViewProps) {
  return (
    <div className="space-y-5">
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))" }}
      >
        <StatCard
          accent="var(--gold)"
          label={`${GOAL_PROJECTION_YEARS}-Year Target`}
          value={formatINR(data.baseTarget, true)}
          sub="Base case 16% CAGR"
          valueColor="var(--gold-l)"
        />
        <StatCard
          accent="var(--teal)"
          label="Bull Case (20%)"
          value={formatINR(data.bullTarget, true)}
          sub="If mid/small delivers"
          valueColor="var(--teal)"
        />
        <StatCard
          accent="var(--red)"
          label="Bear Case (12%)"
          value={formatINR(data.bearTarget, true)}
          sub="Conservative estimate"
          valueColor="var(--red)"
        />
        <StatCard
          accent="var(--blue)"
          label="Time Remaining"
          value={data.yearsRemainingLabel}
          sub={`Target: ${GOAL_TARGET_YEAR}`}
          valueColor="var(--blue)"
        />
        <StatCard
          accent="var(--cyan)"
          label="Mother 10yr Target"
          value={formatINR(data.momTarget, true)}
          sub="Base 15% CAGR"
          valueColor="var(--cyan)"
        />
        <StatCard
          accent="var(--purple)"
          label="Family Combined"
          value={formatINR(data.familyCombined, true)}
          sub={`${GOAL_PROJECTION_YEARS}yr primary + 10yr mom`}
          valueColor="var(--purple)"
        />
      </div>

      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        <div className="card animate-slide-up stagger-2">
          <div
            className="px-[18px] py-[13px] text-[13px] font-semibold"
            style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}
          >
            Your {GOAL_PROJECTION_YEARS}-Year Projection
          </div>
          <div className="px-[18px] py-4">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData}>
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
                    formatter={(value: number, name: string) => [`₹${value}L`, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "var(--text-dim)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bull"
                    name="Bull (20%)"
                    stroke="var(--gold-l)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="base"
                    name="Base (16%)"
                    stroke="var(--teal)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bear"
                    name="Bear (12%)"
                    stroke="var(--orange)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div
              className="mt-3 font-mono text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              Corpus {formatINR(data.corpus, true)} · SIP {formatINR(data.monthlySip, true)}/mo
            </div>
          </div>
        </div>

        <div className="card animate-slide-up stagger-3">
          <div
            className="px-[18px] py-[13px] text-[13px] font-semibold"
            style={{ borderBottom: "1px solid var(--border)", color: "var(--text)" }}
          >
            Progress to Target
          </div>
          <div className="px-[18px] py-4">
            {data.milestones.map((m) => (
              <MilestoneRow
                key={m.label}
                label={m.label}
                eta={m.eta}
                progressPct={m.progressPct}
                accent={m.accent}
              />
            ))}

            <div
              className="mt-3.5 px-3 py-3 rounded-lg"
              style={{
                background: "rgba(201,168,76,0.06)",
                border: "1px solid rgba(201,168,76,0.15)",
              }}
            >
              <div
                className="font-mono text-[11px] mb-1"
                style={{ color: "var(--gold)" }}
              >
                DISCIPLINE RULES
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                +10% SIP every April · Lumpsum on 30% crashes · Review annually · No
                new funds · SIP never stops
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
