import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.actionItem.findMany({
    where: { ownerId: "primary" },
    orderBy: [{ bucket: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, priority = "medium", bucket = "pending", dueDate } = body;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const item = await prisma.actionItem.create({
    data: {
      ownerId: "primary",
      title,
      description: description ?? null,
      priority,
      bucket,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
