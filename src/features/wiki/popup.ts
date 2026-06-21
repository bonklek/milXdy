import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";
import { loadPerformanceStats } from "./localData";
import type { Settings } from "./types";

const enabled = document.querySelector<HTMLInputElement>("#enabled");
const previews = document.querySelector<HTMLInputElement>("#previews");
const debugMode = document.querySelector<HTMLInputElement>("#debugMode");
const maxLinksEnabled = document.querySelector<HTMLInputElement>("#maxLinksEnabled");
const maxLinks = document.querySelector<HTMLInputElement>("#maxLinks");
const maxLowConfidenceLinks = document.querySelector<HTMLInputElement>("#maxLowConfidenceLinks");
const linkColor = document.querySelector<HTMLInputElement>("#linkColor");
const openOptions = document.querySelector<HTMLButtonElement>("#openOptions");
const stats = document.querySelector<HTMLElement>("#stats");

void boot();

async function boot(): Promise<void> {
  const settings = await loadSettings();
  render(settings);
  await renderStats();

  enabled?.addEventListener("change", () => void persist());
  previews?.addEventListener("change", () => void persist());
  debugMode?.addEventListener("change", () => void persist());
  maxLinksEnabled?.addEventListener("change", () => void persist());
  maxLinks?.addEventListener("change", () => void persist());
  maxLowConfidenceLinks?.addEventListener("change", () => void persist());
  linkColor?.addEventListener("input", () => void persist());
  openOptions?.addEventListener("click", () => chrome.runtime.openOptionsPage());
}

async function renderStats(): Promise<void> {
  if (!stats) return;
  const current = await loadPerformanceStats();
  const age = current.updatedAt ? `${Math.round((Date.now() - current.updatedAt) / 1000)}s ago` : "never";
  stats.textContent = `Scanned ${current.tweetsScanned} posts, linked ${current.linksCreated}, matching ${current.matchingMs}ms, skipped ${current.skippedWholeTweet + current.skippedLowConfidence}. Updated ${age}.`;
}

function render(settings: Settings): void {
  if (enabled) enabled.checked = settings.enabled;
  if (previews) previews.checked = settings.previewsEnabled;
  if (debugMode) debugMode.checked = settings.debugMode;
  if (maxLinksEnabled) maxLinksEnabled.checked = settings.maxLinksPerPostEnabled;
  if (maxLinks) maxLinks.value = String(settings.maxLinksPerPost);
  if (maxLowConfidenceLinks) maxLowConfidenceLinks.value = String(settings.maxLowConfidenceLinksPerPost);
  if (linkColor) linkColor.value = settings.linkColor;
}

async function persist(): Promise<void> {
  const next: Settings = {
    enabled: enabled?.checked ?? DEFAULT_SETTINGS.enabled,
    previewsEnabled: previews?.checked ?? DEFAULT_SETTINGS.previewsEnabled,
    debugMode: debugMode?.checked ?? DEFAULT_SETTINGS.debugMode,
    maxLinksPerPostEnabled: maxLinksEnabled?.checked ?? DEFAULT_SETTINGS.maxLinksPerPostEnabled,
    maxLinksPerPost: Number(maxLinks?.value || DEFAULT_SETTINGS.maxLinksPerPost),
    maxLowConfidenceLinksPerPost: Number(maxLowConfidenceLinks?.value ?? DEFAULT_SETTINGS.maxLowConfidenceLinksPerPost),
    linkColor: linkColor?.value || DEFAULT_SETTINGS.linkColor,
  };
  await saveSettings(next);
}
