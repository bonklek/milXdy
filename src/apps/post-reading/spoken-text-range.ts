// Locate displayed text in the spoken sequence, preserving quote and whitespace matching.
export function findBodyRange(spokenText: string, bodyText: string, occurrence: "first" | "last", fromIndex = 0): { start: number; end: number; text: string } | null {
  const text = bodyText.trim();
  if (!text) return null;
  const quoted = `"${text}"`;
  const quotedStart = occurrence === "first" ? spokenText.indexOf(quoted, fromIndex) : spokenText.lastIndexOf(quoted);
  let start = quotedStart >= 0 ? quotedStart + 1 : occurrence === "first" ? spokenText.indexOf(text, fromIndex) : spokenText.lastIndexOf(text);
  if (start < 0) {
    start = findNormalizedRangeStart(spokenText, text, occurrence, fromIndex);
  }
  if (start < 0) return null;
  return { start, end: start + text.length, text };
}

function findNormalizedRangeStart(haystack: string, needle: string, occurrence: "first" | "last", fromIndex = 0): number {
  const collapsedNeedle = needle.replace(/\s+/g, " ").trim();
  if (!collapsedNeedle) return -1;
  const pattern = collapsedNeedle
    .split(" ")
    .map((part) => escapeRegExp(part))
    .join("\\s+");
  const match = Array.from(haystack.matchAll(new RegExp(pattern, "g")))
    .filter((item) => occurrence !== "first" || (item.index ?? -1) >= fromIndex);
  if (!match || match.length === 0) return -1;
  const selected = occurrence === "first" ? match[0] : match[match.length - 1];
  return selected.index ?? -1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

