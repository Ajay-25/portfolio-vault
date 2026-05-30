import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchBulkNAVs } from "@/lib/apis/amfi";
import { fetchUSDINR } from "@/lib/apis/prices";

/**
 * Runs on the 28th of each month at midnight IST (18:30 UTC on 27th).
 * Automatically logs portfolio snapshots to the history table.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [portfolios, usdInr] = await Promise.all([
    prisma.portfolio.findMany({ include: { mfHoldings: true, stockHoldings: true } }),
    fetchUSDINR(),
  ]);

  const allCodes = [...new Set(portfolios.flatMap((p) => p.mfHoldings.map((h) => h.schemeCode)))];
  const navMap   = await fetchBulkNAVs(allCodes);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = [];
  for (const portfolio of portfolios) {
    const mfValue = portfolio.mfHoldings.reduce((s, h) => {
      return s + h.units * (navMap.get(h.schemeCode)?.nav ?? 0);
    }, 0);
    const stockValue = portfolio.stockHoldings.reduce((s, st) => {
      const fx = st.currency === "USD" ? usdInr : 1;
      return s + st.qty * st.avgPrice * fx;
    }, 0);
    const mfInvested = portfolio.mfHoldings.reduce((s, h) => {
      return s + (h.avgNAV ? h.units * h.avgNAV : 0);
    }, 0);

    await prisma.snapshot.upsert({
      where:  { portfolioId_date: { portfolioId: portfolio.id, date: today } },
      update: { totalValue: mfValue + stockValue, totalInvested: mfInvested },
      create: { portfolioId: portfolio.id, date: today, totalValue: mfValue + stockValue, totalInvested: mfInvested },
    });

    results.push({ portfolio: portfolio.name, value: mfValue + stockValue });
  }

  return NextResponse.json({ ok: true, snapshots: results, date: today });
}
