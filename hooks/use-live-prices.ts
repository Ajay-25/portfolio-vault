"use client";

/**
 * Stock prices change every minute during market hours.
 * They should NEVER block page render — fetch them client-side
 * after the page shell has loaded, then overlay on the table.
 */

import { useState, useEffect, useRef } from "react";
import { stockPriceQuery } from "@/lib/utils/stock-ticker";

export type LivePrice = {
  price:     number;
  changePct: number;
  currency:  string;
};

export type PriceMap = Record<string, LivePrice>; // key = "SYMBOL:EXCHANGE"

export function useLivePrices(
  holdings: Array<{ symbol: string; exchange: string; displayName?: string | null }>,
  refreshIntervalMs = 5 * 60 * 1000, // refresh every 5 min
) {
  const [prices, setPrices]   = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);
  const timerRef              = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchPrices = async () => {
    if (holdings.length === 0) {
      setLoading(false);
      return;
    }

    const results = await Promise.allSettled(
      holdings.map((h) =>
        fetch(`/api/market/stock?${stockPriceQuery(h.symbol, h.exchange, h.displayName)}`)
          .then((r) => r.json())
          .then((data) => ({
            key:       `${h.symbol}:${h.exchange}`,
            price:     data.price     ?? 0,
            changePct: data.changePct ?? 0,
            currency:  data.currency  ?? (h.exchange === "NSE" ? "INR" : "USD"),
          })),
      ),
    );

    const map: PriceMap = {};
    results.forEach((r) => {
      if (r.status === "fulfilled") {
        const { key, ...rest } = r.value;
        map[key] = rest;
      }
    });

    setPrices(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchPrices();
    timerRef.current = setInterval(fetchPrices, refreshIntervalMs);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { prices, loading };
}
