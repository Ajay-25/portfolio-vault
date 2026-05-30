import { NextResponse } from "next/server";
import { fetchNifty } from "@/lib/apis/prices";

export async function GET() {
  const data = await fetchNifty();

  if (!data) {
    return NextResponse.json({ error: "Could not fetch Nifty data" }, { status: 502 });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
  });
}
