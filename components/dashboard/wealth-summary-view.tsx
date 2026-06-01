import Link from "next/link";
import { formatINR } from "@/lib/utils/finance";
import type { WealthSummaryData } from "@/lib/wealth-summary";

interface WealthSummaryViewProps {
  data: WealthSummaryData;
}

function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div className="card animate-slide-up" style={{ padding: "14px 16px" }}>
      <div className="stat-label mb-2">{label}</div>
      <div
        className="font-mono text-base font-medium lg:text-xl"
        style={{ color: valueColor ?? "var(--text)" }}
      >
        {value}
      </div>
      <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {sub}
      </div>
    </div>
  );
}

export function WealthSummaryView({ data }: WealthSummaryViewProps) {
  const gainStr =
    data.gainPct !== null
      ? `${data.gainPct >= 0 ? "+" : ""}${data.gainPct.toFixed(2)}%`
      : "—";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={formatINR(data.total, true)}
          sub="MF + stocks + fixed income"
          valueColor="var(--gold-l)"
        />
        <StatCard
          label="Invested / Gain"
          value={formatINR(data.invested, true)}
          sub={`Gain ${gainStr}`}
          valueColor={
            data.gainPct === null
              ? undefined
              : data.gainPct >= 0
                ? "var(--teal)"
                : "var(--red)"
          }
        />
        <StatCard
          label="Monthly SIP"
          value={formatINR(data.sipTotal, true)}
          sub="active mandates"
        />
        <StatCard
          label="Fixed income"
          value={formatINR(data.fixedIncomeTotal, true)}
          sub={
            data.fixedIncomeTotal > 0
              ? `${data.fixedIncomeRate.toFixed(2)}% avg · ${data.upcomingMaturities[0] ? `next in ${Math.ceil((data.upcomingMaturities[0].maturityDate.getTime() - Date.now()) / 86400000)}d` : "no maturity soon"}`
              : "Not configured"
          }
          valueColor="var(--cyan)"
        />
      </div>

      {data.total > 0 && data.allocationSegments.length > 0 ? (
        <div className="card animate-slide-up stagger-2">
          <div
            className="px-4 py-3 sm:px-6"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="stat-label mb-0.5">Allocation</div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Asset mix
            </div>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <div className="flex rounded-lg overflow-hidden h-2.5 gap-0.5">
              {data.allocationSegments.map((seg, i) => (
                <div
                  key={seg.key}
                  className="transition-all duration-700"
                  style={{
                    width: `${seg.pct}%`,
                    background: seg.color,
                    borderRadius:
                      i === 0
                        ? "3px 0 0 3px"
                        : i === data.allocationSegments.length - 1
                          ? "0 3px 3px 0"
                          : undefined,
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {data.allocationSegments.map((seg) => (
                <Link
                  key={seg.key}
                  href={seg.href}
                  className="flex items-center gap-2 hover:opacity-80"
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ background: seg.color }}
                  />
                  <div>
                    <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {seg.label}
                    </div>
                    <div className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                      {formatINR(seg.value, true)} · {seg.pct.toFixed(1)}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <span className="stat-label w-full mb-1">Quick links</span>
        {data.quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg px-3 py-1.5 font-mono text-xs transition-all"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              color: "var(--gold-l)",
              textDecoration: "none",
            }}
          >
            {link.label} →
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card animate-slide-up" style={{ padding: "20px 24px" }}>
          <div className="stat-label mb-1">Upcoming</div>
          <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
            Maturities & deadlines
          </div>
          {data.upcomingMaturities.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No FD maturities tracked yet. Add fixed-income holdings when available.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.upcomingMaturities.map((m) => (
                <li key={m.label} className="text-sm" style={{ color: "var(--text-dim)" }}>
                  {m.label} · {formatINR(m.principal, true)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card animate-slide-up" style={{ padding: "20px 24px" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="stat-label mb-1">Action items</div>
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Open tasks
              </div>
            </div>
            <Link
              href="/dashboard/actions"
              className="font-mono text-[10px]"
              style={{ color: "var(--gold)" }}
            >
              VIEW ALL →
            </Link>
          </div>
          {data.actionItems.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No pending action items ✓
            </p>
          ) : (
            <div className="space-y-1">
              {data.actionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-2"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      background:
                        item.priority === "high"
                          ? "var(--red)"
                          : item.priority === "medium"
                            ? "var(--gold)"
                            : "var(--text-muted)",
                    }}
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {item.title}
                    </div>
                    {item.description ? (
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
