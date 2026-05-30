import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/agent/models";

const OWNER_ID = "primary";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chats = await prisma.agentChat.findMany({
    where:   { ownerId: OWNER_ID },
    orderBy: { updatedAt: "desc" },
    take:    50,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { content: true, role: true },
      },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(
    chats.map((c) => ({
      id:           c.id,
      title:        c.title,
      model:        c.model,
      createdAt:    c.createdAt,
      updatedAt:    c.updatedAt,
      messageCount: c._count.messages,
      preview:      c.messages[0]?.content?.slice(0, 120) ?? "",
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const model = resolveModel(body.model);

  const chat = await prisma.agentChat.create({
    data: {
      ownerId: OWNER_ID,
      title:   "New chat",
      model,
    },
  });

  return NextResponse.json(chat, { status: 201 });
}
