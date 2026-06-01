import { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveModel } from "@/lib/agent/models";
import { runAgentStream } from "@/lib/agent/run";
import { encodeSseEvent, type AgentStreamEvent } from "@/lib/agent/stream-events";
import type { MessageAttachment } from "@/lib/agent/parse-spreadsheet";
import { expandMessageWithAttachments } from "@/lib/agent/parse-spreadsheet";

const OWNER_ID = "primary";

/** Vercel Pro allows up to 300s; bulk agent runs need headroom. */
export const maxDuration = 300;

function chatTitleFromMessage(message: string, attachments?: MessageAttachment[]): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (trimmed) {
    if (trimmed.length <= 60) return trimmed;
    return `${trimmed.slice(0, 57)}...`;
  }
  const first = attachments?.[0]?.fileName ?? "Spreadsheet upload";
  return first.length <= 60 ? first : `${first.slice(0, 57)}...`;
}

function parseAttachments(raw: unknown): MessageAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is MessageAttachment =>
      typeof a === "object" &&
      a != null &&
      typeof (a as MessageAttachment).fileName === "string" &&
      typeof (a as MessageAttachment).parsedText === "string",
  );
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return jsonError("Unauthorized", 401);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return jsonError("GROQ_API_KEY not configured", 503);

  const body = await req.json();
  const { message, chatId, model, attachments: rawAttachments } = body;
  const attachments = parseAttachments(rawAttachments);

  const text = typeof message === "string" ? message.trim() : "";
  if (!text && attachments.length === 0) {
    return jsonError("message or attachments required", 400);
  }

  const modelId = resolveModel(model);
  let chat = chatId
    ? await prisma.agentChat.findFirst({ where: { id: chatId, ownerId: OWNER_ID } })
    : null;

  if (!chat) {
    chat = await prisma.agentChat.create({
      data: {
        ownerId: OWNER_ID,
        title:   chatTitleFromMessage(text, attachments),
        model:   modelId,
      },
    });
  }

  const priorRows = await prisma.agentMessage.findMany({
    where:   { chatId: chat.id },
    orderBy: { createdAt: "asc" },
    select:  { role: true, content: true, attachments: true },
  });

  await prisma.agentMessage.create({
    data: {
      chatId:      chat.id,
      role:        "user",
      content:     text || "(see attached spreadsheet)",
      attachments: attachments.length > 0 ? attachments : undefined,
    },
  });

  const history = priorRows.map((m) => ({
    role:    m.role as "user" | "assistant",
    content: expandMessageWithAttachments(m.content, parseAttachments(m.attachments)),
  }));

  const expandedMessage = expandMessageWithAttachments(text, attachments);
  const chatIdForStream = chat.id;
  const titleUpdate =
    chat.title === "New chat" ? chatTitleFromMessage(text, attachments) : chat.title;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (event: AgentStreamEvent) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      };

      try {
        const gen = runAgentStream(apiKey, modelId, history, expandedMessage, {
          signal: req.signal,
        });
        let result = await gen.next();

        while (!result.done) {
          if (!req.signal.aborted) push(result.value);
          result = await gen.next();
        }

        const agentResult = result.value;

        await prisma.agentMessage.create({
          data: {
            chatId:    chatIdForStream,
            role:      "assistant",
            content:   agentResult.reply,
            toolCalls: agentResult.toolCalls.length > 0 ? agentResult.toolCalls : undefined,
          },
        });

        await prisma.agentChat.update({
          where: { id: chatIdForStream },
          data:  {
            title:     titleUpdate,
            model:     modelId,
            updatedAt: new Date(),
          },
        });

        if (agentResult.refreshed) {
          revalidatePath("/dashboard", "layout");
          revalidateTag("agent-context");
        }

        if (!req.signal.aborted) {
          push({
            type:      "done",
            chatId:    chatIdForStream,
            reply:     agentResult.reply,
            toolCalls: agentResult.toolCalls,
            refreshed: agentResult.refreshed,
            model:     modelId,
            cancelled: agentResult.cancelled,
          });
        }
        controller.close();
      } catch (err) {
        if (req.signal.aborted) {
          controller.close();
          return;
        }
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("Agent error:", err);
        push({ type: "error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection:      "keep-alive",
    },
  });
}
