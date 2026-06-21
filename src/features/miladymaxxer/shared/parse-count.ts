/**
 * Parse a human-readable count string (e.g. "1.2K", "3M", "100") into a number.
 * Returns 0 for empty or non-numeric input.
 */
export function parseCount(text: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  if (lower.includes("k")) {
    return parseFloat(lower.replace("k", "")) * 1000;
  }
  if (lower.includes("m")) {
    return parseFloat(lower.replace("m", "")) * 1000000;
  }
  return parseInt(text, 10) || 0;
}
