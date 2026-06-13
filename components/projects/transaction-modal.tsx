"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { HomeProject } from "@/lib/project-data";

const PAYMENT_MODES = [
  { value: "upi",         label: "UPI" },
  { value: "cash",        label: "Cash" },
  { value: "neft",        label: "NEFT" },
  { value: "rtgs",        label: "RTGS" },
  { value: "credit_card", label: "Credit card" },
  { value: "cheque",      label: "Cheque" },
  { value: "netbanking",  label: "Net banking" },
];

const PHASES = [
  { value: "advance", label: "Advance" },
  { value: "part",    label: "Part" },
  { value: "final",   label: "Final" },
  { value: "full",    label: "Full" },
];

export function TransactionModal({
  project,
  workStreamId: initialWorkStreamId,
  lineItemId:   initialLineItemId,
  onClose,
}: {
  project:        HomeProject;
  workStreamId?:  string;
  lineItemId?:    string;
  onClose:        () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [workStreamId, setWorkStreamId] = useState(initialWorkStreamId ?? project.workStreams[0]?.id ?? "");
  const [lineItemId, setLineItemId] = useState(initialLineItemId ?? "");
  const [paidByPayerId, setPaidByPayerId] = useState(project.payers.find((p) => p.isSelf)?.id ?? "");
  const [settlementType, setSettlementType] = useState("self");
  const [phase, setPhase] = useState("full");
  const [paymentMode, setPaymentMode] = useState("upi");
  const [paidByCard, setPaidByCard] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const selectedPayer = project.payers.find((p) => p.id === paidByPayerId);
  const isSelfPayer = selectedPayer?.isSelf ?? true;

  const lineItemOptions = useMemo(() => {
    const ws = project.workStreams.find((s) => s.id === workStreamId);
    return ws?.lineItems ?? [];
  }, [project.workStreams, workStreamId]);

  const onPayerChange = (payerId: string) => {
    setPaidByPayerId(payerId);
    const payer = project.payers.find((p) => p.id === payerId);
    if (payer?.isSelf) setSettlementType("self");
    else if (settlementType === "self") setSettlementType("repayable");
  };

  const onWorkStreamChange = (wsId: string) => {
    setWorkStreamId(wsId);
    setLineItemId("");
  };

  const save = async () => {
    if (!description.trim() || !amount || !workStreamId) return;
    setSaving(true);

    await fetch(`/api/projects/${project.id}/transactions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        description:    description.trim(),
        amount:         Number(amount),
        date,
        workStreamId,
        lineItemId:     lineItemId || null,
        paidByPayerId:  paidByPayerId || null,
        settlementType: isSelfPayer ? "self" : settlementType,
        phase,
        paymentMode,
        paidBy_card:    paymentMode === "credit_card" ? paidByCard.trim() || null : null,
        reference:      reference.trim() || null,
        notes:          notes.trim() || null,
        direction:      "outflow",
      }),
    });

    setSaving(false);
    onClose();
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium" style={{ color: "var(--text)" }}>Add transaction</div>
          <button type="button" onClick={onClose} className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Description">
            <input
              className="field-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Advance to carpenter"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)">
              <input
                className="field-input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Date">
              <input
                className="field-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Work stream">
            <select
              className="field-input"
              value={workStreamId}
              onChange={(e) => onWorkStreamChange(e.target.value)}
            >
              {project.workStreams.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Line item (optional)">
            <select
              className="field-input"
              value={lineItemId}
              onChange={(e) => setLineItemId(e.target.value)}
            >
              <option value="">— None —</option>
              {lineItemOptions.map((li) => (
                <option key={li.id} value={li.id}>{li.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Paid by">
            <select
              className="field-input"
              value={paidByPayerId}
              onChange={(e) => onPayerChange(e.target.value)}
            >
              {project.payers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          {!isSelfPayer && (
            <Field label="Settlement">
              <div className="flex flex-wrap gap-3">
                {[
                  { value: "repayable", label: "Repayable (owe back)" },
                  { value: "gift",      label: "Gift" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                    <input
                      type="radio"
                      name="settlement"
                      checked={settlementType === opt.value}
                      onChange={() => setSettlementType(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field label="Phase">
            <div className="flex flex-wrap gap-3">
              {PHASES.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                  <input
                    type="radio"
                    name="phase"
                    checked={phase === opt.value}
                    onChange={() => setPhase(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Payment mode">
            <select
              className="field-input"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>

          {paymentMode === "credit_card" && (
            <Field label="Whose card">
              <input
                className="field-input"
                value={paidByCard}
                onChange={(e) => setPaidByCard(e.target.value)}
                placeholder="FIL HDFC card"
              />
            </Field>
          )}

          <Field label="Reference (optional)">
            <input
              className="field-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / txn id"
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              className="field-input min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg font-mono text-xs"
            style={{ background: "var(--bg-2)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !description.trim() || !amount}
            className="flex-1 py-2 rounded-lg font-mono text-xs"
            style={{ background: "var(--gold)", color: "#111", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "Save transaction"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .field-input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          background: var(--bg-2);
          border: 1px solid var(--border);
          color: var(--text);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="stat-label mb-1">{label}</div>
      {children}
    </div>
  );
}
