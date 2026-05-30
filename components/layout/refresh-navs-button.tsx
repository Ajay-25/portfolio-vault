"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshNAVsButton() {
  const router = useRouter();
  const [status, setStatus]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult]   = useState<{ updated: number; asOf: string } | null>(null);

  const refresh = async () => {
    setStatus("loading");
    setResult(null);
    try {
      const res  = await fetch("/api/nav/bulk", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult({ updated: data.updated, asOf: data.asOf });
        setStatus("done");
        router.refresh();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    // Reset to idle after 6 seconds
    setTimeout(() => setStatus("idle"), 6000);
  };

  return (
    <div className="px-3 pb-3">
      <button
        type="button"
        onClick={refresh}
        disabled={status === "loading"}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150"
        style={{
          background: status === "done"  ? "rgba(0,200,150,0.08)"  :
                      status === "error" ? "rgba(245,56,89,0.08)"  :
                      "rgba(201,168,76,0.06)",
          border:     status === "done"  ? "1px solid rgba(0,200,150,0.2)"  :
                      status === "error" ? "1px solid rgba(245,56,89,0.2)"  :
                      "1px solid rgba(201,168,76,0.15)",
          color:      status === "done"  ? "var(--teal)"  :
                      status === "error" ? "var(--red)"   :
                      "var(--gold)",
          cursor:     status === "loading" ? "not-allowed" : "pointer",
          opacity:    status === "loading" ? 0.7 : 1,
        }}
      >
        {status === "loading" ? (
          <>
            <span className="spinner" style={{ width: 12, height: 12 }} />
            <span className="font-mono text-[11px]">Fetching from AMFI...</span>
          </>
        ) : status === "done" && result ? (
          <>
            <span className="font-mono text-base">✓</span>
            <div className="flex-1 text-left">
              <div className="font-mono text-[11px]">{result.updated} NAVs updated</div>
              <div className="font-mono text-[9px]" style={{ color: "var(--text-muted)", marginTop: 1 }}>
                as of {result.asOf}
              </div>
            </div>
          </>
        ) : status === "error" ? (
          <>
            <span className="font-mono text-base">✕</span>
            <span className="font-mono text-[11px]">Refresh failed — retry</span>
          </>
        ) : (
          <>
            <span className="font-mono text-base">↺</span>
            <span className="font-mono text-[11px]">Refresh Live NAVs</span>
          </>
        )}
      </button>
    </div>
  );
}
