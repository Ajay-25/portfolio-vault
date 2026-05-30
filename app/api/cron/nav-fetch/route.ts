import { NextRequest, NextResponse } from "next/server";
import { forceRefreshAllNAVs } from "@/lib/apis/amfi";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await forceRefreshAllNAVs();

  return NextResponse.json({
    ...result,
    source:    "AMFI NAVAll.txt",
    timestamp: new Date().toISOString(),
  });
}
