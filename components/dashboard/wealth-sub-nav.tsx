"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  WEALTH_OWNERS,
  isActiveWealthNav,
  wealthPath,
  type WealthOwnerSlug,
  type WealthSegment,
} from "@/lib/wealth-config";

const SEGMENTS: { key: WealthSegment; label: string; hideForMother?: boolean }[] = [
  { key: "", label: "Summary" },
  { key: "mf", label: "MF" },
  { key: "stocks", label: "Stocks" },
  { key: "fixed-income", label: "Fixed income" },
  { key: "insurance", label: "Insurance" },
];

interface WealthSubNavProps {
  owner: WealthOwnerSlug;
}

export function WealthSubNav({ owner }: WealthSubNavProps) {
  const pathname = usePathname();
  const search = useSearchParams();
  const searchStr = search.toString() ? `?${search.toString()}` : "";

  return (
    <nav
      className="flex flex-wrap gap-1 mb-5 p-1 rounded-lg"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      aria-label="Wealth sections"
    >
      {SEGMENTS.map((seg) => {
        const href =
          seg.key === "stocks" && owner === "mine"
            ? wealthPath(owner, "stocks", { market: "in" })
            : wealthPath(owner, seg.key);
        const isActive = isActiveWealthNav(pathname, searchStr, owner, seg.key);

        return (
          <Link
            key={seg.key || "summary"}
            href={href}
            className="px-3 py-1.5 rounded-md text-xs font-mono transition-colors"
            style={{
              background: isActive ? "rgba(201,168,76,0.12)" : "transparent",
              color: isActive ? "var(--gold-l)" : "var(--text-dim)",
              border: isActive ? "1px solid rgba(201,168,76,0.25)" : "1px solid transparent",
            }}
          >
            {seg.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function wealthOwnerLabel(owner: WealthOwnerSlug): string {
  return WEALTH_OWNERS[owner].label;
}

export function WealthMarketTabs({ owner }: { owner: WealthOwnerSlug }) {
  const search = useSearchParams();
  const market = search.get("market") ?? "in";
  const markets = WEALTH_OWNERS[owner].stocksMarkets;

  if (markets.length <= 1) return null;

  return (
    <nav className="flex gap-1 mb-4" aria-label="Stock markets">
      {markets.map((m) => {
        const active = market === m;
        const label = m === "us" ? "US" : "India (NSE)";
        return (
          <Link
            key={m}
            href={wealthPath(owner, "stocks", { market: m })}
            className="rounded-md px-3 py-1 font-mono text-[11px] transition-all"
            style={{
              background: active ? "var(--bg-3)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              border: `1px solid ${active ? "var(--border)" : "transparent"}`,
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
