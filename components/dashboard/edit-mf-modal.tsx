"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MfRow } from "@/lib/portfolio-data";
import { MF_CATEGORIES } from "@/lib/utils/mf-category";

type EditMfModalProps = {
  row:     MfRow;
  onClose: () => void;
};

export function EditMfModal({ row, onClose }: EditMfModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([...MF_CATEGORIES]);
  const [form, setForm] = useState({
    schemeCode:  row.schemeCode,
    schemeName:  row.schemeName,
    units:       String(row.units),
    avgNAV:      row.avgNAV != null ? String(row.avgNAV) : "",
    sipAmount:   row.sipAmount != null ? String(row.sipAmount) : "",
    sipDate:     row.sipDate != null ? String(row.sipDate) : "7",
    category:    row.category ?? "Flexi",
    status:      row.status,
    notes:       "",
  });

  useEffect(() => {
    fetch("/api/mf-categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories) && d.categories.length) {
          setCategories(d.categories);
        }
      })
      .catch(() => undefined);
  }, []);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/holdings/mf", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          id:         row.id,
          schemeCode: form.schemeCode.trim(),
          schemeName: form.schemeName.trim(),
          units:      parseFloat(form.units) || 0,
          avgNAV:     form.avgNAV === "" ? null : parseFloat(form.avgNAV),
          sipAmount:  form.sipAmount === "" ? null : parseInt(form.sipAmount, 10),
          sipDate:    form.sipDate === "" ? null : parseInt(form.sipDate, 10),
          category:   form.category || null,
          status:     form.status,
          notes:      form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to save MF holding");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 md:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card animate-slide-up max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-medium" style={{ color: "var(--text)" }}>
              Edit MF holding
            </div>
            <div className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              {row.schemeCode}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Scheme code" value={form.schemeCode} onChange={(v) => set("schemeCode", v)} />
          <Field label="Fund name" value={form.schemeName} onChange={(v) => set("schemeName", v)} />
          <Field label="Units" value={form.units} onChange={(v) => set("units", v)} type="number" step="0.001" />
          <Field label="Avg NAV (₹)" value={form.avgNAV} onChange={(v) => set("avgNAV", v)} type="number" step="0.01" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="SIP (₹/mo)" value={form.sipAmount} onChange={(v) => set("sipAmount", v)} type="number" />
            <label className="block">
              <div className="stat-label mb-1">SIP date</div>
              <select
                className="w-full rounded-lg px-3 py-2 font-mono text-sm"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                value={form.sipDate}
                onChange={(e) => set("sipDate", e.target.value)}
              >
                <option value="">None</option>
                <option value="7">7th</option>
                <option value="28">28th</option>
              </select>
            </label>
          </div>
          <label className="block">
            <div className="stat-label mb-1">Category</div>
            <select
              className="w-full rounded-lg px-3 py-2 font-mono text-sm"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="stat-label mb-1">Status</div>
            <select
              className="w-full rounded-lg px-3 py-2 font-mono text-sm"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="active">active</option>
              <option value="hold">hold</option>
              <option value="exit">exit</option>
            </select>
          </label>
          <Field label="Notes" value={form.notes} onChange={(v) => set("notes", v)} />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg py-2 font-mono text-xs"
            style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !form.schemeCode.trim() || !form.schemeName.trim()}
            onClick={save}
            className="flex-1 rounded-lg py-2 font-mono text-xs"
            style={{ background: "var(--gold)", color: "#111" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  type?:    string;
  step?:    string;
}) {
  return (
    <label className="block">
      <div className="stat-label mb-1">{label}</div>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 font-mono text-sm"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
    </label>
  );
}
