import generatedIndex from "./wiki-index.generated.json";
import curatedConcepts from "./concepts.json";
import type { WikiEntry, WikiMatch } from "./types";

const generatedEntries = (generatedIndex as WikiEntry[]).map((entry) => ({ ...entry, priority: entry.priority ?? 0, source: entry.source ?? "generated" as const }));
const conceptEntries = (curatedConcepts as WikiEntry[]).map((entry) => ({ ...entry, priority: entry.priority ?? 10, source: entry.pattern ? "pattern" as const : entry.source ?? "curated" as const }));

export const wikiEntries: WikiEntry[] = normalizeEntries([...conceptEntries, ...generatedEntries]);

const compiledEntries: CompiledEntry[] = compileEntries(wikiEntries);

export function createMatcher(localEntries: WikiEntry[] = [], denyTerms: string[] = []): (text: string, maxMatches: number) => WikiMatch[] {
  const compiled = compileEntries(normalizeEntries([...localEntries, ...wikiEntries]));
  const denySet = new Set(denyTerms.map((term) => normalizeDenyTerm(term)));
  return (text, maxMatches) => findMatchesWithCompiled(text, maxMatches, compiled, denySet);
}

export function findWikiMatches(text: string, maxMatches: number): WikiMatch[] {
  return findMatchesWithCompiled(text, maxMatches, compiledEntries, new Set());
}

function normalizeEntries(entries: WikiEntry[]): WikiEntry[] {
  return entries
  .filter((entry) => entry.label && entry.title && entry.url)
  .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.label.length - a.label.length || a.label.localeCompare(b.label));
}

type CompiledEntry = WikiEntry & {
  regex: RegExp;
  searchNeedle: string;
  label: string;
  isRegexConcept: boolean;
};

function compileEntries(entries: WikiEntry[]): CompiledEntry[] {
  return entries.map((entry) => ({
    ...entry,
    label: entry.label,
    regex: entry.pattern ? new RegExp(entry.pattern, "giu") : buildPattern(entry.label),
    searchNeedle: entry.pattern ? "" : normalizeSearchNeedle(entry.label),
    isRegexConcept: Boolean(entry.pattern),
  }));
}

function findMatchesWithCompiled(text: string, maxMatches: number, entries: CompiledEntry[], denyTerms: Set<string>): WikiMatch[] {
  if (!text.trim() || maxMatches <= 0) return [];

  const candidates: WikiMatch[] = [];
  const lowerText = text.toLowerCase();
  for (const entry of entries) {
    if (denyTerms.has(normalizeDenyTerm(entry.label)) || denyTerms.has(normalizeDenyTerm(entry.title))) continue;
    if (entry.searchNeedle && !lowerText.includes(entry.searchNeedle)) continue;
    if (!passesContextGates(lowerText, entry)) continue;
    entry.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = entry.regex.exec(text))) {
      const start = match.index + (entry.isRegexConcept ? 0 : match[1]?.length ?? 0);
      const matchedText = entry.isRegexConcept ? match[0] : match[2] ?? match[0];
      const end = start + matchedText.length;
      if (denyTerms.has(normalizeDenyTerm(text.slice(start, end)))) continue;
      candidates.push({ ...entry, start, end, text: text.slice(start, end) });
      if (match.index === entry.regex.lastIndex) entry.regex.lastIndex += 1;
    }
  }

  candidates.sort((a, b) => {
    const startDelta = a.start - b.start;
    if (startDelta) return startDelta;
    const lengthDelta = (b.end - b.start) - (a.end - a.start);
    if (lengthDelta) return lengthDelta;
    const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDelta) return priorityDelta;
    return (b.confidence ?? 100) - (a.confidence ?? 100);
  });

  const accepted: WikiMatch[] = [];
  const usedTitles = new Set<string>();
  for (const candidate of candidates) {
    if (accepted.length >= maxMatches) break;
    if (usedTitles.has(candidate.title)) continue;
    if (accepted.some((match) => rangesOverlap(match, candidate))) continue;
    accepted.push(candidate);
    usedTitles.add(candidate.title);
  }

  return accepted.sort((a, b) => a.start - b.start);
}

function normalizeDenyTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeSearchNeedle(value: string): string {
  const tokens = value.toLowerCase().match(/[\p{L}\p{N}$]+/gu) ?? [];
  return tokens.sort((a, b) => b.length - a.length)[0] ?? "";
}

function passesContextGates(lowerText: string, entry: WikiEntry): boolean {
  if (entry.blockContext?.some((term) => lowerText.includes(term.toLowerCase()))) return false;
  if (!entry.requiresContext || entry.requiresContext.length === 0) return true;
  return entry.requiresContext.some((term) => lowerText.includes(term.toLowerCase()));
}

function buildPattern(label: string): RegExp {
  const escaped = escapeRegExp(label).replace(/\\ /g, "\\s+");
  const needsLeftBoundary = startsWithWord(label);
  const needsRightBoundary = endsWithWord(label);
  const left = needsLeftBoundary ? "(^|[^\\p{L}\\p{N}_])" : "()";
  const right = needsRightBoundary ? "(?=$|[^\\p{L}\\p{N}_])" : "";
  return new RegExp(`${left}(${escaped})${right}`, "giu");
}

function startsWithWord(value: string): boolean {
  return /^[\p{L}\p{N}_]/u.test(value);
}

function endsWithWord(value: string): boolean {
  return /[\p{L}\p{N}_]$/u.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rangesOverlap(a: WikiMatch, b: WikiMatch): boolean {
  return a.start < b.end && b.start < a.end;
}
