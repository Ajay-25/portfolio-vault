import { coerceBoolean } from "@/lib/agent/coerce-tool-input";

/** Agent must pass confirmed: true after user explicitly approves a destructive action. */
export function isDeleteConfirmed(input: Record<string, unknown>): boolean {
  return coerceBoolean(input.confirmed) === true;
}

export function confirmationRequired(action: string, details: string[]): string {
  return [
    "CONFIRMATION REQUIRED — no changes were made.",
    action,
    ...details,
    "",
    "Show this to the user and ask them to confirm. Then call the same tool again with confirmed: true.",
  ].join("\n");
}
