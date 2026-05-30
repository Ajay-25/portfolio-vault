"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINR } from "@/lib/utils/finance";
import {
  FIXED_INCOME_TYPES,
  type FixedIncomePageData,
  type FixedIncomeRow,
  type FixedIncomeType,
} from "@/lib/fixed-income-data";

interface FixedIncomeViewProps {
  data: FixedIncomePageData;
}

function patchFixedIncome(id: string, body: Record<string, unknown>) {
  return fetch("/api/holdings/fixed-income", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...body }),
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function typeLabel(type: FixedIncomeType) {
  return type.replace("_", " ").toUpperCase();
}

export function FixedIncomeView({ data }: FixedIncomeViewProps) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const deleteRow = async (id: string) => {
    if (!confirm("Delete this fixed income holding?")) return;
    await fetch("/api/holdings/fixed-income", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
  };

  const timeline = [...data.rows]
    .filter((r) => r.maturityDate)
    .sort(
      (a, b) =>
        new Date(a.maturityDate!).getTime() - new Date(b.maturityDate!).getTime(),
    );

  const stats = [
    {
      label: "Total Principal",
      value: formatINR(data.totalPrincipal, true),
      sub: `${data.rows.length} holdings`,
      color: "var(--gold-l)",
    },
    {
      label: "Weighted Avg Rate",
      value: data.weightedAvgRate != null ? `${data.weightedAvgRate.toFixed(2)}%` : "—",
      sub: "p.a. where set",
      color: "var(--cyan)",
    },
    {
      label: "Next Maturity",
      value: data.nextMaturity ? formatINR(data.nextMaturity.principal, true) : "—",
      sub: data.nextMaturity
        ? `${data.nextMaturity.label} · ${formatDate(data.nextMaturity.date)}`
        : "No upcoming maturities",
      color: "var(--orange)",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-stretch sm:justify-end">
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className="w-full px-4 py-2 rounded-lg text-sm font-mono transition-all sm:w-auto"
          style={{
            background: editMode ? "rgba(201,168,76,0.12)" : "var(--bg-2)",
            border: `1px solid ${editMode ? "rgba(201,168,76,0.3)" : "var(--border)"}`,
            color: editMode ? "var(--gold-l)" : "var(--text-dim)",
          }}
        >
          {editMode ? "Done editing" : "Edit holdings"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {stats.map((stat, i) => (
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

      <div className="card animate-slide-up stagger-2 min-w-0">
        <div
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div className="stat-label mb-0.5">Fixed Income</div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {data.rows.length} holdings
              {editMode && " · click fields to edit"}
            </div>
          </div>
          <span
            className="font-mono text-sm font-medium whitespace-nowrap"
            style={{ color: "var(--gold-l)" }}
          >
            {formatINR(data.totalPrincipal, true)}
          </span>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="data-table min-w-[800px]">
            <thead>
              <tr>
                <th>Type</th>
                <th>Label</th>
                <th>Issuer</th>
                <th style={{ textAlign: "right" }}>Principal</th>
                <th style={{ textAlign: "right" }}>Rate</th>
                <th>Maturity</th>
                <th>Notes</th>
                {editMode && <th />}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <FixedIncomeRowCells
                  key={row.id}
                  row={row}
                  editMode={editMode}
                  saving={saving === row.id}
                  onSave={async (id, body) => {
                    setSaving(id);
                    await patchFixedIncome(id, body);
                    setSaving(null);
                    refresh();
                  }}
                  onDelete={deleteRow}
                />
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={editMode ? 8 : 7} className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
                    No fixed income holdings yet. {editMode ? "Add one below." : "Enable edit mode to add."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {editMode && (
          <AddFixedIncomeForm portfolioId={data.portfolioId} onAdded={refresh} />
        )}
      </div>

      {timeline.length > 0 && (
        <div className="card animate-slide-up stagger-3">
          <div
            className="px-4 py-3 sm:px-6 sm:py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="stat-label mb-0.5">Maturity Timeline</div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Sorted by maturity date
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {timeline.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {row.label}
                  </div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {typeLabel(row.type)}
                    {row.issuer ? ` · ${row.issuer}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                    {formatDate(row.maturityDate)}
                  </span>
                  <span className="font-mono text-sm" style={{ color: "var(--gold-l)" }}>
                    {formatINR(row.principal, true)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FixedIncomeRowCells({
  row,
  editMode,
  saving,
  onSave,
  onDelete,
}: {
  row: FixedIncomeRow;
  editMode: boolean;
  saving: boolean;
  onSave: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [issuer, setIssuer] = useState(row.issuer ?? "");
  const [principal, setPrincipal] = useState(String(row.principal));
  const [rate, setRate] = useState(row.rate != null ? String(row.rate) : "");
  const [maturityDate, setMaturityDate] = useState(
    row.maturityDate ? row.maturityDate.slice(0, 10) : "",
  );
  const [notes, setNotes] = useState(row.notes ?? "");

  const saveField = (body: Record<string, unknown>) => onSave(row.id, body);

  return (
    <tr style={{ opacity: saving ? 0.6 : 1 }}>
      <td>
        <span className="badge badge-index">{typeLabel(row.type)}</span>
      </td>
      <td>
        {editMode ? (
          <input
            className="input-field text-sm w-full min-w-[120px]"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label !== row.label && saveField({ label })}
          />
        ) : (
          <span className="text-sm" style={{ color: "var(--text)" }}>
            {row.label}
          </span>
        )}
      </td>
      <td>
        {editMode ? (
          <input
            className="input-field text-sm w-full min-w-[100px]"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            onBlur={() => issuer !== (row.issuer ?? "") && saveField({ issuer: issuer || null })}
          />
        ) : (
          <span className="text-sm" style={{ color: "var(--text-dim)" }}>
            {row.issuer ?? "—"}
          </span>
        )}
      </td>
      <td className="text-right">
        {editMode ? (
          <input
            className="input-field font-mono text-sm w-28 text-right"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            onBlur={() => {
              const val = parseFloat(principal);
              if (!isNaN(val) && val !== row.principal) saveField({ principal: val });
            }}
          />
        ) : (
          <span className="font-mono text-sm" style={{ color: "var(--gold-l)" }}>
            {formatINR(row.principal, true)}
          </span>
        )}
      </td>
      <td className="text-right">
        {editMode ? (
          <input
            className="input-field font-mono text-sm w-20 text-right"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => {
              const val = rate === "" ? null : parseFloat(rate);
              if (val !== null && isNaN(val)) return;
              if (val !== row.rate) saveField({ rate: val });
            }}
          />
        ) : (
          <span className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
            {row.rate != null ? `${row.rate.toFixed(2)}%` : "—"}
          </span>
        )}
      </td>
      <td>
        {editMode ? (
          <input
            type="date"
            className="input-field font-mono text-xs"
            value={maturityDate}
            onChange={(e) => setMaturityDate(e.target.value)}
            onBlur={() => {
              const iso = maturityDate ? new Date(maturityDate).toISOString() : null;
              if (iso !== row.maturityDate) saveField({ maturityDate: iso });
            }}
          />
        ) : (
          <span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
            {formatDate(row.maturityDate)}
          </span>
        )}
      </td>
      <td>
        {editMode ? (
          <input
            className="input-field text-xs w-full min-w-[100px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (row.notes ?? "") && saveField({ notes: notes || null })}
          />
        ) : (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {row.notes ?? "—"}
          </span>
        )}
      </td>
      {editMode && (
        <td>
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            className="text-xs font-mono px-2 py-1 rounded"
            style={{ color: "var(--red)", background: "rgba(239,68,68,0.08)" }}
          >
            Del
          </button>
        </td>
      )}
    </tr>
  );
}

function AddFixedIncomeForm({
  portfolioId,
  onAdded,
}: {
  portfolioId: string;
  onAdded: () => void;
}) {
  const [type, setType] = useState<FixedIncomeType>("fd");
  const [label, setLabel] = useState("");
  const [principal, setPrincipal] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(principal);
    if (!label.trim() || isNaN(val) || val <= 0) return;
    setBusy(true);
    await fetch("/api/holdings/fixed-income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId,
        type,
        label: label.trim(),
        principal: val,
      }),
    });
    setLabel("");
    setPrincipal("");
    setBusy(false);
    onAdded();
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap gap-2 items-end px-4 py-4 sm:px-6"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div>
        <div className="stat-label mb-1">Type</div>
        <select
          className="input-field text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as FixedIncomeType)}
        >
          {FIXED_INCOME_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[140px]">
        <div className="stat-label mb-1">Label</div>
        <input
          className="input-field text-sm w-full"
          placeholder="HDFC FD Mar 2027"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div>
        <div className="stat-label mb-1">Principal (₹)</div>
        <input
          className="input-field font-mono text-sm w-32"
          type="number"
          min={0}
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded-lg text-sm font-mono"
        style={{
          background: "rgba(201,168,76,0.12)",
          border: "1px solid rgba(201,168,76,0.3)",
          color: "var(--gold-l)",
        }}
      >
        {busy ? "Adding…" : "Add holding"}
      </button>
    </form>
  );
}
