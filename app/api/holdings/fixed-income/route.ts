import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  return new Date(value as string);
}

function normalizeBody(raw: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...raw };
  if ("startDate" in data) data.startDate = parseDate(data.startDate);
  if ("maturityDate" in data) data.maturityDate = parseDate(data.maturityDate);
  if ("valueAsOf" in data) data.valueAsOf = parseDate(data.valueAsOf);
  if ("nextCouponDate" in data) data.nextCouponDate = parseDate(data.nextCouponDate);
  return data;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  const holdings = await prisma.fixedIncomeHolding.findMany({
    where: portfolioId ? { portfolioId, isActive: true } : { isActive: true },
    orderBy: [{ maturityDate: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(holdings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = normalizeBody(await req.json());
  const holding = await prisma.fixedIncomeHolding.create({ data: body as never });
  return NextResponse.json(holding, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...raw } = await req.json();
  const data = normalizeBody(raw);
  const holding = await prisma.fixedIncomeHolding.update({ where: { id }, data: data as never });
  return NextResponse.json(holding);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.fixedIncomeHolding.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
