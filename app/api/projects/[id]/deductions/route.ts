import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deductions = await prisma.builderDeduction.findMany({
    where:   { projectId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(deductions);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const deduction = await prisma.builderDeduction.create({
    data: { ...body, projectId: id },
  });
  return NextResponse.json(deduction, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  const deduction = await prisma.builderDeduction.update({ where: { id }, data });
  return NextResponse.json(deduction);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.builderDeduction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
