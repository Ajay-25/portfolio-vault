import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  const holdings = await prisma.fixedIncomeHolding.findMany({
    where: portfolioId ? { portfolioId } : undefined,
    orderBy: [{ maturityDate: "asc" }, { label: "asc" }],
  });
  return NextResponse.json(holdings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const holding = await prisma.fixedIncomeHolding.create({
    data: {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : null,
      maturityDate: body.maturityDate ? new Date(body.maturityDate) : null,
    },
  });
  return NextResponse.json(holding, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...raw } = await req.json();
  const data = {
    ...raw,
    ...(raw.startDate !== undefined && {
      startDate: raw.startDate ? new Date(raw.startDate) : null,
    }),
    ...(raw.maturityDate !== undefined && {
      maturityDate: raw.maturityDate ? new Date(raw.maturityDate) : null,
    }),
  };
  const holding = await prisma.fixedIncomeHolding.update({ where: { id }, data });
  return NextResponse.json(holding);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.fixedIncomeHolding.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
