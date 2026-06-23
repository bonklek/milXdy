import type { Settings } from "./types";

const SETTINGS_KEY = "remiliaWikiHyperlink.settings";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  previewsEnabled: true,
  debugMode: false,
  grokWorkflowMode: "one-shot",
  maxLinksPerPostEnabled: false,
  maxLinksPerPost: 4,
  maxLowConfidenceLinksPerPost: 1,
  linkColor: "#ff4fbf",
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(asPartialSettings(stored[SETTINGS_KEY]));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

export function observeSettings(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    callback(normalizeSettings(asPartialSettings(changes[SETTINGS_KEY].newValue)));
  });
}

function asPartialSettings(value: unknown): Partial<Settings> | undefined {
  return value && typeof value === "object" ? value as Partial<Settings> : undefined;
}

function normalizeSettings(value: Partial<Settings> | undefined): Settings {
  const maxLinks = Number(value?.maxLinksPerPost);
  const maxLowConfidenceLinks = Number(value?.maxLowConfidenceLinksPerPost);
  const linkColor = typeof value?.linkColor === "string" && /^#[0-9a-f]{6}$/i.test(value.linkColor)
    ? value.linkColor
    : DEFAULT_SETTINGS.linkColor;
  return {
    enabled: value?.enabled ?? DEFAULT_SETTINGS.enabled,
    previewsEnabled: value?.previewsEnabled ?? DEFAULT_SETTINGS.previewsEnabled,
    debugMode: value?.debugMode ?? DEFAULT_SETTINGS.debugMode,
    grokWorkflowMode: value?.grokWorkflowMode === "socratic" ? "socratic" : DEFAULT_SETTINGS.grokWorkflowMode,
    maxLinksPerPostEnabled: value?.maxLinksPerPostEnabled ?? DEFAULT_SETTINGS.maxLinksPerPostEnabled,
    maxLinksPerPost: Number.isFinite(maxLinks) ? Math.min(12, Math.max(1, Math.round(maxLinks))) : DEFAULT_SETTINGS.maxLinksPerPost,
    maxLowConfidenceLinksPerPost: Number.isFinite(maxLowConfidenceLinks)
      ? Math.min(12, Math.max(0, Math.round(maxLowConfidenceLinks)))
      : DEFAULT_SETTINGS.maxLowConfidenceLinksPerPost,
    linkColor,
  };
}
