import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const streams = await prisma.workStream.findMany({
    where:   { projectId: id },
    orderBy: { sortOrder: "asc" },
    include: { lineItems: true, transactions: true },
  });
  return NextResponse.json(streams);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const stream = await prisma.workStream.create({
    data: { ...body, projectId: id },
  });
  return NextResponse.json(stream, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  const stream = await prisma.workStream.update({ where: { id }, data });
  return NextResponse.json(stream);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.workStream.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
