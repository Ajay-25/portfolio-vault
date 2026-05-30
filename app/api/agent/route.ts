import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { AGENT_TOOLS, WRITE_TOOLS } from "@/lib/agent/tools";
import { executeTool } from "@/lib/agent/executor";
import { buildAgentContext } from "@/lib/agent/context";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 },
    );
  }

  const { messages } = await req.json();
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const systemPrompt = await buildAgentContext();

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model:             "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    tools:             [{ functionDeclarations: AGENT_TOOLS }],
  });

  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role:  m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const lastMessage = messages[messages.length - 1].content as string;

  let response = await chat.sendMessage(lastMessage);
  let rounds = 0;
  let wroteData = false;

  while (rounds < 5) {
    rounds++;
    const candidate = response.response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const fnCalls = parts.filter((p) => p.functionCall);

    if (fnCalls.length === 0) {
      const text = response.response.text();
      if (wroteData) {
        revalidatePath("/dashboard", "layout");
      }
      return NextResponse.json({ reply: text, refreshed: wroteData });
    }

    const toolResults = await Promise.all(
      fnCalls.map(async (part) => {
        const fn = part.functionCall!;
        if (WRITE_TOOLS.has(fn.name)) wroteData = true;
        const result = await executeTool(fn.name, (fn.args ?? {}) as Record<string, unknown>);
        return {
          functionResponse: {
            name:     fn.name,
            response: { result },
          },
        };
      }),
    );

    response = await chat.sendMessage(toolResults);
  }

  return NextResponse.json({
    reply: "I couldn't complete that request. Please try again.",
  });
}
