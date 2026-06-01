import type { AgentToolCall } from "@/lib/agent/stream-events";

const TERMINAL_READ_TOOLS = new Set([
  "get_stock_returns",
  "get_mf_returns",
  "get_fixed_income_returns",
  "get_insurance_investment_returns",
  "get_investment_returns",
  "get_portfolio_summary",
  "list_fi_holdings",
]);

function parseGainPct(line: string): number | null {
  const m = line.match(/\|\s*([+-]?\d+(?:\.\d+)?)%\s*\(/);
  return m ? parseFloat(m[1]) : null;
}

function parseDayPct(line: string): number | null {
  const m = line.match(/day\s*([+-]?\d+(?:\.\d+)?)%/i);
  return m ? parseFloat(m[1]) : null;
}

function parseSavedAction(line: string): string | null {
  const m = line.match(/saved action:\s*(\S+)/i);
  return m ? m[1].toUpperCase() : null;
}

function suggestStockAction(
  gainPct: number | null,
  dayPct: number | null,
  saved: string | null,
): string {
  if (saved && /^(HOLD|BUY|ADD|TRIM|EXIT|REVIEW)$/i.test(saved)) {
    return saved.toUpperCase();
  }
  if (gainPct == null) return "HOLD — CMP unavailable; verify price feed";
  if (gainPct >= 40) return "TRIM — strong gain; consider partial profit booking";
  if (gainPct >= 15) return "HOLD — healthy gain; trail stop or trim on weakness";
  if (gainPct <= -20) return "REVIEW — deep loss; reassess thesis or cut";
  if (gainPct <= -8) return "HOLD — underwater; watch for recovery or exit trigger";
  if (dayPct != null && dayPct <= -3) return "HOLD — weak day; avoid panic selling";
  return "HOLD — near fair value vs cost";
}

function formatStockAdvisoryFallback(toolResult: string): string {
  const lines = toolResult.split("\n");
  const header = lines.find((l) => l.includes("Stocks (live")) ?? "Your stocks (live CMP):";
  const rows = lines.filter((l) => l.trimStart().startsWith("•"));

  if (!rows.length) {
    return toolResult.trim() || "No stock holdings found in the selected portfolio.";
  }

  const advisories = rows.map((row) => {
    const gainPct = parseGainPct(row);
    const dayPct = parseDayPct(row);
    const saved = parseSavedAction(row);
    const action = suggestStockAction(gainPct, dayPct, saved);
    const name = row.replace(/^\s*•\s*/, "").split("[")[0]?.trim() ?? row.trim();
    const pctStr = gainPct != null ? `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%` : "n/a";
    return `• ${name} — ${action} (${pctStr} P&L${dayPct != null ? `, day ${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(1)}%` : ""})`;
  });

  return (
    `${header}\n\n` +
    `${rows.join("\n")}\n\n` +
    `Suggested next actions:\n${advisories.join("\n")}\n\n` +
    `(Live data above; suggestions are rule-based — confirm before any trade.)`
  );
}

/** When Groq fails to synthesize text, return a useful reply from tool output. */
export function fallbackReplyFromToolResults(
  toolCalls: AgentToolCall[],
  wantsAdvisory: boolean,
): string | null {
  if (!toolCalls.length) return null;

  const last = toolCalls[toolCalls.length - 1];
  if (!TERMINAL_READ_TOOLS.has(last.name)) return null;

  if (last.name === "get_stock_returns" && wantsAdvisory) {
    return formatStockAdvisoryFallback(last.result);
  }

  const trimmed = last.result.trim();
  if (!trimmed) return null;

  return `${trimmed}\n\n_(Summary generated from live portfolio data.)_`;
}

export function userWantsAdvisory(message: string): boolean {
  return /recommend|next action|advice|what should|review|analyze|analyse|hold|trim|exit|buy more|suggest/i.test(
    message,
  );
}

export const AGENT_SYNTHESIS_PROMPT =
  "Write your complete answer in plain text now. Do NOT call any tools. " +
  "Summarize the tool results above for the user. " +
  "If they asked for stock recommendations, list each holding with HOLD | TRIM | ADD | EXIT and a one-line rationale.";
