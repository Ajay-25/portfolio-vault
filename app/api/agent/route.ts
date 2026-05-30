import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/agent/models";
import { runAgent } from "@/lib/agent/run";

const OWNER_ID = "primary";

function chatTitleFromMessage(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}...`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { message, chatId, model } = body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const modelId = resolveModel(model);
  let chat = chatId
    ? await prisma.agentChat.findFirst({ where: { id: chatId, ownerId: OWNER_ID } })
    : null;

  if (!chat) {
    chat = await prisma.agentChat.create({
      data: {
        ownerId: OWNER_ID,
        title:   chatTitleFromMessage(message),
        model:   modelId,
      },
    });
  }

  const priorMessages = await prisma.agentMessage.findMany({
    where:   { chatId: chat.id },
    orderBy: { createdAt: "asc" },
    select:  { role: true, content: true },
  });

  await prisma.agentMessage.create({
    data: {
      chatId:  chat.id,
      role:    "user",
      content: message.trim(),
    },
  });

  try {
    const result = await runAgent(
      apiKey,
      modelId,
      priorMessages.map((m) => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      })),
      message.trim(),
    );

    await prisma.agentMessage.create({
      data: {
        chatId:    chat.id,
        role:      "assistant",
        content:   result.reply,
        toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
      },
    });

    const titleUpdate =
      chat.title === "New chat" ? chatTitleFromMessage(message) : chat.title;

    await prisma.agentChat.update({
      where: { id: chat.id },
      data:  {
        title:     titleUpdate,
        model:     modelId,
        updatedAt: new Date(),
      },
    });

    if (result.refreshed) {
      revalidatePath("/dashboard", "layout");
      revalidateTag("agent-context");
    }

    return NextResponse.json({
      chatId:    chat.id,
      reply:     result.reply,
      toolCalls: result.toolCalls,
      refreshed: result.refreshed,
      model:     modelId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Agent error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
