type Area = "local" | "sync";
type ControlKind = "boolean" | "number" | "string" | "nullableString" | "handleList";
type ThemeMode = "light" | "dark" | "system";
type BuildProfile = "lite" | "balanced" | "full";
type BuildTarget = "chromium" | "firefox";
type PopupFeatureId = "rootVisuals" | "post-reading" | "wiki" | "remistats" | "miladymaxxer" | "beetol" | "reminetChat";

declare const MILXDY_BUILD_PROFILE: string;
declare const MILXDY_BUILD_TARGET: string;

import type { AppPreset } from "./shared/appPlatform";
import { FIRST_PARTY_APPS } from "./shared/firstPartyApps";
import {
  PERFORMANCE_MODE_KEY,
  budgetForPerformanceMode,
  normalizePerformanceMode,
  type PerformanceMode,
} from "./shared/performanceMode";
import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  PROFILE_AUDIO_PRESETS,
  RESKIN_PROFILE_KEY,
  VISUAL_CUSTOM_THEMES_KEY,
  VISUAL_PRESETS,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type ReskinProfile,
  type SavedVisualTheme,
  type VisualThemeSettings,
  type ProfileAudioSettings,
} from "./shared/reskinProfile";

type ControlBinding = {
  area: Area;
  key: string;
  property?: string;
  kind: ControlKind;
  fallback: boolean | number | string | null | string[];
};

const WIKI_SETTINGS_KEY = "remiliaWikiHyperlink.settings";
const WIKI_LATER_KEY = "remiliaWikiHyperlink.laterItems";
const WIKI_API = "https://wiki.remilia.org/api.php";
const WIKI_PRELOAD_TEMPLATE = "Template:New page preload";
const WIKI_AI_HELP_ZIP = "wiki-helper/remilia-wiki-article-writer.zip";
const WIKITOOL_LATEST_RELEASE_API = "https://api.github.com/repos/remiliacorporation/remilia-wikitool/releases/latest";
const WIKITOOL_RELEASES_URL = "https://github.com/remiliacorporation/remilia-wikitool/releases/latest";
const UPDATE_STATUS_KEY = "milxdy.updateStatus";
const LEGACY_BEETOL_PREFIX = "bex" + "tol";
const GITHUB_ISSUES_NEW_URL = "https://github.com/bonklek/milXdy/issues/new";
const X_FEEDBACK_REPLY_URL = "https://x.com/intent/tweet";
const X_FEEDBACK_POST_ID = "2069113443664220227";
const X_FEEDBACK_COLLECTOR_URL = `https://x.com/MiladyBonkle/status/${X_FEEDBACK_POST_ID}`;
const REMILIA_NET_LOGIN_URL = "https://www.remilia.net/";
const X_HOME_URL = "https://x.com/home";
const LAST_POKE_DIAGNOSTIC_KEY = "milxdy.remistats.lastPokeDiagnostic";
const SETTINGS_THEME_KEY = "milxdy.settings.theme";
const FIRST_RUN_STATUS_KEY = "milxdy.apps.firstRun.status";
const ONBOARDING_ACTIVE_KEY = "milxdy.onboarding.active";
const ONBOARDING_TOOLBAR_PINNED_KEY = "milxdy.onboarding.toolbarPinned";
const RAIL_PIN_KEY = "milxdy.apps.railPinned";
const BUILD_PROFILE = normalizeBuildProfile(MILXDY_BUILD_PROFILE);
const BUILD_TARGET = normalizeBuildTarget(MILXDY_BUILD_TARGET);
const PROFILE_FEATURES: Record<BuildProfile, readonly PopupFeatureId[]> = {
  lite: ["rootVisuals", "post-reading"],
  balanced: ["rootVisuals", "post-reading", "wiki", "remistats"],
  full: ["rootVisuals", "post-reading", "wiki", "remistats", "miladymaxxer", "beetol", "reminetChat"],
};

type UpdateStatus = {
  checkedAt: number;
  currentVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  latestAssetUrl?: string | null;
  latestAssetName?: string | null;
  expectedAssetName?: string | null;
  matchedExpectedAsset?: boolean;
  updateAvailable: boolean;
  error?: string;
};

type WikiLaterItem = {
  id: string;
  text: string;
  pageUrl?: string;
  createdAt: number;
};

type WikiSearchResult = {
  title: string;
  wordcount?: number;
};

type GitHubRelease = {
  html_url?: string;
  assets?: GitHubReleaseAsset[];
};

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

let activeWikiLaterSearchId: string | null = null;
let visualDraft: VisualThemeSettings = DEFAULT_VISUAL_THEME;
let visualMode: ReskinProfile | "custom" = "moderate";
let visualSelectedThemeId = "new";

const bindings: Record<string, ControlBinding> = {
  diagnosticsEnabled: { area: "local", key: "milxdy.diagnostics.enabled", kind: "boolean", fallback: false },
  performanceMode: { area: "local", key: PERFORMANCE_MODE_KEY, kind: "string", fallback: "balanced" },
  reskinProfile: { area: "local", key: RESKIN_PROFILE_KEY, kind: "string", fallback: DEFAULT_RESKIN_PROFILE },
  "wiki.enabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "enabled", kind: "boolean", fallback: true },
  "wiki.previewsEnabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "previewsEnabled", kind: "boolean", fallback: true },
  "wiki.debugMode": { area: "local", key: WIKI_SETTINGS_KEY, property: "debugMode", kind: "boolean", fallback: false },
  "wiki.grokWorkflowMode": { area: "local", key: WIKI_SETTINGS_KEY, property: "grokWorkflowMode", kind: "string", fallback: "one-shot" },
  "wiki.maxLinksPerPostEnabled": { area: "local", key: WIKI_SETTINGS_KEY, property: "maxLinksPerPostEnabled", kind: "boolean", fallback: false },
  "wiki.maxLinksPerPost": { area: "local", key: WIKI_SETTINGS_KEY, property: "maxLinksPerPost", kind: "number", fallback: 4 },
  "wiki.maxLowConfidenceLinksPerPost": { area: "local", key: WIKI_SETTINGS_KEY, property: "maxLowConfidenceLinksPerPost", kind: "number", fallback: 1 },
  "wiki.linkColor": { area: "local", key: WIKI_SETTINGS_KEY, property: "linkColor", kind: "string", fallback: "#ff4fbf" },
  "post-reading.enabled": { area: "sync", key: "enabled", kind: "boolean", fallback: true },
  "post-reading.speed": { area: "sync", key: "speed", kind: "number", fallback: 1 },
  "post-reading.volume": { area: "sync", key: "volume", kind: "number", fallback: 1 },
  "post-reading.voiceURI": { area: "sync", key: "voiceURI", kind: "nullableString", fallback: null },
  "post-reading.autoVoice": { area: "sync", key: "autoVoice", kind: "boolean", fallback: true },
  "post-reading.ttsEngine": { area: "sync", key: "ttsEngine", kind: "string", fallback: "web-speech" },
  "post-reading.customTtsEndpoint": { area: "sync", key: "customTtsEndpoint", kind: "nullableString", fallback: null },
  "post-reading.customTtsTimingMode": { area: "sync", key: "customTtsTimingMode", kind: "string", fallback: "engine" },
  "post-reading.autoplayNext": { area: "sync", key: "autoplayNext", kind: "boolean", fallback: true },
  "post-reading.autoplayMode": { area: "sync", key: "autoplayMode", kind: "string", fallback: "autoscroll" },
  "post-reading.skipPromotedPosts": { area: "sync", key: "skipPromotedPosts", kind: "boolean", fallback: true },
  "post-reading.endOfTweetDing": { area: "sync", key: "endOfTweetDing", kind: "boolean", fallback: true },
  "post-reading.includeQuotes": { area: "sync", key: "includeQuotes", kind: "boolean", fallback: true },
  "post-reading.fetchFullQuotes": { area: "sync", key: "fetchFullQuotes", kind: "boolean", fallback: true },
  "post-reading.fullQuoteDisplay": { area: "sync", key: "fullQuoteDisplay", kind: "string", fallback: "scroll" },
  "post-reading.includeHyperlinks": { area: "sync", key: "includeHyperlinks", kind: "boolean", fallback: false },
  "post-reading.includeImageAltText": { area: "sync", key: "includeImageAltText", kind: "boolean", fallback: true },
  "post-reading.includeImageOcr": { area: "sync", key: "includeImageOcr", kind: "boolean", fallback: true },
  "post-reading.includeLinkPreviews": { area: "sync", key: "includeLinkPreviews", kind: "boolean", fallback: true },
  "post-reading.expandShowMore": { area: "sync", key: "expandShowMore", kind: "boolean", fallback: true },
  "post-reading.activeTweetHighlight": { area: "sync", key: "activeTweetHighlight", kind: "boolean", fallback: true },
  "post-reading.bodyHighlightMode": { area: "sync", key: "bodyHighlightMode", kind: "string", fallback: "smooth" },
  "post-reading.playerPosition": { area: "sync", key: "playerPosition", kind: "string", fallback: "top-right" },
  "post-reading.buttonPlacement": { area: "sync", key: "buttonPlacement", kind: "string", fallback: "auto" },
  "post-reading.useHandles": { area: "sync", key: "useHandles", kind: "boolean", fallback: false },
  "post-reading.keyNextTweet": { area: "sync", key: "keyNextTweet", kind: "string", fallback: "Ctrl+Alt+ArrowDown" },
  "post-reading.keyPreviousTweet": { area: "sync", key: "keyPreviousTweet", kind: "string", fallback: "Ctrl+Alt+ArrowUp" },
  "post-reading.keyNextChunk": { area: "sync", key: "keyNextChunk", kind: "string", fallback: "Ctrl+Alt+ArrowRight" },
  "post-reading.keyPreviousChunk": { area: "sync", key: "keyPreviousChunk", kind: "string", fallback: "Ctrl+Alt+ArrowLeft" },
  "post-reading.keySkipOcr": { area: "sync", key: "keySkipOcr", kind: "string", fallback: "Ctrl+Alt+S" },
  "post-reading.keyPlayPause": { area: "sync", key: "keyPlayPause", kind: "string", fallback: "Ctrl+Alt+\\" },
  "remistats.enabled": { area: "sync", key: "milxdy.remistats.enabled", kind: "boolean", fallback: true },
  "remistats.showTooltips": { area: "sync", key: "showTooltips", kind: "boolean", fallback: true },
  "remistats.soundsEnabled": { area: "sync", key: "soundsEnabled", kind: "boolean", fallback: true },
  "remistats.soundVolume": { area: "sync", key: "soundVolume", kind: "number", fallback: 0.6 },
  "reminetChat.sounds.enabled": { area: "sync", key: "milxdy.reminetChat.sounds.enabled", kind: "boolean", fallback: true },
  "reminetChat.sounds.volume": { area: "sync", key: "milxdy.reminetChat.sounds.volume", kind: "number", fallback: 0.55 },
  "reminetChat.sounds.send": { area: "sync", key: "milxdy.reminetChat.sounds.send", kind: "boolean", fallback: true },
  "reminetChat.sounds.react": { area: "sync", key: "milxdy.reminetChat.sounds.react", kind: "boolean", fallback: true },
  "reminetChat.sounds.reactToMe": { area: "sync", key: "milxdy.reminetChat.sounds.reactToMe", kind: "boolean", fallback: true },
  "reminetChat.sounds.message": { area: "sync", key: "milxdy.reminetChat.sounds.message", kind: "boolean", fallback: true },
  "reminetChat.sounds.poke": { area: "sync", key: "milxdy.reminetChat.sounds.poke", kind: "boolean", fallback: true },
  "remistats.icons.enabled": { area: "sync", key: "milxdy.remistats.icons.enabled", kind: "boolean", fallback: true },
  "remistats.icons.score": { area: "sync", key: "milxdy.remistats.icons.score", kind: "boolean", fallback: true },
  "remistats.icons.beetle": { area: "sync", key: "milxdy.remistats.icons.beetle", kind: "boolean", fallback: true },
  "remistats.icons.poke": { area: "sync", key: "milxdy.remistats.icons.poke", kind: "boolean", fallback: true },
  "milady.mode": { area: "sync", key: "mode", kind: "string", fallback: "milady" },
  "milady.soundEnabled": { area: "sync", key: "soundEnabled", kind: "boolean", fallback: true },
  "milady.showLevelBadge": { area: "sync", key: "showLevelBadge", kind: "boolean", fallback: true },
  "milady.includeRemiStatsBeetles": { area: "sync", key: "includeRemiStatsBeetles", kind: "boolean", fallback: true },
  "milady.hideNonMiladyOrBeetlePosts": { area: "sync", key: "hideNonMiladyOrBeetlePosts", kind: "boolean", fallback: false },
  "milady.cardTheme": { area: "sync", key: "cardTheme", kind: "string", fallback: "full" },
  "milady.whitelistHandles": { area: "sync", key: "whitelistHandles", kind: "handleList", fallback: [] },
  "milady.miladyListHandles": { area: "sync", key: "miladyListHandles", kind: "handleList", fallback: [] },
  "remistats.beetol.enabled": { area: "local", key: "milxdy.remistats.beetol.enabled", kind: "boolean", fallback: true },
  "reminetChat.enabled": { area: "local", key: "milxdy.reminetChat.enabled", kind: "boolean", fallback: false },
};

void boot();

async function boot(): Promise<void> {
  applyBuildProfileAvailability();
  setupTabs();
  await setupThemeControls();
  setupUpdateStatus();
  await migrateBeetolSettings();
  await loadControls();
  setupPerformanceModeControl();
  await setupVisualSettings();
  await setupOnboarding();
  setupWikiMaxLinksControl();
  setupWikiPreloadTemplateAction();
  setupWikiAiHelp();
  setupRemiStatsIconControls();
  setupReportActions();
  setupPostReadingVoiceSelect();
  await renderWikiLaterItems();
  observeWikiLaterItems();
  await setupBeetolPanel();
  await renderStatus();
}

function normalizeBuildProfile(value: unknown): BuildProfile {
  return value === "lite" || value === "balanced" || value === "full" ? value : "full";
}

function normalizeBuildTarget(value: unknown): BuildTarget {
  return value === "firefox" ? "firefox" : "chromium";
}

function applyBuildProfileAvailability(): void {
  document.documentElement.dataset.milxdyBuildProfile = BUILD_PROFILE;
  document.documentElement.dataset.milxdyBuildTarget = BUILD_TARGET;
  for (const control of Array.from(document.querySelectorAll<HTMLElement>("[data-control]"))) {
    const feature = popupFeatureForControl(control.dataset.control || "");
    if (feature && !profileHasFeature(feature)) hideUnavailableControl(control);
  }
  setPanelAvailability("wiki", profileHasFeature("wiki"));
  setPanelAvailability("remistats", profileHasFeature("remistats") || profileHasFeature("beetol") || profileHasFeature("reminetChat"));
  hideEmptySettingGroups();
  ensureVisibleActivePanel();
}

function popupFeatureForControl(control: string): PopupFeatureId | null {
  if (control.startsWith("post-reading.")) return "post-reading";
  if (control.startsWith("wiki.")) return "wiki";
  if (control.startsWith("remistats.beetol.")) return "beetol";
  if (control.startsWith("remistats.")) return "remistats";
  if (control.startsWith("milady.")) return "miladymaxxer";
  if (control.startsWith("reminetChat.")) return "reminetChat";
  return null;
}

function profileHasFeature(feature: PopupFeatureId): boolean {
  return PROFILE_FEATURES[BUILD_PROFILE].includes(feature);
}

function hideUnavailableControl(control: HTMLElement): void {
  const row = control.closest<HTMLElement>(".setting, .field, .setting-group-nested, .inline-actions") || control;
  row.hidden = true;
  row.dataset.profileUnavailable = "true";
}

function setPanelAvailability(panelId: string, available: boolean): void {
  const tab = document.querySelector<HTMLElement>(`.tab[data-panel="${panelId}"]`);
  const panel = document.querySelector<HTMLElement>(`.panel[data-panel="${panelId}"]`);
  if (tab) {
    tab.hidden = !available;
    tab.dataset.profileUnavailable = String(!available);
  }
  if (panel) {
    panel.hidden = !available;
    panel.dataset.profileUnavailable = String(!available);
  }
}

function hideEmptySettingGroups(): void {
  for (const group of Array.from(document.querySelectorAll<HTMLElement>(".setting-group"))) {
    const controls = Array.from(group.querySelectorAll<HTMLElement>("[data-control], input[id], select[id], button[id]"));
    if (controls.length === 0) continue;
    const hasVisibleControl = controls.some((control) => !control.closest<HTMLElement>("[hidden]"));
    if (!hasVisibleControl) {
      group.hidden = true;
      group.dataset.profileUnavailable = "true";
    }
  }
}

function ensureVisibleActivePanel(): void {
  const activePanel = document.querySelector<HTMLElement>(".panel.is-active");
  if (activePanel && !activePanel.hidden) return;
  const fallbackPanel = document.querySelector<HTMLElement>('.panel[data-panel="suite"]');
  const fallbackTab = document.querySelector<HTMLElement>('.tab[data-panel="suite"]');
  for (const panel of Array.from(document.querySelectorAll<HTMLElement>(".panel"))) panel.classList.toggle("is-active", panel === fallbackPanel);
  for (const tab of Array.from(document.querySelectorAll<HTMLElement>(".tab"))) tab.classList.toggle("is-active", tab === fallbackTab);
}

async function setupThemeControls(): Promise<void> {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-choice]"));
  if (buttons.length === 0) return;
  const stored = await chrome.storage.local.get(SETTINGS_THEME_KEY);
  const initial = normalizeThemeMode(stored[SETTINGS_THEME_KEY]);
  renderThemeChoice(buttons, initial);
  applySettingsTheme(initial);
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const mode = normalizeThemeMode(button.dataset.themeChoice);
      applySettingsTheme(mode);
      renderThemeChoice(buttons, mode);
      void chrome.storage.local.set({ [SETTINGS_THEME_KEY]: mode });
    });
  }
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function applySettingsTheme(mode: ThemeMode): void {
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }
  document.documentElement.dataset.theme = mode;
}

function renderThemeChoice(buttons: HTMLButtonElement[], active: ThemeMode): void {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === active));
  }
}

function setupPerformanceModeControl(): void {
  const select = document.getElementById("performanceMode") as HTMLSelectElement | null;
  const detail = document.getElementById("performanceModeDetail");
  if (!select || !detail) return;
  const render = () => {
    const mode = normalizePerformanceMode(select.value);
    detail.textContent = performanceModeSummary(mode);
  };
  select.addEventListener("change", render);
  render();
}

function performanceModeSummary(mode: PerformanceMode): string {
  const budget = budgetForPerformanceMode(mode);
  const preload = budget.idlePreloadDelayMs === null
    ? "no idle preload"
    : `idle preload after ${Math.round(budget.idlePreloadDelayMs / 1000)}s`;
  const safety = budget.safetyScanIntervalMs === null
    ? "no safety scans"
    : `safety scan ${Math.round(budget.safetyScanIntervalMs / 1000)}s`;
  const diagnostics = budget.diagnostics ? ", diagnostics on" : "";
  const label = mode === "fast"
    ? "Fast keeps X responsive"
    : mode === "balanced"
      ? "Balanced is the default"
      : mode === "full"
        ? "Full warms more apps"
        : "Developer records extra diagnostics";
  return `${label}: ${budget.maxIdleTasksPerFrame} idle tasks/frame, ${budget.networkConcurrency} network slots, ${preload}, ${safety}${diagnostics}.`;
}

async function setupOnboarding(): Promise<void> {
  const root = document.getElementById("onboardingStart");
  if (!root) return;
  const active = await shouldShowOnboarding();
  root.hidden = !active;
  if (!active) return;

  const applyFull = document.getElementById("onboardingApplyFull") as HTMLButtonElement | null;
  const openRemilia = document.getElementById("onboardingOpenRemilia") as HTMLButtonElement | null;
  const retryRemilia = document.getElementById("onboardingRetryRemilia") as HTMLButtonElement | null;
  const pinToolbar = document.getElementById("onboardingPinToolbar") as HTMLButtonElement | null;
  const openX = document.getElementById("onboardingOpenX") as HTMLButtonElement | null;
  const dismiss = document.getElementById("onboardingDismiss") as HTMLButtonElement | null;
  const appearance = document.getElementById("onboardingAppearance") as HTMLButtonElement | null;
  const audio = document.getElementById("onboardingAudio") as HTMLButtonElement | null;

  applyFull?.addEventListener("click", () => {
    applyFull.disabled = true;
    void applyFullStartSetup().finally(() => {
      applyFull.disabled = false;
    });
  });
  openRemilia?.addEventListener("click", () => {
    void openExternalUrl(REMILIA_NET_LOGIN_URL);
    showOnboardingMessage("Finish RemiliaNET sign-in, then retry the session.");
  });
  retryRemilia?.addEventListener("click", () => {
    retryRemilia.disabled = true;
    void renderOnboarding().finally(() => {
      retryRemilia.disabled = false;
    });
  });
  pinToolbar?.addEventListener("click", () => {
    void chrome.storage.local.set({ [ONBOARDING_TOOLBAR_PINNED_KEY]: true }).then(renderOnboarding);
  });
  openX?.addEventListener("click", () => {
    void openOrRefreshX();
  });
  appearance?.addEventListener("click", () => activatePanel("visual"));
  audio?.addEventListener("click", () => activatePanel("audio"));
  dismiss?.addEventListener("click", () => {
    void chrome.storage.local.set({
      [FIRST_RUN_STATUS_KEY]: "complete",
      [ONBOARDING_ACTIVE_KEY]: false,
    }).then(() => {
      root.hidden = true;
    });
  });

  await chrome.storage.local.set({ [ONBOARDING_ACTIVE_KEY]: true });
  await renderOnboarding();
}

async function shouldShowOnboarding(): Promise<boolean> {
  const stored = await chrome.storage.local.get({
    [FIRST_RUN_STATUS_KEY]: "complete",
    [ONBOARDING_ACTIVE_KEY]: false,
  });
  return stored[FIRST_RUN_STATUS_KEY] === "pending" || stored[ONBOARDING_ACTIVE_KEY] === true;
}

async function renderOnboarding(): Promise<void> {
  const tasksRoot = document.getElementById("onboardingTasks");
  const progress = document.getElementById("onboardingProgress");
  const retryRemilia = document.getElementById("onboardingRetryRemilia") as HTMLButtonElement | null;
  if (!tasksRoot || !progress) return;

  const [local, remiliaAuth, hasXTab, toolbarPinnedByBrowser] = await Promise.all([
    chrome.storage.local.get([
      PERFORMANCE_MODE_KEY,
      RESKIN_PROFILE_KEY,
      RAIL_PIN_KEY,
      ONBOARDING_TOOLBAR_PINNED_KEY,
    ]),
    chrome.runtime.sendMessage({ type: "beetol:authStatus" }).catch(() => null),
    hasOpenXTab(),
    isToolbarPinned(),
  ]);
  const signedIn = Boolean(remiliaAuth?.signedIn);
  const fullSetup = await isFullStartSetup(local);
  const toolbarPinned = toolbarPinnedByBrowser || local[ONBOARDING_TOOLBAR_PINNED_KEY] === true;
  const tasks = [
    ["Full suite enabled", fullSetup, "Performance, Max appearance, app enablement, and rail pins."],
    ["RemiliaNET signed in", signedIn, signedIn ? "Browser session detected." : "Needed for Beetol, RemiStats pokes, and chat."],
    ["Toolbar pinned", toolbarPinned, "Keep milXdy one click away after install."],
    ["X opened or refreshed", hasXTab, "Open X so the side rail and enabled apps can mount."],
  ] as const;
  const done = tasks.filter(([, complete]) => complete).length;
  progress.textContent = `${done}/${tasks.length} ready`;
  if (retryRemilia) retryRemilia.textContent = signedIn ? "Session ready" : "Retry session";
  tasksRoot.textContent = "";
  for (const [label, complete, detail] of tasks) {
    const item = document.createElement("li");
    item.className = "onboarding-task";
    item.dataset.done = String(complete);
    item.innerHTML = `<span aria-hidden="true"></span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div>`;
    tasksRoot.append(item);
  }
}

async function isFullStartSetup(local: Record<string, unknown>): Promise<boolean> {
  const pinned = Array.isArray(local[RAIL_PIN_KEY]) ? local[RAIL_PIN_KEY] as unknown[] : [];
  const expectedPinned = railAppIdsForPreset("full");
  const appEnabledStates = await Promise.all(
    FIRST_PARTY_APPS
      .filter((app) => app.available !== false)
      .map((app) => app.isEnabled()),
  );
  return normalizePerformanceMode(local[PERFORMANCE_MODE_KEY]) === "full"
    && normalizeReskinProfile(local[RESKIN_PROFILE_KEY]) === "max"
    && appEnabledStates.every(Boolean)
    && expectedPinned.every((id) => pinned.includes(id));
}

async function applyFullStartSetup(): Promise<void> {
  showOnboardingMessage("Applying full setup...");
  await Promise.all(
    FIRST_PARTY_APPS
      .filter((app) => app.available !== false && app.setEnabled)
      .map((app) => app.setEnabled?.(true)),
  );
  const fullTheme = { ...VISUAL_PRESETS.max };
  const railPinned = railAppIdsForPreset("full");
  await Promise.all([
    persistVisualTheme(fullTheme),
    applyProfileAudioPreset(PROFILE_AUDIO_PRESETS.max),
    chrome.storage.local.set({
      [PERFORMANCE_MODE_KEY]: "full",
      [RAIL_PIN_KEY]: railPinned,
      [FIRST_RUN_STATUS_KEY]: "complete",
      [ONBOARDING_ACTIVE_KEY]: true,
      [SETTINGS_THEME_KEY]: "system",
      "milxdy.diagnostics.enabled": false,
      "milxdy.reminetChat.enabled": true,
      "milxdy.miladychan.enabled": true,
      "milxdy.music.enabled": true,
      "milxdy.remistats.beetol.enabled": true,
      [WIKI_SETTINGS_KEY]: {
        enabled: true,
        previewsEnabled: true,
        debugMode: false,
        grokWorkflowMode: "socratic",
        maxLinksPerPostEnabled: false,
        maxLinksPerPost: 4,
        maxLowConfidenceLinksPerPost: 1,
        linkColor: "#ff4fbf",
      },
    }),
    chrome.storage.sync.set({
      enabled: true,
      autoVoice: true,
      autoplayNext: true,
      includeQuotes: true,
      includeImageAltText: true,
      includeLinkPreviews: true,
      expandShowMore: true,
      activeTweetHighlight: true,
      "milxdy.remistats.enabled": true,
      showTooltips: true,
      soundsEnabled: true,
      soundVolume: 0.75,
      mode: "milady",
      soundEnabled: true,
      showLevelBadge: true,
      includeRemiStatsBeetles: true,
      "milxdy.reminetChat.sounds.enabled": true,
      "milxdy.reminetChat.sounds.send": true,
      "milxdy.reminetChat.sounds.react": true,
      "milxdy.reminetChat.sounds.reactToMe": true,
      "milxdy.reminetChat.sounds.message": true,
      "milxdy.reminetChat.sounds.poke": true,
    }),
  ]);
  setControlValue("performanceMode", "full");
  setControlValue("diagnosticsEnabled", false);
  setControlValue("wiki.enabled", true);
  setControlValue("wiki.previewsEnabled", true);
  setControlValue("wiki.debugMode", false);
  setControlValue("wiki.grokWorkflowMode", "socratic");
  setControlValue("post-reading.enabled", true);
  setControlValue("remistats.enabled", true);
  setControlValue("remistats.showTooltips", true);
  setControlValue("remistats.soundsEnabled", true);
  setControlValue("remistats.soundVolume", 0.75);
  setControlValue("milady.mode", "milady");
  setControlValue("milady.soundEnabled", true);
  setControlValue("milady.showLevelBadge", true);
  setControlValue("milady.includeRemiStatsBeetles", true);
  setControlValue("remistats.beetol.enabled", true);
  setControlValue("reminetChat.enabled", true);
  const performanceSelect = document.getElementById("performanceMode");
  performanceSelect?.dispatchEvent(new Event("change"));
  writeVisualEditor(fullTheme);
  renderVisualPresetButtons();
  showOnboardingMessage("Full setup is on. Sign in to RemiliaNET and refresh X to finish.");
  await refreshXTabs();
  await renderOnboarding();
  await renderStatus();
}

function railAppIdsForPreset(preset: AppPreset): string[] {
  return FIRST_PARTY_APPS
    .filter((app) => app.available !== false
      && app.dock
      && app.hub?.rail.supported !== false
      && app.hub?.presets.includes(preset))
    .map((app) => app.id);
}

async function hasOpenXTab(): Promise<boolean> {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }).catch(() => []);
  return tabs.length > 0;
}

async function isToolbarPinned(): Promise<boolean> {
  if (!chrome.action?.getUserSettings) return false;
  const settings = await chrome.action.getUserSettings().catch(() => null);
  return settings?.isOnToolbar === true;
}

async function openOrRefreshX(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }).catch(() => []);
  if (tabs.length === 0) {
    await openExternalUrl(X_HOME_URL);
  } else {
    await Promise.all(tabs.map((tab) => tab.id ? chrome.tabs.reload(tab.id).catch(() => undefined) : Promise.resolve()));
    const first = tabs.find((tab) => tab.id && tab.windowId);
    if (first?.id && first.windowId) {
      await chrome.tabs.update(first.id, { active: true }).catch(() => undefined);
      await chrome.windows.update(first.windowId, { focused: true }).catch(() => undefined);
    }
  }
  showOnboardingMessage("X is ready. The enabled rail apps will mount on refresh.");
  await renderOnboarding();
}

function activatePanel(panelId: string): void {
  const tab = document.querySelector<HTMLButtonElement>(`.tab[data-panel="${cssEscape(panelId)}"]`);
  tab?.click();
}

function showOnboardingMessage(text: string): void {
  const message = document.getElementById("onboardingMessage");
  if (message) message.textContent = text;
}

function setupRemiStatsIconControls(): void {
  const enabled = document.querySelector<HTMLInputElement>('[data-control="remistats.icons.enabled"]');
  const children = Array.from(document.querySelectorAll<HTMLInputElement>(
    '[data-control="remistats.icons.score"], [data-control="remistats.icons.beetle"], [data-control="remistats.icons.poke"]',
  ));
  if (!enabled || children.length === 0) return;
  const syncDisabled = () => {
    for (const child of children) {
      child.disabled = !enabled.checked;
      child.title = enabled.checked ? "" : "RemiStats icons are disabled";
    }
  };
  enabled.addEventListener("change", syncDisabled);
  syncDisabled();
}

function setupPostReadingVoiceSelect(): void {
  const select = document.querySelector<HTMLSelectElement>('[data-control="post-reading.voiceURI"]');
  if (!select || !("speechSynthesis" in window)) return;

  const render = () => {
    const current = select.value;
    const voices = window.speechSynthesis.getVoices();
    select.textContent = "";
    select.append(new Option("System default", ""));
    for (const voice of voices) {
      select.append(new Option(`${voice.name} (${voice.lang})`, voice.voiceURI));
    }
    if (current && !voices.some((voice) => voice.voiceURI === current)) {
      select.append(new Option(`Unavailable: ${current}`, current));
    }
    select.value = current;
  };

  render();
  window.speechSynthesis.addEventListener("voiceschanged", render);
}

async function setupVisualSettings(): Promise<void> {
  const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-visual-preset]"));
  const apply = document.getElementById("visualApply") as HTMLButtonElement | null;
  const saveAs = document.getElementById("visualSaveAs") as HTMLButtonElement | null;
  const deleteTheme = document.getElementById("visualDeleteTheme") as HTMLButtonElement | null;
  const exportButton = document.getElementById("visualExport") as HTMLButtonElement | null;
  const copyShareButton = document.getElementById("visualCopyShare") as HTMLButtonElement | null;
  const importButton = document.getElementById("visualImport") as HTMLButtonElement | null;
  const importShareButton = document.getElementById("visualImportShare") as HTMLButtonElement | null;
  const importFile = document.getElementById("visualImportFile") as HTMLInputElement | null;
  const themeSelect = document.getElementById("visualThemeSelect") as HTMLSelectElement | null;
  if (!presetButtons.length || !apply || !saveAs || !deleteTheme || !exportButton || !copyShareButton || !importButton || !importShareButton || !importFile || !themeSelect) return;

  const stored = await chrome.storage.local.get({
    [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE,
    [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME,
  });
  visualDraft = normalizeVisualTheme(stored[VISUAL_THEME_KEY], normalizeReskinProfile(stored[RESKIN_PROFILE_KEY]));
  visualMode = visualDraft.profile;
  writeVisualEditor(visualDraft);
  await renderVisualThemeSelect();
  renderVisualPresetButtons();
  setupAppearanceSearch();

  for (const button of presetButtons) {
    button.addEventListener("click", () => {
      const choice = button.dataset.visualPreset;
      if (choice === "custom") {
        visualMode = "custom";
      } else {
        const profile = normalizeReskinProfile(choice);
        visualMode = profile;
        visualDraft = { ...VISUAL_PRESETS[profile] };
        visualSelectedThemeId = "new";
        themeSelect.value = "new";
        writeVisualEditor(visualDraft);
      }
      renderVisualPresetButtons();
    });
  }

  themeSelect.addEventListener("change", () => {
    void loadSelectedVisualTheme(themeSelect.value);
  });
  for (const element of visualEditorElements()) {
    element.addEventListener("change", () => {
      visualDraft = readVisualEditor();
      visualMode = "custom";
      renderVisualPresetButtons();
      if (element.id === "visualDisableMaxxer") {
        void persistVisualTheme(visualDraft).then(() => showVisualMessage("Saved Maxxer setting."));
      }
    });
  }
  apply.addEventListener("click", () => {
    const profile = visualMode === "custom" ? null : visualMode;
    void applyVisualTheme(readVisualEditor(), profile ? `Applied ${profileLabel(profile)} preset.` : "Applied visual theme.", profile);
  });
  saveAs.addEventListener("click", () => {
    void saveVisualThemeAs();
  });
  deleteTheme.addEventListener("click", () => {
    void deleteSelectedVisualTheme();
  });
  exportButton.addEventListener("click", () => {
    exportVisualTheme(readVisualEditor());
  });
  copyShareButton.addEventListener("click", () => {
    void copyVisualThemeString(readVisualEditor());
  });
  importButton.addEventListener("click", () => importFile.click());
  importShareButton.addEventListener("click", () => {
    void importVisualThemeString(window.prompt("Paste milXdy appearance string") || "");
  });
  importFile.addEventListener("change", () => {
    const file = importFile.files?.[0];
    if (file) void importVisualTheme(file);
    importFile.value = "";
  });
}

async function renderVisualThemeSelect(): Promise<void> {
  const select = document.getElementById("visualThemeSelect") as HTMLSelectElement | null;
  const deleteButton = document.getElementById("visualDeleteTheme") as HTMLButtonElement | null;
  if (!select) return;
  const themes = await loadSavedVisualThemes();
  select.textContent = "";
  const empty = document.createElement("option");
  empty.value = "new";
  empty.textContent = themes.length ? "New" : "New";
  select.append(empty);
  for (const theme of themes) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    select.append(option);
  }
  select.value = themes.some((theme) => theme.id === visualSelectedThemeId) ? visualSelectedThemeId : "new";
  if (deleteButton) {
    deleteButton.disabled = select.value === "new";
    deleteButton.title = deleteButton.disabled ? "Select a saved custom theme to delete" : "Delete selected custom theme";
  }
}

async function loadSelectedVisualTheme(id: string): Promise<void> {
  visualSelectedThemeId = id;
  await renderVisualThemeSelect();
  if (id === "new") {
    visualMode = "custom";
    renderVisualPresetButtons();
    return;
  }
  const theme = (await loadSavedVisualThemes()).find((entry) => entry.id === id);
  if (!theme) return;
  visualDraft = normalizeVisualTheme(theme.settings);
  visualMode = "custom";
  setInputValue("visualThemeName", theme.name);
  writeVisualEditor(visualDraft, false);
  renderVisualPresetButtons();
}

async function deleteSelectedVisualTheme(): Promise<void> {
  if (visualSelectedThemeId === "new") {
    showVisualMessage("Select a saved custom theme to delete.", "warn");
    return;
  }
  const themes = await loadSavedVisualThemes();
  const selected = themes.find((theme) => theme.id === visualSelectedThemeId);
  if (!selected) {
    visualSelectedThemeId = "new";
    await renderVisualThemeSelect();
    showVisualMessage("Theme was already removed.", "warn");
    return;
  }
  const next = themes.filter((theme) => theme.id !== visualSelectedThemeId);
  await chrome.storage.local.set({ [VISUAL_CUSTOM_THEMES_KEY]: next });
  visualSelectedThemeId = "new";
  await renderVisualThemeSelect();
  setInputValue("visualThemeName", "");
  showVisualMessage(`Deleted "${selected.name}".`);
}

async function applyVisualTheme(settings: VisualThemeSettings, messageText: string, profileAudio?: ReskinProfile | null): Promise<void> {
  await persistVisualTheme(settings);
  if (profileAudio) {
    await applyProfileAudioPreset(PROFILE_AUDIO_PRESETS[profileAudio]);
  }
  showVisualMessage(messageText);
  await refreshXTabs();
}

async function persistVisualTheme(settings: VisualThemeSettings): Promise<VisualThemeSettings> {
  const theme = normalizeVisualTheme(settings);
  visualDraft = theme;
  await chrome.storage.local.set({
    [RESKIN_PROFILE_KEY]: theme.profile,
    [VISUAL_THEME_KEY]: theme,
    "milxdy.reminetChat.enabled": theme.reminetChatOverlay,
  });
  return theme;
}

async function applyProfileAudioPreset(settings: ProfileAudioSettings): Promise<void> {
  await chrome.storage.sync.set({
    soundEnabled: settings.miladySoundEnabled,
    soundsEnabled: settings.remistatsSoundsEnabled,
    soundVolume: settings.remistatsSoundVolume,
    endOfTweetDing: settings.postReadingEndOfTweetDing,
  });
  setControlValue("milady.soundEnabled", settings.miladySoundEnabled);
  setControlValue("remistats.soundsEnabled", settings.remistatsSoundsEnabled);
  setControlValue("remistats.soundVolume", settings.remistatsSoundVolume);
  setControlValue("post-reading.endOfTweetDing", settings.postReadingEndOfTweetDing);
}

function setControlValue(id: string, value: unknown): void {
  const element = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-control="${cssEscape(id)}"]`);
  if (element) setElementValue(element, value);
}

function profileLabel(profile: ReskinProfile): string {
  return profile === "max" ? "Max" : profile === "moderate" ? "Medium" : "Minimal";
}

async function saveVisualThemeAs(): Promise<void> {
  const nameInput = document.getElementById("visualThemeName") as HTMLInputElement | null;
  const name = (nameInput?.value || "").trim() || "Custom visual theme";
  const now = Date.now();
  const themes = await loadSavedVisualThemes();
  const existingIndex = visualSelectedThemeId === "new" ? -1 : themes.findIndex((theme) => theme.id === visualSelectedThemeId);
  const settings = readVisualEditor();
  const saved: SavedVisualTheme = {
    id: existingIndex >= 0 ? themes[existingIndex].id : `visual-${now.toString(36)}`,
    name,
    createdAt: existingIndex >= 0 ? themes[existingIndex].createdAt : now,
    updatedAt: now,
    settings,
  };
  if (existingIndex >= 0) themes[existingIndex] = saved;
  else themes.push(saved);
  await chrome.storage.local.set({ [VISUAL_CUSTOM_THEMES_KEY]: themes });
  visualSelectedThemeId = saved.id;
  await renderVisualThemeSelect();
  await applyVisualTheme(settings, `Saved and applied "${name}".`);
}

function exportVisualTheme(settings: VisualThemeSettings): void {
  const name = (document.getElementById("visualThemeName") as HTMLInputElement | null)?.value.trim() || "milxdy-visual-theme";
  const payload = {
    kind: "milxdy.visualTheme",
    version: 1,
    exportedAt: new Date().toISOString(),
    name,
    settings: normalizeVisualTheme(settings),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(name)}.milxdy-theme.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showVisualMessage("Exported theme file.");
}

async function copyVisualThemeString(settings: VisualThemeSettings): Promise<void> {
  const name = (document.getElementById("visualThemeName") as HTMLInputElement | null)?.value.trim() || "milxdy-visual-theme";
  const share = await encodeVisualThemeShareString(name, settings);
  await navigator.clipboard.writeText(share);
  showVisualMessage("Copied share string.");
}

async function importVisualThemeString(value: string): Promise<void> {
  if (!value.trim()) return;
  try {
    const imported = await decodeVisualThemeShareString(value.trim());
    writeVisualEditor(imported.settings);
    setInputValue("visualThemeName", imported.name);
    visualDraft = imported.settings;
    visualMode = "custom";
    visualSelectedThemeId = "new";
    await renderVisualThemeSelect();
    renderVisualPresetButtons();
    showVisualMessage("Imported share string. Apply or save it.");
  } catch {
    showVisualMessage("Import failed. The share string is invalid.", "warn");
  }
}

async function importVisualTheme(file: File): Promise<void> {
  try {
    const root = JSON.parse(await file.text()) as Record<string, unknown>;
    const settings = normalizeVisualTheme(objectValue(root.settings).profile ? root.settings : root);
    const name = typeof root.name === "string" && root.name.trim() ? root.name.trim() : file.name.replace(/\.json$/i, "");
    writeVisualEditor(settings);
    setInputValue("visualThemeName", name);
    visualDraft = settings;
    visualMode = "custom";
    visualSelectedThemeId = "new";
    await renderVisualThemeSelect();
    renderVisualPresetButtons();
    showVisualMessage("Imported theme. Apply or save it.");
  } catch {
    showVisualMessage("Import failed. Use a milXdy visual theme JSON file.", "warn");
  }
}

async function loadSavedVisualThemes(): Promise<SavedVisualTheme[]> {
  const stored = await chrome.storage.local.get(VISUAL_CUSTOM_THEMES_KEY);
  const raw = stored[VISUAL_CUSTOM_THEMES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): SavedVisualTheme[] => {
    const record = objectValue(entry);
    if (typeof record.id !== "string" || typeof record.name !== "string") return [];
    return [{
      id: record.id,
      name: record.name,
      createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
      updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
      settings: normalizeVisualTheme(record.settings),
    }];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

function writeVisualEditor(settings: VisualThemeSettings, includeName = true): void {
  const theme = normalizeVisualTheme(settings);
  setSelectValue("visualProfile", theme.profile);
  setSelectValue("visualTweetFont", theme.tweetFont);
  setSelectValue("visualUiFont", theme.uiFont);
  setSelectValue("visualPfpShape", theme.pfpShape);
  setSelectValue("visualMaxxerIntensity", theme.maxxerIntensity);
  setSelectValue("visualMaxxerSeparators", theme.maxxerSeparators);
  setSelectValue("visualPokePlacement", theme.pokePlacement);
  setSelectValue("visualAppWindowStyle", theme.appWindowStyle);
  setSelectValue("visualTweetPngBorderPalette", theme.tweetPngBorderPalette);
  setInputValue("visualMaxMediaHeight", String(theme.maxMediaHeight));
  setChecked("visualBackgroundFade", theme.backgroundFade);
  setChecked("visualSquareMedia", theme.squareMedia);
  setChecked("visualPfpFeed", theme.pfpFeed);
  setChecked("visualPfpNotifications", theme.pfpNotifications);
  setChecked("visualPfpChat", theme.pfpChat);
  setChecked("visualQuoteMediaGap", theme.quoteMediaGap);
  setChecked("visualAppShadows", theme.appShadows);
  setChecked("visualPostButtonClickly", theme.postButtonClickly);
  setChecked("visualPostSound", theme.postSound);
  setChecked("visualSidebarBevel", theme.sidebarBevel);
  setChecked("visualSidebarSound", theme.sidebarSound);
  setChecked("visualNewPostsPill", theme.newPostsPill);
  setChecked("visualNewPostsSound", theme.newPostsSound);
  setChecked("visualNotificationUnreadTint", theme.notificationUnreadTint);
  setChecked("visualRemistatsBox", theme.remistatsBox);
  setChecked("visualIncomingPokeGold", theme.incomingPokeGold);
  setChecked("visualReminetChatOverlay", theme.reminetChatOverlay);
  setChecked("visualDisableMaxxer", theme.disableMaxxer);
  setChecked("visualDisableSelfTracking", theme.disableSelfTracking);
  setChecked("visualMaxxerShimmer", theme.maxxerShimmer);
  setChecked("visualTweetPngIncludeImages", theme.tweetPngIncludeImages);
  setChecked("visualTweetPngIncludeQuoteText", theme.tweetPngIncludeQuoteText);
  setChecked("visualTweetPngIncludeQuoteImages", theme.tweetPngIncludeQuoteImages);
  setChecked("visualTweetPngShrinkTallImages", theme.tweetPngShrinkTallImages);
  setChecked("visualTweetPngIncludeDate", theme.tweetPngIncludeDate);
  setChecked("visualTweetPngIncludeStats", theme.tweetPngIncludeStats);
  setChecked("visualTweetPngBorder", theme.tweetPngBorder);
  if (includeName) setInputValue("visualThemeName", "");
}

function readVisualEditor(): VisualThemeSettings {
  return normalizeVisualTheme({
    profile: selectValue("visualProfile"),
    tweetFont: selectValue("visualTweetFont"),
    uiFont: selectValue("visualUiFont"),
    pfpShape: selectValue("visualPfpShape"),
    maxxerIntensity: selectValue("visualMaxxerIntensity"),
    maxxerSeparators: selectValue("visualMaxxerSeparators"),
    pokePlacement: selectValue("visualPokePlacement"),
    appWindowStyle: selectValue("visualAppWindowStyle"),
    tweetPngBorderPalette: selectValue("visualTweetPngBorderPalette"),
    maxMediaHeight: numberInputValue("visualMaxMediaHeight"),
    backgroundFade: checkedValue("visualBackgroundFade"),
    squareMedia: checkedValue("visualSquareMedia"),
    pfpFeed: checkedValue("visualPfpFeed"),
    pfpNotifications: checkedValue("visualPfpNotifications"),
    pfpChat: checkedValue("visualPfpChat"),
    quoteMediaGap: checkedValue("visualQuoteMediaGap"),
    appShadows: checkedValue("visualAppShadows"),
    postButtonClickly: checkedValue("visualPostButtonClickly"),
    postSound: checkedValue("visualPostSound"),
    sidebarBevel: checkedValue("visualSidebarBevel"),
    sidebarSound: checkedValue("visualSidebarSound"),
    newPostsPill: checkedValue("visualNewPostsPill"),
    newPostsSound: checkedValue("visualNewPostsSound"),
    notificationUnreadTint: checkedValue("visualNotificationUnreadTint"),
    remistatsBox: checkedValue("visualRemistatsBox"),
    incomingPokeGold: checkedValue("visualIncomingPokeGold"),
    reminetChatOverlay: checkedValue("visualReminetChatOverlay"),
    disableMaxxer: checkedValue("visualDisableMaxxer"),
    disableSelfTracking: checkedValue("visualDisableSelfTracking"),
    maxxerShimmer: checkedValue("visualMaxxerShimmer"),
    tweetPngIncludeImages: checkedValue("visualTweetPngIncludeImages"),
    tweetPngIncludeQuoteText: checkedValue("visualTweetPngIncludeQuoteText"),
    tweetPngIncludeQuoteImages: checkedValue("visualTweetPngIncludeQuoteImages"),
    tweetPngShrinkTallImages: checkedValue("visualTweetPngShrinkTallImages"),
    tweetPngIncludeDate: checkedValue("visualTweetPngIncludeDate"),
    tweetPngIncludeStats: checkedValue("visualTweetPngIncludeStats"),
    tweetPngBorder: checkedValue("visualTweetPngBorder"),
  });
}

function visualEditorElements(): Array<HTMLInputElement | HTMLSelectElement> {
  return [
    "visualThemeName",
    "visualProfile",
    "visualTweetFont",
    "visualUiFont",
    "visualPfpShape",
    "visualMaxxerIntensity",
    "visualMaxxerSeparators",
    "visualPokePlacement",
    "visualAppWindowStyle",
    "visualTweetPngBorderPalette",
    "visualMaxMediaHeight",
    "visualBackgroundFade",
    "visualSquareMedia",
    "visualPfpFeed",
    "visualPfpNotifications",
    "visualPfpChat",
    "visualQuoteMediaGap",
    "visualAppShadows",
    "visualPostButtonClickly",
    "visualPostSound",
    "visualSidebarBevel",
    "visualSidebarSound",
    "visualNewPostsPill",
    "visualNewPostsSound",
    "visualNotificationUnreadTint",
    "visualRemistatsBox",
    "visualIncomingPokeGold",
    "visualReminetChatOverlay",
    "visualDisableMaxxer",
    "visualDisableSelfTracking",
    "visualMaxxerShimmer",
    "visualTweetPngIncludeImages",
    "visualTweetPngIncludeQuoteText",
    "visualTweetPngIncludeQuoteImages",
    "visualTweetPngShrinkTallImages",
    "visualTweetPngIncludeDate",
    "visualTweetPngIncludeStats",
    "visualTweetPngBorder",
  ].flatMap((id) => {
    const element = document.getElementById(id);
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement ? [element] : [];
  });
}

function renderVisualPresetButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-visual-preset]")) {
    button.setAttribute("aria-pressed", String(button.dataset.visualPreset === visualMode));
  }
}

function setupAppearanceSearch(): void {
  const search = document.getElementById("appearanceSearch") as HTMLInputElement | null;
  const panel = document.querySelector<HTMLElement>('section.panel[data-panel="visual"]');
  if (!search || !panel) return;
  const filter = () => {
    const query = search.value.trim().toLowerCase();
    for (const group of Array.from(panel.querySelectorAll<HTMLElement>(".setting-group, .appearance-subgroup, .resource-links"))) {
      if (group.contains(search)) continue;
      const groupText = (group.textContent || "").toLowerCase();
      const groupMatches = !query || groupText.includes(query);
      group.hidden = !groupMatches;
      for (const item of Array.from(group.querySelectorAll<HTMLElement>(".setting, .field, .setting-group-nested, .inline-actions, .visual-preset-grid"))) {
        const itemText = (item.textContent || "").toLowerCase();
        item.classList.toggle("appearance-filter-hidden", Boolean(query) && !itemText.includes(query));
      }
    }
  };
  search.addEventListener("input", filter);
  filter();
}

async function refreshXTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }).catch(() => []);
  await Promise.all(tabs.flatMap((tab) => typeof tab.id === "number" ? [chrome.tabs.reload(tab.id)] : []));
}

function showVisualMessage(text: string, kind = ""): void {
  const message = document.getElementById("visualMessage");
  if (!message) return;
  message.textContent = text;
  if (kind) message.dataset.kind = kind;
  else delete message.dataset.kind;
}

function setSelectValue(id: string, value: string): void {
  const element = document.getElementById(id) as HTMLSelectElement | null;
  if (element) element.value = value;
}

function selectValue(id: string): string {
  return (document.getElementById(id) as HTMLSelectElement | null)?.value || "";
}

function setInputValue(id: string, value: string): void {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (element) element.value = value;
}

function setChecked(id: string, value: boolean): void {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (element) element.checked = value;
}

function checkedValue(id: string): boolean {
  return (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
}

function numberInputValue(id: string): number {
  const value = Number((document.getElementById(id) as HTMLInputElement | null)?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "milxdy-visual-theme";
}

async function encodeVisualThemeShareString(name: string, settings: VisualThemeSettings): Promise<string> {
  const payload = {
    kind: "milxdy.visualTheme",
    version: 1,
    name,
    settings: normalizeVisualTheme(settings),
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const checksum = await sha256Base64Url(body);
  return `milxdy-theme-v1.${body}.${checksum}`;
}

async function decodeVisualThemeShareString(value: string): Promise<{ name: string; settings: VisualThemeSettings }> {
  const match = value.match(/^milxdy-theme-v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!match) throw new Error("bad format");
  const [, body, checksum] = match;
  if (await sha256Base64Url(body) !== checksum) throw new Error("bad checksum");
  const payload = JSON.parse(base64UrlDecode(body)) as Record<string, unknown>;
  if (payload.kind !== "milxdy.visualTheme") throw new Error("bad kind");
  return {
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "Imported visual theme",
    settings: normalizeVisualTheme(payload.settings),
  };
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "").slice(0, 16);
}

async function migrateBeetolSettings(): Promise<void> {
  const legacy = {
    enabled: `milxdy.${LEGACY_BEETOL_PREFIX}.enabled`,
    color: `${LEGACY_BEETOL_PREFIX}Color`,
    mode: `${LEGACY_BEETOL_PREFIX}Mode`,
  };
  const current = await chrome.storage.local.get([
    "milxdy.remistats.beetol.enabled",
    "beetolColor",
    "beetolMode",
    legacy.enabled,
    legacy.color,
    legacy.mode,
  ]);
  const next: Record<string, unknown> = {};
  if (current["milxdy.remistats.beetol.enabled"] === undefined && current[legacy.enabled] !== undefined) {
    next["milxdy.remistats.beetol.enabled"] = current[legacy.enabled];
  }
  if (current.beetolColor === undefined && typeof current[legacy.color] === "string") {
    next.beetolColor = current[legacy.color];
  }
  if (current.beetolMode === undefined && typeof current[legacy.mode] === "string") {
    next.beetolMode = current[legacy.mode];
  }
  if (Object.keys(next).length) await chrome.storage.local.set(next);
}

function setupTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
  const panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const target = tab.dataset.panel;
      for (const entry of tabs) entry.classList.toggle("is-active", entry === tab);
      for (const panel of panels) panel.classList.toggle("is-active", panel.dataset.panel === target);
    });
  }
}

async function loadControls(): Promise<void> {
  await Promise.all(Object.keys(bindings).map(loadControl));
}

async function loadControl(id: string): Promise<void> {
  const element = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-control="${cssEscape(id)}"]`);
  if (!element) return;
  const binding = bindings[id];
  const storage = binding.area === "sync" ? chrome.storage.sync : chrome.storage.local;
  const stored = await storage.get(binding.key);
  setElementValue(element, readBindingValue(binding, stored[binding.key]));
  const eventName = element instanceof HTMLInputElement && element.type === "checkbox" ? "change" : "change";
  element.addEventListener(eventName, () => {
    void saveControl(id, element);
  });
}

function readBindingValue(binding: ControlBinding, stored: unknown): unknown {
  const raw = binding.property ? objectValue(stored)[binding.property] : stored;
  if (raw === undefined || raw === null) return binding.fallback;
  return raw;
}

async function saveControl(id: string, element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): Promise<void> {
  const binding = bindings[id];
  const storage = binding.area === "sync" ? chrome.storage.sync : chrome.storage.local;
  const value = readElementValue(element, binding);
  if (!binding.property) {
    await storage.set({ [binding.key]: value });
    return;
  }
  const stored = await storage.get(binding.key);
  await storage.set({
    [binding.key]: {
      ...objectValue(stored[binding.key]),
      [binding.property]: value,
    },
  });
}

function setElementValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: unknown): void {
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    element.checked = Boolean(value);
    return;
  }
  if (element instanceof HTMLTextAreaElement && Array.isArray(value)) {
    element.value = value.join("\n");
    return;
  }
  element.value = value == null ? "" : String(value);
}

function readElementValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, binding: ControlBinding): unknown {
  if (binding.kind === "boolean" && element instanceof HTMLInputElement) return element.checked;
  if (binding.kind === "number") return Number(element.value);
  if (binding.kind === "nullableString") return element.value.trim() || null;
  if (binding.kind === "handleList") return normalizeHandleList(element.value);
  return element.value;
}

function normalizeHandleList(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[\n,]+/)
      .map((entry) => entry.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string {
  return Array.isArray(value) && value.length
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).join(", ") || "none"
    : "none";
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function setupWikiMaxLinksControl(): void {
  const enabled = document.querySelector<HTMLInputElement>('[data-control="wiki.maxLinksPerPostEnabled"]');
  const count = document.querySelector<HTMLInputElement>('[data-control="wiki.maxLinksPerPost"]');
  if (!enabled || !count) return;
  const syncDisabled = () => {
    count.disabled = !enabled.checked;
    count.title = enabled.checked ? "" : "No maximum";
  };
  enabled.addEventListener("change", syncDisabled);
  syncDisabled();
}

async function renderWikiLaterItems(): Promise<void> {
  const root = document.getElementById("wikiLaterItems");
  if (!root) return;
  const stored = await chrome.storage.local.get(WIKI_LATER_KEY);
  const items = normalizeWikiLaterItems(stored[WIKI_LATER_KEY]);
  root.textContent = "";
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "settings-list-empty";
    empty.textContent = "No saved entries.";
    root.append(empty);
    return;
  }
  for (const item of items) {
    root.append(createWikiLaterRow(item, items));
  }
}

function observeWikiLaterItems(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[WIKI_LATER_KEY]) {
      void renderWikiLaterItems();
    }
  });
}

function createWikiLaterRow(item: WikiLaterItem, allItems: WikiLaterItem[]): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-list-row";
  row.dataset.expanded = String(activeWikiLaterSearchId === item.id);

  const main = document.createElement("div");
  main.className = "settings-list-main";
  const text = document.createElement("div");
  text.className = "settings-list-text";
  text.textContent = item.text;
  text.title = item.text;

  const meta = document.createElement("div");
  meta.className = "settings-list-meta";
  const savedAt = document.createElement("span");
  savedAt.textContent = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Saved";
  meta.append(savedAt);
  if (item.pageUrl) {
    const link = document.createElement("a");
    link.href = item.pageUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = shortUrl(item.pageUrl);
    link.title = item.pageUrl;
    meta.append(link);
  }
  main.append(text, meta);

  const actions = document.createElement("div");
  actions.className = "settings-list-actions";

  const newPage = document.createElement("button");
  newPage.type = "button";
  newPage.className = "settings-list-action";
  newPage.textContent = "New page";
  newPage.addEventListener("click", () => openWikiNewPage(item));

  const addExisting = document.createElement("button");
  addExisting.type = "button";
  addExisting.className = "settings-list-action";
  addExisting.textContent = activeWikiLaterSearchId === item.id ? "Hide search" : "Add to page";
  addExisting.addEventListener("click", () => {
    activeWikiLaterSearchId = activeWikiLaterSearchId === item.id ? null : item.id;
    void renderWikiLaterItems();
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "settings-list-remove";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    void removeWikiLaterItem(item.id, allItems);
  });

  actions.append(newPage, addExisting, remove);
  row.append(main, actions);

  if (activeWikiLaterSearchId === item.id) {
    const search = createWikiLaterSearch(item);
    row.append(search);
    void runWikiLaterSearch(item, search);
  }
  return row;
}

function setupWikiPreloadTemplateAction(): void {
  const button = document.getElementById("wikiPreloadTemplate") as HTMLButtonElement | null;
  button?.addEventListener("click", () => {
    openWikiEditorUrl(wikiEditUrl(WIKI_PRELOAD_TEMPLATE));
  });
}

function setupWikiAiHelp(): void {
  const open = document.getElementById("wikiAiHelp") as HTMLButtonElement | null;
  const dialog = document.getElementById("wikiAiHelpDialog");
  const close = document.getElementById("wikiAiHelpClose") as HTMLButtonElement | null;
  const download = document.getElementById("wikiAiHelpDownload") as HTMLButtonElement | null;
  const wikitoolDownload = document.getElementById("wikiWikitoolDownload") as HTMLButtonElement | null;
  const wikitoolRelease = document.getElementById("wikiWikitoolRelease") as HTMLButtonElement | null;
  const copy = document.getElementById("wikiAiHelpCopy") as HTMLButtonElement | null;
  const message = document.getElementById("wikiAiHelpMessage");
  if (!open || !dialog || !close || !download || !wikitoolDownload || !wikitoolRelease || !copy || !message) return;

  const showDialog = () => {
    dialog.hidden = false;
    message.textContent = "Downloaded remilia-wiki-article-writer.zip.";
  };

  open.addEventListener("click", () => {
    downloadWikiAiHelpZip();
    showDialog();
  });
  download.addEventListener("click", () => {
    downloadWikiAiHelpZip();
    message.textContent = "Downloaded again.";
  });
  wikitoolDownload.addEventListener("click", () => {
    wikitoolDownload.disabled = true;
    message.textContent = "Finding the latest Wikitool release...";
    void downloadLatestWikitool().then((downloaded) => {
      message.textContent = downloaded
        ? "Opened the matching Wikitool release asset."
        : "Opened the Wikitool release page.";
    }).catch(() => {
      openExternalUrl(WIKITOOL_RELEASES_URL);
      message.textContent = "Opened the Wikitool release page.";
    }).finally(() => {
      wikitoolDownload.disabled = false;
    });
  });
  wikitoolRelease.addEventListener("click", () => {
    openExternalUrl(WIKITOOL_RELEASES_URL);
    message.textContent = "Opened the Wikitool release page.";
  });
  copy.addEventListener("click", () => {
    void navigator.clipboard.writeText(wikiAiHelpPrompt()).then(() => {
      message.textContent = "Prompt copied.";
    }).catch(() => {
      message.textContent = "Copy failed. You can still use the downloaded skill zip.";
    });
  });
  close.addEventListener("click", () => {
    dialog.hidden = true;
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.hidden = true;
  });
}

function downloadWikiAiHelpZip(): void {
  const link = document.createElement("a");
  link.href = chrome.runtime.getURL(WIKI_AI_HELP_ZIP);
  link.download = "remilia-wiki-article-writer.zip";
  link.rel = "noopener noreferrer";
  link.click();
}

async function downloadLatestWikitool(): Promise<boolean> {
  const response = await fetch(WIKITOOL_LATEST_RELEASE_API);
  if (!response.ok) {
    openExternalUrl(WIKITOOL_RELEASES_URL);
    return false;
  }
  const release = await response.json() as GitHubRelease;
  const asset = chooseWikitoolAsset(release.assets ?? []);
  if (!asset?.browser_download_url) {
    openExternalUrl(release.html_url || WIKITOOL_RELEASES_URL);
    return false;
  }
  openExternalUrl(asset.browser_download_url);
  return true;
}

function chooseWikitoolAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  const isArm = /arm|aarch64/.test(platform) || /arm|aarch64/.test(userAgent);
  const candidates = assets.filter((asset) => /\.zip$/i.test(asset.name || ""));
  const preferred = platform.includes("win")
    ? ["windows", "x86_64"]
    : platform.includes("mac")
      ? ["macos", isArm ? "arm64" : "x86_64"]
      : ["linux", "x86_64"];
  return candidates.find((asset) => {
    const name = (asset.name || "").toLowerCase();
    return preferred.every((part) => name.includes(part));
  }) || candidates[0] || null;
}

function openExternalUrl(url: string): Promise<chrome.tabs.Tab> {
  return chrome.tabs.create({ url });
}

function wikiAiHelpPrompt(): string {
  return [
    "Help me draft a Remilia Wiki article.",
    "If I provide the Remilia Wikitool release or AI pack, use its AGENTS.md, codex_skills, and writing_context guidance first.",
    "If Wikitool is available locally, start with `wikitool workflow session-refresh` and `wikitool knowledge article-start \"<Topic>\" --intent new --view brief --format json`, then interview me before drafting.",
    "If local tools are not available, use the attached remilia-wiki-article-writer skill as a chat-only fallback.",
    "Interview me for the necessary facts, dates, influences, related pages, and sources. Finish with ready-to-paste MediaWiki wikitext and a short list of unresolved citation gaps.",
  ].join("\n");
}

function createWikiLaterSearch(item: WikiLaterItem): HTMLElement {
  const root = document.createElement("div");
  root.className = "wiki-later-search";
  root.dataset.status = "loading";
  root.textContent = `Searching for "${item.text}"...`;
  return root;
}

async function runWikiLaterSearch(item: WikiLaterItem, root: HTMLElement): Promise<void> {
  const results = await searchWikiPages(item.text).catch(() => []);
  if (!root.isConnected || activeWikiLaterSearchId !== item.id) return;
  root.textContent = "";
  delete root.dataset.status;
  if (results.length === 0) {
    root.dataset.status = "empty";
    root.textContent = "No matching pages found.";
    return;
  }
  for (const result of results) {
    const row = document.createElement("div");
    row.className = "wiki-later-search-row";
    const label = document.createElement("span");
    label.textContent = result.wordcount ? `${result.title} (${result.wordcount} words)` : result.title;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-list-action";
    button.textContent = "Add section";
    button.addEventListener("click", () => openWikiSectionEditor(item, result.title));
    row.append(label, button);
    root.append(row);
  }
}

async function searchWikiPages(query: string): Promise<WikiSearchResult[]> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("list", "search");
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("srsearch", query);
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as { query?: { search?: WikiSearchResult[] } };
  return data.query?.search ?? [];
}

function openWikiNewPage(item: WikiLaterItem): void {
  const url = wikiEditUrl(titleFromLaterText(item.text));
  url.searchParams.set("preload", WIKI_PRELOAD_TEMPLATE);
  openWikiEditorUrl(url);
}

function openWikiSectionEditor(item: WikiLaterItem, pageTitle: string): void {
  const url = wikiEditUrl(pageTitle);
  url.searchParams.set("section", "new");
  url.searchParams.set("preload", WIKI_PRELOAD_TEMPLATE);
  url.searchParams.set("preloadtitle", item.text);
  openWikiEditorUrl(url);
}

function wikiEditUrl(title: string): URL {
  const url = new URL("https://wiki.remilia.org/index.php");
  url.searchParams.set("title", title);
  url.searchParams.set("action", "edit");
  return url;
}

function titleFromLaterText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean
    .split(" ")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

function openWikiEditorUrl(url: URL): void {
  void chrome.tabs.create({ url: url.toString() });
}

async function removeWikiLaterItem(id: string, currentItems: WikiLaterItem[]): Promise<void> {
  await chrome.storage.local.set({
    [WIKI_LATER_KEY]: currentItems.filter((item) => item.id !== id),
  });
}

function normalizeWikiLaterItems(value: unknown): WikiLaterItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : `${item.createdAt || Date.now()}-${item.text || ""}`,
      text: typeof item.text === "string" ? item.text : "",
      pageUrl: typeof item.pageUrl === "string" ? item.pageUrl : undefined,
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
    }))
    .filter((item) => item.text.trim().length > 0)
    .sort((left, right) => right.createdAt - left.createdAt);
}

function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return value;
  }
}

function setupUpdateStatus(): void {
  const refresh = document.getElementById("updateRefresh") as HTMLButtonElement | null;
  const download = document.getElementById("updateDownload") as HTMLButtonElement | null;
  const copySteps = document.getElementById("updateCopySteps") as HTMLButtonElement | null;
  const reload = document.getElementById("updateReload") as HTMLButtonElement | null;
  const message = document.getElementById("updateMessage");
  void renderUpdateStatus();
  refresh?.addEventListener("click", () => {
    refresh.disabled = true;
    void chrome.runtime.sendMessage({ type: "milxdy:checkUpdate" })
      .then((status) => renderUpdateStatus(isUpdateStatus(status) ? status : undefined))
      .finally(() => {
        refresh.disabled = false;
      });
  });
  download?.addEventListener("click", () => {
    void currentUpdateStatus().then((status) => {
      const url = status?.latestAssetUrl || status?.latestUrl;
      if (!url) {
        if (message) message.textContent = "No release download is available yet. Try refresh first.";
        return;
      }
      openExternalUrl(url);
      if (message) {
        message.textContent = status?.matchedExpectedAsset
          ? `Opened ${status.latestAssetName}.`
          : status?.latestAssetUrl
            ? `Opened ${status.latestAssetName || "a release zip"}. Confirm it matches this build before replacing files.`
            : "Opened the release page.";
      }
    });
  });
  copySteps?.addEventListener("click", () => {
    void currentUpdateStatus().then((status) => {
      const steps = updateStepsText(status);
      void navigator.clipboard.writeText(steps).then(() => {
        if (message) message.textContent = "Update steps copied. Replace files in the same folder before using Reload.";
      }).catch(() => {
        if (message) message.textContent = "Copy failed. Use the README update steps.";
      });
    });
  });
  reload?.addEventListener("click", () => {
    if (message) message.textContent = "Reloading extension. Refresh X/Twitter tabs after it comes back.";
    window.setTimeout(() => chrome.runtime.reload(), 250);
  });
}

async function renderUpdateStatus(status?: UpdateStatus): Promise<void> {
  const root = document.getElementById("updateStatus");
  const title = document.getElementById("updateStatusTitle");
  const detail = document.getElementById("updateStatusDetail");
  const link = document.getElementById("updateLink") as HTMLAnchorElement | null;
  const download = document.getElementById("updateDownload") as HTMLButtonElement | null;
  const copySteps = document.getElementById("updateCopySteps") as HTMLButtonElement | null;
  const reload = document.getElementById("updateReload") as HTMLButtonElement | null;
  if (!root || !title || !detail || !link || !download || !copySteps || !reload) return;

  const installedVersion = chrome.runtime.getManifest().version;
  const stored = status ? { [UPDATE_STATUS_KEY]: status } : await chrome.storage.local.get(UPDATE_STATUS_KEY);
  const updateStatus = isUpdateStatus(stored[UPDATE_STATUS_KEY]) ? stored[UPDATE_STATUS_KEY] : null;
  delete root.dataset.state;
  link.hidden = true;
  download.hidden = true;
  copySteps.hidden = true;
  reload.hidden = true;
  link.removeAttribute("href");

  if (!updateStatus) {
    title.textContent = "Checking for updates...";
    detail.textContent = `Installed v${installedVersion}.`;
    return;
  }

  if (updateStatus.updateAvailable && updateStatus.latestVersion) {
    root.dataset.state = "available";
    title.textContent = `Update available: v${updateStatus.latestVersion}`;
    detail.textContent = updateStatus.matchedExpectedAsset
      ? `Installed v${updateStatus.currentVersion}. Download ${updateStatus.latestAssetName}, replace files in the same folder, then reload to preserve settings and stats.`
      : `Installed v${updateStatus.currentVersion}. Expected ${updateStatus.expectedAssetName || "this build's profile archive"}; open the release page if Download does not match.`;
    download.hidden = false;
    copySteps.hidden = false;
    reload.hidden = false;
    if (updateStatus.latestUrl) {
      link.href = updateStatus.latestUrl;
      link.hidden = false;
    }
    return;
  }

  if (updateStatus.error) {
    root.dataset.state = "error";
    title.textContent = "Update check failed";
    detail.textContent = `${updateStatus.error}. Installed v${installedVersion}.`;
    return;
  }

  title.textContent = "milXdy is up to date";
  detail.textContent = `Installed v${updateStatus.currentVersion}. Last checked ${formatCheckedAt(updateStatus.checkedAt)}.`;
  copySteps.hidden = false;
  reload.hidden = false;
}

async function currentUpdateStatus(): Promise<UpdateStatus | null> {
  const stored = await chrome.storage.local.get(UPDATE_STATUS_KEY);
  return isUpdateStatus(stored[UPDATE_STATUS_KEY]) ? stored[UPDATE_STATUS_KEY] : null;
}

function updateStepsText(status: UpdateStatus | null): string {
  const installedVersion = chrome.runtime.getManifest().version;
  const latest = status?.latestVersion ? `v${status.latestVersion}` : "the latest release";
  const asset = status?.latestAssetName ? ` (${status.latestAssetName})` : "";
  const expected = status?.expectedAssetName ? `Expected archive: ${status.expectedAssetName}` : "";
  const releaseUrl = status?.latestUrl || "https://github.com/bonklek/milXdy/releases";
  const downloadUrl = status?.latestAssetUrl || releaseUrl;
  return [
    `milXdy in-place update steps`,
    "",
    `Installed: v${status?.currentVersion || installedVersion}`,
    `Target: ${latest}${asset}`,
    expected,
    "",
    "1. Download the latest milXdy prerelease zip:",
    downloadUrl,
    "2. Unzip it over the same folder this unpacked extension already uses.",
    "3. Do not remove milXdy from chrome://extensions.",
    "4. Do not load a fresh folder as a second unpacked extension.",
    "5. Return to the milXdy popup and click Reload, or press reload on the existing chrome://extensions card.",
    "6. Refresh open X/Twitter tabs.",
    "",
    "Keeping the same loaded folder preserves Chrome extension storage, including Maxxer stats, settings, diagnostics, and RemiNet/Beetol login state.",
  ].join("\n");
}

function isUpdateStatus(value: unknown): value is UpdateStatus {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.checkedAt === "number"
    && typeof record.currentVersion === "string"
    && (typeof record.latestAssetUrl === "string" || record.latestAssetUrl == null)
    && (typeof record.latestAssetName === "string" || record.latestAssetName == null)
    && (typeof record.expectedAssetName === "string" || record.expectedAssetName == null)
    && (typeof record.matchedExpectedAsset === "boolean" || record.matchedExpectedAsset == null)
    && typeof record.updateAvailable === "boolean";
}

function formatCheckedAt(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function renderStatus(): Promise<void> {
  const statusGrid = document.getElementById("statusGrid");
  if (!statusGrid) return;
  const [local, sync] = await Promise.all([
    chrome.storage.local.get([
      "stats",
      "matchedAccounts",
      "playerStats",
      "milxdy.diagnostics.scanner",
      "milxdy.diagnostics.miladyDetection",
      "milxdy.diagnostics.runtime",
      "remiliaWikiHyperlink.performance",
      PERFORMANCE_MODE_KEY,
      RESKIN_PROFILE_KEY,
    ]),
    chrome.storage.sync.get(["mode"]),
  ]);
  const stats = objectValue(local.stats);
  const matchedAccounts = objectValue(local.matchedAccounts);
  const scanner = objectValue(local["milxdy.diagnostics.scanner"]);
  const miladyDetection = objectValue(local["milxdy.diagnostics.miladyDetection"]);
  const runtime = objectValue(local["milxdy.diagnostics.runtime"]);
  const wikiPerformance = objectValue(local["remiliaWikiHyperlink.performance"]);
  const performanceMode = normalizePerformanceMode(local[PERFORMANCE_MODE_KEY]);
  const profile = typeof local[RESKIN_PROFILE_KEY] === "string" ? local[RESKIN_PROFILE_KEY] : DEFAULT_RESKIN_PROFILE;
  statusGrid.innerHTML = "";
  for (const item of [
    ["Reskin", profile],
    ["Performance", performanceMode],
    ["Build", `${BUILD_TARGET}/${BUILD_PROFILE}`],
    ["Loaded apps", stringList(runtime.loadedApps)],
    ["Heavy apps", stringList(runtime.loadedHeavyApps)],
    ["Worker-heavy", stringList(runtime.loadedWorkerHeavyApps)],
    ["Network apps", stringList(runtime.loadedNetworkApps)],
    ["Mode", typeof sync.mode === "string" ? sync.mode : "milady"],
    ["Maxxer matches", String(Object.keys(matchedAccounts).length)],
    ["Avatars checked", String(stats.avatarsChecked ?? 0)],
    ["Cache hits", String(stats.cacheHits ?? 0)],
    ["Scanner emitted", String(scanner.surfacesEmitted ?? 0)],
    ["Scanner flush", `${String(scanner.lastFlushMs ?? 0)} ms`],
    ["Detection queue", `${String(miladyDetection.active ?? 0)} active / ${String(miladyDetection.queued ?? 0)} queued`],
    ["Wiki links", String(wikiPerformance.linksCreated ?? 0)],
  ]) {
    const node = document.createElement("div");
    node.className = "status-item";
    node.innerHTML = `<strong>${escapeHtml(item[1])}</strong><span>${escapeHtml(item[0])}</span>`;
    statusGrid.appendChild(node);
  }
}

function setupReportActions(): void {
  const message = document.getElementById("reportMessage");
  const llmAssist = document.getElementById("reportLlmAssist") as HTMLInputElement | null;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-report-target]"));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const target = button.dataset.reportTarget === "github" ? "github" : "x";
      const template = bugReportTemplate();
      if (llmAssist?.checked) {
        void navigator.clipboard.writeText(llmBugReportPrompt(target, template)).then(() => {
          void openExternalUrl(target === "github" ? GITHUB_ISSUES_NEW_URL : xReplyUrl(""))
            .then(() => showLlmPromptCopiedNotification(target))
            .catch(() => showLlmPromptCopiedNotification(target));
          if (message) {
            message.textContent = `LLM prompt copied. Paste it into a chat window, then use the opened ${target === "github" ? "GitHub issue" : "X reply"} when your report is ready.`;
          }
        }).catch(() => {
          if (message) message.textContent = "Copy failed. Disable LLM assisted to open a prefilled report instead.";
        });
        return;
      }
      if (target === "github") {
        openExternalUrl(githubIssueUrl(template));
        if (message) message.textContent = "Opened GitHub issue form.";
        return;
      }
      openExternalUrl(xReplyUrl(template.x));
      if (message) message.textContent = "Opened X reply composer.";
    });
  }
}

function bugReportTemplate(): { title: string; full: string; x: string } {
  const version = chrome.runtime.getManifest().version;
  return {
    title: "[Bug]: ",
    full: [
      "### Bug report",
      "",
      `milXdy version: ${version}`,
      `Build: ${BUILD_TARGET}/${BUILD_PROFILE}`,
      "Browser:",
      "Feature area:",
      "What happened:",
      "Expected:",
      "Steps to reproduce:",
      "Console errors/screenshots:",
    ].join("\n"),
    x: [
      "milXdy bug report",
      `v${version} ${BUILD_TARGET}/${BUILD_PROFILE}`,
      "Feature:",
      "Issue:",
      "Steps:",
      "Expected:",
    ].join("\n"),
  };
}

function llmBugReportPrompt(target: "github" | "x", template: { title: string; full: string; x: string }): string {
  const version = chrome.runtime.getManifest().version;
  const targetInstructions = target === "github"
    ? [
      "Final destination: GitHub issue.",
      "Output a clear issue title and a Markdown body that follows the template below.",
      "Prefer concise sections, reproduction steps, expected behavior, actual behavior, environment, suspected area, screenshots/logs, and impact.",
      "If information is missing, ask targeted questions before drafting. Do not invent facts.",
    ]
    : [
      "Final destination: X reply to the milXdy bug collector tweet.",
      `Collector tweet: ${X_FEEDBACK_COLLECTOR_URL}`,
      "Respect X character limits. First try to produce one reply under 240 characters that includes feature area, symptom, and reproduction cue.",
      "If the bug needs more detail, output a short reply plus a second expanded note. If you can generate images, offer to create a screenshot-style summary card so the report can fit despite character limits.",
      "Ask targeted questions before drafting. Do not invent facts.",
    ];

  return [
    "Help me create a high-quality milXdy bug report through a short interview.",
    "",
    `milXdy version: ${version}`,
    `Build: ${BUILD_TARGET}/${BUILD_PROFILE}`,
    ...targetInstructions,
    "",
    "Interview flow:",
    "1. Ask only the most relevant questions needed to make the report actionable.",
    "2. Prioritize exact page or feature, what the user clicked or saw, expected vs actual behavior, repeatability, browser/extension version, console errors, screenshots, and whether reloading X or the extension changes anything.",
    "3. If the user is unsure, help them gather evidence with simple steps, such as checking the Diag tab values or copying visible error text.",
    "4. When enough detail is available, output only the final report text for the selected destination.",
    "",
    "Quality bar:",
    "- Make it reproducible.",
    "- Keep speculation separate from observed facts.",
    "- Include privacy reminders before asking for screenshots or logs.",
    "- Keep the user's tone intact while making the report concise.",
    "",
    "Template:",
    target === "github" ? template.full : template.x,
  ].join("\n");
}

function showLlmPromptCopiedNotification(target: "github" | "x"): void {
  chrome.notifications.create(`milxdy-llm-bug-report-${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "LLM prompt copied",
    message: `Paste it into your LLM chat, answer its questions, then use the opened ${target === "github" ? "GitHub issue" : "X reply"} for the final bug report.`,
  });
}

function githubIssueUrl(template: { title: string; full: string }): string {
  const url = new URL(GITHUB_ISSUES_NEW_URL);
  url.searchParams.set("title", template.title);
  url.searchParams.set("body", template.full);
  url.searchParams.set("labels", "bug");
  return url.toString();
}

function xReplyUrl(template: string): string {
  const url = new URL(X_FEEDBACK_REPLY_URL);
  url.searchParams.set("in_reply_to", X_FEEDBACK_POST_ID);
  url.searchParams.set("text", template);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

async function setupBeetolPanel(): Promise<void> {
  const session = document.getElementById("beetolSession");
  const status = document.getElementById("beetolStatus");
  const authDetail = document.getElementById("beetolAuthDetail");
  const logout = document.getElementById("beetolLogout") as HTMLButtonElement | null;
  const openSso = document.getElementById("beetolOpenSso") as HTMLButtonElement | null;
  const retrySession = document.getElementById("beetolRetrySession") as HTMLButtonElement | null;
  const pokeDiagnostic = document.getElementById("beetolPokeDiagnostic");
  const color = document.getElementById("beetolColor") as HTMLSelectElement | null;
  const mode = document.getElementById("beetolMode") as HTMLSelectElement | null;
  const message = document.getElementById("beetolMessage");

  if (!session || !status || !authDetail || !logout || !openSso || !retrySession || !pokeDiagnostic || !color || !mode || !message) return;

  const settings = await chrome.storage.local.get(["beetolColor", "beetolMode"]);
  color.value = typeof settings.beetolColor === "string" ? settings.beetolColor : "red";
  mode.value = typeof settings.beetolMode === "string" ? settings.beetolMode : "settings";

  const setMessage = (text: string, kind = "") => {
    message.textContent = text;
    if (kind) message.dataset.kind = kind;
    else delete message.dataset.kind;
  };

  const renderAuth = (signedIn: boolean, method = "") => {
    session.toggleAttribute("data-signed-in", signedIn);
    status.parentElement?.toggleAttribute("data-signed-in", signedIn);
    status.textContent = signedIn
      ? `Login active${method === "session" ? " via browser session" : ""}`
      : "Not signed in";
    authDetail.textContent = signedIn
      ? ""
      : "Sign in on remilia.net, then retry the browser session to use Beetol hunts and RemiStats pokes.";
    logout.hidden = !signedIn;
    openSso.hidden = signedIn;
    retrySession.hidden = signedIn;
    if (signedIn) pokeDiagnostic.hidden = true;
  };

  const auth = await chrome.runtime.sendMessage({ type: "beetol:authStatus" }).catch(() => null);
  const signedIn = Boolean(auth?.signedIn);
  renderAuth(signedIn, typeof auth?.method === "string" ? auth.method : "");
  if (signedIn) pokeDiagnostic.hidden = true;
  else await renderPokeDiagnostic(pokeDiagnostic);

  openSso.addEventListener("click", () => {
    openExternalUrl(REMILIA_NET_LOGIN_URL);
    setMessage("Click Log in on RemiliaNET, finish the site login flow, then click Retry session.");
  });

  retrySession.addEventListener("click", () => {
    retrySession.disabled = true;
    setMessage("Checking browser session...");
    void chrome.runtime.sendMessage({ type: "beetol:sessionStatus" }).then((response) => {
      const signedIn = Boolean(response?.signedIn);
      renderAuth(signedIn, signedIn ? "session" : "");
      setMessage(signedIn
        ? "Browser session detected."
        : "No browser session detected. Complete RemiliaNET SSO first.",
      signedIn ? "" : "warn");
    }).finally(() => {
      retrySession.disabled = false;
    });
  });

  logout.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "beetol:logout" }).then(() => {
      setMessage("Disconnected from milXdy. Your RemiliaNET website session may still be active.");
      renderAuth(false);
    });
  });

  color.addEventListener("change", () => {
    void chrome.storage.local.set({ beetolColor: color.value });
  });
  mode.addEventListener("change", () => {
    void chrome.storage.local.set({ beetolMode: mode.value });
  });
}

async function renderPokeDiagnostic(root: HTMLElement): Promise<void> {
  const stored = await chrome.storage.local.get(LAST_POKE_DIAGNOSTIC_KEY);
  const diagnostic = objectValue(stored[LAST_POKE_DIAGNOSTIC_KEY]);
  if (!Object.keys(diagnostic).length) {
    root.hidden = true;
    return;
  }
  const updatedAt = typeof diagnostic.updatedAt === "number"
    ? formatCheckedAt(diagnostic.updatedAt)
    : "unknown";
  root.hidden = false;
  root.textContent = [
    `Last poke: ${diagnostic.ok ? "ok" : "failed"} (${updatedAt})`,
    `Target: ${String(diagnostic.username || "")}`,
    `Error: ${String(diagnostic.error || "")}`,
  ].join("\n");
}

export {};
