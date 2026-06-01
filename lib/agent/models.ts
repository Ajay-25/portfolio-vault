export type TokenUsageTier = "minimal" | "low" | "moderate" | "high";

export type AgentModelOption = {
  id:          string;
  label:       string;
  description: string;
  bestFor:     string;
  tokenUsage:  {
    tier:  TokenUsageTier;
    label: string;
  };
};

/** @deprecated Use AgentModelOption */
export type GeminiModelOption = AgentModelOption;

export const DEFAULT_AGENT_MODEL = "llama-3.3-70b-versatile";

/** @deprecated Use DEFAULT_AGENT_MODEL */
export const DEFAULT_GEMINI_MODEL = DEFAULT_AGENT_MODEL;

const USAGE = {
  minimal:  { tier: "minimal" as const,  label: "Fastest on Groq · quick lookups" },
  low:      { tier: "low" as const,      label: "Low latency · light tasks" },
  moderate: { tier: "moderate" as const, label: "Balanced speed and quality" },
  high:     { tier: "high" as const,     label: "Stronger reasoning · more tokens" },
};

/** Curated guidance keyed by exact Groq model id. */
const MODEL_GUIDE: Record<
  string,
  Pick<AgentModelOption, "bestFor" | "tokenUsage" | "description">
> = {
  "llama-3.3-70b-versatile": {
    description: "Best default on Groq — strong reasoning with tool use.",
    bestFor:     "Daily portfolio Q&A, SIP updates, unit changes, and snapshots",
    tokenUsage:  USAGE.moderate,
  },
  "llama-3.1-8b-instant": {
    description: "Fastest Llama on Groq — lowest latency.",
    bestFor:     "Quick lookups — NAV checks, SIP dates, simple yes/no questions",
    tokenUsage:  USAGE.minimal,
  },
  "llama-3.3-70b-specdec": {
    description: "Llama 3.3 with speculative decoding — ultra-low latency.",
    bestFor:     "Responsive back-and-forth when 70B versatile feels slow",
    tokenUsage:  USAGE.moderate,
  },
  "llama3-70b-8192": {
    description: "Previous-gen Llama 3 70B on Groq.",
    bestFor:     "General tasks — prefer 3.3 versatile if available",
    tokenUsage:  USAGE.moderate,
  },
  "llama3-8b-8192": {
    description: "Previous-gen Llama 3 8B on Groq.",
    bestFor:     "Lightweight queries and rapid responses",
    tokenUsage:  USAGE.minimal,
  },
  "gemma2-9b-it": {
    description: "Gemma 2 9B — compact and capable on Groq.",
    bestFor:     "Short answers and simple portfolio reads",
    tokenUsage:  USAGE.low,
  },
  "mixtral-8x7b-32768": {
    description: "Mixtral MoE — wide context window on Groq.",
    bestFor:     "Longer spreadsheets or multi-fund summaries",
    tokenUsage:  USAGE.moderate,
  },
  "qwen-qwq-32b": {
    description: "Qwen reasoning model — deeper analysis on Groq.",
    bestFor:     "Complex allocation reviews and multi-step planning",
    tokenUsage:  USAGE.high,
  },
  "deepseek-r1-distill-llama-70b": {
    description: "DeepSeek R1 distilled into Llama 70B on Groq.",
    bestFor:     "Harder reasoning tasks and careful decision support",
    tokenUsage:  USAGE.high,
  },
};

function inferModelMeta(
  id: string,
  apiDescription?: string,
): Pick<AgentModelOption, "bestFor" | "tokenUsage" | "description"> {
  if (MODEL_GUIDE[id]) return MODEL_GUIDE[id];

  const lower = id.toLowerCase();

  if (lower.includes("8b") || lower.includes("-lite") || lower.endsWith("-instant")) {
    return {
      description: apiDescription ?? "Lightweight Groq model — optimized for speed.",
      bestFor:     "Quick results, simple updates, and short answers",
      tokenUsage:  USAGE.minimal,
    };
  }

  if (lower.includes("70b") || lower.includes("32b") || lower.includes("r1")) {
    return {
      description: apiDescription ?? "Large Groq model with stronger reasoning.",
      bestFor:     "Complex analysis, planning, and multi-step portfolio work",
      tokenUsage:  USAGE.high,
    };
  }

  if (lower.includes("mixtral") || lower.includes("gemma")) {
    return {
      description: apiDescription ?? "Balanced open model on Groq.",
      bestFor:     "Everyday portfolio tasks — reads, updates, and summaries",
      tokenUsage:  USAGE.moderate,
    };
  }

  return {
    description: apiDescription ?? "Groq-hosted model.",
    bestFor:     "General portfolio assistant tasks",
    tokenUsage:  USAGE.moderate,
  };
}

function enrichModel(
  id: string,
  label: string,
  apiDescription?: string,
): AgentModelOption {
  const meta = inferModelMeta(id, apiDescription);
  return { id, label, ...meta };
}

export const FALLBACK_AGENT_MODELS: AgentModelOption[] = [
  enrichModel("llama-3.3-70b-versatile", "Llama 3.3 70B Versatile"),
  enrichModel("llama-3.1-8b-instant", "Llama 3.1 8B Instant"),
  enrichModel("gemma2-9b-it", "Gemma 2 9B"),
  enrichModel("mixtral-8x7b-32768", "Mixtral 8x7B"),
];

/** @deprecated Use FALLBACK_AGENT_MODELS */
export const FALLBACK_GEMINI_MODELS = FALLBACK_AGENT_MODELS;

const LEGACY_GEMINI_PREFIX = "gemini";

export function resolveModel(model?: string | null): string {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_AGENT_MODEL;
  if (trimmed.startsWith(LEGACY_GEMINI_PREFIX)) return DEFAULT_AGENT_MODEL;
  return trimmed;
}

export function getModelGuide(modelId: string): AgentModelOption {
  const id = resolveModel(modelId);
  const curated = FALLBACK_AGENT_MODELS.find((m) => m.id === id);
  if (curated) return curated;
  return enrichModel(id, labelFromId(id));
}

const EXCLUDED_ID_FRAGMENTS = [
  "whisper", "tts", "guard", "embed", "playai", "compound", "distil-whisper",
];

const CHAT_MODEL_PATTERNS = [/llama/i, /mixtral/i, /gemma/i, /qwen/i, /deepseek/i];

function isAgentSuitableModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !EXCLUDED_ID_FRAGMENTS.some((frag) => lower.includes(frag));
}

function isChatModel(id: string): boolean {
  if (MODEL_GUIDE[id]) return true;
  if (!isAgentSuitableModel(id)) return false;
  return CHAT_MODEL_PATTERNS.some((pattern) => pattern.test(id));
}

function labelFromId(id: string): string {
  return id
    .split("-")
    .map((part) => (part.length <= 4 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export async function listAgentModels(apiKey: string): Promise<AgentModelOption[]> {
  try {
    const groq = await import("groq-sdk").then((m) => new m.default({ apiKey }));
    const res = await groq.models.list();
    const models = (res.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string" && isChatModel(id))
      .map((id) => enrichModel(id, labelFromId(id)))
      .sort((a, b) => {
        if (a.id === DEFAULT_AGENT_MODEL) return -1;
        if (b.id === DEFAULT_AGENT_MODEL) return 1;
        const tierOrder: Record<TokenUsageTier, number> = {
          minimal: 0, low: 1, moderate: 2, high: 3,
        };
        const tierDiff = tierOrder[a.tokenUsage.tier] - tierOrder[b.tokenUsage.tier];
        if (tierDiff !== 0) return tierDiff;
        return a.label.localeCompare(b.label);
      });

    return models.length > 0 ? models : FALLBACK_AGENT_MODELS;
  } catch {
    return FALLBACK_AGENT_MODELS;
  }
}

/** @deprecated Use listAgentModels */
export const listGeminiModels = listAgentModels;

export function isKnownModel(model: string, options: AgentModelOption[]): boolean {
  return options.some((o) => o.id === model);
}

export const TOKEN_TIER_STYLES: Record<
  TokenUsageTier,
  { color: string; bg: string; border: string }
> = {
  minimal:  { color: "#6ee7b7", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)" },
  low:      { color: "#86efac", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.30)" },
  moderate: { color: "var(--gold-l)", bg: "rgba(201,168,76,0.12)", border: "rgba(201,168,76,0.35)" },
  high:     { color: "#fca5a5", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.30)" },
};
