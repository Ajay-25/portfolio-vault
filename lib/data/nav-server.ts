/**
 * unstable_cache persists the NAV data across requests — unlike React.cache()
 * which only deduplicates within a single request, unstable_cache survives
 * between navigations until the TTL expires or the tag is revalidated.
 *
 * This means: the first navigation to any page that needs NAVs downloads
 * the AMFI file. Every subsequent navigation in the next 4 hours hits
 * the in-memory/CDN cache instead.
 */
import { unstable_cache } from "next/cache";
import { fetchBulkNAVs } from "@/lib/apis/amfi";

export async function getCachedNAVs(schemeCodes: string[]) {
  if (schemeCodes.length === 0) return {};

  const unique   = [...new Set(schemeCodes)].sort();
  const cacheKey = unique.join(",");

  const cached = unstable_cache(
    async () => {
      const navMap = await fetchBulkNAVs(unique);
      return Object.fromEntries(navMap);
    },
    ["bulk-navs", cacheKey],
    {
      revalidate: 14400, // 4 hours
      tags:       ["navs"],
    },
  );

  return cached();
}

/**
 * Call this from the cron job and the sidebar refresh button
 * to invalidate the unstable_cache immediately.
 */
export async function invalidateNAVCache() {
  const { revalidateTag } = await import("next/cache");
  revalidateTag("navs");
}
