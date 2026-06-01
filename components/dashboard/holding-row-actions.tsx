"use client";

type HoldingRowActionsProps = {
  onEdit:   () => void;
  onDelete: () => void;
};

export function HoldingRowActions({ onEdit, onDelete }: HoldingRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
        aria-label="Edit holding"
        title="Edit"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
        style={{ border: "1px solid rgba(220,80,80,0.25)", color: "var(--red)" }}
        aria-label="Delete holding"
        title="Delete"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2.5 3.5h7M4.5 3.5V2.5h3v1M5 5.5v4M7 5.5v4M3.5 3.5l.5 6.5h4l.5-6.5"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
