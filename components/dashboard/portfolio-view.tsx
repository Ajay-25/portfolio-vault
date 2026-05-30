"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { MfRow, PortfolioPageData, StockRow } from "@/lib/portfolio-data";
import { formatINR, formatPct } from "@/lib/utils/finance";
import { LiveStocksTable } from "@/components/dashboard/live-stocks-table";
import { MF_CATEGORIES, mfCategoryBadgeClass } from "@/lib/utils/mf-category";

interface PortfolioViewProps {
  data: PortfolioPageData;
}

function patchMf(id: string, body: Record<string, unknown>) {
  return fetch("/api/holdings/mf", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...body }),
  });
}

export function PortfolioView({ data }: PortfolioViewProps) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const deleteMf = async (id: string) => {
    if (!confirm("Delete this MF holding?")) return;
    await fetch("/api/holdings/mf", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
  };

  const deleteStock = async (id: string) => {
    if (!confirm("Delete this stock holding?")) return;
    await fetch("/api/holdings/stock", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
  };

  const mfStats =
    data.view === "mf"
      ? [
          {
            label: "Invested",
            value: data.mfInvested > 0 ? formatINR(data.mfInvested, true) : "—",
            sub:
              data.mfFundsMissingCost > 0
                ? `${data.mfFundsWithCost} of ${data.mfRows.length} funds with avg NAV`
                : `cost basis · ${data.mfRows.length} funds`,
            color: "var(--text)",
          },
          {
            label: "Market Value",
            value: formatINR(data.mfTotal, true),
            sub: "live NAV",
            color: "var(--gold-l)",
          },
          {
            label: "Total Gain",
            value:
              data.mfGainAbs != null
                ? `${data.mfGainAbs >= 0 ? "+" : ""}${formatINR(data.mfGainAbs, true)}`
                : "—",
            sub:
              data.mfGainPct != null
                ? [
                    formatPct(data.mfGainPct),
                    data.mfXirr != null ? `XIRR ${formatPct(data.mfXirr)} est.` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "add avg NAV on holdings for gain",
            color:
              data.mfGainAbs == null
                ? "var(--text-muted)"
                : data.mfGainAbs >= 0
                  ? "var(--teal)"
                  : "var(--red)",
          },
          {
            label: "Next SIP",
            value: data.upcomingSip
              ? formatINR(data.upcomingSip.amount, true)
              : data.sipTotal > 0
                ? formatINR(data.sipTotal, true)
                : "—",
            sub: data.upcomingSip
              ? `in ${data.upcomingSip.daysUntil}d · ${data.upcomingSip.label} · ${formatINR(data.sipTotal, true)}/mo total`
              : data.sipTotal > 0
                ? `${formatINR(data.sipTotal, true)}/mo total mandate`
                : "no SIPs configured",
            color: "var(--purple)",
          },
        ]
      : null;

  const stats = mfStats ?? [
    {
      label: "Total Value",
      value: formatINR(data.displayTotal, true),
      sub:
        data.view === "us"
          ? "US holdings · live"
          : data.view === "in"
            ? "NSE holdings · live"
            : "MF + Stocks · live",
      color: "var(--gold-l)",
    },
    ...(data.showMf
      ? [
          {
            label: "MF Value",
            value: formatINR(data.mfTotal, true),
            sub: `${data.mfRows.length} funds`,
            color: "var(--text)",
          },
          {
            label: "MF Gain",
            value:
              data.mfGainPct != null
                ? formatPct(data.mfGainPct)
                : "—",
            sub:
              data.mfGainAbs != null
                ? `${data.mfGainAbs >= 0 ? "+" : ""}${formatINR(data.mfGainAbs, true)}`
                : "absolute return",
            color:
              data.mfGainPct == null
                ? "var(--text-muted)"
                : data.mfGainPct >= 0
                  ? "var(--teal)"
                  : "var(--red)",
          },
          {
            label: "Monthly SIP",
            value: formatINR(data.sipTotal, true),
            sub: data.upcomingSip
              ? `next in ${data.upcomingSip.daysUntil}d (${data.upcomingSip.label})`
              : "total mandate",
            color: "var(--text)",
          },
        ]
      : [
          {
            label: "Holdings",
            value: String(data.filteredStockRows.length),
            sub: data.view === "us" ? "US tickers" : "NSE tickers",
            color: "var(--text)",
          },
          {
            label: "Stock Value",
            value: formatINR(data.filteredStockTotal, true),
            sub: "live prices",
            color: "var(--purple)",
          },
          {
            label: "Stock Gain",
            value:
              data.stockGainPct !== null
                ? `${data.stockGainPct >= 0 ? "+" : ""}${data.stockGainPct.toFixed(1)}%`
                : "—",
            sub: "vs avg cost",
            color:
              data.stockGainPct === null
                ? "var(--text-muted)"
                : data.stockGainPct >= 0
                  ? "var(--teal)"
                  : "var(--red)",
          },
        ]),
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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

      {data.showMf && (
        <MfSection
          rows={data.mfRows}
          total={data.mfTotal}
          portfolioId={data.portfolioId}
          editMode={editMode}
          saving={saving}
          onSave={async (id, body) => {
            setSaving(id);
            await patchMf(id, body);
            setSaving(null);
            refresh();
          }}
          onDelete={deleteMf}
          onAdded={refresh}
        />
      )}

      {data.showStocks && data.filteredStockRows.length > 0 && (
        <StockSection
          rows={data.filteredStockRows}
          total={data.filteredStockTotal}
          usdInr={data.usdInr}
          editMode={editMode}
          onDelete={deleteStock}
        />
      )}

      {editMode && (
        <AddStockForm portfolioId={data.portfolioId} onAdded={refresh} />
      )}
    </div>
  );
}

function MfSection({
  rows,
  total,
  portfolioId,
  editMode,
  saving,
  onSave,
  onDelete,
  onAdded,
}: {
  rows: MfRow[];
  total: number;
  portfolioId: string;
  editMode: boolean;
  saving: string | null;
  onSave: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => void;
  onAdded: () => void;
}) {
  type MfSortKey =
    | "schemeName"
    | "category"
    | "units"
    | "avgNAV"
    | "nav"
    | "value"
    | "gain"
    | "sipAmount"
    | "status";

  type SortDir = "asc" | "desc";

  const [sortKey, setSortKey] = useState<MfSortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: MfSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "schemeName" || key === "category" || key === "status" ? "asc" : "desc");
    }
  };

  const sortedRows = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;

    const str = (a: string | null | undefined, b: string | null | undefined) =>
      mul * (a ?? "").localeCompare(b ?? "", "en", { sensitivity: "base" });

    const num = (a: number | null | undefined, b: number | null | undefined) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return mul * (a - b);
    };

    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case "schemeName":
          return str(a.schemeName, b.schemeName);
        case "category":
          return str(a.category, b.category);
        case "status":
          return str(a.status, b.status);
        case "units":
          return num(a.units, b.units);
        case "avgNAV":
          return num(a.avgNAV, b.avgNAV);
        case "nav":
          return num(a.nav, b.nav);
        case "value":
          return num(a.value, b.value);
        case "gain":
          return num(a.gain, b.gain);
        case "sipAmount":
          return num(a.sipAmount, b.sipAmount);
        default:
          return 0;
      }
    });
  }, [rows, sortKey, sortDir]);

  const SortableTh = ({
    label,
    column,
    align = "left",
  }: {
    label:   string;
    column:  MfSortKey;
    align?:  "left" | "right" | "center";
  }) => {
    const active = sortKey === column;
    return (
      <th style={{ textAlign: align }}>
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="inline-flex items-center gap-1 bg-transparent p-0 font-inherit uppercase tracking-wider"
          style={{
            color:      active ? "var(--gold-l)" : "var(--text-muted)",
            cursor:     "pointer",
            justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
            width:      align === "right" ? "100%" : undefined,
          }}
          aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        >
          <span>{label}</span>
          <span className="font-mono text-[9px]" style={{ opacity: active ? 1 : 0.45 }}>
            {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="card animate-slide-up stagger-2 min-w-0">
      <div
        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="min-w-0">
          <div className="stat-label mb-0.5">Mutual Funds</div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {rows.length} holdings · Live NAVs
            {editMode && " · click units/avgNAV to edit"}
          </div>
        </div>
        <span className="font-mono text-sm font-medium whitespace-nowrap" style={{ color: "var(--gold-l)" }}>
          {formatINR(total, true)}
        </span>
      </div>
      <div className="min-w-0 overflow-x-auto">
      <table className="data-table min-w-[720px]">
        <thead>
          <tr>
            <SortableTh label="Fund Name" column="schemeName" />
            <SortableTh label="Cat" column="category" />
            <SortableTh label="Units" column="units" align="right" />
            <SortableTh label="Avg NAV" column="avgNAV" align="right" />
            <SortableTh label="NAV · Date" column="nav" align="right" />
            <SortableTh label="Value" column="value" align="right" />
            <SortableTh label="Gain" column="gain" align="right" />
            <SortableTh label="SIP/mo" column="sipAmount" align="right" />
            <SortableTh label="Status" column="status" align="center" />
            {editMode && <th />}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((h) => (
            <MfRowCells
              key={h.id}
              row={h}
              editMode={editMode}
              saving={saving === h.id}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
      </div>
      {editMode && <AddMfForm portfolioId={portfolioId} onAdded={onAdded} />}
    </div>
  );
}

function MfRowCells({
  row,
  editMode,
  saving,
  onSave,
  onDelete,
}: {
  row: MfRow;
  editMode: boolean;
  saving: boolean;
  onSave: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [units, setUnits] = useState(String(row.units));
  const [avgNAV, setAvgNAV] = useState(row.avgNAV != null ? String(row.avgNAV) : "");

  const saveUnits = () => {
    const val = parseFloat(units);
    if (!isNaN(val) && val !== row.units) onSave(row.id, { units: val });
  };

  const saveAvgNav = () => {
    const val = avgNAV === "" ? null : parseFloat(avgNAV);
    if (val !== null && isNaN(val)) return;
    if (val !== row.avgNAV) onSave(row.id, { avgNAV: val });
  };

  return (
    <tr style={{ opacity: saving ? 0.6 : 1 }}>
      <td>
        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
          {row.schemeName}
        </div>
        <div className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {row.schemeCode}
        </div>
      </td>
      <td>
        {row.category ? (
          <span className={`badge ${mfCategoryBadgeClass(row.category)}`}>{row.category}</span>
        ) : (
          <span className="badge badge-muted">—</span>
        )}
      </td>
      <td className="text-right">
        {editMode ? (
          <input
            type="number"
            step="0.001"
            className="input-field font-mono text-sm w-full min-w-[6.5rem] max-w-[8rem] ml-auto text-right sm:w-24 sm:min-w-0 sm:max-w-none"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            onBlur={saveUnits}
          />
        ) : (
          <span className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
            {row.units.toLocaleString("en-IN")}
          </span>
        )}
      </td>
      <td className="text-right">
        {editMode ? (
          <input
            type="number"
            step="0.01"
            className="input-field font-mono text-sm w-full min-w-[6.5rem] max-w-[8rem] ml-auto text-right sm:w-24 sm:min-w-0 sm:max-w-none"
            placeholder="—"
            value={avgNAV}
            onChange={(e) => setAvgNAV(e.target.value)}
            onBlur={saveAvgNav}
          />
        ) : (
          <span className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
            {row.avgNAV ? `₹${row.avgNAV.toFixed(2)}` : "—"}
          </span>
        )}
      </td>
      <td className="font-mono text-right" style={{ color: "var(--text)" }}>
        <div className="text-sm font-medium">
          {row.nav ? `₹${row.nav.toFixed(2)}` : "—"}
        </div>
        {row.navDate && (
          <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {row.navDate}
          </div>
        )}
      </td>
      <td className="font-mono text-right text-sm font-medium" style={{ color: "var(--gold-l)" }}>
        {row.value > 0 ? formatINR(row.value, true) : "—"}
      </td>
      <td
        className="font-mono text-right text-sm"
        style={{
          color:
            row.gain === null
              ? "var(--text-muted)"
              : row.gain >= 0
                ? "var(--teal)"
                : "var(--red)",
        }}
      >
        {row.gain !== null ? `${row.gain >= 0 ? "+" : ""}${(row.gain * 100).toFixed(1)}%` : "—"}
      </td>
      <td className="font-mono text-right text-sm" style={{ color: "var(--teal)" }}>
        {row.sipAmount ? `₹${row.sipAmount.toLocaleString("en-IN")}` : "—"}
      </td>
      <td style={{ textAlign: "center" }}>
        <span
          className={`badge ${row.status === "active" ? "badge-teal" : row.status === "hold" ? "badge-gold" : "badge-red"}`}
        >
          {row.status}
        </span>
      </td>
      {editMode && (
        <td>
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            className="text-[10px] font-mono px-2 py-1 rounded"
            style={{ color: "var(--red)" }}
          >
            Delete
          </button>
        </td>
      )}
    </tr>
  );
}

function StockSection({
  rows,
  total,
  usdInr,
  editMode,
  onDelete,
}: {
  rows: StockRow[];
  total: number;
  usdInr: number;
  editMode: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card animate-slide-up stagger-3 min-w-0">
      <div
        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="min-w-0">
          <div className="stat-label mb-0.5">Stocks</div>
          <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {rows.length} holdings · Live prices
          </div>
        </div>
        <span className="font-mono text-sm font-medium whitespace-nowrap" style={{ color: "var(--gold-l)" }}>
          {formatINR(total, true)}
        </span>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <LiveStocksTable
          holdings={rows}
          usdInr={usdInr}
          editMode={editMode}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function AddMfForm({
  portfolioId,
  onAdded,
}: {
  portfolioId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([...MF_CATEGORIES]);
  const [form, setForm] = useState({
    schemeCode: "",
    schemeName: "",
    units: "",
    avgNAV: "",
    sipAmount: "",
    sipDate: "7",
    category: "Flexi",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/holdings/mf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId,
        schemeCode: form.schemeCode,
        schemeName: form.schemeName,
        units: parseFloat(form.units) || 0,
        avgNAV: form.avgNAV ? parseFloat(form.avgNAV) : null,
        sipAmount: form.sipAmount ? parseInt(form.sipAmount, 10) : null,
        sipDate: parseInt(form.sipDate, 10),
        category: form.category,
        status: "active",
      }),
    });
    setOpen(false);
    onAdded();
  };

  if (!open) {
    return (
      <div className="px-6 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            fetch("/api/mf-categories")
              .then((r) => r.json())
              .then((d) => {
                if (Array.isArray(d.categories) && d.categories.length) {
                  setCategories(d.categories);
                }
              })
              .catch(() => undefined);
          }}
          className="text-sm font-mono"
          style={{ color: "var(--gold)" }}
        >
          + Add MF holding
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="px-6 py-4 grid gap-3"
      style={{ borderTop: "1px solid var(--border)", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
    >
      <input className="input-field" placeholder="Scheme code" required value={form.schemeCode} onChange={(e) => setForm({ ...form, schemeCode: e.target.value })} />
      <input className="input-field" placeholder="Fund name" required value={form.schemeName} onChange={(e) => setForm({ ...form, schemeName: e.target.value })} />
      <input className="input-field font-mono" type="number" placeholder="Units" required value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
      <input className="input-field font-mono" type="number" placeholder="Avg NAV" value={form.avgNAV} onChange={(e) => setForm({ ...form, avgNAV: e.target.value })} />
      <input className="input-field font-mono" type="number" placeholder="SIP ₹/mo" value={form.sipAmount} onChange={(e) => setForm({ ...form, sipAmount: e.target.value })} />
      <select className="input-field" value={form.sipDate} onChange={(e) => setForm({ ...form, sipDate: e.target.value })}>
        <option value="7">SIP 7th</option>
        <option value="28">SIP 28th</option>
      </select>
      <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div className="flex gap-2 col-span-full">
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-mono" style={{ background: "var(--gold)", color: "#111" }}>
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-dim)" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddStockForm({
  portfolioId,
  onAdded,
}: {
  portfolioId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    symbol: "",
    displayName: "",
    exchange: "NSE",
    currency: "INR",
    qty: "",
    avgPrice: "",
    action: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currency = form.exchange === "NYSE" ? "USD" : "INR";
    await fetch("/api/holdings/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolioId,
        symbol: form.symbol.toUpperCase(),
        displayName: form.displayName || form.symbol.toUpperCase(),
        exchange: form.exchange,
        currency,
        qty: parseFloat(form.qty) || 0,
        avgPrice: parseFloat(form.avgPrice) || 0,
        action: form.action || null,
      }),
    });
    setOpen(false);
    onAdded();
  };

  if (!open) {
    return (
      <div className="card" style={{ padding: "16px 24px" }}>
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-mono" style={{ color: "var(--gold)" }}>
          + Add stock holding
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: "24px" }}>
      <div className="stat-label mb-3">Add stock</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <input className="input-field font-mono" placeholder="Symbol" required value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
        <input className="input-field" placeholder="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <select className="input-field" value={form.exchange} onChange={(e) => setForm({ ...form, exchange: e.target.value })}>
          <option value="NSE">NSE</option>
          <option value="NYSE">NYSE</option>
        </select>
        <input className="input-field font-mono" type="number" step="any" placeholder="Qty" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        <input className="input-field font-mono" type="number" step="any" placeholder="Avg price" required value={form.avgPrice} onChange={(e) => setForm({ ...form, avgPrice: e.target.value })} />
        <input className="input-field" placeholder="Action note" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-mono" style={{ background: "var(--gold)", color: "#111" }}>
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--text-dim)" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
