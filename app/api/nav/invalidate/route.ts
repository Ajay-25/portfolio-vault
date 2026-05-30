import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { invalidateNAVCache } from "@/lib/data/nav-server";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await invalidateNAVCache();
  return NextResponse.json({ ok: true, message: "NAV cache invalidated" });
}
