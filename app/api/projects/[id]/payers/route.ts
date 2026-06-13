import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payers = await prisma.payer.findMany({
    where:   { projectId: id },
    include: { transactions: true, advances: { include: { transactions: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(payers);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const payer = await prisma.payer.create({
    data: { ...body, projectId: id },
  });
  return NextResponse.json(payer, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  const payer = await prisma.payer.update({ where: { id }, data });
  return NextResponse.json(payer);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.payer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
