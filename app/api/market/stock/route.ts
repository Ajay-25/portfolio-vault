import { NextRequest, NextResponse } from "next/server";
import { fetchStockPrice } from "@/lib/apis/prices";

/** GET /api/market/stock?symbol=RELIANCE&exchange=NSE */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawSymbol = searchParams.get("symbol");
  const exchange = searchParams.get("exchange") ?? "NSE";

  if (!rawSymbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const symbol = decodeURIComponent(rawSymbol).trim();

  const data = await fetchStockPrice(symbol, exchange);

  if (!data) {
    return NextResponse.json({ error: "Price not found" }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
  });
}
