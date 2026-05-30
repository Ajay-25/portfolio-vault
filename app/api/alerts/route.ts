import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await prisma.alert.findMany({
    where: { ownerId: "primary", active: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { symbol, exchange = "NSE", type, target, message } = body;

  if (!symbol || !type || target === undefined) {
    return NextResponse.json({ error: "symbol, type, and target required" }, { status: 400 });
  }

  const alert = await prisma.alert.create({
    data: {
      ownerId: "primary",
      symbol: String(symbol).toUpperCase(),
      exchange,
      type,
      target: parseFloat(target),
      message: message ?? null,
    },
  });

  return NextResponse.json(alert, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.alert.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
