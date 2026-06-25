type FeatureId = "wiki" | "postreader" | "remistats" | "miladymaxxer" | "beetol" | "reminetChat";
const LEGACY_BEETOL_PREFIX = "bex" + "tol";

import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type VisualThemeSettings,
} from "./shared/reskinProfile";
import { injectReskinStyles } from "./shared/reskinStyles";

type FeatureDefinition = {
  id: FeatureId;
  isEnabled: () => Promise<boolean>;
  script: string;
};

const loaded = new Set<FeatureId>();
let postSoundContext: AudioContext | null = null;

const features: FeatureDefinition[] = [
  {
    id: "wiki",
    isEnabled: async () => {
      const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
      const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
      return settings.enabled !== false;
    },
    script: "features/wiki.js",
  },
  {
    id: "postreader",
    isEnabled: async () => {
      const stored = await chrome.storage.sync.get({ enabled: true });
      return stored.enabled !== false;
    },
    script: "features/postreader.js",
  },
  {
    id: "remistats",
    isEnabled: async () => {
      const stored = await chrome.storage.sync.get({ "milxdy.remistats.enabled": true });
      return stored["milxdy.remistats.enabled"] !== false;
    },
    script: "features/remistats.js",
  },
  {
    id: "miladymaxxer",
    isEnabled: async () => {
      const stored = await chrome.storage.sync.get({ mode: "milady" });
      return stored.mode !== "off";
    },
    script: "features/miladymaxxer.js",
  },
  {
    id: "beetol",
    isEnabled: async () => {
      const legacyKey = `milxdy.${LEGACY_BEETOL_PREFIX}.enabled`;
      const stored = await chrome.storage.local.get(["milxdy.remistats.beetol.enabled", legacyKey]);
      return (stored["milxdy.remistats.beetol.enabled"] ?? stored[legacyKey] ?? true) !== false;
    },
    script: "features/beetol.js",
  },
  {
    id: "reminetChat",
    isEnabled: async () => {
      const stored = await chrome.storage.local.get({ "milxdy.reminetChat.enabled": false });
      return stored["milxdy.reminetChat.enabled"] === true;
    },
    script: "features/reminetChat.js",
  },
];

void bootFeatures();

async function bootFeatures(): Promise<void> {
  await setupReskinProfile();
  for (const feature of features) {
    if (await feature.isEnabled()) {
      await loadFeature(feature);
    }
  }
  observeFeatureEnablement();
  setupShowNewPostsMarkers();
}

async function setupReskinProfile(): Promise<void> {
  injectReskinStyles();
  setupMaxPostSound();
  const stored = await chrome.storage.local.get({
    [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE,
    [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME,
  });
  applyReskinProfile(stored[RESKIN_PROFILE_KEY], stored[VISUAL_THEME_KEY]);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes[RESKIN_PROFILE_KEY] || changes[VISUAL_THEME_KEY])) {
      void chrome.storage.local.get({
        [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE,
        [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME,
      }).then((next) => applyReskinProfile(next[RESKIN_PROFILE_KEY], next[VISUAL_THEME_KEY]));
    }
  });
}

function applyReskinProfile(profileValue: unknown, visualValue: unknown): void {
  const profile = normalizeReskinProfile(profileValue);
  const theme = normalizeVisualTheme(visualValue, profile);
  const root = document.documentElement;
  root.dataset.milxdyReskinProfile = theme.profile;
  root.dataset.milxdyVisualBackgroundFade = String(theme.backgroundFade);
  root.dataset.milxdyVisualSquareMedia = String(theme.squareMedia);
  root.dataset.milxdyVisualPfpShape = theme.pfpShape;
  root.dataset.milxdyVisualPfpFeed = String(theme.pfpFeed);
  root.dataset.milxdyVisualPfpNotifications = String(theme.pfpNotifications);
  root.dataset.milxdyVisualPfpChat = String(theme.pfpChat);
  root.dataset.milxdyVisualQuoteMediaGap = String(theme.quoteMediaGap);
  root.dataset.milxdyVisualPostButton = theme.postButtonClickly ? "clickly" : "flat";
  root.dataset.milxdyVisualPostSound = String(theme.postSound);
  root.dataset.milxdyVisualSidebarBevel = String(theme.sidebarBevel);
  root.dataset.milxdyVisualSidebarSound = String(theme.sidebarSound);
  root.dataset.milxdyVisualNewPostsPill = String(theme.newPostsPill);
  root.dataset.milxdyVisualNewPostsSound = String(theme.newPostsSound);
  root.dataset.milxdyVisualNotificationUnreadTint = String(theme.notificationUnreadTint);
  root.dataset.milxdyVisualRemistatsBox = String(theme.remistatsBox);
  root.dataset.milxdyVisualPokePlacement = theme.pokePlacement;
  root.dataset.milxdyVisualReminetChatOverlay = String(theme.reminetChatOverlay);
  root.dataset.milxdyVisualMiladyOnly = String(theme.miladyOnly);
  root.dataset.milxdyVisualDisableSelfTracking = String(theme.disableSelfTracking);
  root.dataset.milxdyVisualMaxxerIntensity = theme.maxxerIntensity;
  root.dataset.milxdyVisualMaxxerSeparators = theme.maxxerSeparators;
  root.dataset.milxdyVisualMaxxerShimmer = String(theme.maxxerShimmer);
  root.style.setProperty("--milxdy-font-tweet", tweetFontStack(theme.tweetFont));
  root.style.setProperty("--milxdy-font-ui", uiFontStack(theme.uiFont));
  root.style.setProperty("--milxdy-font-mono", '"Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace');
}

function setupMaxPostSound(): void {
  document.addEventListener("click", (event) => {
    if (document.documentElement.dataset.milxdyReskinProfile !== "max") return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest<HTMLElement>('header[role="banner"] nav a, [data-testid^="AppTabBar_"]')) {
      if (document.documentElement.dataset.milxdyVisualSidebarSound !== "false") playPostSendSound(0.45);
      return;
    }
    const newPostsButton = target?.closest<HTMLElement>('[data-milxdy-show-new-posts="true"]');
    if (newPostsButton && /show\s+\d+\s+posts?/i.test(newPostsButton.textContent || "")) {
      if (document.documentElement.dataset.milxdyVisualNewPostsSound !== "false") playPostSendSound(0.55);
      return;
    }
    if (document.documentElement.dataset.milxdyVisualPostSound === "false") return;
    const button = target?.closest<HTMLElement>('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    playPostSendSound();
  }, true);
}

function setupShowNewPostsMarkers(): void {
  const mark = () => {
    for (const button of document.querySelectorAll<HTMLElement>('[role="button"], button')) {
      const isShowNewPosts = /show\s+\d+\s+posts?/i.test(button.textContent || "");
      if (isShowNewPosts) button.dataset.milxdyShowNewPosts = "true";
      else if (button.dataset.milxdyShowNewPosts === "true") delete button.dataset.milxdyShowNewPosts;
    }
  };
  mark();
  window.setInterval(mark, 1200);
}

function playPostSendSound(volumeScale = 1): void {
  const audioWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = postSoundContext ?? new AudioContextCtor();
  postSoundContext = context;
  if (context.state === "suspended") void context.resume();
  const start = context.currentTime + 0.005;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.035 * volumeScale, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  gain.connect(context.destination);

  const first = context.createOscillator();
  first.type = "square";
  first.frequency.setValueAtTime(660, start);
  first.frequency.exponentialRampToValueAtTime(880, start + 0.08);
  first.connect(gain);
  first.start(start);
  first.stop(start + 0.11);

  const second = context.createOscillator();
  second.type = "triangle";
  second.frequency.setValueAtTime(1320, start + 0.055);
  second.connect(gain);
  second.start(start + 0.055);
  second.stop(start + 0.18);
}

function tweetFontStack(value: VisualThemeSettings["tweetFont"]): string {
  switch (value) {
    case "hei":
      return '"Milxdy Remilia Hei", TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    case "mincho":
      return '"Milxdy Remilia Mincho", Georgia, "Times New Roman", serif';
    case "menlo":
      return '"Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    case "twitter":
    default:
      return 'TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  }
}

function uiFontStack(value: VisualThemeSettings["uiFont"]): string {
  switch (value) {
    case "menlo":
      return '"Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    case "system":
      return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    case "hei":
    default:
      return '"Milxdy Remilia Hei", "Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  }
}

async function loadFeature(feature: FeatureDefinition): Promise<void> {
  if (loaded.has(feature.id)) return;
  loaded.add(feature.id);
  if (feature.id === "remistats") injectStylesheet("milxdy-remistats-styles", "remistats/remistats.css");
  if (feature.id === "beetol") injectStylesheet("milxdy-beetol-styles", "beetol/content.css");
  if (feature.id === "reminetChat") injectStylesheet("milxdy-reminet-chat-styles", "reminetChat/content.css");
  await import(chrome.runtime.getURL(feature.script));
  void writeLoadedFeatureDiagnostics();
}

function observeFeatureEnablement(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    for (const feature of features) {
      if (!featureChanged(feature.id, changes, area)) continue;
      void feature.isEnabled().then((enabled) => {
        if (enabled) void loadFeature(feature);
      });
    }
  });
}

function featureChanged(
  feature: FeatureId,
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
): boolean {
  if (feature === "wiki") return area === "local" && Boolean(changes["remiliaWikiHyperlink.settings"]);
  if (feature === "postreader") return area === "sync" && Boolean(changes.enabled);
  if (feature === "remistats") return area === "sync" && Boolean(changes["milxdy.remistats.enabled"]);
  if (feature === "miladymaxxer") return area === "sync" && Boolean(changes.mode);
  if (feature === "beetol") return area === "local" && Boolean(changes["milxdy.remistats.beetol.enabled"]);
  if (feature === "reminetChat") return area === "local" && Boolean(changes["milxdy.reminetChat.enabled"]);
  return false;
}

function injectStylesheet(id: string, path: string): void {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL(path);
  document.documentElement.appendChild(link);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function writeLoadedFeatureDiagnostics(): Promise<void> {
  const stored = await chrome.storage.local.get({ "milxdy.diagnostics.enabled": false });
  if (stored["milxdy.diagnostics.enabled"] !== true) return;
  await chrome.storage.local.set({
    "milxdy.diagnostics.loadedFeatures": {
      features: Array.from(loaded).sort(),
      updatedAt: Date.now(),
    },
  });
}

export {};
