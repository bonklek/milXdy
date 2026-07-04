import { DEFAULT_SETTINGS } from "./shared/defaults";
import type { AutoplayMode, BodyHighlightMode, ButtonPlacement, CustomTtsTimingMode, FullQuoteDisplay, PlayerPosition, PostReadingSettings, TtsEngineChoice, VoiceGenderFilter } from "./shared/types";
import type { BoundarySupport } from "./speech";

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof PostReadingSettings>;
const VOICE_BOUNDARY_SUPPORT_KEY = "voiceBoundarySupportV2";

export async function loadSettings(): Promise<PostReadingSettings> {
  const fallback = { ...DEFAULT_SETTINGS };
  if (!globalThis.chrome?.storage?.sync) {
    return fallback;
  }
  const stored = await chrome.storage.sync.get(fallback);
  return normalizeSettings(stored);
}

export async function saveSettings(settings: PostReadingSettings): Promise<void> {
  if (!globalThis.chrome?.storage?.sync) return;
  await chrome.storage.sync.set(normalizeSettings(settings));
}

export function observeSettings(callback: (settings: PostReadingSettings) => void): () => void {
  if (!globalThis.chrome?.storage?.onChanged) return () => undefined;
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "sync") return;
    if (!SETTINGS_KEYS.some((key) => changes[key])) return;
    void loadSettings().then(callback);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function loadVoiceBoundarySupport(): Promise<Record<string, BoundarySupport>> {
  if (!globalThis.chrome?.storage?.local) return {};
  const stored = await chrome.storage.local.get({ [VOICE_BOUNDARY_SUPPORT_KEY]: {} });
  return normalizeVoiceBoundarySupport(stored[VOICE_BOUNDARY_SUPPORT_KEY]);
}

export async function saveVoiceBoundarySupport(results: Record<string, BoundarySupport>): Promise<void> {
  if (!globalThis.chrome?.storage?.local) return;
  await chrome.storage.local.set({ [VOICE_BOUNDARY_SUPPORT_KEY]: normalizeVoiceBoundarySupport(results) });
}

export function normalizeSettings(value: unknown): PostReadingSettings {
  const raw = value && typeof value === "object" ? value as Partial<PostReadingSettings> : {};
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_SETTINGS.enabled,
    speed: clampNumber(raw.speed, 0.5, 10, DEFAULT_SETTINGS.speed),
    volume: clampNumber(raw.volume, 0, 1, DEFAULT_SETTINGS.volume),
    voiceURI: typeof raw.voiceURI === "string" && raw.voiceURI.length > 0 ? raw.voiceURI : null,
    voiceLanguageFilter: normalizeVoiceLanguageFilter(raw.voiceLanguageFilter),
    voiceGenderFilter: normalizeVoiceGenderFilter(raw.voiceGenderFilter),
    autoVoice: typeof raw.autoVoice === "boolean" ? raw.autoVoice : DEFAULT_SETTINGS.autoVoice,
    ttsEngine: isTtsEngineChoice(raw.ttsEngine) ? raw.ttsEngine : DEFAULT_SETTINGS.ttsEngine,
    customTtsEndpoint: typeof raw.customTtsEndpoint === "string" && raw.customTtsEndpoint.trim().length > 0 ? raw.customTtsEndpoint.trim() : null,
    customTtsTimingMode: isCustomTtsTimingMode(raw.customTtsTimingMode) ? raw.customTtsTimingMode : DEFAULT_SETTINGS.customTtsTimingMode,
    autoplayNext: typeof raw.autoplayNext === "boolean" ? raw.autoplayNext : DEFAULT_SETTINGS.autoplayNext,
    autoplayMode: isAutoplayMode(raw.autoplayMode) ? raw.autoplayMode : DEFAULT_SETTINGS.autoplayMode,
    skipPromotedPosts: typeof raw.skipPromotedPosts === "boolean" ? raw.skipPromotedPosts : DEFAULT_SETTINGS.skipPromotedPosts,
    endOfTweetDing: typeof raw.endOfTweetDing === "boolean" ? raw.endOfTweetDing : DEFAULT_SETTINGS.endOfTweetDing,
    includeQuotes: typeof raw.includeQuotes === "boolean" ? raw.includeQuotes : DEFAULT_SETTINGS.includeQuotes,
    fetchFullQuotes: typeof raw.fetchFullQuotes === "boolean" ? raw.fetchFullQuotes : DEFAULT_SETTINGS.fetchFullQuotes,
    fullQuoteDisplay: isFullQuoteDisplay(raw.fullQuoteDisplay) ? raw.fullQuoteDisplay : DEFAULT_SETTINGS.fullQuoteDisplay,
    includeHyperlinks: typeof raw.includeHyperlinks === "boolean" ? raw.includeHyperlinks : DEFAULT_SETTINGS.includeHyperlinks,
    includeImageAltText: typeof raw.includeImageAltText === "boolean" ? raw.includeImageAltText : DEFAULT_SETTINGS.includeImageAltText,
    includeImageOcr: typeof raw.includeImageOcr === "boolean" ? raw.includeImageOcr : DEFAULT_SETTINGS.includeImageOcr,
    includeLinkPreviews: typeof raw.includeLinkPreviews === "boolean" ? raw.includeLinkPreviews : DEFAULT_SETTINGS.includeLinkPreviews,
    expandShowMore: typeof raw.expandShowMore === "boolean" ? raw.expandShowMore : DEFAULT_SETTINGS.expandShowMore,
    wikiAutoScroll: typeof raw.wikiAutoScroll === "boolean" ? raw.wikiAutoScroll : DEFAULT_SETTINGS.wikiAutoScroll,
    activeTweetHighlight: typeof raw.activeTweetHighlight === "boolean" ? raw.activeTweetHighlight : DEFAULT_SETTINGS.activeTweetHighlight,
    bodyHighlightMode: normalizeBodyHighlightMode(raw.bodyHighlightMode, (raw as { highlightMode?: unknown }).highlightMode),
    playerPosition: isPlayerPosition(raw.playerPosition) ? raw.playerPosition : DEFAULT_SETTINGS.playerPosition,
    buttonPlacement: isButtonPlacement(raw.buttonPlacement) ? raw.buttonPlacement : DEFAULT_SETTINGS.buttonPlacement,
    useHandles: typeof raw.useHandles === "boolean" ? raw.useHandles : DEFAULT_SETTINGS.useHandles,
    keyNextTweet: normalizeKeybind(raw.keyNextTweet, DEFAULT_SETTINGS.keyNextTweet, "Ctrl+Alt+D"),
    keyPreviousTweet: normalizeKeybind(raw.keyPreviousTweet, DEFAULT_SETTINGS.keyPreviousTweet, "Ctrl+Alt+A"),
    keyNextChunk: normalizeKeybind(raw.keyNextChunk, DEFAULT_SETTINGS.keyNextChunk),
    keyPreviousChunk: normalizeKeybind(raw.keyPreviousChunk, DEFAULT_SETTINGS.keyPreviousChunk),
    keySkipOcr: normalizeKeybind(raw.keySkipOcr, DEFAULT_SETTINGS.keySkipOcr),
    keyPlayPause: normalizeKeybind(raw.keyPlayPause, DEFAULT_SETTINGS.keyPlayPause, "Ctrl+Alt+Space"),
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isAutoplayMode(value: unknown): value is AutoplayMode {
  return value === "visible" || value === "autoscroll";
}

function isTtsEngineChoice(value: unknown): value is TtsEngineChoice {
  return value === "web-speech" || value === "custom-http";
}

function normalizeVoiceLanguageFilter(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SETTINGS.voiceLanguageFilter;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "all") return "all";
  return /^[a-z]{2,3}$/.test(normalized) ? normalized : DEFAULT_SETTINGS.voiceLanguageFilter;
}

function normalizeVoiceGenderFilter(value: unknown): VoiceGenderFilter {
  return value === "female" || value === "male" ? value : DEFAULT_SETTINGS.voiceGenderFilter;
}

function isCustomTtsTimingMode(value: unknown): value is CustomTtsTimingMode {
  return value === "off" || value === "engine";
}

function normalizeBodyHighlightMode(value: unknown, legacyValue: unknown): BodyHighlightMode {
  if (value === "off" || value === "word" || value === "smooth") return value;
  if (legacyValue === "off") return "off";
  if (legacyValue === "jump") return "word";
  if (legacyValue === "smooth") return "smooth";
  return DEFAULT_SETTINGS.bodyHighlightMode;
}

function isPlayerPosition(value: unknown): value is PlayerPosition {
  return value === "top-right" || value === "bottom-right" || value === "top-left" || value === "bottom-left";
}

function isButtonPlacement(value: unknown): value is ButtonPlacement {
  return value === "auto" || value === "top" || value === "actions";
}

function isFullQuoteDisplay(value: unknown): value is FullQuoteDisplay {
  return value === "hidden" || value === "expand" || value === "scroll";
}

function normalizeKeybind(value: unknown, fallback: string, legacyDefault?: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (legacyDefault && normalizeKeybindText(trimmed) === normalizeKeybindText(legacyDefault)) return fallback;
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeKeybindText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function normalizeVoiceBoundarySupport(value: unknown): Record<string, BoundarySupport> {
  if (!value || typeof value !== "object") return {};
  const normalized: Record<string, BoundarySupport> = {};
  for (const [key, result] of Object.entries(value as Record<string, unknown>)) {
    if (result === "supported" || result === "unsupported" || result === "unknown") {
      normalized[key] = result;
    }
  }
  return normalized;
}
