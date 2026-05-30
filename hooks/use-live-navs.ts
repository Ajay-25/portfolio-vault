"use client";

/**
 * For pages that want NAVs refreshed in the browser
 * (e.g., after user clicks "Refresh NAVs").
 * Falls back to server-rendered navs prop on initial load.
 */

import { useState } from "react";

export type NavMap = Record<string, { nav: number; date: string; schemeName: string }>;

export function useLiveNAVs(initialNavs: NavMap) {
  const [navs, setNavs]               = useState<NavMap>(initialNavs);
  const [loading, setLoading]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/nav/bulk", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const navRes  = await fetch("/api/nav/bulk");
        const navData = await navRes.json();
        setNavs(navData);
        setLastUpdated(data.asOf);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  return { navs, loading, lastUpdated, refresh };
}
