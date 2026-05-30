import { GoogleGenerativeAI } from "@google/generative-ai";
import { AGENT_TOOLS, WRITE_TOOLS } from "@/lib/agent/tools";
import { executeTool } from "@/lib/agent/executor";
import { buildAgentContext } from "@/lib/agent/context";
import { resolveModel } from "@/lib/agent/models";

export type AgentToolCall = {
  name:   string;
  result: string;
};

export type AgentRunResult = {
  reply:      string;
  toolCalls:  AgentToolCall[];
  refreshed:  boolean;
};

type HistoryMessage = {
  role:    "user" | "assistant";
  content: string;
};

export async function runAgent(
  apiKey: string,
  modelId: string,
  history: HistoryMessage[],
  userMessage: string,
): Promise<AgentRunResult> {
  const systemPrompt = await buildAgentContext();
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model:             resolveModel(modelId),
    systemInstruction: systemPrompt,
    tools:             [{ functionDeclarations: AGENT_TOOLS }],
  });

  const geminiHistory = history.map((m) => ({
    role:  m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });

  let response = await chat.sendMessage(userMessage);
  let rounds = 0;
  let wroteData = false;
  const toolCalls: AgentToolCall[] = [];

  while (rounds < 5) {
    rounds++;
    const candidate = response.response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const fnCalls = parts.filter((p) => p.functionCall);

    if (fnCalls.length === 0) {
      return {
        reply:     response.response.text(),
        toolCalls,
        refreshed: wroteData,
      };
    }

    const toolResults = await Promise.all(
      fnCalls.map(async (part) => {
        const fn = part.functionCall!;
        if (WRITE_TOOLS.has(fn.name)) wroteData = true;
        const result = await executeTool(fn.name, (fn.args ?? {}) as Record<string, unknown>);
        toolCalls.push({ name: fn.name, result });
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

  return {
    reply:     "I couldn't complete that request. Please try again.",
    toolCalls,
    refreshed: wroteData,
  };
}
