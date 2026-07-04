/**
 * Safely parse a JSON string into a plain object.
 * Returns null for empty input, parse errors, or any non-object value (including arrays).
 */
export function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
