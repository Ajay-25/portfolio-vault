"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FITypeOption =
  | "ppf" | "epf" | "nps_tier1" | "nps_tier2" | "scss"
  | "fd" | "rd" | "bond" | "nsc" | "liquid";

const GOVT_TYPES: FITypeOption[] = ["ppf", "epf", "nps_tier1", "nps_tier2", "scss"];
const OTHER_TYPES: FITypeOption[] = ["fd", "rd", "bond", "nsc", "liquid"];

type Tab = "govt" | "deposits" | "bonds" | "liquid";

function defaultTypeForTab(tab: Tab): FITypeOption {
  if (tab === "govt") return "ppf";
  if (tab === "deposits") return "fd";
  if (tab === "bonds") return "bond";
  return "liquid";
}

export function FIAddModal({
  portfolioId,
  onClose,
  defaultTab = "govt",
}: {
  portfolioId: string;
  onClose:     () => void;
  defaultTab?: Tab;
}) {
  const router = useRouter();
  const [type, setType] = useState<FITypeOption>(defaultTypeForTab(defaultTab));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    label:       "",
    institution: "",
    principal:   "",
    rate:        "",
    startDate:   "",
    maturityDate: "",
    notes:       "",
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.label.trim() || !form.principal.trim()) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      portfolioId,
      type,
      label:       form.label.trim(),
      institution: form.institution.trim() || null,
      principal:   Number(form.principal),
      rate:        form.rate ? Number(form.rate) : null,
      startDate:   form.startDate || null,
      maturityDate: form.maturityDate || null,
      notes:       form.notes.trim() || null,
    };

    if (type === "ppf") body.annualContrib = form.annualContrib ? Number(form.annualContrib) : Number(form.principal);
    if (type === "epf") {
      body.uan = form.uan || null;
      body.employeeMonthly = form.employeeMonthly ? Number(form.employeeMonthly) : null;
      body.employerMonthly = form.employerMonthly ? Number(form.employerMonthly) : null;
      body.currentValue = Number(form.principal);
    }
    if (type.startsWith("nps")) {
      body.pran = form.pran || null;
      body.fundManager = form.fundManager || null;
      body.equityPct = form.equityPct ? Number(form.equityPct) : null;
      body.corpBondPct = form.corpBondPct ? Number(form.corpBondPct) : null;
      body.govtSecPct = form.govtSecPct ? Number(form.govtSecPct) : null;
      body.altPct = form.altPct ? Number(form.altPct) : null;
      body.currentValue = Number(form.principal);
    }
    if (type === "fd" || type === "rd") {
      body.maturityAmount = form.maturityAmount ? Number(form.maturityAmount) : null;
      body.compoundingFreq = form.compoundingFreq || "quarterly";
      body.interestPayout = form.interestPayout || "cumulative";
      body.isTaxSaving = form.isTaxSaving === "true";
      body.autoRenewal = form.autoRenewal === "true";
    }
    if (type === "bond" || type === "nsc") {
      body.isin = form.isin || null;
      body.rating = form.rating || null;
      body.couponFrequency = form.couponFrequency || "annual";
    }
    if (type === "liquid") body.currentValue = Number(form.principal);

    await fetch("/api/holdings/fixed-income", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    setSaving(false);
    onClose();
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium" style={{ color: "var(--text)" }}>Add instrument</div>
          <button type="button" onClick={onClose} className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        <div className="space-y-3 mb-4">
          <div className="stat-label">Govt schemes</div>
          <div className="flex flex-wrap gap-2">
            {GOVT_TYPES.map((t) => (
              <TypePill key={t} active={type === t} label={t.replace(/_/g, " ").toUpperCase()} onClick={() => setType(t)} />
            ))}
          </div>
          <div className="stat-label">Others</div>
          <div className="flex flex-wrap gap-2">
            {OTHER_TYPES.map((t) => (
              <TypePill key={t} active={type === t} label={t.toUpperCase()} onClick={() => setType(t)} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Label" value={form.label} onChange={(v) => set("label", v)} />
          <Field label="Institution" value={form.institution} onChange={(v) => set("institution", v)} />
          <Field label="Principal / balance (₹)" value={form.principal} onChange={(v) => set("principal", v)} type="number" />
          <Field label="Rate % p.a." value={form.rate} onChange={(v) => set("rate", v)} type="number" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" value={form.startDate} onChange={(v) => set("startDate", v)} type="date" />
            <Field label="Maturity date" value={form.maturityDate} onChange={(v) => set("maturityDate", v)} type="date" />
          </div>

          {type === "ppf" && (
            <Field label="Annual contribution (₹)" value={form.annualContrib ?? ""} onChange={(v) => set("annualContrib", v)} type="number" />
          )}
          {type === "epf" && (
            <>
              <Field label="UAN" value={form.uan ?? ""} onChange={(v) => set("uan", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Employee / mo" value={form.employeeMonthly ?? ""} onChange={(v) => set("employeeMonthly", v)} type="number" />
                <Field label="Employer / mo" value={form.employerMonthly ?? ""} onChange={(v) => set("employerMonthly", v)} type="number" />
              </div>
            </>
          )}
          {(type === "nps_tier1" || type === "nps_tier2") && (
            <>
              <Field label="PRAN" value={form.pran ?? ""} onChange={(v) => set("pran", v)} />
              <Field label="Fund manager" value={form.fundManager ?? ""} onChange={(v) => set("fundManager", v)} />
              <div className="grid grid-cols-4 gap-2">
                {(["equityPct", "corpBondPct", "govtSecPct", "altPct"] as const).map((k) => (
                  <Field key={k} label={k.replace("Pct", "").toUpperCase()} value={form[k] ?? ""} onChange={(v) => set(k, v)} type="number" />
                ))}
              </div>
            </>
          )}
          {(type === "fd" || type === "rd") && (
            <>
              <Field label="Maturity amount (₹)" value={form.maturityAmount ?? ""} onChange={(v) => set("maturityAmount", v)} type="number" />
              <Field label="Compounding" value={form.compoundingFreq ?? "quarterly"} onChange={(v) => set("compoundingFreq", v)} />
            </>
          )}
          {(type === "bond" || type === "nsc") && (
            <>
              <Field label="ISIN" value={form.isin ?? ""} onChange={(v) => set("isin", v)} />
              <Field label="Rating" value={form.rating ?? ""} onChange={(v) => set("rating", v)} />
            </>
          )}
          <Field label="Notes" value={form.notes} onChange={(v) => set("notes", v)} />
        </div>

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg font-mono text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}>
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={save} className="flex-1 py-2 rounded-lg font-mono text-xs" style={{ background: "var(--gold)", color: "#111" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypePill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded-full font-mono text-[10px]"
      style={{
        background: active ? "rgba(201,168,76,0.12)" : "var(--bg-2)",
        border:     `1px solid ${active ? "rgba(201,168,76,0.35)" : "var(--border)"}`,
        color:      active ? "var(--gold-l)" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  type?:    string;
}) {
  return (
    <label className="block">
      <div className="stat-label mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 font-mono text-sm"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
    </label>
  );
}
