import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type VisualThemeSettings,
} from "./reskinProfile";
import { injectReskinStyles } from "./reskinStyles";

type XTheme = "light" | "dim" | "dark";
type SettingsTheme = "light" | "dark" | "system";

const SETTINGS_THEME_KEY = "milxdy.settings.theme";
const DIAGNOSTICS_ENABLED_KEY = "milxdy.diagnostics.enabled";
const ROOT_VISUAL_DIAGNOSTICS_KEY = "milxdy.diagnostics.rootVisualState";

const rootVisualDiagnostics = {
  datasetWrites: 0,
  datasetNoops: 0,
  styleWrites: 0,
  styleNoops: 0,
  profileApplications: 0,
  profileNoops: 0,
  themeApplications: 0,
  themeNoops: 0,
  updatedAt: 0,
};

let lastReskinSignature: string | null = null;
let diagnosticsWriteTimer: number | null = null;
let diagnosticsEnabled = false;

export async function setupRootVisualState(): Promise<void> {
  resetRootVisualDiagnostics();
  initializeRootDiagnosticsGate();
  injectReskinStyles();
  applyReskinProfile(DEFAULT_RESKIN_PROFILE, DEFAULT_VISUAL_THEME);
  const stored = await chrome.storage.local.get({
    [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE,
    [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME,
    [SETTINGS_THEME_KEY]: "system",
  });
  setupXThemeDetection(stored[SETTINGS_THEME_KEY]);
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
  const signature = visualThemeSignature(theme);
  if (signature === lastReskinSignature) {
    rootVisualDiagnostics.profileNoops += 1;
    rootVisualDiagnostics.updatedAt = Date.now();
    scheduleRootVisualDiagnosticsWrite();
    return;
  }
  lastReskinSignature = signature;
  rootVisualDiagnostics.profileApplications += 1;
  setDatasetValue(root, "milxdyReskinProfile", theme.profile);
  setDatasetValue(root, "milxdyVisualBackgroundFade", String(theme.backgroundFade));
  setDatasetValue(root, "milxdyVisualSquareMedia", String(theme.squareMedia));
  setDatasetValue(root, "milxdyVisualPfpShape", theme.pfpShape);
  setDatasetValue(root, "milxdyVisualPfpFeed", String(theme.pfpFeed));
  setDatasetValue(root, "milxdyVisualPfpNotifications", String(theme.pfpNotifications));
  setDatasetValue(root, "milxdyVisualPfpChat", String(theme.pfpChat));
  setDatasetValue(root, "milxdyVisualQuoteMediaGap", String(theme.quoteMediaGap));
  setDatasetValue(root, "milxdyVisualAppWindowStyle", theme.appWindowStyle);
  setDatasetValue(root, "milxdyVisualAppShadows", String(theme.appShadows));
  setDatasetValue(root, "milxdyVisualMaxMediaHeight", String(theme.maxMediaHeight));
  setDatasetValue(root, "milxdyVisualPostButton", theme.postButtonClickly ? "clickly" : "flat");
  setDatasetValue(root, "milxdyVisualPostSound", String(theme.postSound));
  setDatasetValue(root, "milxdyVisualSidebarBevel", String(theme.sidebarBevel));
  setDatasetValue(root, "milxdyVisualSidebarSound", String(theme.sidebarSound));
  setDatasetValue(root, "milxdyVisualNewPostsPill", String(theme.newPostsPill));
  setDatasetValue(root, "milxdyVisualNewPostsSound", String(theme.newPostsSound));
  setDatasetValue(root, "milxdyVisualNotificationUnreadTint", String(theme.notificationUnreadTint));
  setDatasetValue(root, "milxdyVisualRemistatsBox", String(theme.remistatsBox));
  setDatasetValue(root, "milxdyVisualIncomingPokeGold", String(theme.incomingPokeGold));
  setDatasetValue(root, "milxdyVisualPokePlacement", theme.pokePlacement);
  setDatasetValue(root, "milxdyVisualReminetChatOverlay", String(theme.reminetChatOverlay));
  setDatasetValue(root, "milxdyVisualMiladyOnly", String(theme.miladyOnly));
  setDatasetValue(root, "milxdyVisualDisableMaxxer", String(theme.disableMaxxer));
  setDatasetValue(root, "milxdyVisualDisableSelfTracking", String(theme.disableSelfTracking));
  setDatasetValue(root, "milxdyVisualMaxxerIntensity", theme.maxxerIntensity);
  setDatasetValue(root, "milxdyVisualMaxxerSeparators", theme.maxxerSeparators);
  setDatasetValue(root, "milxdyVisualMaxxerShimmer", String(theme.maxxerShimmer));
  setDatasetValue(root, "milxdyVisualTweetPngBorderPalette", theme.tweetPngBorderPalette);
  setStyleValue(root, "--milxdy-font-tweet", tweetFontStack(theme.tweetFont));
  setStyleValue(root, "--milxdy-font-ui", uiFontStack(theme.uiFont));
  setStyleValue(root, "--milxdy-font-mono", '"Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace');
  setStyleValue(root, "--milxdy-max-media-height", theme.maxMediaHeight > 0 ? `${theme.maxMediaHeight}px` : "none");
}

function visualThemeSignature(theme: VisualThemeSettings): string {
  return JSON.stringify(theme);
}

function resetRootVisualDiagnostics(): void {
  rootVisualDiagnostics.datasetWrites = 0;
  rootVisualDiagnostics.datasetNoops = 0;
  rootVisualDiagnostics.styleWrites = 0;
  rootVisualDiagnostics.styleNoops = 0;
  rootVisualDiagnostics.profileApplications = 0;
  rootVisualDiagnostics.profileNoops = 0;
  rootVisualDiagnostics.themeApplications = 0;
  rootVisualDiagnostics.themeNoops = 0;
  rootVisualDiagnostics.updatedAt = Date.now();
  diagnosticsEnabled = false;
  lastReskinSignature = null;
  if (diagnosticsWriteTimer !== null) {
    window.clearTimeout(diagnosticsWriteTimer);
    diagnosticsWriteTimer = null;
  }
}

function initializeRootDiagnosticsGate(): void {
  void chrome.storage.local.get({ [DIAGNOSTICS_ENABLED_KEY]: false })
    .then((stored) => {
      diagnosticsEnabled = stored?.[DIAGNOSTICS_ENABLED_KEY] === true;
      if (diagnosticsEnabled) scheduleRootVisualDiagnosticsWrite();
    })
    .catch(() => undefined);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[DIAGNOSTICS_ENABLED_KEY]) return;
    diagnosticsEnabled = changes[DIAGNOSTICS_ENABLED_KEY].newValue === true;
    if (diagnosticsEnabled) scheduleRootVisualDiagnosticsWrite();
  });
}

function scheduleRootVisualDiagnosticsWrite(): void {
  rootVisualDiagnostics.updatedAt = Date.now();
  if (!diagnosticsEnabled || diagnosticsWriteTimer !== null) return;
  diagnosticsWriteTimer = window.setTimeout(() => {
    diagnosticsWriteTimer = null;
    if (!diagnosticsEnabled) return;
    void chrome.storage.local.set({ [ROOT_VISUAL_DIAGNOSTICS_KEY]: { ...rootVisualDiagnostics } })
      .catch(() => undefined);
  }, 1000);
}

function setDatasetValue(element: HTMLElement, key: string, value: string): void {
  if (element.dataset[key] === value) {
    rootVisualDiagnostics.datasetNoops += 1;
    scheduleRootVisualDiagnosticsWrite();
    return;
  }
  element.dataset[key] = value;
  rootVisualDiagnostics.datasetWrites += 1;
  scheduleRootVisualDiagnosticsWrite();
}

function setupXThemeDetection(initialSettingsTheme: unknown): void {
  let queued = false;
  let lastAppliedTheme: XTheme | null = null;
  let lastSettingsTheme: SettingsTheme | null = null;
  let settingsTheme = normalizeSettingsTheme(initialSettingsTheme);
  const update = () => {
    const root = document.documentElement;
    const detectedTheme = detectXTheme();
    const theme = resolveEffectiveXTheme(settingsTheme, detectedTheme);
    if (settingsTheme === lastSettingsTheme && theme === lastAppliedTheme) {
      applySidebarThemeOverride(theme, false);
      rootVisualDiagnostics.themeNoops += 1;
      scheduleRootVisualDiagnosticsWrite();
      return;
    }
    setDatasetValue(root, "milxdySettingsTheme", settingsTheme);
    setDatasetValue(root, "milxdyXTheme", theme);
    applyNativeThemeHints(settingsTheme);
    applySidebarThemeOverride(theme, theme !== lastAppliedTheme);
    lastSettingsTheme = settingsTheme;
    lastAppliedTheme = theme;
    rootVisualDiagnostics.themeApplications += 1;
    scheduleRootVisualDiagnosticsWrite();
  };
  const scheduleUpdate = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  update();
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", scheduleUpdate);
  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-color-mode", "data-theme"] });
  if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-color-mode", "data-theme"] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[SETTINGS_THEME_KEY]) return;
    settingsTheme = normalizeSettingsTheme(changes[SETTINGS_THEME_KEY].newValue);
    scheduleUpdate();
  });
  window.setTimeout(scheduleUpdate, 250);
  window.setTimeout(scheduleUpdate, 1000);
}

function normalizeSettingsTheme(value: unknown): SettingsTheme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function resolveEffectiveXTheme(settingsTheme: SettingsTheme, detectedTheme: XTheme): XTheme {
  if (settingsTheme === "light" || settingsTheme === "dark") return settingsTheme;
  return detectedTheme;
}

function applyNativeThemeHints(settingsTheme: SettingsTheme): void {
  const scheme = settingsTheme === "system" ? "" : settingsTheme;
  setStyleValue(document.documentElement, "color-scheme", scheme);
  if (document.body) setStyleValue(document.body, "color-scheme", scheme);
}

function setStyleValue(element: HTMLElement, property: string, value: string): void {
  const current = element.style.getPropertyValue(property);
  if (value) {
    if (current === value) {
      rootVisualDiagnostics.styleNoops += 1;
      scheduleRootVisualDiagnosticsWrite();
      return;
    }
    element.style.setProperty(property, value);
    rootVisualDiagnostics.styleWrites += 1;
    scheduleRootVisualDiagnosticsWrite();
    return;
  }
  if (!current) {
    rootVisualDiagnostics.styleNoops += 1;
    scheduleRootVisualDiagnosticsWrite();
    return;
  }
  element.style.removeProperty(property);
  rootVisualDiagnostics.styleWrites += 1;
  scheduleRootVisualDiagnosticsWrite();
}

function findXBackgroundColor(): string | null {
  const inlineCandidates = [
    document.documentElement.style.backgroundColor,
    document.body?.style.backgroundColor,
    document.documentElement.getAttribute("style")?.match(/background-color:\s*([^;]+)/i)?.[1],
    document.body?.getAttribute("style")?.match(/background-color:\s*([^;]+)/i)?.[1],
  ];
  for (const color of inlineCandidates) {
    if (isUsableThemeColor(color)) return color.trim();
  }
  const computedCandidates = [
    document.querySelector<HTMLElement>('[data-testid="primaryColumn"]'),
    document.querySelector<HTMLElement>('main[role="main"]'),
    document.body,
    document.documentElement,
  ];
  for (const element of computedCandidates) {
    if (!element) continue;
    const color = getComputedStyle(element).backgroundColor;
    if (isUsableThemeColor(color)) return color.trim();
  }
  return null;
}

function detectXTheme(): XTheme {
  const stored = detectStoredXTheme();
  if (stored) return stored;
  const backgroundColor = findXBackgroundColor();
  if (!backgroundColor) return "light";
  const match = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return "light";
  const [, red, green, blue] = match.map(Number);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  if (luminance <= 8) return "dark";
  if (luminance <= 48) return "dim";
  return "light";
}

function detectStoredXTheme(): XTheme | null {
  for (const key of ["theme", "colorScheme", "backgroundColor"]) {
    const theme = normalizeStoredThemeValue(localStorage.getItem(key));
    if (theme) return theme;
  }
  const settings = parseJsonObject(localStorage.getItem("rweb.settings"));
  for (const key of ["theme", "colorScheme", "colorMode", "backgroundColor", "background_color"]) {
    const theme = normalizeStoredThemeValue(settings?.[key]);
    if (theme) return theme;
  }
  return null;
}

function normalizeStoredThemeValue(value: unknown): XTheme | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "light" || normalized === "lights out") return "light";
  if (normalized === "dim") return "dim";
  if (normalized === "dark" || normalized === "lights_out" || normalized === "black") return "dark";
  return null;
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isUsableThemeColor(color: string | null | undefined): color is string {
  if (!color) return false;
  const normalized = color.trim().toLowerCase();
  return Boolean(normalized && normalized !== "transparent" && normalized !== "rgba(0, 0, 0, 0)");
}

function applySidebarThemeOverride(theme: XTheme, force = false): void {
  const header = document.querySelector<HTMLElement>('header[role="banner"]');
  if (!header) return;
  const dark = theme === "dark" || theme === "dim";
  const color = dark ? "#f4ffe8" : "";
  if (!force && header.dataset.milxdySidebarThemeOverride === theme) {
    applyComposeButtonIconOverride(header);
    return;
  }
  header.dataset.milxdySidebarThemeOverride = theme;
  const elements = header.querySelectorAll<HTMLElement | SVGElement>(
    'nav a, nav a *, [data-testid^="AppTabBar_"], [data-testid^="AppTabBar_"] *, svg, svg *',
  );
  for (const element of elements) {
    if (dark) {
      if (element.style.getPropertyValue("color") !== color) {
        element.style.setProperty("color", color, "important");
      }
      if (element instanceof SVGElement) {
        if (element.style.getPropertyValue("fill") !== "currentColor") {
          element.style.setProperty("fill", "currentColor", "important");
        }
        if (element.style.getPropertyValue("stroke") !== "currentColor") {
          element.style.setProperty("stroke", "currentColor", "important");
        }
      }
    } else {
      element.style.removeProperty("color");
      if (element instanceof SVGElement) {
        element.style.removeProperty("fill");
        element.style.removeProperty("stroke");
      }
    }
  }
  applyComposeButtonIconOverride(header);
}

function applyComposeButtonIconOverride(root: ParentNode = document): void {
  const selector = [
    '[data-testid="SideNav_NewTweet_Button"] svg',
    '[data-testid="SideNav_NewTweet_Button"] svg *',
    'a[href="/compose/post"] svg',
    'a[href="/compose/post"] svg *',
    '[data-testid="tweetButtonInline"] svg',
    '[data-testid="tweetButtonInline"] svg *',
    '[data-testid="tweetButton"] svg',
    '[data-testid="tweetButton"] svg *',
  ].join(", ");
  for (const element of Array.from(root.querySelectorAll<HTMLElement | SVGElement>(selector))) {
    element.style.setProperty("color", "#ffffff", "important");
    if (element instanceof SVGElement) {
      element.style.setProperty("fill", "currentColor", "important");
      element.style.setProperty("stroke", "currentColor", "important");
    }
  }
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
