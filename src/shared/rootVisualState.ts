import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type VisualThemeSettings,
} from "./reskinProfile";
import { parseJsonObject } from "./json";
import { injectReskinStyles } from "./reskinStyles";

type XTheme = "light" | "dim" | "dark";
type SettingsTheme = "light" | "dark" | "system";

const SETTINGS_THEME_KEY = "milxdy.settings.theme";

export async function setupRootVisualState(): Promise<void> {
  injectReskinStyles();
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
  root.dataset.milxdyReskinProfile = theme.profile;
  root.dataset.milxdyVisualBackgroundFade = String(theme.backgroundFade);
  root.dataset.milxdyVisualSquareMedia = String(theme.squareMedia);
  root.dataset.milxdyVisualPfpShape = theme.pfpShape;
  root.dataset.milxdyVisualPfpFeed = String(theme.pfpFeed);
  root.dataset.milxdyVisualPfpNotifications = String(theme.pfpNotifications);
  root.dataset.milxdyVisualPfpChat = String(theme.pfpChat);
  root.dataset.milxdyVisualQuoteMediaGap = String(theme.quoteMediaGap);
  root.dataset.milxdyVisualAppWindowStyle = theme.appWindowStyle;
  root.dataset.milxdyVisualAppShadows = String(theme.appShadows);
  root.dataset.milxdyVisualMaxMediaHeight = String(theme.maxMediaHeight);
  root.dataset.milxdyVisualPostButton = theme.postButtonClickly ? "clickly" : "flat";
  root.dataset.milxdyVisualPostSound = String(theme.postSound);
  root.dataset.milxdyVisualSidebarBevel = String(theme.sidebarBevel);
  root.dataset.milxdyVisualSidebarSound = String(theme.sidebarSound);
  root.dataset.milxdyVisualNewPostsPill = String(theme.newPostsPill);
  root.dataset.milxdyVisualNewPostsSound = String(theme.newPostsSound);
  root.dataset.milxdyVisualNotificationUnreadTint = String(theme.notificationUnreadTint);
  root.dataset.milxdyVisualRemistatsBox = String(theme.remistatsBox);
  root.dataset.milxdyVisualIncomingPokeGold = String(theme.incomingPokeGold);
  root.dataset.milxdyVisualPokePlacement = theme.pokePlacement;
  root.dataset.milxdyVisualReminetChatOverlay = String(theme.reminetChatOverlay);
  root.dataset.milxdyVisualMiladyOnly = String(theme.miladyOnly);
  root.dataset.milxdyVisualDisableMaxxer = String(theme.disableMaxxer);
  root.dataset.milxdyVisualDisableSelfTracking = String(theme.disableSelfTracking);
  root.dataset.milxdyVisualMaxxerIntensity = theme.maxxerIntensity;
  root.dataset.milxdyVisualMaxxerSeparators = theme.maxxerSeparators;
  root.dataset.milxdyVisualMaxxerShimmer = String(theme.maxxerShimmer);
  root.dataset.milxdyVisualTweetPngBorderPalette = theme.tweetPngBorderPalette;
  root.style.setProperty("--milxdy-font-tweet", tweetFontStack(theme.tweetFont));
  root.style.setProperty("--milxdy-font-ui", uiFontStack(theme.uiFont));
  root.style.setProperty("--milxdy-font-mono", '"Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace');
  root.style.setProperty("--milxdy-max-media-height", theme.maxMediaHeight > 0 ? `${theme.maxMediaHeight}px` : "none");
}

function setupXThemeDetection(initialSettingsTheme: unknown): void {
  let queued = false;
  let lastAppliedTheme: XTheme | null = null;
  let settingsTheme = normalizeSettingsTheme(initialSettingsTheme);
  const update = () => {
    const root = document.documentElement;
    const detectedTheme = detectXTheme();
    const theme = resolveEffectiveXTheme(settingsTheme, detectedTheme);
    root.dataset.milxdySettingsTheme = settingsTheme;
    root.dataset.milxdyXTheme = theme;
    applyNativeThemeHints(settingsTheme);
    applySidebarThemeOverride(theme, theme !== lastAppliedTheme);
    lastAppliedTheme = theme;
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
  if (value) {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  } else if (element.style.getPropertyValue(property)) {
    element.style.removeProperty(property);
  }
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
