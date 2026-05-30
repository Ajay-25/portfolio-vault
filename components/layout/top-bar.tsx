"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "@/components/layout/sidebar-context";

type NiftyData = { price: number; changePct: number } | null;

export function TopBar({ title }: { title: string }) {
  const { isOpen, toggle } = useSidebar();
  const [nifty, setNifty]     = useState<NiftyData>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime]       = useState("");

  const fetchNifty = async () => {
    try {
      const res  = await fetch("/api/market/nifty");
      const data = await res.json();
      if (res.ok && typeof data.price === "number") {
        setNifty({ price: data.price, changePct: data.changePct ?? 0 });
      } else {
        setNifty(null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchNifty();

    // Refresh every 3 minutes
    const interval = setInterval(fetchNifty, 3 * 60 * 1000);

    // Live clock
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const clock = setInterval(tick, 30 * 1000);

    return () => { clearInterval(interval); clearInterval(clock); };
  }, []);

  const pct = nifty?.changePct ?? 0;
  const isUp = pct >= 0;

  return (
    <header
      className="sticky top-0 z-40 flex min-w-0 items-center justify-between gap-3 px-4 py-3 md:px-6"
      style={{
        background:    "rgba(6,14,31,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom:  "1px solid var(--border)",
      }}
    >
      {/* Left: menu + page title */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md md:hidden"
          style={{
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
            background: "var(--bg-2)",
          }}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          onClick={toggle}
        >
          <span className="font-mono text-base leading-none">{isOpen ? "✕" : "☰"}</span>
        </button>
        <div
          className="min-w-0 truncate font-mono text-xs tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </div>
      </div>

      {/* Right: Nifty + time */}
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        {/* Nifty Pill */}
        <div
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 sm:gap-2 sm:px-3"
          style={{
            background:  "var(--bg-2)",
            border:      "1px solid var(--border)",
          }}
        >
          <span className="live-dot" />
          <span className="font-mono text-[11px]" style={{ color: "var(--text-dim)" }}>NIFTY</span>
          {loading ? (
            <span className="spinner" />
          ) : nifty?.price != null ? (
            <>
              <span className="font-mono text-[12px] font-medium" style={{ color: "var(--text)" }}>
                {nifty.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
              <span
                className="font-mono text-[10px] whitespace-nowrap"
                style={{ color: isUp ? "var(--teal)" : "var(--red)" }}
              >
                {isUp ? "+" : ""}{pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>—</span>
          )}
        </div>

        {/* Time */}
        <div className="hidden font-mono text-[11px] sm:block" style={{ color: "var(--text-muted)" }}>
          {time} IST
        </div>
      </div>
    </header>
  );
}
