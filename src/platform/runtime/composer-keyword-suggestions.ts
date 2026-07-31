const DEFAULT_STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "been", "before", "being", "but", "can", "could",
  "does", "for", "from", "have", "here", "into", "just", "like", "more", "most", "not", "only", "other",
  "our", "out", "over", "really", "should", "some", "than", "that", "their", "them", "then", "there",
  "these", "they", "this", "those", "through", "very", "was", "were", "what", "when", "where", "which",
  "the", "to", "who", "why", "will", "with", "would", "you", "your", "and", "are", "has", "its", "was",
  "an", "as", "at", "by", "if", "in", "is", "it", "of", "on", "or",
]);

export function deriveComposerKeywordSuggestions(
  rawText: string,
  { maxItems = 5, maxLength = 64 }: { maxItems?: number; maxLength?: number } = {},
): string[] {
  const boundedItems = Math.max(0, Math.min(5, Math.trunc(maxItems)));
  const boundedLength = Math.max(1, Math.min(64, Math.trunc(maxLength)));
  if (!boundedItems || typeof rawText !== "string") return [];

  const normalized = rawText
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/@[\p{L}\p{N}_]+/gu, " ")
    .toLocaleLowerCase("en-US");
  const counts = new Map<string, { count: number; first: number }>();
  const tokens = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) || [];
  tokens.forEach((token, index) => {
    const value = token.slice(0, boundedLength).replace(/^[-_]+|[-_]+$/gu, "");
    if (value.length < 2 || DEFAULT_STOP_WORDS.has(value)) return;
    const existing = counts.get(value);
    if (existing) existing.count += 1;
    else counts.set(value, { count: 1, first: index });
  });
  return [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[1].first - right[1].first)
    .slice(0, boundedItems)
    .map(([value]) => value);
}
