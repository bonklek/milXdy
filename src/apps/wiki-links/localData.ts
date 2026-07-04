import type { LaterItem, LocalAlias, PerformanceStats, TuningExport, WikiEntry } from "./types";

const ALIASES_KEY = "remiliaWikiHyperlink.localAliases";
const DENY_KEY = "remiliaWikiHyperlink.denyTerms";
const LATER_KEY = "remiliaWikiHyperlink.laterItems";
const PERF_KEY = "remiliaWikiHyperlink.performanceStats";

export async function loadLocalAliases(): Promise<LocalAlias[]> {
  const stored = await chrome.storage.local.get(ALIASES_KEY);
  return Array.isArray(stored[ALIASES_KEY]) ? stored[ALIASES_KEY] as LocalAlias[] : [];
}

export async function saveLocalAliases(aliases: LocalAlias[]): Promise<void> {
  await chrome.storage.local.set({ [ALIASES_KEY]: aliases });
}

export async function loadDenyTerms(): Promise<string[]> {
  const stored = await chrome.storage.local.get(DENY_KEY);
  return Array.isArray(stored[DENY_KEY]) ? stored[DENY_KEY] as string[] : [];
}

export async function saveDenyTerms(terms: string[]): Promise<void> {
  await chrome.storage.local.set({ [DENY_KEY]: normalizeUnique(terms) });
}

export async function loadLaterItems(): Promise<LaterItem[]> {
  const stored = await chrome.storage.local.get(LATER_KEY);
  return Array.isArray(stored[LATER_KEY]) ? stored[LATER_KEY] as LaterItem[] : [];
}

export async function saveLaterItems(items: LaterItem[]): Promise<void> {
  await chrome.storage.local.set({ [LATER_KEY]: items });
}

export function localAliasesToEntries(aliases: LocalAlias[]): WikiEntry[] {
  return aliases.map((alias) => ({
    label: alias.label,
    title: alias.title,
    url: alias.url,
    priority: 50,
    confidence: 100,
    source: "local",
  }));
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function exportTuningData(): Promise<TuningExport> {
  const [aliases, denyTerms, laterItems] = await Promise.all([loadLocalAliases(), loadDenyTerms(), loadLaterItems()]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    aliases,
    denyTerms,
    laterItems,
  };
}

export async function importTuningData(data: TuningExport): Promise<void> {
  if (data.version !== 1) throw new Error("Unsupported tuning data version");
  await Promise.all([
    saveLocalAliases(Array.isArray(data.aliases) ? data.aliases : []),
    saveDenyTerms(Array.isArray(data.denyTerms) ? data.denyTerms : []),
    saveLaterItems(Array.isArray(data.laterItems) ? data.laterItems : []),
  ]);
}

export async function loadPerformanceStats(): Promise<PerformanceStats> {
  const stored = await chrome.storage.local.get(PERF_KEY);
  return normalizePerformanceStats(stored[PERF_KEY]);
}

export async function savePerformanceStats(stats: PerformanceStats): Promise<void> {
  await chrome.storage.local.set({ [PERF_KEY]: stats });
}

function normalizePerformanceStats(value: unknown): PerformanceStats {
  const stats = value && typeof value === "object" ? value as Partial<PerformanceStats> : {};
  return {
    tweetsScanned: Number(stats.tweetsScanned) || 0,
    linksCreated: Number(stats.linksCreated) || 0,
    matchingMs: Number(stats.matchingMs) || 0,
    skippedWholeTweet: Number(stats.skippedWholeTweet) || 0,
    skippedLowConfidence: Number(stats.skippedLowConfidence) || 0,
    updatedAt: Number(stats.updatedAt) || 0,
  };
}

function normalizeUnique(values: string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const clean = value.replace(/\s+/g, " ").trim().toLowerCase();
    if (clean) seen.add(clean);
  }
  return Array.from(seen).sort();
}
