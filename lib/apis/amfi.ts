/**
 * lib/apis/amfi.ts
 *
 * Fetches NAVs from AMFI's official bulk file (one HTTP request for all funds).
 * Falls back to mfapi.in per-scheme if the bulk file fails.
 * Caches results in Neon (NavCache table) with a 4-hour TTL.
 */

import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS    = 4 * 60 * 60 * 1000;  // 4 hours
const AMFI_BULK_URL   = "https://www.amfiindia.com/spages/NAVAll.txt";
const MFAPI_BASE      = "https://api.mfapi.in/mf";

export type NavResult = {
  schemeCode: string;
  schemeName: string;
  nav:        number;
  date:       string;
  cached:     boolean;
};

// ── AMFI bulk file parser ──────────────────────────────────────────────────

/**
 * Downloads the AMFI NAVAll.txt file and parses it into a Map.
 * The file has ~14,000 rows — we extract only the scheme codes we need.
 *
 * File format (semicolon-separated, no header on data rows):
 * Scheme Code;ISIN Div Payout;ISIN Growth;Scheme Name;NAV;Date
 * 122639;INF109K01Z23;INF109K01Z15;Parag Parikh Flexi Cap Fund;72.1485;30-May-2026
 */
async function fetchAMFIBulkFile(
  targetCodes: Set<string>
): Promise<Map<string, { nav: number; date: string; name: string }>> {
  const res = await fetch(AMFI_BULK_URL, {
    cache:   "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
    signal:  AbortSignal.timeout(15000), // 15s timeout
  });

  if (!res.ok) throw new Error(`AMFI bulk file returned ${res.status}`);

  const text   = await res.text();
  const lines  = text.split("\n");
  const result = new Map<string, { nav: number; date: string; name: string }>();

  for (const line of lines) {
    const parts = line.trim().split(";");
    // Data rows have exactly 6 semicolon-separated fields
    if (parts.length !== 6) continue;

    const [code, , , name, navStr, date] = parts;
    const trimmedCode = code.trim();

    if (!targetCodes.has(trimmedCode)) continue;

    const nav = parseFloat(navStr.trim());
    if (isNaN(nav) || nav <= 0) continue;

    result.set(trimmedCode, {
      nav,
      date: date.trim(),
      name: name.trim(),
    });
  }

  return result;
}

// ── Single scheme fallback via mfapi.in ───────────────────────────────────

async function fetchFromMFAPI(schemeCode: string): Promise<NavResult | null> {
  try {
    const res  = await fetch(`${MFAPI_BASE}/${schemeCode}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const nav  = parseFloat(data.data[0].nav);
    const date = data.data[0].date as string;
    const name = data.meta.scheme_name as string;
    return { schemeCode, schemeName: name, nav, date, cached: false };
  } catch {
    return null;
  }
}

// ── Cache helpers ──────────────────────────────────────────────────────────

function isCacheStale(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() > CACHE_TTL_MS;
}

async function upsertCache(
  schemeCode: string,
  nav:        number,
  navDate:    string,
  schemeName: string
): Promise<void> {
  await prisma.navCache.upsert({
    where:  { schemeCode },
    update: { nav, navDate, schemeName },
    create: { schemeCode, nav, navDate, schemeName },
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch NAVs for multiple scheme codes efficiently.
 *
 * Strategy:
 * 1. Check Neon cache — return all fresh entries immediately.
 * 2. For stale/missing codes, download the AMFI bulk file once.
 * 3. Parse only the needed scheme codes from the bulk file.
 * 4. For any codes still missing from the bulk file, fall back to mfapi.in.
 * 5. Update cache for all newly fetched NAVs.
 */
export async function fetchBulkNAVs(
  schemeCodes: string[]
): Promise<Map<string, NavResult>> {
  if (schemeCodes.length === 0) return new Map();

  const result     = new Map<string, NavResult>();
  const staleCodes = new Set<string>();

  // Step 1: check cache
  const cached = await prisma.navCache.findMany({
    where: { schemeCode: { in: schemeCodes } },
  });

  const cacheMap = new Map(cached.map((c) => [c.schemeCode, c]));

  for (const code of schemeCodes) {
    const entry = cacheMap.get(code);
    if (entry && !isCacheStale(entry.updatedAt)) {
      result.set(code, {
        schemeCode: code,
        schemeName: entry.schemeName ?? "",
        nav:        entry.nav,
        date:       entry.navDate,
        cached:     true,
      });
    } else {
      staleCodes.add(code);
    }
  }

  if (staleCodes.size === 0) return result;

  // Step 2: fetch AMFI bulk file for stale codes
  try {
    const amfiData = await fetchAMFIBulkFile(staleCodes);

    const cacheUpdates: Promise<void>[] = [];

    for (const code of staleCodes) {
      const data = amfiData.get(code);
      if (data) {
        result.set(code, {
          schemeCode: code,
          schemeName: data.name,
          nav:        data.nav,
          date:       data.date,
          cached:     false,
        });
        cacheUpdates.push(upsertCache(code, data.nav, data.date, data.name));
        staleCodes.delete(code); // mark as resolved
      }
    }

    // Persist cache updates in background
    await Promise.allSettled(cacheUpdates);
  } catch (err) {
    console.warn("AMFI bulk file fetch failed, falling back to mfapi.in:", err);
  }

  // Step 3: fallback to mfapi.in for any codes not in the bulk file
  if (staleCodes.size > 0) {
    const fallbacks = await Promise.allSettled(
      [...staleCodes].map(fetchFromMFAPI)
    );

    const cacheUpdates: Promise<void>[] = [];

    fallbacks.forEach((r, i) => {
      const code = [...staleCodes][i];
      if (r.status === "fulfilled" && r.value) {
        result.set(code, r.value);
        cacheUpdates.push(
          upsertCache(code, r.value.nav, r.value.date, r.value.schemeName)
        );
      } else {
        // Return stale cache entry rather than nothing
        const staleEntry = cacheMap.get(code);
        if (staleEntry) {
          result.set(code, {
            schemeCode: code,
            schemeName: staleEntry.schemeName ?? "",
            nav:        staleEntry.nav,
            date:       staleEntry.navDate,
            cached:     true,
          });
        }
      }
    });

    await Promise.allSettled(cacheUpdates);
  }

  return result;
}

/**
 * Fetch NAV for a single scheme code.
 * Used by the /api/nav/[code] route.
 */
export async function fetchNAV(schemeCode: string): Promise<NavResult | null> {
  const map = await fetchBulkNAVs([schemeCode]);
  return map.get(schemeCode) ?? null;
}

/**
 * Force-refresh all NAVs for scheme codes in the database.
 * Bypasses cache — always downloads fresh from AMFI.
 * Used by the cron job and the "Refresh NAVs" button.
 */
export async function forceRefreshAllNAVs(): Promise<{
  updated: number;
  failed:  string[];
  asOf:    string;
}> {
  const holdings = await prisma.mFHolding.findMany({
    select:   { schemeCode: true },
    distinct: ["schemeCode"],
  });

  const allCodes = holdings.map((h) => h.schemeCode);
  if (allCodes.length === 0) return { updated: 0, failed: [], asOf: "" };

  const targetCodes = new Set(allCodes);

  // Always hit AMFI fresh — ignore cache TTL
  let amfiData = new Map<string, { nav: number; date: string; name: string }>();
  try {
    amfiData = await fetchAMFIBulkFile(targetCodes);
  } catch (err) {
    console.error("forceRefreshAllNAVs: AMFI bulk fetch failed:", err);
  }

  const updated: string[] = [];
  const failed:  string[] = [];
  let latestDate = "";

  for (const code of allCodes) {
    const data = amfiData.get(code);
    if (data) {
      await upsertCache(code, data.nav, data.date, data.name);
      updated.push(code);
      latestDate = data.date;
    } else {
      // Try mfapi.in as last resort for this specific fund
      const fallback = await fetchFromMFAPI(code);
      if (fallback) {
        await upsertCache(code, fallback.nav, fallback.date, fallback.schemeName);
        updated.push(code);
        latestDate = fallback.date;
      } else {
        failed.push(code);
      }
    }
  }

  return { updated: updated.length, failed, asOf: latestDate };
}
