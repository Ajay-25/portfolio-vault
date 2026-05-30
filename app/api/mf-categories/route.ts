import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listMfCategoryLabels } from "@/lib/data/mf-categories-server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await listMfCategoryLabels();
  return NextResponse.json({ categories });
}
