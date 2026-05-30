import { NextResponse } from "next/server";
import { fetchUSDINR } from "@/lib/apis/prices";

export async function GET() {
  const rate = await fetchUSDINR();
  return NextResponse.json({ pair: "USDINR", rate }, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
  });
}
