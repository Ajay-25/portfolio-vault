import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getInsuranceSummary } from "@/lib/insurance-data";
import { TopBar } from "@/components/layout/top-bar";
import { formatINR } from "@/lib/utils/finance";
import { WEALTH_OWNERS } from "@/lib/wealth-config";

export const revalidate = 0;

function typeBadge(type: string) {
  const map: Record<string, string> = {
    term: "badge-blue",
    health: "badge-teal",
    ulip: "badge-gold",
    endowment: "badge-purple",
    money_back: "badge-purple",
  };
  return map[type] ?? "badge-muted";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "badge-teal",
    paid_up: "badge-gold",
    lapsed: "badge-red",
    matured: "badge-muted",
    surrendered: "badge-red",
  };
  return map[status] ?? "badge-muted";
}

export default async function InsuranceOverviewPage() {
  const [mineSummary, momSummary, allPolicies] = await Promise.all([
    getInsuranceSummary(WEALTH_OWNERS.mine.portfolioId),
    getInsuranceSummary(WEALTH_OWNERS.mother.portfolioId),
    prisma.insurancePolicy.findMany({
      include: { portfolio: { select: { name: true, type: true } } },
      orderBy: [{ type: "asc" }, { nextPremiumDate: "asc" }],
    }),
  ]);

  const totalLifeCover = mineSummary.termSumAssured + momSummary.termSumAssured;
  const totalHealthCover = mineSummary.healthSumInsured + momSummary.healthSumInsured;
  const totalFundValue = mineSummary.investmentFundValue + momSummary.investmentFundValue;
  const totalPremiums = mineSummary.annualPremiumOutflow + momSummary.annualPremiumOutflow;

  const allRenewals = [
    ...mineSummary.renewalsSoon.map((r) => ({ ...r, person: "Mine" })),
    ...momSummary.renewalsSoon.map((r) => ({ ...r, person: "Mother" })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);

  const byPerson = [
    { label: WEALTH_OWNERS.mine.label, type: "primary", policies: allPolicies.filter((p) => p.portfolio.type === "primary") },
    { label: WEALTH_OWNERS.mother.label, type: "secondary", policies: allPolicies.filter((p) => p.portfolio.type === "secondary") },
  ];

  const statCards = [
    { label: "Household life cover", value: formatINR(totalLifeCover, true), color: "var(--blue)" },
    { label: "Household health cover", value: formatINR(totalHealthCover, true), color: "var(--teal)" },
    { label: "Investment funds", value: formatINR(totalFundValue, true), color: "var(--gold-l)" },
    { label: "Annual premiums", value: formatINR(totalPremiums, true), color: "var(--text-dim)" },
  ];

  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title="Household · Insurance overview" />
      <main className="p-4 md:p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
              <div className="stat-label mb-2">{s.label}</div>
              <div className="font-mono text-lg font-medium" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {allRenewals.length > 0 && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div className="stat-label mb-3">Upcoming renewals (90 days)</div>
            {allRenewals.map((r) => (
              <div
                key={`${r.person}-${r.id}`}
                className="flex items-center gap-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span className="badge badge-muted font-mono text-[10px]">{r.person}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {r.planName}
                  </div>
                  <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                    {r.insurer}
                  </div>
                </div>
                <div className="font-mono text-sm" style={{ color: "var(--teal)" }}>
                  {formatINR(r.premium)}
                </div>
                <span
                  className={`badge ${r.daysLeft <= 30 ? "badge-red" : r.daysLeft <= 60 ? "badge-gold" : "badge-muted"}`}
                >
                  {r.daysLeft}d
                </span>
              </div>
            ))}
          </div>
        )}

        {byPerson.map((group) => (
          <div key={group.type} className="card overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 sm:px-6"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <div className="stat-label mb-0.5">{group.label}</div>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {group.policies.length} policies
                </div>
              </div>
              <Link
                href={`/dashboard/wealth/${group.type === "primary" ? "mine" : "mother"}/insurance`}
                className="font-mono text-xs"
                style={{ color: "var(--gold)" }}
              >
                VIEW →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Plan</th>
                    <th>Insurer</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Sum assured</th>
                    <th style={{ textAlign: "right" }}>Fund value</th>
                    <th>Next premium</th>
                  </tr>
                </thead>
                <tbody>
                  {group.policies.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className={`badge ${typeBadge(p.type)}`}>{p.type.toUpperCase()}</span>
                      </td>
                      <td className="text-sm font-medium" style={{ color: "var(--text)" }}>
                        {p.planName}
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{p.insurer}</td>
                      <td>
                        <span className={`badge ${statusBadge(p.status)}`}>
                          {p.status === "paid_up" ? "PAID UP" : p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="font-mono text-right text-sm">
                        {p.sumAssured ? formatINR(p.sumAssured, true) : "—"}
                      </td>
                      <td className="font-mono text-right text-sm" style={{ color: "var(--gold-l)" }}>
                        {p.isInvestmentLinked && p.currentFundValue
                          ? formatINR(p.currentFundValue, true)
                          : "—"}
                      </td>
                      <td className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                        {p.nextPremiumDate
                          ? p.nextPremiumDate.toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
