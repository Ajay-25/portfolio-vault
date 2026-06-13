"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HomeProject } from "@/lib/project-data";
import type { computeProjectStats } from "@/lib/project-data";
import { computeBuilderPaymentStats } from "@/lib/project-data";
import { formatINR } from "@/lib/utils/finance";
import { StatCard } from "@/components/dashboard/fi/shared";
import { TransactionModal } from "@/components/projects/transaction-modal";

type Stats = ReturnType<typeof computeProjectStats>;
type Tab = "overview" | "expenses" | "streams" | "builder" | "payers" | "deductions";

type ProjectTxn = HomeProject["transactions"][number] | HomeProject["workStreams"][number]["transactions"][number];

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",   label: "Overview" },
  { id: "expenses",   label: "All expenses" },
  { id: "streams",    label: "Work streams" },
  { id: "builder",    label: "Builder payments" },
  { id: "payers",     label: "Payers & settlements" },
  { id: "deductions", label: "Builder deductions" },
];

const STREAM_COLORS = [
  "var(--gold)",
  "var(--blue)",
  "var(--purple)",
  "var(--teal)",
  "var(--orange)",
  "var(--red)",
  "rgba(201,168,76,0.6)",
  "var(--text-dim)",
  "rgba(29,158,117,0.7)",
  "rgba(120,140,200,0.8)",
];

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash:         "CASH",
  upi:          "UPI",
  neft:         "NEFT",
  rtgs:         "RTGS",
  credit_card:  "CARD",
  cheque:       "CHEQUE",
  netbanking:   "NETBANK",
};

export function ProjectDashboard({
  project,
  stats,
}: {
  project: HomeProject;
  stats:   Stats;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const builderStats = computeBuilderPaymentStats(project);
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [txnModal, setTxnModal] = useState<{
    workStreamId?: string;
    lineItemId?:   string;
  } | null>(null);

  const toggleStream = (id: string) => {
    setExpandedStreams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const patchTxn = async (id: string, data: Record<string, unknown>) => {
    await fetch(`/api/projects/${project.id}/transactions`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, ...data }),
    });
    router.refresh();
  };

  const patchDeduction = async (id: string, data: Record<string, unknown>) => {
    await fetch(`/api/projects/${project.id}/deductions`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, ...data }),
    });
    router.refresh();
  };

  const recordRepayment = async (payerId: string, payerName: string) => {
    const raw = window.prompt(`Repayment amount to ${payerName} (₹):`);
    if (!raw) return;
    const amount = Number(raw);
    if (!amount || amount <= 0) return;
    await fetch(`/api/projects/${project.id}/transactions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        description:    `Repayment to ${payerName}`,
        amount,
        date:           new Date().toISOString(),
        direction:      "refund",
        paidByPayerId:  payerId,
        settlementType: "repayable",
        phase:          "full",
        paymentMode:    "upi",
      }),
    });
    router.refresh();
  };

  return (
    <main className="min-w-0 space-y-5 p-4 md:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total spent"
          value={formatINR(stats.totalSpent, true)}
          sub={`${project.transactions.length} transactions`}
        />
        <StatCard
          label="Own money spent"
          value={formatINR(stats.ownSpend, true)}
          sub="self-funded outflows"
        />
        <StatCard
          label="Owed to others"
          value={formatINR(stats.totalOwed, true)}
          sub={`${stats.payerBalances.filter((p) => p.owedBack > 0).length} payers with balance`}
          urgent={stats.totalOwed > 0}
        />
        <StatCard
          label="Builder deductions (est.)"
          value={formatINR(stats.deductionEstimate, true)}
          sub={`${stats.deductionPending} pending confirmation`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all font-mono"
            style={{
              background: tab === id ? "rgba(201,168,76,0.08)" : "var(--bg-2)",
              border:     `1px solid ${tab === id ? "rgba(201,168,76,0.3)" : "var(--border)"}`,
              color:      tab === id ? "var(--gold-l)" : "var(--text-dim)",
              fontSize:   "12px",
            }}
          >
            <span style={{ fontSize: 14 }}>◈</span>
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setTxnModal({})}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono"
          style={{ background: "var(--gold)", color: "#111", fontSize: "12px" }}
        >
          + Add transaction
        </button>
      </div>

      {tab === "overview" && (
        <div className="space-y-5 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {stats.streamTotals
              .filter((s) => s.total > 0 || s.lineItemCount > 0)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setTab("streams");
                    setExpandedStreams(new Set([s.id]));
                  }}
                  className="card text-left p-4 hover:border-gold-500 transition-colors"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                      {s.name}
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="font-display text-lg font-semibold" style={{ color: "var(--gold-l)" }}>
                    {formatINR(s.total, true)}
                  </div>
                  <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {s.txnCount} transactions across {s.lineItemCount} items
                  </div>
                </button>
              ))}
          </div>

          {stats.totalSpent > 0 && (
            <div className="card p-5">
              <div className="stat-label mb-3">Spend by work stream</div>
              <div className="flex rounded-lg overflow-hidden h-3 gap-0.5">
                {stats.streamTotals
                  .filter((s) => s.total > 0)
                  .map((s, i) => (
                    <div
                      key={s.id}
                      title={`${s.name}: ${formatINR(s.total, true)}`}
                      style={{
                        width:      `${(s.total / stats.totalSpent) * 100}%`,
                        background: STREAM_COLORS[i % STREAM_COLORS.length],
                        minWidth:   s.total > 0 ? "4px" : 0,
                      }}
                    />
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {stats.streamTotals
                  .filter((s) => s.total > 0)
                  .map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{ background: STREAM_COLORS[i % STREAM_COLORS.length] }}
                      />
                      <div className="font-mono text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {s.name} · {formatINR(s.total, true)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "expenses" && (
        <div className="animate-slide-up">
          <ExpensesTable
            transactions={project.transactions}
            payers={project.payers}
            workStreams={project.workStreams}
            onSettlementToggle={(id, settlementType) => patchTxn(id, { settlementType })}
          />
        </div>
      )}

      {tab === "builder" && (
        <div className="space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Builder payments total"
              value={formatINR(builderStats.totalPaid, true)}
              sub={`${builderStats.transactions.length} payments logged`}
            />
            {builderStats.byStream.map((s) => (
              <StatCard
                key={s.id}
                label={s.name}
                value={formatINR(s.paid, true)}
                sub={`${s.txnCount} payment${s.txnCount === 1 ? "" : "s"}`}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setTxnModal({ workStreamId: "ws-flat" })}
              className="font-mono text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--gold)", color: "#111" }}
            >
              + Add builder payment
            </button>
          </div>

          <ExpensesTable
            transactions={builderStats.transactions}
            payers={project.payers}
            workStreams={project.workStreams}
            onSettlementToggle={(id, settlementType) => patchTxn(id, { settlementType })}
            emptyMessage="No builder payments logged yet — flat purchase, home loan, and purchase fees."
          />
        </div>
      )}

      {tab === "streams" && (
        <div className="space-y-3 animate-slide-up">
          <div className="flex justify-end">
            <button
              type="button"
              className="font-mono text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "var(--bg-2)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
              onClick={async () => {
                const name = window.prompt("Work stream name:");
                if (!name?.trim()) return;
                await fetch(`/api/projects/${project.id}/workstreams`, {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ name: name.trim(), sortOrder: project.workStreams.length + 1 }),
                });
                router.refresh();
              }}
            >
              + Add work stream
            </button>
          </div>

          {project.workStreams.map((ws) => (
            <div key={ws.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleStream(ws.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
                style={{ borderBottom: expandedStreams.has(ws.id) ? "1px solid var(--border)" : undefined }}
              >
                <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  {expandedStreams.has(ws.id) ? "▼" : "▶"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{ws.name}</div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {ws.lineItems.length} items · {formatINR(
                      ws.transactions.filter((t) => t.direction === "outflow").reduce((s, t) => s + t.amount, 0),
                      true,
                    )}
                  </div>
                </div>
                <StatusBadge status={ws.status} />
              </button>

              {expandedStreams.has(ws.id) && (
                <div className="p-4 space-y-3" style={{ background: "var(--bg-2)" }}>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="font-mono text-[10px] px-2 py-1 rounded"
                      style={{ color: "var(--gold-l)", border: "1px solid rgba(201,168,76,0.3)" }}
                      onClick={() => setTxnModal({ workStreamId: ws.id })}
                    >
                      + Add transaction
                    </button>
                    <button
                      type="button"
                      className="font-mono text-[10px] px-2 py-1 rounded"
                      style={{ color: "var(--text-dim)", border: "1px solid var(--border)" }}
                      onClick={async () => {
                        const name = window.prompt("Line item name:");
                        if (!name?.trim()) return;
                        await fetch(`/api/projects/${project.id}/lineitems`, {
                          method:  "POST",
                          headers: { "Content-Type": "application/json" },
                          body:    JSON.stringify({ workStreamId: ws.id, name: name.trim() }),
                        });
                        router.refresh();
                      }}
                    >
                      + Add line item
                    </button>
                  </div>

                  {ws.lineItems.map((li) => (
                    <div key={li.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      <button
                        type="button"
                        onClick={() => toggleItem(li.id)}
                        className="w-full flex items-center gap-2 p-3 text-left"
                        style={{ background: "var(--bg-1)" }}
                      >
                        <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {expandedItems.has(li.id) ? "▼" : "▶"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm" style={{ color: "var(--text)" }}>{li.name}</div>
                          {li.vendor && (
                            <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {li.vendor}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={li.status} />
                      </button>

                      {expandedItems.has(li.id) && (
                        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                          {li.transactions.length === 0 && (
                            <div className="p-3 font-mono text-xs text-center" style={{ color: "var(--text-muted)" }}>
                              No transactions yet
                            </div>
                          )}
                          {li.transactions.map((t) => (
                            <TransactionRow
                              key={t.id}
                              txn={t}
                              payers={project.payers}
                              onSettlementToggle={(settlementType) =>
                                patchTxn(t.id, { settlementType })
                              }
                            />
                          ))}
                          <div className="p-2">
                            <button
                              type="button"
                              className="font-mono text-[10px] w-full py-1.5 rounded"
                              style={{ color: "var(--gold-l)" }}
                              onClick={() => setTxnModal({ workStreamId: ws.id, lineItemId: li.id })}
                            >
                              + Add transaction
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {ws.transactions.filter((t) => !t.lineItemId).length > 0 && (
                    <div>
                      <div className="stat-label mb-2">Stream-level transactions</div>
                      <div className="divide-y rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        {ws.transactions
                          .filter((t) => !t.lineItemId)
                          .map((t) => (
                            <TransactionRow
                              key={t.id}
                              txn={t}
                              payers={project.payers}
                              onSettlementToggle={(settlementType) =>
                                patchTxn(t.id, { settlementType })
                              }
                            />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "payers" && (
        <div className="space-y-4 animate-slide-up">
          {project.payers
            .filter((p) => !p.isSelf)
            .map((payer) => {
              const balance = stats.payerBalances.find((b) => b.id === payer.id);
              return (
                <div key={payer.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="font-medium" style={{ color: "var(--text)" }}>{payer.name}</div>
                      {payer.relationship && (
                        <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {payer.relationship.replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="stat-label mb-1">Owe back</div>
                      <div
                        className="font-display text-xl font-semibold"
                        style={{ color: (balance?.owedBack ?? 0) > 0 ? "var(--orange)" : "var(--teal)" }}
                      >
                        {formatINR(balance?.owedBack ?? 0, true)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <div className="stat-label mb-1">Total paid</div>
                      <div className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                        {formatINR(balance?.totalPaid ?? 0, true)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label mb-1">Repayable</div>
                      <div className="font-mono text-sm" style={{ color: "var(--orange)" }}>
                        {formatINR(balance?.owedBack ?? 0, true)}
                      </div>
                    </div>
                    <div>
                      <div className="stat-label mb-1">Gift</div>
                      <div className="font-mono text-sm" style={{ color: "var(--teal)" }}>
                        {formatINR(balance?.gifted ?? 0, true)}
                      </div>
                    </div>
                  </div>

                  {(balance?.owedBack ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => recordRepayment(payer.id, payer.name)}
                      className="mb-4 font-mono text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(201,168,76,0.1)", color: "var(--gold-l)", border: "1px solid rgba(201,168,76,0.3)" }}
                    >
                      Record repayment
                    </button>
                  )}

                  <div className="divide-y rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {payer.transactions.map((t) => (
                      <TransactionRow
                        key={t.id}
                        txn={t}
                        payers={project.payers}
                        showSettlementToggle
                        onSettlementToggle={(settlementType) =>
                          patchTxn(t.id, { settlementType })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}

          {project.payers.some((p) => p.advances.length > 0) && (
            <div className="card p-5">
              <div className="stat-label mb-3">Cash advances</div>
              {project.payers.flatMap((p) =>
                p.advances.map((adv) => {
                  const drawn = adv.transactions
                    .filter((t) => t.direction === "outflow")
                    .reduce((s, t) => s + t.amount, 0);
                  const remaining = adv.totalGiven - drawn;
                  return (
                    <div key={adv.id} className="py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{adv.label}</div>
                      <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                        Held by {p.name} · Given {formatINR(adv.totalGiven, true)} · Drawn {formatINR(drawn, true)} · Remaining {formatINR(remaining, true)}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          )}
        </div>
      )}

      {tab === "deductions" && (
        <div className="space-y-4 animate-slide-up">
          <div
            className="card p-4"
            style={{ borderColor: "rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.05)" }}
          >
            <div className="font-medium text-sm" style={{ color: "var(--gold-l)" }}>
              When making final builder payment, deduct ~{formatINR(stats.deductionEstimate, true)}
            </div>
            {stats.deductionConfirmed > 0 && (
              <div className="font-mono text-xs mt-1" style={{ color: "var(--teal)" }}>
                Confirmed so far: {formatINR(stats.deductionConfirmed, true)}
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Item", "Reason", "You paid", "Est. deduction", "Confirmed", "Status"].map((h) => (
                    <th key={h} className="text-left py-3 px-3 stat-label font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.deductions.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-3 px-3" style={{ color: "var(--text)" }}>{d.item}</td>
                    <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                      {d.reason ?? "—"}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      {d.selfPaidAmount != null ? formatINR(d.selfPaidAmount, true) : "—"}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs" style={{ color: "var(--gold-l)" }}>
                      {formatINR(d.isConfirmed && d.confirmedAmount != null ? d.confirmedAmount : d.estimatedAmount, true)}
                    </td>
                    <td className="py-3 px-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={d.isConfirmed}
                          onChange={(e) => {
                            const isConfirmed = e.target.checked;
                            const confirmedAmount = isConfirmed
                              ? (d.confirmedAmount ?? d.estimatedAmount)
                              : null;
                            patchDeduction(d.id, { isConfirmed, confirmedAmount, status: isConfirmed ? "confirmed" : "pending" });
                          }}
                        />
                        {d.isConfirmed && (
                          <input
                            type="number"
                            className="w-24 px-2 py-1 rounded font-mono text-xs"
                            style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                            defaultValue={d.confirmedAmount ?? d.estimatedAmount}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val > 0) patchDeduction(d.id, { confirmedAmount: val, isConfirmed: true, status: "confirmed" });
                            }}
                          />
                        )}
                      </label>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`badge ${d.isConfirmed ? "badge-teal" : "badge-amber"}`}>
                        {d.isConfirmed ? "confirmed" : d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
            Estimated total to deduct: {formatINR(stats.deductionEstimate, true)}
          </div>
        </div>
      )}

      {txnModal && (
        <TransactionModal
          project={project}
          workStreamId={txnModal.workStreamId}
          lineItemId={txnModal.lineItemId}
          onClose={() => setTxnModal(null)}
        />
      )}
    </main>
  );
}

function ExpensesTable({
  transactions,
  payers,
  workStreams,
  onSettlementToggle,
  emptyMessage = "No expenses logged yet.",
}: {
  transactions:        HomeProject["transactions"];
  payers:                HomeProject["payers"];
  workStreams:           HomeProject["workStreams"];
  onSettlementToggle?:  (id: string, settlementType: string) => void;
  emptyMessage?:         string;
}) {
  const streamMap = new Map(workStreams.map((ws) => [ws.id, ws.name]));

  if (transactions.length === 0) {
    return (
      <div className="card p-8 text-center font-mono text-sm" style={{ color: "var(--text-dim)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Date", "Description", "Stream", "Amount", "Paid by", "Mode", "Phase", "Settlement"].map((h) => (
              <th key={h} className="text-left py-3 px-3 stat-label font-normal whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((t) => {
              const payer = payers.find((p) => p.id === t.paidByPayerId);
              const isRefund = t.direction === "refund";
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2.5 px-3 font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-dim)" }}>
                    {new Date(t.date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-2.5 px-3" style={{ color: "var(--text)" }}>
                    {t.description}
                    {isRefund && (
                      <span className="ml-2 badge badge-teal font-mono text-[9px]">repayment</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                    {t.workStreamId ? streamMap.get(t.workStreamId) ?? "—" : "—"}
                  </td>
                  <td
                    className="py-2.5 px-3 font-mono text-xs font-medium whitespace-nowrap"
                    style={{ color: isRefund ? "var(--teal)" : "var(--text)" }}
                  >
                    {isRefund ? "−" : ""}{formatINR(t.amount, true)}
                  </td>
                  <td className="py-2.5 px-3">
                    {payer ? (
                      <span className="badge badge-blue font-mono text-[10px]">{payer.name}</span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    {t.paymentMode ? (
                      <span
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-3)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                      >
                        {PAYMENT_MODE_LABELS[t.paymentMode] ?? t.paymentMode.toUpperCase()}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <PhaseBadge phase={t.phase} />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <SettlementBadge type={t.settlementType} />
                      {onSettlementToggle && !payer?.isSelf && t.direction === "outflow" && (
                        <select
                          className="font-mono text-[10px] px-1 py-0.5 rounded"
                          style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
                          value={t.settlementType}
                          onChange={(e) => onSettlementToggle(t.id, e.target.value)}
                        >
                          <option value="repayable">Repayable</option>
                          <option value="gift">Gift</option>
                        </select>
                      )}
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

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed" ? "badge-teal"
    : status === "pending" ? "badge-amber"
    : status === "on_hold" ? "badge-muted"
    : "badge-blue";
  return <span className={`badge ${cls} font-mono text-[10px]`}>{status.replace(/_/g, " ")}</span>;
}

function SettlementBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    self:      "badge-muted",
    repayable: "badge-amber",
    gift:      "badge-teal",
  };
  const labels: Record<string, string> = {
    self:      "Own",
    repayable: "Owe back",
    gift:      "Gift",
  };
  return <span className={`badge ${map[type] ?? "badge-muted"} font-mono text-[10px]`}>{labels[type] ?? type}</span>;
}

function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, string> = {
    advance: "badge-blue",
    part:    "badge-purple",
    final:   "badge-teal",
    full:    "badge-muted",
  };
  return <span className={`badge ${map[phase] ?? "badge-muted"} font-mono text-[10px]`}>{phase}</span>;
}

function TransactionRow({
  txn,
  payers,
  showSettlementToggle,
  onSettlementToggle,
}: {
  txn:                  ProjectTxn;
  payers:               HomeProject["payers"];
  showSettlementToggle?: boolean;
  onSettlementToggle?:  (type: string) => void;
}) {
  const payer = payers.find((p) => p.id === txn.paidByPayerId);
  const isRefund = txn.direction === "refund";

  return (
    <div className="flex flex-wrap items-center gap-2 p-3" style={{ background: "var(--bg-1)" }}>
      <div className="flex-1 min-w-[180px]">
        <div className="text-sm" style={{ color: "var(--text)" }}>{txn.description}</div>
        <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {new Date(txn.date).toLocaleDateString("en-IN")}
          {isRefund && " · repayment"}
        </div>
      </div>
      <div
        className="font-mono text-sm font-medium"
        style={{ color: isRefund ? "var(--teal)" : "var(--text)" }}
      >
        {isRefund ? "−" : ""}{formatINR(txn.amount, true)}
      </div>
      {payer && (
        <span className="badge badge-blue font-mono text-[10px]">{payer.name}</span>
      )}
      {txn.paymentMode && (
        <span
          className="font-mono text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: "var(--bg-3)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
        >
          {PAYMENT_MODE_LABELS[txn.paymentMode] ?? txn.paymentMode.toUpperCase()}
        </span>
      )}
      <PhaseBadge phase={txn.phase} />
      <SettlementBadge type={txn.settlementType} />
      {showSettlementToggle && !payer?.isSelf && txn.direction === "outflow" && onSettlementToggle && (
        <select
          className="font-mono text-[10px] px-1 py-0.5 rounded"
          style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
          value={txn.settlementType}
          onChange={(e) => onSettlementToggle(e.target.value)}
        >
          <option value="repayable">Repayable</option>
          <option value="gift">Gift</option>
        </select>
      )}
    </div>
  );
}

