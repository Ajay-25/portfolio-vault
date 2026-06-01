"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StockRow } from "@/lib/portfolio-data";

type EditStockModalProps = {
  row:     StockRow;
  onClose: () => void;
};

export function EditStockModal({ row, onClose }: EditStockModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    symbol:      row.symbol,
    displayName: row.displayName ?? "",
    exchange:    row.exchange,
    qty:         String(row.qty),
    avgPrice:    String(row.avgPrice),
    action:      row.action ?? "",
    notes:       "",
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const currency = form.exchange === "NYSE" ? "USD" : "INR";
      const res = await fetch("/api/holdings/stock", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          id:          row.id,
          symbol:      form.symbol.trim().toUpperCase(),
          displayName: form.displayName.trim() || form.symbol.trim().toUpperCase(),
          exchange:    form.exchange,
          currency,
          qty:         parseFloat(form.qty) || 0,
          avgPrice:    parseFloat(form.avgPrice) || 0,
          action:      form.action.trim() || null,
          notes:       form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to save stock holding");
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
              Edit stock holding
            </div>
            <div className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              {row.symbol} · {row.exchange}
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
          <Field label="Symbol" value={form.symbol} onChange={(v) => set("symbol", v)} />
          <Field label="Display name" value={form.displayName} onChange={(v) => set("displayName", v)} />
          <label className="block">
            <div className="stat-label mb-1">Exchange</div>
            <select
              className="w-full rounded-lg px-3 py-2 font-mono text-sm"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
              value={form.exchange}
              onChange={(e) => set("exchange", e.target.value)}
            >
              <option value="NSE">NSE</option>
              <option value="NYSE">NYSE</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" value={form.qty} onChange={(v) => set("qty", v)} type="number" step="any" />
            <Field
              label={form.exchange === "NYSE" ? "Avg price ($)" : "Avg price (₹)"}
              value={form.avgPrice}
              onChange={(v) => set("avgPrice", v)}
              type="number"
              step="any"
            />
          </div>
          <Field label="Action note" value={form.action} onChange={(v) => set("action", v)} placeholder="HOLD, BUY, EXIT…" />
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
            disabled={saving || !form.symbol.trim()}
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
  placeholder,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  type?:       string;
  step?:       string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="stat-label mb-1">{label}</div>
      <input
        type={type}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 font-mono text-sm"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text)" }}
      />
    </label>
  );
}
