"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CSV_HOLDINGS_TEMPLATE = [
  "schemeCode,schemeName,units,avgNAV",
  "122639,Example Fund Direct Growth,2800,45.2",
  "120503,Another Fund Direct Plan,150.5,112.75",
].join("\n");

type ImportResult = {
  updated: number;
  created: number;
  skipped: number;
  holdings: Array<{
    schemeCode: string;
    schemeName: string;
    units: number;
    action: "created" | "updated";
  }>;
  warnings: string[];
  errors: string[];
  casType?: string;
  statementPeriod?: { from?: string; to?: string };
  investorName?: string;
};

type PreviewHolding = {
  schemeCode: string;
  schemeName: string;
  units: number;
  avgNAV: number | null;
  matchMethod: string;
  schemeInNavCache: boolean;
  rowWarning?: string;
};

type PreviewResult = {
  holdings: PreviewHolding[];
  warnings: string[];
  errors: string[];
  casType?: string;
  statementPeriod?: { from?: string; to?: string };
  investorName?: string;
};

type ReviewRow = PreviewHolding & { _id: string };

type ImportTab = "json" | "csv";
type ImportStep = "upload" | "review" | "done";

const PORTFOLIOS = [
  { id: "portfolio-primary", label: "My MF" },
  { id: "portfolio-mom", label: "Mother's MF" },
] as const;

const CAS_SOURCES = [
  { label: "CAMS", url: "https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" },
  { label: "KFintech", url: "https://mfs.kfintech.com/investor/General/Download-CAS" },
  { label: "MFCentral", url: "https://www.mfcentral.com/" },
] as const;

const MATCH_LABELS: Record<string, string> = {
  amfi: "AMFI",
  existing: "Portfolio",
  rta: "RTA",
  isin: "ISIN",
  unresolved: "Unresolved",
  manual: "Manual",
};

function newRowId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toReviewRows(holdings: PreviewHolding[]): ReviewRow[] {
  return holdings.map((h) => ({ ...h, _id: newRowId() }));
}

export function CasImport() {
  const router = useRouter();
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<ImportTab>("json");
  const [step, setStep] = useState<ImportStep>("upload");
  const [portfolioId, setPortfolioId] = useState<string>("portfolio-primary");
  const [showInstructions, setShowInstructions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [previewMeta, setPreviewMeta] = useState<
    Pick<PreviewResult, "warnings" | "errors" | "casType" | "statementPeriod" | "investorName">
  >({ warnings: [], errors: [] });

  const reset = () => {
    setError(null);
    setResult(null);
    setReviewRows([]);
    setPreviewMeta({ warnings: [], errors: [] });
    setStep("upload");
    if (jsonFileRef.current) jsonFileRef.current.value = "";
    if (csvFileRef.current) csvFileRef.current.value = "";
  };

  const handleTabChange = (next: ImportTab) => {
    setTab(next);
    reset();
  };

  const previewHoldings = async (format: "json" | "csv", file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("format", format);
    form.append("portfolioId", portfolioId);
    form.append("file", file);

    try {
      const res = await fetch("/api/import/holdings/preview", { method: "POST", body: form });
      const data = (await res.json()) as PreviewResult & { error?: string };

      if (!res.ok) {
        setError(data.error ?? data.errors?.[0] ?? "Could not parse file");
        setPreviewMeta({
          warnings: data.warnings ?? [],
          errors: data.errors ?? [],
          casType: data.casType,
          statementPeriod: data.statementPeriod,
          investorName: data.investorName,
        });
        return;
      }

      setReviewRows(toReviewRows(data.holdings));
      setPreviewMeta({
        warnings: data.warnings,
        errors: data.errors,
        casType: data.casType,
        statementPeriod: data.statementPeriod,
        investorName: data.investorName,
      });
      setStep("review");
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = async () => {
    const holdings = reviewRows
      .filter((r) => r.schemeCode.trim() && r.schemeName.trim() && r.units > 0)
      .map(({ schemeCode, schemeName, units, avgNAV, matchMethod }) => ({
        schemeCode: schemeCode.trim(),
        schemeName: schemeName.trim(),
        units,
        avgNAV,
        matchMethod,
      }));

    if (holdings.length === 0) {
      setError("Add at least one holding with scheme code, name, and units > 0.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/import/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId, holdings }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };

      if (!res.ok) {
        setError(data.error ?? data.errors?.[0] ?? "Import failed");
        if (data.holdings || data.warnings) setResult(data);
        return;
      }

      setResult(data);
      setStep("done");
      router.refresh();
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const previewJson = async () => {
    const file = jsonFileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a JSON file first.");
      return;
    }
    await previewHoldings("json", file);
  };

  const previewCsv = async () => {
    const file = csvFileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    await previewHoldings("csv", file);
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_HOLDINGS_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vaulted-holdings-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setReviewRows((rows) =>
      rows.map((r) => {
        if (r._id !== id) return r;
        const next = { ...r, ...patch };
        const code = next.schemeCode.trim();
        let rowWarning = r.rowWarning;
        if (!code) rowWarning = "Scheme code missing — edit before import.";
        else if (next.matchMethod === "unresolved") rowWarning = "Could not auto-resolve scheme code.";
        else if (next.matchMethod === "isin")
          rowWarning = "Matched by ISIN only — NAV lookup may fail until AMFI code is set.";
        else if (!next.schemeInNavCache && code) rowWarning = "Scheme not in NAV cache — verify AMFI code.";
        else rowWarning = undefined;
        return { ...next, rowWarning };
      }),
    );
  };

  const deleteRow = (id: string) => {
    setReviewRows((rows) => rows.filter((r) => r._id !== id));
  };

  const addManualRow = () => {
    setReviewRows((rows) => [
      ...rows,
      {
        _id: newRowId(),
        schemeCode: "",
        schemeName: "",
        units: 0,
        avgNAV: null,
        matchMethod: "manual",
        schemeInNavCache: false,
        rowWarning: "Scheme code missing — edit before import.",
      },
    ]);
  };

  const tabs: Array<{ id: ImportTab; label: string; hint?: string }> = [
    { id: "json", label: "Import JSON", hint: "recommended" },
    { id: "csv", label: "Import CSV" },
  ];

  if (step === "review") {
    return (
      <div className="space-y-5">
        <ReviewHeader
          portfolioLabel={PORTFOLIOS.find((p) => p.id === portfolioId)?.label ?? portfolioId}
          format={tab}
          meta={previewMeta}
          rowCount={reviewRows.length}
        />

        <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Scheme code</th>
                <th>Fund name</th>
                <th style={{ textAlign: "right" }}>Units</th>
                <th style={{ textAlign: "right" }}>Avg NAV</th>
                <th>Match</th>
                <th style={{ textAlign: "center" }}>NAV DB</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reviewRows.map((row) => (
                <ReviewRowCells
                  key={row._id}
                  row={row}
                  onChange={(patch) => updateRow(row._id, patch)}
                  onDelete={() => deleteRow(row._id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addManualRow}
          className="text-sm font-mono"
          style={{ color: "var(--gold)" }}
        >
          + Add row manually
        </button>

        {previewMeta.warnings.length > 0 && (
          <WarningsBlock title="Parser warnings" items={previewMeta.warnings} />
        )}

        {error && (
          <p className="font-mono text-xs" style={{ color: "var(--red)" }}>
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setError(null);
            }}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{
              background: "var(--bg-3)",
              color: "var(--text-dim)",
              border: "1px solid var(--border)",
              fontFamily: "IBM Plex Mono",
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={confirmImport}
            disabled={loading}
            className="px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            style={{
              background: "var(--gold)",
              color: "#111",
              fontFamily: "IBM Plex Mono",
              boxShadow: "0 0 0 1px rgba(201,168,76,0.35), 0 4px 14px rgba(201,168,76,0.15)",
            }}
          >
            {loading ? "Importing…" : "Confirm import"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <HowToUseInstructions expanded={showInstructions} onToggle={() => setShowInstructions((v) => !v)} />

      {step === "done" && result && (
        <div className="space-y-3">
          <div
            className="rounded-lg px-4 py-3 font-mono text-xs"
            style={{
              background: "rgba(45, 212, 191, 0.08)",
              border: "1px solid rgba(45, 212, 191, 0.25)",
              color: "var(--teal)",
            }}
          >
            Import complete — {result.updated} updated, {result.created} new
            {result.skipped > 0 && `, ${result.skipped} skipped`}
          </div>
          <ImportResultPanel result={result} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: "var(--bg-3)",
                color: "var(--text-dim)",
                border: "1px solid var(--border)",
                fontFamily: "IBM Plex Mono",
              }}
            >
              Import another file
            </button>
          </div>
        </div>
      )}

      {step === "upload" && (
        <>
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id)}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60"
                style={{
                  background: tab === t.id ? "var(--gold)" : "var(--bg-3)",
                  color: tab === t.id ? "#111" : "var(--text-dim)",
                  border: tab === t.id ? "none" : "1px solid var(--border)",
                  fontFamily: "IBM Plex Mono",
                }}
              >
                {t.label}
                {t.hint && (
                  <span className="ml-1 opacity-70" style={{ fontSize: "9px" }}>
                    ({t.hint})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div>
            <div className="stat-label mb-1.5">Portfolio</div>
            <select
              value={portfolioId}
              onChange={(e) => {
                setPortfolioId(e.target.value);
                reset();
              }}
              className="input-field font-mono w-full"
              disabled={loading}
            >
              {PORTFOLIOS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {tab === "json" && (
            <>
              <div>
                <div className="stat-label mb-1.5">CAS JSON</div>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="input-field w-full text-sm"
                  disabled={loading}
                  onChange={() => {
                    setError(null);
                    setResult(null);
                  }}
                />
                <p className="font-mono text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                  Output from casparser CLI, or a Vaulted JSON array (max 5 MB)
                </p>
              </div>

              <ActionRow
                loading={loading}
                error={error}
                label={loading ? "Parsing…" : "Review import"}
                onAction={previewJson}
              />
            </>
          )}

          {tab === "csv" && (
            <>
              <div>
                <div className="stat-label mb-1.5">CSV format</div>
                <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Headers: <code>schemeCode</code>, <code>schemeName</code>, <code>units</code>,{" "}
                  <code>avgNAV</code> (optional)
                </p>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--bg-3)",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                    fontFamily: "IBM Plex Mono",
                  }}
                >
                  Download template CSV
                </button>
              </div>

              <div>
                <div className="stat-label mb-1.5">Holdings CSV</div>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept="text/csv,.csv"
                  className="input-field w-full text-sm"
                  disabled={loading}
                  onChange={() => {
                    setError(null);
                    setResult(null);
                  }}
                />
              </div>

              <ActionRow
                loading={loading}
                error={error}
                label={loading ? "Parsing…" : "Review import"}
                onAction={previewCsv}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function HowToUseInstructions({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const steps = [
    {
      title: "Download your CAS PDF",
      body: (
        <>
          Request a Consolidated Account Statement from{" "}
          {CAS_SOURCES.map((s, i) => (
            <span key={s.label}>
              {i > 0 && (i === CAS_SOURCES.length - 1 ? ", or " : ", ")}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--gold-l)" }}
              >
                {s.label}
              </a>
            </span>
          ))}{" "}
          (email statement).
        </>
      ),
    },
    {
      title: "Install casparser locally",
      body: (
        <pre
          className="mt-2 p-2.5 rounded text-[10px] leading-relaxed"
          style={{ background: "var(--bg-2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          pip install casparser
        </pre>
      ),
    },
    {
      title: "Parse PDF to JSON",
      body: (
        <pre
          className="mt-2 p-2.5 rounded text-[10px] leading-relaxed overflow-x-auto"
          style={{ background: "var(--bg-2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          casparser ~/Downloads/cas.pdf -p YOUR_PAN -o parsed.json
        </pre>
      ),
    },
    {
      title: "Upload & review in Vaulted",
      body: "Upload parsed.json below, review holdings in the table, edit any mismatched scheme codes, then confirm import.",
    },
    {
      title: "CSV alternative",
      body: "Download the template CSV, fill schemeCode / schemeName / units / avgNAV, upload, review, and confirm.",
    },
  ];

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(201,168,76,0.06) 0%, var(--bg-3) 45%)",
        border: "1px solid rgba(201,168,76,0.22)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        style={{ fontFamily: "IBM Plex Mono" }}
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-medium"
            style={{ background: "var(--gold)", color: "#111" }}
          >
            ?
          </span>
          <span className="text-xs font-medium" style={{ color: "var(--gold-l)" }}>
            How to use it
          </span>
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {expanded ? "Hide" : "Show steps"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid rgba(201,168,76,0.12)" }}>
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-3">
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium mt-0.5"
                style={{
                  background: "rgba(201,168,76,0.15)",
                  color: "var(--gold-l)",
                  border: "1px solid rgba(201,168,76,0.25)",
                }}
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text)" }}>
                  {step.title}
                </div>
                <div className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewHeader({
  portfolioLabel,
  format,
  meta,
  rowCount,
}: {
  portfolioLabel: string;
  format: ImportTab;
  meta: Pick<PreviewResult, "warnings" | "errors" | "casType" | "statementPeriod" | "investorName">;
  rowCount: number;
}) {
  return (
    <div
      className="rounded-lg p-4 space-y-2"
      style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
    >
      <div className="stat-label">Review before import</div>
      <p className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
        {rowCount} holdings · {portfolioLabel} · {format.toUpperCase()} upload
      </p>
      {(meta.casType || meta.investorName) && (
        <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          {meta.casType && <span>CAS type: {meta.casType}</span>}
          {meta.casType && meta.investorName && " · "}
          {meta.investorName && <span>{meta.investorName}</span>}
          {meta.statementPeriod?.from && meta.statementPeriod?.to && (
            <>
              {" · "}
              {meta.statementPeriod.from} → {meta.statementPeriod.to}
            </>
          )}
        </p>
      )}
      <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
        Edit scheme codes or units if needed. Rows with warnings are highlighted — fix them before confirming.
      </p>
    </div>
  );
}

function ReviewRowCells({
  row,
  onChange,
  onDelete,
}: {
  row: ReviewRow;
  onChange: (patch: Partial<ReviewRow>) => void;
  onDelete: () => void;
}) {
  const hasWarning = Boolean(row.rowWarning);

  return (
    <tr
      style={{
        background: hasWarning ? "rgba(245, 158, 11, 0.06)" : undefined,
      }}
    >
      <td>
        <input
          type="text"
          value={row.schemeCode}
          onChange={(e) => onChange({ schemeCode: e.target.value })}
          className="input-field font-mono text-xs w-full min-w-[88px]"
          placeholder="AMFI code"
        />
      </td>
      <td>
        <input
          type="text"
          value={row.schemeName}
          onChange={(e) => onChange({ schemeName: e.target.value })}
          className="input-field font-mono text-xs w-full min-w-[180px]"
        />
        {row.rowWarning && (
          <div className="font-mono text-[9px] mt-1" style={{ color: "var(--gold)" }}>
            {row.rowWarning}
          </div>
        )}
      </td>
      <td style={{ textAlign: "right" }}>
        <input
          type="number"
          step="any"
          value={row.units || ""}
          onChange={(e) => onChange({ units: parseFloat(e.target.value) || 0 })}
          className="input-field font-mono text-xs w-24 text-right ml-auto"
        />
      </td>
      <td style={{ textAlign: "right" }}>
        <input
          type="number"
          step="any"
          value={row.avgNAV ?? ""}
          onChange={(e) =>
            onChange({ avgNAV: e.target.value === "" ? null : parseFloat(e.target.value) || null })
          }
          className="input-field font-mono text-xs w-24 text-right ml-auto"
          placeholder="—"
        />
      </td>
      <td>
        <span
          className="font-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: "var(--bg-2)",
            color: row.matchMethod === "unresolved" ? "var(--gold)" : "var(--text-dim)",
            border: "1px solid var(--border)",
          }}
        >
          {MATCH_LABELS[row.matchMethod] ?? row.matchMethod}
        </span>
      </td>
      <td style={{ textAlign: "center" }}>
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: row.schemeInNavCache ? "var(--teal)" : "var(--gold)" }}
          title={row.schemeInNavCache ? "Scheme found in NAV cache" : "Not in NAV cache"}
        />
      </td>
      <td style={{ textAlign: "right" }}>
        <button
          type="button"
          onClick={onDelete}
          className="font-mono text-[10px] px-2 py-1 rounded"
          style={{ color: "var(--red)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

function WarningsBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{ background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.2)" }}
    >
      <div className="stat-label">{title}</div>
      <ul className="space-y-1 max-h-32 overflow-y-auto">
        {items.map((w, i) => (
          <li key={i} className="font-mono text-[10px]" style={{ color: "var(--gold)" }}>
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionRow({
  loading,
  error,
  label,
  onAction,
}: {
  loading: boolean;
  error: string | null;
  label: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {error && (
        <span className="font-mono text-xs max-w-xs text-right" style={{ color: "var(--red)" }}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={onAction}
        disabled={loading}
        className="px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
        style={{ background: "var(--gold)", color: "#111", fontFamily: "IBM Plex Mono" }}
      >
        {label}
      </button>
    </div>
  );
}

function ImportResultPanel({ result }: { result: ImportResult }) {
  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-wrap gap-4 font-mono text-xs">
        <span style={{ color: "var(--teal)" }}>{result.updated} updated</span>
        <span style={{ color: "var(--gold-l)" }}>{result.created} new</span>
        {result.skipped > 0 && (
          <span style={{ color: "var(--text-muted)" }}>{result.skipped} skipped</span>
        )}
      </div>

      {(result.casType || result.investorName) && (
        <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          {result.casType && <span>CAS type: {result.casType}</span>}
          {result.casType && result.investorName && " · "}
          {result.investorName && <span>{result.investorName}</span>}
          {result.statementPeriod?.from && result.statementPeriod?.to && (
            <>
              {" · "}
              {result.statementPeriod.from} → {result.statementPeriod.to}
            </>
          )}
        </div>
      )}

      {result.holdings.length > 0 && (
        <div>
          <div className="stat-label mb-2">Schemes</div>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {result.holdings.map((h) => (
              <li
                key={`${h.schemeCode}-${h.action}`}
                className="flex items-baseline justify-between gap-3 font-mono text-xs py-1"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span style={{ color: "var(--text)" }}>{h.schemeName}</span>
                <span className="flex-shrink-0" style={{ color: "var(--text-dim)" }}>
                  {h.units.toFixed(3)} u ·{" "}
                  <span style={{ color: h.action === "created" ? "var(--gold-l)" : "var(--teal)" }}>
                    {h.action}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <WarningsBlock title="Warnings" items={result.warnings} />
      )}

      {result.errors.length > 0 && (
        <div>
          <div className="stat-label mb-2">Errors</div>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li key={i} className="font-mono text-[10px]" style={{ color: "var(--red)" }}>
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
