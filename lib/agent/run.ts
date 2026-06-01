import Groq from "groq-sdk";
import { AGENT_TOOLS, WRITE_TOOLS } from "@/lib/agent/tools";
import { relaxSchemaForGroq } from "@/lib/agent/tool-schema";
import {
  buildFailedGenerationNudge,
  buildToolValidationNudge,
  isGroqFailedGeneration,
  isGroqToolValidationError,
  prepareToolCalls,
  resolveToolName,
} from "@/lib/agent/tool-call-prep";
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
const GROQ_RATE_LIMIT_RETRIES = 5;
const GROQ_FAILED_GENERATION_RETRIES = 2;

const KNOWN_TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.name));

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
  lookup_stock_symbol:               "Looking up stock ticker…",
  find_stock_holdings:               "Searching stock holdings…",
  update_stock_holding:              "Updating stock holding…",
  lookup_mf_scheme:                  "Looking up AMFI scheme code…",
  resolve_mf_category:               "Resolving MF category…",
  bulk_add_mf_holdings:              "Importing MF holdings…",
  bulk_add_stocks:                   "Importing stock holdings…",
  delete_all_mf_holdings:            "Deleting all MF holdings…",
  delete_all_stocks:                 "Deleting all stock holdings…",
  delete_mf_holding:                 "Deleting MF holding…",
  find_fixed_income_holdings:        "Searching fixed income…",
  update_fixed_income:               "Updating fixed income…",
  delete_fixed_income:               "Removing fixed income…",
  list_fi_holdings:                  "Listing fixed income…",
  find_fi_holding:                   "Searching fixed income…",
  create_fi_holding:                 "Creating fixed income…",
  update_fi_balance:                 "Updating FI balance…",
  update_fi_holding:                 "Updating fixed income…",
  update_nps_allocation:             "Updating NPS allocation…",
  extend_ppf:                        "Recording PPF extension…",
  renew_fd:                          "Recording FD renewal…",
  close_fi_holding:                  "Closing fixed income…",
  delete_fi_holding:                 "Deleting fixed income…",
  calculate_fi_projection:           "Calculating projection…",
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

function toGroqTools() {
  return AGENT_TOOLS.map((t) => ({
    type:     "function" as const,
    function: {
      name:        t.name,
      description: t.description,
      parameters:  relaxSchemaForGroq(t.parameters),
    },
  }));
}

type AccumulatedToolCall = {
  id?:        string;
  name?:      string;
  arguments?: string;
};

type GroqFunctionCall = {
  id:       string;
  type:     "function";
  function: { name: string; arguments: string };
};

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Groq/Llama sometimes emits `add_or_update_stock,{"symbol":...}` as the tool name. */
function sanitizeToolCall(
  raw: AccumulatedToolCall,
  idx: number,
  round: number,
): GroqFunctionCall | null {
  let name = (raw.name ?? "").trim();
  let args = (raw.arguments ?? "").trim();

  const embedded = name.match(/^([a-z_][a-z0-9_]*),\s*(\{[\s\S]+)$/i);
  if (embedded) {
    name = embedded[1];
    if (!args || args === "{}") args = embedded[2];
  }

  if (name.endsWith(",") && args.startsWith("{")) {
    name = name.slice(0, -1).trim();
  }

  if (!KNOWN_TOOL_NAMES.has(name)) {
    const resolved = resolveToolName(name);
    if (resolved) {
      name = resolved;
    } else {
      for (const known of KNOWN_TOOL_NAMES) {
        if (!name.startsWith(known)) continue;
        const rest = name.slice(known.length).replace(/^,\s*/, "");
        if (rest.startsWith("{") && (!args || args === "{}")) args = rest;
        name = known;
        break;
      }
    }
  }

  if (!KNOWN_TOOL_NAMES.has(name)) return null;
  if (!args) args = "{}";

  return {
    id:       raw.id ?? `call_${round}_${idx}`,
    type:     "function",
    function: { name, arguments: args },
  };
}

function isGroqRateLimit(err: unknown): boolean {
  if (err instanceof Groq.APIError) return err.status === 429;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("rate_limit") || msg.includes("429");
}

function parseGroqRetryMs(err: unknown, attempt: number): number {
  const msg = err instanceof Error ? err.message : String(err);
  const msMatch = msg.match(/try again in (\d+(?:\.\d+)?)\s*ms/i);
  if (msMatch) return Math.ceil(parseFloat(msMatch[1])) + 200;
  const sMatch = msg.match(/try again in (\d+(?:\.\d+)?)\s*s/i);
  if (sMatch) return Math.ceil(parseFloat(sMatch[1]) * 1000) + 200;
  return Math.min(2000 * 2 ** attempt, 15_000);
}

function formatGroqError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (isGroqRateLimit(err)) {
    return "Groq rate limit reached (token quota per minute). Wait ~60 seconds and try again, or switch to Llama 3.1 8B Instant in the model picker for large imports.";
  }
  if (isGroqFailedGeneration(err)) {
    return "Groq could not generate a valid tool call. Try a direct request e.g. \"Update SIEMENS avg price to 2823.95 on NSE in mine portfolio\".";
  }
  if (isGroqToolValidationError(err)) {
    return "Groq rejected malformed tool arguments. Retry with flat JSON fields (strings, not nested objects).";
  }
  return msg;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* runAgentStream(
  apiKey: string,
  modelId: string,
  history: HistoryMessage[],
  userMessage: string,
): AsyncGenerator<AgentStreamEvent, AgentRunResult> {
  const groq = new Groq({ apiKey });
  const systemPrompt = await buildAgentContext();

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role:    m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  let rounds = 0;
  let wroteData = false;
  let failedGenerationRetries = 0;
  const toolCalls: AgentToolCall[] = [];
  let reply = "";

  while (rounds < MAX_AGENT_ROUNDS) {
    rounds++;
    yield { type: "status", message: rounds === 1 ? "Thinking…" : "Continuing…" };

    let stream: Awaited<ReturnType<typeof groq.chat.completions.create>> | null = null;
    for (let attempt = 0; attempt <= GROQ_RATE_LIMIT_RETRIES; attempt++) {
      try {
        stream = await groq.chat.completions.create({
          model:       resolveModel(modelId),
          messages,
          tools:       toGroqTools(),
          tool_choice: "auto",
          stream:      true,
        });
        break;
      } catch (err) {
        if (
          (isGroqFailedGeneration(err) || isGroqToolValidationError(err)) &&
          failedGenerationRetries < GROQ_FAILED_GENERATION_RETRIES
        ) {
          failedGenerationRetries++;
          messages.push({
            role:    "user",
            content: isGroqToolValidationError(err)
              ? buildToolValidationNudge()
              : buildFailedGenerationNudge(messages),
          });
          yield {
            type:    "status",
            message: "Retrying tool call…",
          };
          stream = null;
          break;
        }
        if (!isGroqRateLimit(err) || attempt === GROQ_RATE_LIMIT_RETRIES) {
          throw new Error(formatGroqError(err));
        }
        const waitMs = parseGroqRetryMs(err, attempt);
        yield {
          type:    "status",
          message: `Groq rate limit — waiting ${Math.ceil(waitMs / 1000)}s…`,
        };
        await sleep(waitMs);
      }
    }

    if (!stream) {
      if (failedGenerationRetries > 0 && failedGenerationRetries <= GROQ_FAILED_GENERATION_RETRIES) {
        continue;
      }
      throw new Error("Groq rate limit — max retries exceeded.");
    }

    let roundText = "";
    let finishReason: string | null = null;
    const toolCallsAccum = new Map<number, AccumulatedToolCall>();

    for await (const chunk of stream) {
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        roundText += delta.content;
        yield { type: "text_delta", text: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = toolCallsAccum.get(idx) ?? {};
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) {
            existing.name = (existing.name ?? "") + tc.function.name;
          }
          if (tc.function?.arguments) {
            existing.arguments = (existing.arguments ?? "") + tc.function.arguments;
          }
          toolCallsAccum.set(idx, existing);
        }
      }
    }

    const messageToolCalls = [...toolCallsAccum.entries()]
      .sort(([a], [b]) => a - b)
      .map(([idx, tc]) => sanitizeToolCall(tc, idx, rounds))
      .filter((tc): tc is GroqFunctionCall => tc != null);

    if (finishReason === "failed_generation") {
      if (failedGenerationRetries < GROQ_FAILED_GENERATION_RETRIES) {
        failedGenerationRetries++;
        messages.push({
          role:    "user",
          content: buildFailedGenerationNudge(messages),
        });
        yield { type: "status", message: "Retrying tool call…" };
        continue;
      }
      throw new Error(
        "Groq could not generate a valid tool call. Try: \"Update SIEMENS avg price to 2823.95 on NSE in mine portfolio\".",
      );
    }

    if (messageToolCalls.length === 0) {
      if (toolCallsAccum.size > 0) {
        reply = roundText.trim()
          || "Tool call failed — the model returned an invalid tool format. Please try again; for Excel imports use bulk_add_stocks in one shot.";
        return { reply, toolCalls, refreshed: wroteData };
      }
      reply = roundText.trim() || "Done.";
      return { reply, toolCalls, refreshed: wroteData };
    }

    const sanitizedToolCalls = prepareToolCalls(messageToolCalls);

    messages.push({
      role:       "assistant",
      content:    roundText || null,
      tool_calls: sanitizedToolCalls,
    });

    for (const call of sanitizedToolCalls) {
      const name = call.function.name;
      yield { type: "status", message: toolStatus(name) };
      yield { type: "tool_start", name };
      if (WRITE_TOOLS.has(name)) wroteData = true;

      const args = parseToolArgs(call.function.arguments);
      const result = await executeTool(name, args);
      toolCalls.push({ name, result });
      yield { type: "tool_end", name, result };

      messages.push({
        role:         "tool",
        tool_call_id: call.id,
        content:      result,
      });
    }
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
