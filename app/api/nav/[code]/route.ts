import { NextRequest, NextResponse } from "next/server";
import { fetchNAV } from "@/lib/apis/amfi";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const result   = await fetchNAV(code);

  if (!result) {
    return NextResponse.json({ error: "NAV not found" }, { status: 404 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=60" },
  });
}
