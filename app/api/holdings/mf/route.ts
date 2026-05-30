import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  const holdings = await prisma.mFHolding.findMany({
    where: portfolioId ? { portfolioId } : undefined,
  });
  return NextResponse.json(holdings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body    = await req.json();
  const holding = await prisma.mFHolding.create({ data: body });
  return NextResponse.json(holding, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  const holding = await prisma.mFHolding.update({ where: { id }, data });
  return NextResponse.json(holding);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.mFHolding.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
