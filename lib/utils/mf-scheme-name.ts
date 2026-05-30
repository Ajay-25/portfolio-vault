/**
 * Normalizes AMFI / mfapi scheme names to a consistent display format:
 *   "HDFC Flexi Cap Fund - Growth (Direct)"
 *   "Parag Parikh Flexi Cap Fund - Growth (Direct)"
 */

const PLAN_DIRECT  = /\b(direct\s*plan|direct)\b/i;
const PLAN_REGULAR = /\bregular\s*plan\b|\bregular\b/i;

const OPTION_GROWTH = /\bgrowth\b/i;
const OPTION_IDCW   = /\b(idcw|dividend|income distribution|reinvestment of income)\b/i;

/** Already in canonical display form */
const CANONICAL = /^.+\s-\s(Growth|IDCW)\s\((Direct|Regular)\)$/;

/** Trailing segments to strip when extracting the fund base name */
const STRIP_SEGMENT =
  /^(direct plan|regular plan|direct|regular|growth option|growth plan|growth|idcw option|idcw|option|plan|weekly idcw|monthly idcw|lock in|series \d+)$/i;

function detectPlan(raw: string): "Direct" | "Regular" | null {
  if (PLAN_DIRECT.test(raw)) return "Direct";
  if (PLAN_REGULAR.test(raw)) return "Regular";
  return null;
}

function detectOption(raw: string): "Growth" | "IDCW" {
  if (OPTION_IDCW.test(raw)) return "IDCW";
  if (OPTION_GROWTH.test(raw)) return "Growth";
  return "Growth";
}

function extractBaseName(raw: string): string {
  // Remove erstwhile parenthetical from middle of name
  let name = raw.replace(/\s*\([^)]*erstwhile[^)]*\)\s*/gi, " ").replace(/\s+/g, " ").trim();

  const parts = name.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  const fundParts: string[] = [];

  for (const part of parts) {
    if (STRIP_SEGMENT.test(part)) continue;
    if (PLAN_DIRECT.test(part) && part.split(/\s+/).length <= 3) continue;
    if (/^growth option$/i.test(part)) continue;
    if (/^direct plan$/i.test(part)) continue;
    fundParts.push(part);
  }

  if (fundParts.length === 0) return name;

  // Last segment might still be "Growth" attached to fund name in ALL CAPS style
  const last = fundParts[fundParts.length - 1];
  if (/^growth$/i.test(last) && fundParts.length > 1) {
    fundParts.pop();
  }

  return fundParts.join(" - ").replace(/\s+/g, " ").trim();
}

function titleCaseFundName(base: string): string {
  // Preserve ALL-CAPS fund names that are short acronyms; otherwise sentence-case words
  if (base === base.toUpperCase() && base.length > 20) {
    return base
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return base;
}

function preprocess(raw: string): string {
  return raw
    .replace(/\s*-\s*lock[- ]?in\s*/gi, " ")
    .replace(/\s*-\s*reinvestment of income distribution[^-]*/gi, "")
    .replace(/\s+cumulative option\b/gi, "")
    .replace(/\s*-\s*cumulative option\s*/gi, "")
    .replace(/\s+direct plan\b/gi, "")
    .replace(/\s+regular plan\b/gi, " Regular")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatMFSchemeName(raw: string | null | undefined): string {
  if (!raw?.trim()) return raw ?? "";

  const original = raw.trim().replace(/\s+/g, " ");
  if (CANONICAL.test(original)) return original;

  const plan   = detectPlan(original);
  const option = detectOption(original);
  const base   = titleCaseFundName(extractBaseName(preprocess(original)));

  if (!base) return original;
  if (!plan) {
    // Short holdings label without AMFI suffixes — assume Direct Growth (typical SIP)
    if (!/\s-\s(Growth|IDCW)\s\(/i.test(original)) {
      const label = titleCaseFundName(original);
      return `${label} - ${option} (Direct)`;
    }
    return original;
  }

  return `${base} - ${option} (${plan})`;
}
