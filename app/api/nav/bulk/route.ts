import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchBulkNAVs, forceRefreshAllNAVs } from "@/lib/apis/amfi";

/**
 * GET /api/nav/bulk
 * Returns NAVs for all scheme codes in the database.
 * Uses cache — fast response.
 */
export async function GET() {
  const holdings = await prisma.mFHolding.findMany({
    select:   { schemeCode: true },
    distinct: ["schemeCode"],
  });

  const codes  = holdings.map((h) => h.schemeCode);
  const navMap = await fetchBulkNAVs(codes);

  return NextResponse.json(Object.fromEntries(navMap));
}

/**
 * POST /api/nav/bulk
 * Force-refreshes all NAVs from AMFI — bypasses cache.
 * Called by the sidebar "Refresh Live NAVs" button.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await forceRefreshAllNAVs();

  return NextResponse.json({
    ok:      true,
    updated: result.updated,
    failed:  result.failed,
    asOf:    result.asOf,
    source:  "AMFI NAVAll.txt",
  });
}
