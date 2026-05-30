"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InsurancePolicy } from "@prisma/client";
import { formatINR } from "@/lib/utils/finance";
import type { InsuranceSummary } from "@/lib/insurance-data";
import type { WealthOwnerSlug } from "@/lib/wealth-config";

type PolicyRow = Omit<
  InsurancePolicy,
  | "startDate"
  | "premiumEndDate"
  | "policyEndDate"
  | "nextPremiumDate"
  | "fundValueAsOf"
> & {
  startDate: Date | string | null;
  premiumEndDate: Date | string | null;
  policyEndDate: Date | string | null;
  nextPremiumDate: Date | string | null;
  fundValueAsOf: Date | string | null;
};

interface InsuranceViewProps {
  policies: PolicyRow[];
  summary: InsuranceSummary;
  owner: WealthOwnerSlug;
  portfolioId: string;
}

const TYPE_ORDER = ["term", "health", "ulip", "endowment", "money_back"] as const;

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  return d instanceof Date ? d : new Date(d);
}

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

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    term: "TERM",
    health: "HEALTH",
    ulip: "ULIP",
    endowment: "ENDOW",
    money_back: "MONEY BACK",
  };
  return labels[type] ?? type.toUpperCase();
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "badge-teal",
    paid_up: "badge-gold",
    lapsed: "badge-red",
    matured: "badge-muted",
    surrendered: "badge-red",
    claimed: "badge-muted",
  };
  return map[status] ?? "badge-muted";
}

function statusLabel(status: string) {
  if (status === "paid_up") return "PAID UP";
  return status.replace("_", " ").toUpperCase();
}

function annualPremium(premium: number | null, freq: string | null) {
  if (!premium) return null;
  const m =
    freq === "monthly" ? 12 : freq === "quarterly" ? 4 : freq === "annual" ? 1 : 1;
  return premium * m;
}

function patchPolicy(id: string, body: Record<string, unknown>) {
  return fetch("/api/holdings/insurance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...body }),
  });
}

function formatShortDate(d: Date | string | null | undefined) {
  const dt = toDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(d: Date | string | null | undefined) {
  const dt = toDate(d);
  if (!dt) return null;
  return Math.ceil((dt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function maturityDuration(days: number) {
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return `${y}y ${m}m`;
}

export function InsuranceView({ policies, summary, owner, portfolioId }: InsuranceViewProps) {
  const router = useRouter();
  const [editFundId, setEditFundId] = useState<string | null>(null);
  const [fundInput, setFundInput] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const investmentPolicies = policies.filter((p) => p.isInvestmentLinked);

  const statCards = [
    {
      label: "Life cover",
      value: formatINR(summary.termSumAssured, true),
      sub: "term + ULIP sum assured",
      color: "var(--blue)",
    },
    {
      label: "Health cover",
      value: formatINR(summary.healthSumInsured, true),
      sub: "total sum insured",
      color: "var(--teal)",
    },
    {
      label: "Investment value",
      value: formatINR(summary.investmentFundValue, true),
      sub: "ULIP + endowment funds",
      color: "var(--gold-l)",
    },
    {
      label: "Annual outflow",
      value: formatINR(summary.annualPremiumOutflow, true),
      sub: "total premiums/yr",
      color: "var(--text-dim)",
    },
  ];

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: policies.filter((p) => p.type === type),
  })).filter((g) => g.rows.length > 0);

  const saveFundValue = async (id: string) => {
    const val = parseFloat(fundInput);
    if (Number.isNaN(val) || val < 0) return;
    setSaving(id);
    await patchPolicy(id, {
      currentFundValue: val,
      fundValueAsOf: new Date().toISOString(),
    });
    setSaving(null);
    setEditFundId(null);
    refresh();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {statCards.map((stat, i) => (
          <div
            key={stat.label}
            className={`card animate-slide-up stagger-${i + 1}`}
            style={{ padding: "14px 16px" }}
          >
            <div className="stat-label mb-2">{stat.label}</div>
            <div
              className="font-mono text-base font-medium whitespace-nowrap lg:text-xl"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
            <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {summary.renewalsSoon.length > 0 && (
        <div className="card animate-slide-up min-w-0" style={{ padding: "16px 20px" }}>
          <div className="stat-label mb-3">Renewals within 90 days</div>
          {summary.renewalsSoon.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div style={{ width: 40, textAlign: "center" }}>
                <div
                  className="font-display text-2xl"
                  style={{ color: "var(--gold)", fontWeight: 600, lineHeight: 1 }}
                >
                  {r.date.getDate()}
                </div>
                <div className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                  {r.date.toLocaleString("en-IN", { month: "short" })}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                  {r.planName}
                </div>
                <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  {r.insurer}
                </div>
              </div>
              <div className="font-mono text-sm font-medium" style={{ color: "var(--teal)" }}>
                {formatINR(r.premium)}
              </div>
              <span
                className={`badge ${r.daysLeft <= 30 ? "badge-red" : r.daysLeft <= 60 ? "badge-gold" : "badge-muted"}`}
              >
                {r.daysLeft <= 30 ? "DUE SOON · " : ""}
                {r.daysLeft}d
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card animate-slide-up min-w-0 overflow-hidden">
        <div
          className="px-4 py-3 sm:px-6 sm:py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="stat-label mb-0.5">Policies</div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {policies.length} policies · {owner === "mine" ? "My portfolio" : "Mother's portfolio"}
          </div>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Insurer</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Sum assured</th>
                <th style={{ textAlign: "right" }}>Premium/yr</th>
                <th style={{ textAlign: "right" }}>Fund value</th>
                <th>Maturity</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <Fragment key={group.type}>
                  <tr>
                    <td
                      colSpan={7}
                      className="font-mono text-[10px] py-2"
                      style={{
                        color: "var(--text-muted)",
                        background: "var(--bg-2)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {typeLabel(group.type)}
                    </td>
                  </tr>
                  {group.rows.map((p) => {
                    const premYr = annualPremium(p.premium, p.premiumFrequency);
                    const endDays = daysUntil(p.policyEndDate);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${typeBadge(p.type)}`}>
                              {typeLabel(p.type)}
                            </span>
                            <div>
                              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                                {p.planName}
                              </div>
                              {p.policyNumber && (
                                <div
                                  className="font-mono text-[10px] mt-0.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {p.policyNumber}
                                </div>
                              )}
                              {p.status === "paid_up" && p.policyEndDate && (
                                <div
                                  className="font-mono text-[9px] mt-0.5"
                                  style={{ color: "var(--gold)" }}
                                >
                                  Premiums complete · matures {formatShortDate(p.policyEndDate)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-sm" style={{ color: "var(--text-dim)" }}>
                          {p.insurer}
                        </td>
                        <td>
                          <span className={`badge ${statusBadge(p.status)}`}>
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td
                          className="font-mono text-right text-sm"
                          style={{ color: "var(--text)" }}
                        >
                          {p.sumAssured ? formatINR(p.sumAssured, true) : "—"}
                        </td>
                        <td
                          className="font-mono text-right text-sm"
                          style={{ color: "var(--teal)" }}
                        >
                          {premYr ? formatINR(premYr, true) : "—"}
                        </td>
                        <td
                          className="font-mono text-right text-sm"
                          style={{ color: "var(--gold-l)" }}
                        >
                          {p.isInvestmentLinked && p.currentFundValue
                            ? formatINR(p.currentFundValue, true)
                            : "—"}
                        </td>
                        <td className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                          {p.policyEndDate ? (
                            <>
                              <div>{formatShortDate(p.policyEndDate)}</div>
                              {endDays != null && endDays > 0 && (
                                <div style={{ color: "var(--text-muted)" }}>{endDays}d left</div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {investmentPolicies.length > 0 && (
        <div className="card animate-slide-up" style={{ padding: "24px" }}>
          <div className="stat-label mb-4">Investment-linked tracker</div>
          {investmentPolicies.map((p) => {
            const gain =
              p.currentFundValue && p.totalPremiumPaid
                ? ((p.currentFundValue - p.totalPremiumPaid) / p.totalPremiumPaid) * 100
                : null;
            const daysToMaturity = daysUntil(p.policyEndDate);
            const isEditing = editFundId === p.id;

            return (
              <div
                key={p.id}
                className="rounded-xl p-4 mb-3 last:mb-0"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border-gold)" }}
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div>
                    <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                      {p.planName}
                    </div>
                    <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                      {p.insurer}
                      {p.policyNumber ? ` · ${p.policyNumber}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <div className="stat-label mb-1">Invested</div>
                    <div className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                      {formatINR(p.totalPremiumPaid ?? 0, true)}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label mb-1">Fund value</div>
                    <div
                      className="font-mono text-sm font-medium"
                      style={{ color: "var(--gold-l)" }}
                    >
                      {p.currentFundValue ? formatINR(p.currentFundValue, true) : "—"}
                    </div>
                    {p.fundValueAsOf && (
                      <div
                        className="font-mono text-[9px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        as of {formatShortDate(p.fundValueAsOf)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="stat-label mb-1">Gain</div>
                    <div
                      className="font-mono text-sm"
                      style={{
                        color:
                          gain === null
                            ? "var(--text-muted)"
                            : gain >= 0
                              ? "var(--teal)"
                              : "var(--red)",
                      }}
                    >
                      {gain !== null ? `${gain >= 0 ? "+" : ""}${gain.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label mb-1">Matures in</div>
                    <div className="font-mono text-sm" style={{ color: "var(--text)" }}>
                      {daysToMaturity != null && daysToMaturity > 0
                        ? maturityDuration(daysToMaturity)
                        : "—"}
                    </div>
                    {p.policyEndDate && (
                      <div
                        className="font-mono text-[9px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatShortDate(p.policyEndDate)}
                      </div>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      className="input-field font-mono text-sm w-40"
                      value={fundInput}
                      onChange={(e) => setFundInput(e.target.value)}
                      placeholder="Fund value ₹"
                    />
                    <button
                      type="button"
                      onClick={() => saveFundValue(p.id)}
                      disabled={saving === p.id}
                      className="font-mono text-xs px-3 py-1.5 rounded-md"
                      style={{
                        background: "rgba(201,168,76,0.15)",
                        color: "var(--gold-l)",
                        border: "1px solid rgba(201,168,76,0.3)",
                      }}
                    >
                      {saving === p.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditFundId(null)}
                      className="font-mono text-xs"
                      style={{ color: "var(--text-muted)", background: "none", border: "none" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditFundId(p.id);
                      setFundInput(String(p.currentFundValue ?? ""));
                    }}
                    className="mt-3 font-mono text-xs"
                    style={{
                      color: "var(--gold)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    ↺ Update fund value
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <input type="hidden" name="portfolioId" value={portfolioId} />
    </div>
  );
}
