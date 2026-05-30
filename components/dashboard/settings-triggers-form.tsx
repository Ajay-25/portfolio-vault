"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TriggerRow {
  id: string;
  label: string;
  niftyLevel: number;
  deployAmount: number;
}

interface SettingsTriggersFormProps {
  triggers: TriggerRow[];
}

export function SettingsTriggersForm({ triggers: initial }: SettingsTriggersFormProps) {
  const router = useRouter();
  const [triggers, setTriggers] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const update = (id: string, field: "niftyLevel" | "deployAmount", raw: string) => {
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    setTriggers((rows) =>
      rows.map((t) => (t.id === id ? { ...t, [field]: val } : t)),
    );
  };

  const save = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/triggers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggers }),
      });
      if (!res.ok) throw new Error("Save failed");
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <div className="space-y-4">
        {triggers.map((t, i) => (
          <div key={t.id} className="grid grid-cols-3 gap-4 items-end">
            <div>
              <div className="stat-label mb-1.5">Label</div>
              <div
                className="input-field font-mono flex items-center"
                style={{ background: "var(--bg-3)", color: "var(--gold-l)", cursor: "default" }}
              >
                {t.label}
              </div>
            </div>
            <div>
              <div className="stat-label mb-1.5">Nifty Level</div>
              <input
                type="number"
                value={t.niftyLevel}
                onChange={(e) => update(t.id, "niftyLevel", e.target.value)}
                className="input-field font-mono"
                style={{ color: ["var(--teal)", "var(--gold)", "var(--red)"][i] ?? "var(--text)" }}
              />
            </div>
            <div>
              <div className="stat-label mb-1.5">Deploy (₹)</div>
              <input
                type="number"
                value={t.deployAmount}
                onChange={(e) => update(t.id, "deployAmount", e.target.value)}
                className="input-field font-mono"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 mt-5">
        {status === "saved" && (
          <span className="font-mono text-xs" style={{ color: "var(--teal)" }}>
            Saved
          </span>
        )}
        {status === "error" && (
          <span className="font-mono text-xs" style={{ color: "var(--red)" }}>
            Save failed
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          style={{ background: "var(--gold)", color: "#111", fontFamily: "IBM Plex Mono" }}
        >
          {status === "saving" ? "Saving…" : "Save Triggers"}
        </button>
      </div>
    </>
  );
}
