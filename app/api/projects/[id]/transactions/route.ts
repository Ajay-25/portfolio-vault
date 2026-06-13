import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const txns = await prisma.transaction.findMany({
    where:   { projectId: id },
    include: { payer: true, workStream: true, lineItem: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(txns);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const txn = await prisma.transaction.create({
    data: {
      ...body,
      projectId: id,
      date:      body.date ? new Date(body.date) : new Date(),
    },
  });
  return NextResponse.json(txn, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  if (data.date) data.date = new Date(data.date);
  const txn = await prisma.transaction.update({ where: { id }, data });
  return NextResponse.json(txn);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
