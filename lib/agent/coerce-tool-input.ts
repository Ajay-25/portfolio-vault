import { normalizeExchange, normalizePortfolioScope } from "@/lib/agent/normalize-input";

/** Fields that must stay strings even when they look numeric (e.g. scheme_code "122639"). */
const STRING_FIELD =
  /^(symbol|new_symbol|scheme_code|isin|query|keyword|name|title|description|exchange|portfolio|action|category|type|filter|asset_class|policy_keyword|title_keyword|display_name|note|status|condition|plan_name|label|new_label|issuer|institution)$/i;

/** Top-level tool args that must never remain nested objects. */
const SCALAR_PARAM =
  /^(symbol|new_symbol|scheme_code|isin|query|keyword|name|title|description|exchange|portfolio|action|category|type|filter|asset_class|policy_keyword|title_keyword|display_name|note|status|condition|plan_name|label|new_label|issuer|institution|confirmed)$/i;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function looksNumericString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

/** Groq often emits nested objects as JSON strings (e.g. fields_to_update). */
function parseJsonObjectString(value: unknown): Record<string, unknown> | undefined {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Groq/Llama often wrap scalars as {value:…}, {type, value}, or {fieldName:…}. */
export function flattenModelValue(value: unknown): unknown {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const obj = value as Record<string, unknown>;

  if ("value" in obj) {
    const inner = obj.value;
    if (inner == null || typeof inner !== "object" || Array.isArray(inner)) {
      return inner;
    }
    return flattenModelValue(inner);
  }

  const keys = Object.keys(obj);
  if (keys.length === 1) {
    const sole = obj[keys[0]];
    if (sole == null || typeof sole !== "object" || Array.isArray(sole)) {
      return sole;
    }
    return flattenModelValue(sole);
  }

  return value;
}

function extractScalarFromObject(obj: Record<string, unknown>, key: string): unknown {
  const flat = flattenModelValue(obj);
  if (flat !== obj) return flat;

  const direct = obj[key] ?? obj[key.toLowerCase()];
  if (direct != null && typeof direct !== "object") return direct;

  for (const v of Object.values(obj)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      return v;
    }
  }

  return undefined;
}

export function coerceBoolean(value: unknown): boolean | undefined {
  const flat = flattenModelValue(value);
  if (flat === true || flat === "true" || flat === 1 || flat === "1") return true;
  if (flat === false || flat === "false" || flat === 0 || flat === "0") return false;
  return undefined;
}

export function parseOptionalNumber(value: unknown): number | undefined {
  const flat = flattenModelValue(value);
  if (isBlank(flat)) return undefined;
  if (typeof flat === "number" && !Number.isNaN(flat)) return flat;
  if (typeof flat === "string" && looksNumericString(flat)) {
    const n = Number(flat);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function coerceValue(key: string, value: unknown): unknown {
  value = flattenModelValue(value);
  if (isBlank(value)) return undefined;

  if (/^fields_to_update$/i.test(key)) {
    const obj = parseJsonObjectString(value);
    if (obj) return coerceRecord(obj);
    return undefined;
  }

  if (/^confirmed$/i.test(key)) {
    const b = coerceBoolean(value);
    if (b === undefined) return undefined;
    return b ? "true" : "false";
  }

  if (/^exchange$/i.test(key)) {
    return normalizeExchange(value);
  }

  if (/^portfolio$/i.test(key)) {
    return normalizePortfolioScope(value);
  }

  if (typeof value === "string") {
    if (!STRING_FIELD.test(key) && looksNumericString(value)) {
      const n = Number(value);
      if (!Number.isNaN(n)) return n;
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      item != null && typeof item === "object" && !Array.isArray(item)
        ? coerceRecord(item as Record<string, unknown>)
        : item,
    );
  }

  if (value != null && typeof value === "object") {
    if (/^holdings$/i.test(key)) {
      return coerceRecord(value as Record<string, unknown>);
    }
    if (SCALAR_PARAM.test(key)) {
      const extracted = extractScalarFromObject(value as Record<string, unknown>, key);
      if (extracted !== undefined) return coerceValue(key, extracted);
      return undefined;
    }
    return coerceRecord(value as Record<string, unknown>);
  }

  return value;
}

function coerceRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const coerced = coerceValue(key, value);
    if (coerced !== undefined) out[key] = coerced;
  }
  return out;
}

function unwrapToolInputRoot(input: Record<string, unknown>): Record<string, unknown> {
  const params = input.parameters;
  if (params != null && typeof params === "object" && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }
  const args = input.arguments;
  if (args != null && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return input;
}

/** Flatten fields_to_update (object or JSON string) into top-level args for Groq compatibility. */
export function flattenFiUpdateArgs(args: Record<string, unknown>): Record<string, unknown> {
  if (args.fields_to_update === undefined) return args;

  const out = { ...args };
  const raw = args.fields_to_update;
  delete out.fields_to_update;

  let patch: Record<string, unknown> | undefined;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        patch = parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    patch = raw as Record<string, unknown>;
  }

  if (patch) {
    for (const [key, val] of Object.entries(patch)) {
      if (out[key] === undefined) out[key] = val;
    }
  }

  return out;
}

/** Parse stringified numbers from LLM tool calls; drop empty strings; flatten nested scalars. */
export function coerceToolInput(input: Record<string, unknown>): Record<string, unknown> {
  return coerceRecord(unwrapToolInputRoot(input));
}
