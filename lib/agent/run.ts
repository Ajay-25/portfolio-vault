import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { AGENT_TOOLS, WRITE_TOOLS } from "@/lib/agent/tools";
import { executeTool } from "@/lib/agent/executor";
import { buildAgentContext } from "@/lib/agent/context";
import { resolveModel } from "@/lib/agent/models";
import type { AgentStreamEvent, AgentToolCall } from "@/lib/agent/stream-events";

export type { AgentToolCall } from "@/lib/agent/stream-events";

export type AgentRunResult = {
  reply:      string;
  toolCalls:  AgentToolCall[];
  refreshed:  boolean;
};

type HistoryMessage = {
  role:    "user" | "assistant";
  content: string;
};

export const MAX_AGENT_ROUNDS = 12;

const TOOL_STATUS: Record<string, string> = {
  get_mf_returns:                    "Fetching live MF returns…",
  get_stock_returns:                 "Fetching live stock prices…",
  get_fixed_income_returns:          "Loading fixed income…",
  get_insurance_investment_returns:  "Loading insurance investments…",
  get_investment_returns:            "Loading all investment returns…",
  get_portfolio_summary:             "Summarizing portfolio…",
  get_upcoming_sips:                 "Checking upcoming SIPs…",
  get_action_items:                  "Loading action items…",
  get_nav:                           "Fetching NAV…",
  find_mf_holdings:                  "Searching MF holdings…",
  update_mf_holding:                 "Updating MF holding…",
  lookup_mf_scheme:                  "Looking up AMFI scheme code…",
  resolve_mf_category:               "Resolving MF category…",
  bulk_add_mf_holdings:              "Importing MF holdings…",
  delete_all_mf_holdings:            "Deleting all MF holdings…",
  delete_all_stocks:                 "Deleting all stock holdings…",
  delete_mf_holding:                 "Deleting MF holding…",
  delete_stock:                      "Deleting stock…",
  update_mf_units:                   "Updating MF units…",
  add_mf_holding:                    "Adding MF holding…",
  add_or_update_stock:               "Saving stock holding…",
  add_action_item:                   "Adding action item…",
  complete_action_item:              "Completing action item…",
  log_snapshot:                      "Logging snapshot…",
  update_investment_fund_value:      "Updating fund value…",
};

function toolStatus(name: string): string {
  return TOOL_STATUS[name] ?? `Running ${name}…`;
}

async function createAgentChat(
  apiKey: string,
  modelId: string,
  history: HistoryMessage[],
) {
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

  return model.startChat({ history: geminiHistory });
}

export async function* runAgentStream(
  apiKey: string,
  modelId: string,
  history: HistoryMessage[],
  userMessage: string,
): AsyncGenerator<AgentStreamEvent, AgentRunResult> {
  const chat = await createAgentChat(apiKey, modelId, history);
  let nextRequest: string | Part[] = userMessage;
  let rounds = 0;
  let wroteData = false;
  const toolCalls: AgentToolCall[] = [];
  let reply = "";

  while (rounds < MAX_AGENT_ROUNDS) {
    rounds++;
    yield { type: "status", message: rounds === 1 ? "Thinking…" : "Continuing…" };

    const streamResult = await chat.sendMessageStream(nextRequest);
    let roundText = "";

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        roundText += chunkText;
        yield { type: "text_delta", text: chunkText };
      }
    }

    const response = await streamResult.response;
    const fnCalls = response.functionCalls() ?? [];

    if (fnCalls.length === 0) {
      try {
        reply = roundText || response.text();
      } catch {
        reply = roundText;
      }
      if (!reply.trim()) reply = "Done.";
      return { reply, toolCalls, refreshed: wroteData };
    }

    const toolResults: Part[] = [];

    for (const fn of fnCalls) {
      const name = fn.name;
      yield { type: "status", message: toolStatus(name) };
      yield { type: "tool_start", name };
      if (WRITE_TOOLS.has(name)) wroteData = true;
      const result = await executeTool(name, (fn.args ?? {}) as Record<string, unknown>);
      toolCalls.push({ name, result });
      yield { type: "tool_end", name, result };
      toolResults.push({
        functionResponse: {
          name,
          response: { result },
        },
      });
    }

    nextRequest = toolResults;
  }

  reply = "I couldn't complete that request in time. Some actions may have partially applied — check your portfolio or try again.";
  return { reply, toolCalls, refreshed: wroteData };
}

/** Non-streaming fallback (tests / scripts). */
export async function runAgent(
  apiKey: string,
  modelId: string,
  history: HistoryMessage[],
  userMessage: string,
): Promise<AgentRunResult> {
  const gen = runAgentStream(apiKey, modelId, history, userMessage);
  let result = await gen.next();
  while (!result.done) {
    result = await gen.next();
  }
  return result.value;
}
