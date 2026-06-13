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
import { resolveModel, modelSupportsVaultTools } from "@/lib/agent/models";
import {
  AGENT_SYNTHESIS_PROMPT,
  fallbackReplyFromToolResults,
  userWantsAdvisory,
} from "@/lib/agent/synthesis-fallback";
import type { AgentStreamEvent, AgentToolCall } from "@/lib/agent/stream-events";

export type { AgentToolCall } from "@/lib/agent/stream-events";

export type AgentRunResult = {
  reply:      string;
  toolCalls:  AgentToolCall[];
  refreshed:  boolean;
  cancelled?: boolean;
};

type HistoryMessage = {
  role:    "user" | "assistant";
  content: string;
};

export const MAX_AGENT_ROUNDS = 12;
const GROQ_RATE_LIMIT_RETRIES = 5;
const GROQ_FAILED_GENERATION_RETRIES = 2;

/** Read tools that should be followed by a user-facing summary (not find/lookup intermediates). */
const TERMINAL_READ_TOOLS = new Set([
  "get_stock_returns",
  "get_mf_returns",
  "get_fixed_income_returns",
  "get_insurance_investment_returns",
  "get_investment_returns",
  "get_portfolio_summary",
  "get_upcoming_sips",
  "get_action_items",
  "get_nav",
  "list_fi_holdings",
  "calculate_fi_projection",
  "get_home_summary",
  "get_payer_balance",
  "list_work_streams",
]);

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
  log_home_expense:                  "Logging home expense…",
  get_home_summary:                  "Summarizing home project…",
  get_payer_balance:                 "Checking payer balance…",
  record_repayment:                  "Recording repayment…",
  add_builder_deduction:             "Adding builder deduction…",
  list_work_streams:                 "Listing work streams…",
  create_work_stream:                "Creating work stream…",
  update_home_transaction_settlement:"Updating settlement…",
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
  if (msg.includes("tool calling") && msg.toLowerCase().includes("not supported")) {
    return "This model does not support Vault portfolio tools. Choose Llama 3.3 70B Versatile or Llama 3.1 8B Instant in the model picker.";
  }
  return msg;
}

type AgentRunOptions = {
  signal?: AbortSignal;
};

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}

function cancelledResult(
  reply: string,
  toolCalls: AgentToolCall[],
  refreshed: boolean,
): AgentRunResult {
  const text = reply.trim();
  return {
    reply:     text || "(Stopped)",
    toolCalls,
    refreshed,
    cancelled: true,
  };
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      },
      { once: true },
    );
  });
}

type GroqStream = AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>;

async function createGroqStream(
  groq: Groq,
  modelId: string,
  messages: Groq.Chat.ChatCompletionMessageParam[],
  textOnly: boolean,
  signal?: AbortSignal,
): Promise<GroqStream> {
  if (textOnly) {
    return groq.chat.completions.create(
      {
        model:    resolveModel(modelId),
        messages,
        stream:   true,
      },
      { signal },
    ) as Promise<GroqStream>;
  }
  return groq.chat.completions.create(
    {
      model:       resolveModel(modelId),
      messages,
      tools:       toGroqTools(),
      tool_choice: "auto",
      stream:      true,
    },
    { signal },
  ) as Promise<GroqStream>;
}

function tryFallbackReply(
  toolCalls: AgentToolCall[],
  userMessage: string,
): string | null {
  return fallbackReplyFromToolResults(toolCalls, userWantsAdvisory(userMessage));
}

export async function* runAgentStream(
  apiKey: string,
  modelId: string,
  history: HistoryMessage[],
  userMessage: string,
  options: AgentRunOptions = {},
): AsyncGenerator<AgentStreamEvent, AgentRunResult> {
  const { signal } = options;
  const resolvedModel = resolveModel(modelId);

  if (!modelSupportsVaultTools(resolvedModel)) {
    const msg =
      "Groq Compound models use Groq's built-in tools only and cannot run Vault portfolio updates. Switch to Llama 3.3 70B Versatile or Llama 3.1 8B Instant.";
    yield { type: "status", message: "Unsupported model" };
    yield { type: "text_delta", text: msg };
    return { reply: msg, toolCalls: [], refreshed: false };
  }

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
  let synthesisNudges = 0;
  let forceTextOnly = false;
  const toolCalls: AgentToolCall[] = [];
  let reply = "";
  let accumulatedReply = "";

  try {
  while (rounds < MAX_AGENT_ROUNDS) {
    throwIfAborted(signal);
    rounds++;
    yield { type: "status", message: rounds === 1 ? "Thinking…" : forceTextOnly ? "Summarizing…" : "Continuing…" };

    let stream: GroqStream | null = null;
    for (let attempt = 0; attempt <= GROQ_RATE_LIMIT_RETRIES; attempt++) {
      throwIfAborted(signal);
      try {
        stream = await createGroqStream(groq, modelId, messages, forceTextOnly, signal);
        break;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (
          (isGroqFailedGeneration(err) || isGroqToolValidationError(err)) &&
          failedGenerationRetries < GROQ_FAILED_GENERATION_RETRIES
        ) {
          const fallback = tryFallbackReply(toolCalls, userMessage);
          if (fallback) {
            reply = fallback;
            yield { type: "text_delta", text: fallback };
            return { reply, toolCalls, refreshed: wroteData };
          }

          failedGenerationRetries++;
          messages.push({
            role:    "user",
            content: forceTextOnly
              ? AGENT_SYNTHESIS_PROMPT
              : isGroqToolValidationError(err)
                ? buildToolValidationNudge()
                : buildFailedGenerationNudge(messages, forceTextOnly),
          });
          if (forceTextOnly) forceTextOnly = true;
          yield {
            type:    "status",
            message: forceTextOnly ? "Summarizing…" : "Retrying tool call…",
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
        await sleep(waitMs, signal);
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

    try {
    for await (const chunk of stream) {
      throwIfAborted(signal);
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        roundText += delta.content;
        accumulatedReply += delta.content;
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
    } catch (err) {
      if (isAbortError(err)) return cancelledResult(accumulatedReply, toolCalls, wroteData);
      throw err;
    }

    const messageToolCalls = [...toolCallsAccum.entries()]
      .sort(([a], [b]) => a - b)
      .map(([idx, tc]) => sanitizeToolCall(tc, idx, rounds))
      .filter((tc): tc is GroqFunctionCall => tc != null);

    if (finishReason === "failed_generation") {
      const fallback = tryFallbackReply(toolCalls, userMessage);
      if (fallback) {
        reply = fallback;
        yield { type: "text_delta", text: fallback };
        return { reply, toolCalls, refreshed: wroteData };
      }

      if (failedGenerationRetries < GROQ_FAILED_GENERATION_RETRIES) {
        failedGenerationRetries++;
        messages.push({
          role:    "user",
          content: buildFailedGenerationNudge(messages, forceTextOnly),
        });
        yield { type: "status", message: forceTextOnly ? "Summarizing…" : "Retrying tool call…" };
        continue;
      }
      throw new Error(
        "Groq could not generate a valid response. Try again or switch to Llama 3.3 70B Versatile in the model picker.",
      );
    }

    if (messageToolCalls.length === 0) {
      if (toolCallsAccum.size > 0) {
        reply = roundText.trim()
          || "Tool call failed — the model returned an invalid tool format. Please try again; for Excel imports use bulk_add_stocks in one shot.";
        return { reply, toolCalls, refreshed: wroteData };
      }

      reply = roundText.trim() || "Done.";

      if (
        reply.length < 40 &&
        toolCalls.length > 0 &&
        synthesisNudges < 2
      ) {
        const fallback = tryFallbackReply(toolCalls, userMessage);
        if (fallback) {
          reply = fallback;
          yield { type: "text_delta", text: fallback };
          return { reply, toolCalls, refreshed: wroteData };
        }
        synthesisNudges++;
        forceTextOnly = true;
        messages.push({ role: "user", content: AGENT_SYNTHESIS_PROMPT });
        yield { type: "status", message: "Summarizing…" };
        continue;
      }

      forceTextOnly = false;
      return { reply, toolCalls, refreshed: wroteData };
    }

    forceTextOnly = false;

    const sanitizedToolCalls = prepareToolCalls(messageToolCalls);

    messages.push({
      role:       "assistant",
      content:    roundText || null,
      tool_calls: sanitizedToolCalls,
    });

    for (const call of sanitizedToolCalls) {
      throwIfAborted(signal);
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

    const toolNames = sanitizedToolCalls.map((c) => c.function.name);
    const allTerminalRead = toolNames.every((n) => TERMINAL_READ_TOOLS.has(n));
    if (allTerminalRead && synthesisNudges < 2) {
      synthesisNudges++;
      forceTextOnly = true;
      messages.push({ role: "user", content: AGENT_SYNTHESIS_PROMPT });
      yield { type: "status", message: "Summarizing…" };
    }
  }

  const fallback = tryFallbackReply(toolCalls, userMessage);
  if (fallback) {
    reply = fallback;
    yield { type: "text_delta", text: fallback };
    return { reply, toolCalls, refreshed: wroteData };
  }

  reply = "I couldn't complete that request in time. Some actions may have partially applied — check your portfolio or try again.";
  return { reply, toolCalls, refreshed: wroteData };
  } catch (err) {
    if (isAbortError(err)) return cancelledResult(accumulatedReply, toolCalls, wroteData);
    throw err;
  }
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
