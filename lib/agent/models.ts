export type TokenUsageTier = "minimal" | "low" | "moderate" | "high";

export type GeminiModelOption = {
  id:          string;
  label:       string;
  description: string;
  bestFor:     string;
  tokenUsage:  {
    tier:  TokenUsageTier;
    label: string;
  };
};

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const USAGE = {
  minimal:  { tier: "minimal" as const,  label: "Lowest tokens · usually free-tier friendly" },
  low:      { tier: "low" as const,      label: "Low token use · cost-efficient" },
  moderate: { tier: "moderate" as const, label: "Moderate tokens · balanced cost" },
  high:     { tier: "high" as const,     label: "High token use · premium pricing" },
};

/** Curated guidance keyed by exact model id (without `models/` prefix). */
const MODEL_GUIDE: Record<
  string,
  Pick<GeminiModelOption, "bestFor" | "tokenUsage" | "description">
> = {
  "gemini-2.5-flash": {
    description: "Latest Flash with thinking — great default for Vault.",
    bestFor:     "Daily portfolio Q&A, SIP updates, unit changes, and snapshots",
    tokenUsage:  USAGE.moderate,
  },
  "gemini-2.5-pro": {
    description: "Most capable Gemini 2.5 — deeper reasoning.",
    bestFor:     "Complex allocation reviews, tax planning, multi-fund analysis, and architectural decisions",
    tokenUsage:  USAGE.high,
  },
  "gemini-2.5-flash-lite": {
    description: "Fastest 2.5 model with the smallest footprint.",
    bestFor:     "Quick lookups — NAV checks, SIP dates, simple yes/no questions",
    tokenUsage:  USAGE.minimal,
  },
  "gemini-2.0-flash-lite": {
    description: "Legacy lightweight Flash model.",
    bestFor:     "Simple, short requests when newer models are unavailable",
    tokenUsage:  USAGE.minimal,
  },
  "gemini-2.0-flash": {
    description: "Previous-gen Flash (deprecated for new API keys).",
    bestFor:     "General tasks — prefer 2.5 Flash if available",
    tokenUsage:  USAGE.low,
  },
  "gemini-2.5-pro-preview-03-25": {
    description: "Preview Pro with extended reasoning.",
    bestFor:     "Experimental deep analysis and complex portfolio scenarios",
    tokenUsage:  USAGE.high,
  },
  "gemini-2.5-flash-preview-05-20": {
    description: "Preview Flash — latest experimental features.",
    bestFor:     "Trying new capabilities before GA release",
    tokenUsage:  USAGE.moderate,
  },
  "gemini-2.5-flash-preview-tts": {
    description: "Flash preview variant (TTS-focused).",
    bestFor:     "Not ideal for Vault — prefer standard Flash models",
    tokenUsage:  USAGE.moderate,
  },
  "gemini-3-flash-preview": {
    description: "Next-gen Flash preview.",
    bestFor:     "Fast answers with improved reasoning over 2.5 Flash",
    tokenUsage:  USAGE.moderate,
  },
  "gemini-3.1-pro-preview": {
    description: "Next-gen Pro preview — highest capability.",
    bestFor:     "Hardest questions: strategy, architecture, and multi-step portfolio planning",
    tokenUsage:  USAGE.high,
  },
  "gemini-3.1-flash-lite-preview": {
    description: "Next-gen lite preview — ultra-fast.",
    bestFor:     "Lightweight queries and rapid back-and-forth",
    tokenUsage:  USAGE.minimal,
  },
};

function inferModelMeta(
  id: string,
  apiDescription?: string,
): Pick<GeminiModelOption, "bestFor" | "tokenUsage" | "description"> {
  if (MODEL_GUIDE[id]) return MODEL_GUIDE[id];

  const lower = id.toLowerCase();

  if (lower.includes("embed") || lower.includes("aqa") || lower.includes("text-embedding")) {
    return {
      description: apiDescription ?? "Embedding / search model — not for chat.",
      bestFor:     "Not suitable for Vault chat",
      tokenUsage:  USAGE.minimal,
    };
  }

  if (lower.includes("flash-lite") || lower.endsWith("-lite")) {
    return {
      description: apiDescription ?? "Lightweight Flash — optimized for speed.",
      bestFor:     "Quick results, simple updates, and short answers",
      tokenUsage:  USAGE.minimal,
    };
  }

  if (lower.includes("pro")) {
    return {
      description: apiDescription ?? "Pro-tier model with stronger reasoning.",
      bestFor:     "Complex analysis, planning, and architectural or strategic work",
      tokenUsage:  USAGE.high,
    };
  }

  if (lower.includes("thinking") || lower.includes("deep-research")) {
    return {
      description: apiDescription ?? "Extended reasoning model.",
      bestFor:     "Multi-step analysis and careful decision support",
      tokenUsage:  USAGE.high,
    };
  }

  if (lower.includes("flash")) {
    return {
      description: apiDescription ?? "Balanced Flash model.",
      bestFor:     "Everyday portfolio tasks — reads, updates, and summaries",
      tokenUsage:  USAGE.moderate,
    };
  }

  if (lower.includes("preview")) {
    return {
      description: apiDescription ?? "Preview / experimental model.",
      bestFor:     "Testing newer capabilities — behavior may change",
      tokenUsage:  USAGE.moderate,
    };
  }

  return {
    description: apiDescription ?? "Gemini model.",
    bestFor:     "General portfolio assistant tasks",
    tokenUsage:  USAGE.moderate,
  };
}

function enrichModel(
  id: string,
  label: string,
  apiDescription?: string,
): GeminiModelOption {
  const meta = inferModelMeta(id, apiDescription);
  return { id, label, ...meta };
}

export const FALLBACK_GEMINI_MODELS: GeminiModelOption[] = [
  enrichModel("gemini-2.5-flash", "Gemini 2.5 Flash"),
  enrichModel("gemini-2.5-pro", "Gemini 2.5 Pro"),
  enrichModel("gemini-2.5-flash-lite", "Gemini 2.5 Flash Lite"),
  enrichModel("gemini-2.0-flash-lite", "Gemini 2.0 Flash Lite"),
];

export function resolveModel(model?: string | null): string {
  const trimmed = model?.trim();
  return trimmed || DEFAULT_GEMINI_MODEL;
}

export function getModelGuide(modelId: string): GeminiModelOption {
  const id = resolveModel(modelId);
  return enrichModel(id, id.replace(/-/g, " "));
}

const EXCLUDED_ID_FRAGMENTS = ["embed", "aqa", "imagen", "veo", "gemma", "learnlm", "tts"];

function isAgentSuitableModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !EXCLUDED_ID_FRAGMENTS.some((frag) => lower.includes(frag));
}

export async function listGeminiModels(apiKey: string): Promise<GeminiModelOption[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      { cache: "no-store" },
    );
    if (!res.ok) return FALLBACK_GEMINI_MODELS;

    const data = (await res.json()) as {
      models?: Array<{
        name:                        string;
        displayName?:                string;
        description?:                string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const models = (data.models ?? [])
      .filter(
        (m) =>
          m.supportedGenerationMethods?.includes("generateContent") &&
          m.name.includes("gemini"),
      )
      .map((m) => {
        const id = m.name.replace(/^models\//, "");
        return enrichModel(
          id,
          m.displayName ?? id,
          m.description,
        );
      })
      .filter((m) => isAgentSuitableModel(m.id))
      .sort((a, b) => {
        if (a.id === DEFAULT_GEMINI_MODEL) return -1;
        if (b.id === DEFAULT_GEMINI_MODEL) return 1;
        const tierOrder: Record<TokenUsageTier, number> = {
          minimal: 0, low: 1, moderate: 2, high: 3,
        };
        const tierDiff = tierOrder[a.tokenUsage.tier] - tierOrder[b.tokenUsage.tier];
        if (tierDiff !== 0) return tierDiff;
        return a.label.localeCompare(b.label);
      });

    return models.length > 0 ? models : FALLBACK_GEMINI_MODELS;
  } catch {
    return FALLBACK_GEMINI_MODELS;
  }
}

export function isKnownModel(model: string, options: GeminiModelOption[]): boolean {
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
