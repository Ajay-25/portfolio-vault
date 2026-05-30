import { NextRequest, NextResponse } from "next/server";
import { forceRefreshAllNAVs } from "@/lib/apis/amfi";
import { invalidateNAVCache } from "@/lib/data/nav-server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await forceRefreshAllNAVs();

  await invalidateNAVCache();

  return NextResponse.json({
    ...result,
    cacheInvalidated: true,
    source:           "AMFI NAVAll.txt",
    timestamp:        new Date().toISOString(),
  });
}
