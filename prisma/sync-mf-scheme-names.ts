/**
 * Sync all MF holding scheme names from mfapi and apply Growth (Direct) formatting.
 * Run: npx tsx prisma/sync-mf-scheme-names.ts
 */
import { PrismaClient } from "@prisma/client";
import { formatMFSchemeName } from "../lib/utils/mf-scheme-name";

const MFAPI_BASE = "https://api.mfapi.in/mf";
const prisma = new PrismaClient();

async function fetchOfficialName(schemeCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${MFAPI_BASE}/${schemeCode}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const name = data.meta?.scheme_name as string | undefined;
    return name?.trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const holdings = await prisma.mFHolding.findMany({
    orderBy: [{ portfolioId: "asc" }, { schemeCode: "asc" }],
  });

  console.log(`Syncing ${holdings.length} MF holdings...\n`);

  for (const h of holdings) {
    const official = await fetchOfficialName(h.schemeCode);
    const raw      = official ?? h.schemeName;
    const formatted = formatMFSchemeName(raw);

    if (formatted === h.schemeName) {
      console.log(`  = ${h.schemeCode}  ${formatted}`);
      continue;
    }

    await prisma.mFHolding.update({
      where: { id: h.id },
      data:  { schemeName: formatted },
    });

    console.log(`  ✓ ${h.schemeCode}`);
    console.log(`      was: ${h.schemeName}`);
    console.log(`      now: ${formatted}`);
  }

  // Refresh NavCache names too
  const caches = await prisma.navCache.findMany();
  for (const c of caches) {
    const formatted = formatMFSchemeName(c.schemeName ?? "");
    if (formatted && formatted !== c.schemeName) {
      await prisma.navCache.update({
        where: { schemeCode: c.schemeCode },
        data:  { schemeName: formatted },
      });
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
