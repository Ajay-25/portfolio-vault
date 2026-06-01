import { AGENT_TOOLS } from "@/lib/agent/tools";
import { coerceToolInput } from "@/lib/agent/coerce-tool-input";

const KNOWN_TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.name));

/** Groq/Llama sometimes truncates or misspells tool names. */
export function resolveToolName(raw: string): string | null {
  const name = raw.trim();
  if (KNOWN_TOOL_NAMES.has(name)) return name;

  const aliases: Record<string, string> = {
    ind_stock_holdings:        "find_stock_holdings",
    find_stock_holding:        "find_stock_holdings",
    update_stock:              "update_stock_holding",
    delete_stocks:             "delete_stock",
    add_stock:                 "add_or_update_stock",
    find_fixed_income:         "find_fixed_income_holdings",
    delete_fixed_income_holding: "delete_fixed_income",
    // Model often hallucinates this when removing duplicate fixed income — no such tool exists
    update_portfolio_summary:  "delete_fixed_income",
  };
  if (aliases[name]) return aliases[name];

  if (/stock_holdings?$/i.test(name)) {
    return /update|patch/i.test(name) ? "update_stock_holding" : "find_stock_holdings";
  }

  for (const known of KNOWN_TOOL_NAMES) {
    if (!name.startsWith(known)) continue;
    return known;
  }

  return null;
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function hasStockSearchArgs(args: Record<string, unknown>): boolean {
  const symbol = typeof args.symbol === "string" ? args.symbol.trim() : "";
  const keyword = typeof args.keyword === "string" ? args.keyword.trim() : "";
  return Boolean(symbol || keyword);
}

export type PreparedToolCall = {
  id:       string;
  type:     "function";
  function: { name: string; arguments: string };
};

/** Coerce args, drop duplicate empty find_stock_holdings in the same model turn. */
export function prepareToolCalls(
  calls: PreparedToolCall[],
): PreparedToolCall[] {
  const parsed = calls.map((call) => ({
    call,
    name: call.function.name,
    args: coerceToolInput(parseToolArgs(call.function.arguments)),
  }));

  const hasStockFindWithQuery = parsed.some(
    (p) => p.name === "find_stock_holdings" && hasStockSearchArgs(p.args),
  );

  return parsed
    .filter((p) => {
      if (p.name !== "find_stock_holdings") return true;
      if (hasStockFindWithQuery && !hasStockSearchArgs(p.args)) return false;
      return true;
    })
    .map(({ call, args }) => ({
      ...call,
      function: {
        ...call.function,
        arguments: JSON.stringify(args),
      },
    }));
}

export function buildFailedGenerationNudge(
  messages: Array<{ role: string; content?: unknown }>,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "tool" || typeof m.content !== "string") continue;
    if (!m.content.includes("Found 1 stock holding")) continue;

    const sym = m.content.match(/\[([A-Z0-9][A-Z0-9.-]*)\]/)?.[1];
    const portfolio = /\/ mine\)/.test(m.content)
      ? "mine"
      : /\/ mother\)/.test(m.content)
        ? "mother"
        : "mine";
    const exchange = m.content.includes("(NYSE") ? "NYSE" : "NSE";

    if (sym) {
      return [
        "Continue with ONE tool call: update_stock_holding.",
        `Use symbol="${sym}", exchange="${exchange}", portfolio="${portfolio}", plus ONLY the field being changed (e.g. avg_price).`,
        "Do NOT call find_stock_holdings again.",
      ].join(" ");
    }
  }

  return [
    "Retry with ONE valid tool call and complete JSON arguments.",
    "For stock avg price / qty updates: update_stock_holding with symbol or keyword, exchange NSE (default), portfolio mine (default), and only the fields changing.",
    "Do not call find_stock_holdings twice.",
  ].join(" ");
}

export function isGroqFailedGeneration(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("failed_generation") ||
    msg.includes("Failed to call a function")
  );
}

export function isGroqToolValidationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("tool call validation failed") || msg.includes("did not match schema");
}

export function buildToolValidationNudge(toolName?: string): string {
  if (toolName === "delete_fixed_income" || toolName?.includes("fixed_income")) {
    return [
      "Use ONE tool call with flat JSON string fields — no nested objects.",
      'Example: {"type":"liquid","label":"Liquid / Arbitrage","portfolio":"mine","confirmed":"true"}',
    ].join(" ");
  }
  return "Use flat JSON tool arguments — each field must be a plain string or number, not a nested object.";
}
