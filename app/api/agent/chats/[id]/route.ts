import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const OWNER_ID = "primary";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const chat = await prisma.agentChat.findFirst({
    where:   { id, ownerId: OWNER_ID },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  return NextResponse.json({
    id:        chat.id,
    title:     chat.title,
    model:     chat.model,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages:  chat.messages.map((m) => ({
      id:        m.id,
      role:      m.role,
      content:   m.content,
      toolCalls: m.toolCalls,
      createdAt: m.createdAt,
    })),
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const chat = await prisma.agentChat.findFirst({
    where: { id, ownerId: OWNER_ID },
  });

  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  await prisma.agentChat.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
