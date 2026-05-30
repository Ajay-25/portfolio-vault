/**
 * Fix incorrect AMFI scheme codes → correct Direct Growth codes from mfapi.in
 * Run: npx tsx prisma/fix-mf-scheme-codes.ts
 */
import { PrismaClient } from "@prisma/client";
import { formatMFSchemeName } from "../lib/utils/mf-scheme-name";
import { fetchBulkNAVs } from "../lib/apis/amfi";

const MFAPI_BASE = "https://api.mfapi.in/mf";

/** oldCode → newCode (verified on mfapi.in, Direct Growth plans) */
const CODE_FIXES: Record<string, string> = {
  "119028": "118989", // HDFC Mid Cap Fund (was wrong: DSP Natural Resources)
  "118825": "118778", // Nippon India Small Cap
  "120255": "119775", // Kotak Midcap (was wrong: ICICI Debt)
  "135798": "120684", // ICICI Nifty Next 50 Index
  "143979": "149389", // ICICI Nifty Midcap 150 Index
  "120578": "120251", // ICICI Equity & Debt (mom)
  "119189": "118968", // HDFC Balanced Advantage (mom)
};

/** Swap two codes within same portfolio (Nifty 50 ↔ Gold ETF were crossed) */
const SWAP_FIXES: Array<{ oldNifty50: string; oldGold: string; nifty50: string; gold: string }> = [
  { oldNifty50: "120685", oldGold: "135759", nifty50: "120620", gold: "120685" },
];

const prisma = new PrismaClient();

async function officialName(code: string): Promise<string> {
  try {
    const res = await fetch(`${MFAPI_BASE}/${code}`, { cache: "no-store" });
    if (!res.ok) return code;
    const data = await res.json();
    const name = data.meta?.scheme_name as string | undefined;
    return name ? formatMFSchemeName(name) : code;
  } catch {
    return code;
  }
}

async function applyCodeChange(
  portfolioId: string,
  oldCode: string,
  newCode: string,
): Promise<void> {
  const holding = await prisma.mFHolding.findUnique({
    where: { portfolioId_schemeCode: { portfolioId, schemeCode: oldCode } },
  });
  if (!holding) return;

  const existingTarget = await prisma.mFHolding.findUnique({
    where: { portfolioId_schemeCode: { portfolioId, schemeCode: newCode } },
  });
  if (existingTarget) {
    console.warn(`  skip ${portfolioId} ${oldCode}→${newCode}: target already exists`);
    return;
  }

  const schemeName = await officialName(newCode);
  await prisma.mFHolding.update({
    where: { id: holding.id },
    data:  { schemeCode: newCode, schemeName },
  });
  console.log(`  ✓ ${portfolioId}: ${oldCode} → ${newCode}  (${schemeName})`);
}

async function swapNiftyGold(portfolioId: string, swap: (typeof SWAP_FIXES)[0]) {
  const niftyRow = await prisma.mFHolding.findUnique({
    where: { portfolioId_schemeCode: { portfolioId, schemeCode: swap.oldNifty50 } },
  });
  const goldRow = await prisma.mFHolding.findUnique({
    where: { portfolioId_schemeCode: { portfolioId, schemeCode: swap.oldGold } },
  });
  if (!niftyRow || !goldRow) return;

  const tempNifty = `__tmp_${swap.oldNifty50}`;
  const tempGold  = `__tmp_${swap.oldGold}`;

  await prisma.mFHolding.update({ where: { id: niftyRow.id }, data: { schemeCode: tempNifty } });
  await prisma.mFHolding.update({ where: { id: goldRow.id }, data: { schemeCode: tempGold } });

  const goldName  = await officialName(swap.gold);
  const niftyName = await officialName(swap.nifty50);

  await prisma.mFHolding.update({
    where: { id: goldRow.id },
    data:  { schemeCode: swap.gold, schemeName: goldName },
  });
  await prisma.mFHolding.update({
    where: { id: niftyRow.id },
    data:  { schemeCode: swap.nifty50, schemeName: niftyName },
  });

  console.log(`  ✓ ${portfolioId}: Nifty 50 ${swap.oldNifty50}→${swap.nifty50} (${niftyName})`);
  console.log(`  ✓ ${portfolioId}: Gold ETF ${swap.oldGold}→${swap.gold} (${goldName})`);
}

async function main() {
  const portfolios = await prisma.portfolio.findMany({ select: { id: true } });

  console.log("Fixing scheme codes...\n");

  for (const { id: portfolioId } of portfolios) {
    for (const [oldCode, newCode] of Object.entries(CODE_FIXES)) {
      await applyCodeChange(portfolioId, oldCode, newCode);
    }
    for (const swap of SWAP_FIXES) {
      await swapNiftyGold(portfolioId, swap);
    }
  }

  const staleCodes = [
    ...Object.keys(CODE_FIXES),
    ...Object.values(CODE_FIXES),
    "135759",
    "__tmp_120685",
    "__tmp_135759",
  ];
  await prisma.navCache.deleteMany({
    where: { schemeCode: { in: [...new Set(staleCodes)] } },
  });

  const holdings = await prisma.mFHolding.findMany({ select: { schemeCode: true } });
  const codes = [...new Set(holdings.map((h) => h.schemeCode))];
  await fetchBulkNAVs(codes);

  console.log("\nFinal holdings:");
  const all = await prisma.mFHolding.findMany({
    include: { portfolio: { select: { name: true } } },
    orderBy: [{ portfolioId: "asc" }, { schemeCode: "asc" }],
  });
  for (const h of all) {
    console.log(`  ${h.portfolio.name.padEnd(22)} ${h.schemeCode.padEnd(8)} ${h.schemeName}`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
