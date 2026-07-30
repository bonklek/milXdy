import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type VisualThemeSettings,
} from "../../platform/visuals/reskin-profile";
import type { MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";
import { parseJsonObject } from "../../platform/browser/json";

let postSoundContext: AudioContext | null = null;
let visualTheme: VisualThemeSettings = DEFAULT_VISUAL_THEME;
const clickedNotificationKeys = new WeakMap<HTMLElement, string>();
const SHOW_NEW_POSTS_RE = /show\s+\d+\s+posts?/i;
const SHOW_NEW_POST_SCAN_INTERVAL_MS = 5000;
const SHOW_NEW_POST_SCAN_LIMIT = 120;
const HOME_LOGO_REPLACEMENT_CLASS = "milady-logo-replacement";
const HOME_LOGO_BACKGROUND_CLASS = "milxdy-home-logo-background";
const PAGE_FAVICON_ID = "milxdy-page-favicon";
const HOME_LOGO_LINK_SELECTOR = 'h1 a[href="/home"], h1 a[aria-label="X"][role="link"]';
const HOME_LOGO_PAGE_CHROME_SELECTOR = 'header[role="banner"], h1';
const REPLY_CONTEXT_RE = /\breplying to\b/i;
const NATIVE_REPLY_CONNECTOR_SELECTOR = [
  'div[style*="background-color: rgb(207, 217, 222)"]',
  'div[style*="background-color: rgb(239, 243, 244)"]',
  'div[style*="background-color: rgb(196, 207, 214)"]',
  'div[style*="background-color: rgb(56, 68, 77)"]',
  'div[style*="background-color: rgb(61, 73, 82)"]',
  'div[style*="background-color: rgb(51, 54, 57)"]',
  'div[style*="background-color: rgb(47, 51, 54)"]',
  'div[style*="background-color: rgb(66, 83, 100)"]',
].join(", ");
let booted = false;
let queueNotificationSurface: ((notification: HTMLElement) => void) | null = null;
let queueTweetSurface: ((tweet: HTMLElement) => void) | null = null;
let refreshHomeLogo: (() => void) | null = null;
type RootVisualClickHandler = (event: MouseEvent) => void;
const rootVisualClickHandlers = new Set<RootVisualClickHandler>();
let rootVisualClickListenerInstalled = false;

function addRootVisualClickHandler(context: MilxdyContentAppContext, handler: RootVisualClickHandler): void {
  rootVisualClickHandlers.add(handler);
  if (!rootVisualClickListenerInstalled) {
    document.addEventListener("click", dispatchRootVisualClick, true);
    rootVisualClickListenerInstalled = true;
  }
  context.addDisposable(() => {
    rootVisualClickHandlers.delete(handler);
    if (rootVisualClickHandlers.size === 0 && rootVisualClickListenerInstalled) {
      document.removeEventListener("click", dispatchRootVisualClick, true);
      rootVisualClickListenerInstalled = false;
    }
  });
}

function dispatchRootVisualClick(event: MouseEvent): void {
  for (const handler of Array.from(rootVisualClickHandlers)) handler(event);
}

function setupPageFavicon(context: MilxdyContentAppContext): void {
  let queued = false;
  const ensureFavicon = () => {
    queued = false;
    if (context.signal.aborted || !document.head) return;
    let favicon = document.head.querySelector<HTMLLinkElement>(`#${PAGE_FAVICON_ID}`);
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.id = PAGE_FAVICON_ID;
      favicon.rel = "icon";
      favicon.type = "image/png";
      favicon.href = chrome.runtime.getURL("brand/milxdy-logo-square-bevel.png");
      document.head.append(favicon);
      return;
    }
    // X replaces its favicon link during some client-side navigations. Keep
    // ours last so Chromium continues to use the square milXdy mark.
    if (favicon !== document.head.lastElementChild) document.head.append(favicon);
  };
  const scheduleEnsure = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(ensureFavicon);
  };
  ensureFavicon();
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  context.addDisposable(() => {
    observer.disconnect();
    document.getElementById(PAGE_FAVICON_ID)?.remove();
  });
}

export async function boot(context: MilxdyContentAppContext): Promise<void> {
  if (booted) return;
  booted = true;
  await loadVisualTheme();
  if (context.signal.aborted) return;
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local" || (!changes[RESKIN_PROFILE_KEY] && !changes[VISUAL_THEME_KEY])) return;
    void loadVisualTheme().then(() => refreshHomeLogo?.());
  };
  chrome.storage.onChanged.addListener(storageListener);
  context.addDisposable(() => chrome.storage.onChanged.removeListener(storageListener));
  setupMaxPostSound(context);
  injectHomeLogoStyles();
  setupPageFavicon(context);
  setupHomeLogoReplacement(context);
  setupShowNewPostsMarkers(context);
  setupNotificationUnreadMarkers(context);
  setupOrphanReplyMarkers(context);
}

export function onSurface(surface: { kind: string; element: HTMLElement }): void {
  if (surface.kind === "tweet") queueTweetSurface?.(surface.element);
  if (surface.kind === "notification") queueNotificationSurface?.(surface.element);
}

export function onRouteChange(): void {
  refreshHomeLogo?.();
}

export function disable(): void {}

export function dispose(): void {
  disable();
  postSoundContext?.close?.().catch(() => undefined);
  postSoundContext = null;
  refreshHomeLogo = null;
  queueTweetSurface = null;
  rootVisualClickHandlers.clear();
  if (rootVisualClickListenerInstalled) {
    document.removeEventListener("click", dispatchRootVisualClick, true);
    rootVisualClickListenerInstalled = false;
  }
  booted = false;
}

async function loadVisualTheme(): Promise<void> {
  const stored = await chrome.storage.local.get({
    [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE,
    [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME,
  }).catch(() => ({})) as Record<string, unknown>;
  const profile = normalizeReskinProfile(stored[RESKIN_PROFILE_KEY]);
  visualTheme = normalizeVisualTheme(stored[VISUAL_THEME_KEY], profile);
}

function setupMaxPostSound(context: MilxdyContentAppContext): void {
  let lastPostSoundButton: HTMLElement | null = null;
  let lastPostSoundAt = 0;
  const playPostButtonSound = (button: HTMLElement): void => {
    const now = performance.now();
    if (button === lastPostSoundButton && now - lastPostSoundAt < 250) return;
    lastPostSoundButton = button;
    lastPostSoundAt = now;
    playPostSendSound();
  };
  const postSoundsEnabled = (): boolean => document.documentElement.dataset.milxdyVisualPostSound !== "false";
  const clickListener = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest<HTMLElement>('header[role="banner"] nav a, [data-testid^="AppTabBar_"]')) {
      if (document.documentElement.dataset.milxdyVisualSidebarSound !== "false") playPostSendSound(0.45);
      return;
    }
    const newPostsButton = target?.closest<HTMLElement>('[role="button"], button');
    if (newPostsButton && SHOW_NEW_POSTS_RE.test(newPostsButton.textContent || "")) {
      if (document.documentElement.dataset.milxdyVisualNewPostsSound !== "false") playPostSendSound(0.55);
      return;
    }
    if (!postSoundsEnabled()) return;
    const button = target?.closest<HTMLElement>('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    playPostButtonSound(button);
  };
  addRootVisualClickHandler(context, clickListener);

  const keydownListener = (event: KeyboardEvent) => {
    if (!postSoundsEnabled()) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target instanceof Element ? event.target : document.activeElement;
    const button = target?.closest<HTMLElement>('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    playPostButtonSound(button);
  };
  document.addEventListener("keydown", keydownListener, true);
  context.addDisposable(() => document.removeEventListener("keydown", keydownListener, true));
}

function setupHomeLogoReplacement(context: MilxdyContentAppContext): void {
  let frameId: number | null = null;
  let observedPageChromeRoot: Element | null = null;
  let observedHeaderResizeTarget: HTMLElement | null = null;
  let observedHomeLinkResizeTarget: HTMLElement | null = null;
  const replace = () => {
    replaceHomeLogo();
    observePageChromeRoot();
    observeHeaderResize();
  };
  const scheduleReplaceFrame = () => {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      if (!context.signal.aborted) replace();
    });
  };
  const retryCancels = new Set<() => void>();
  const scheduleReplace = (delayMs: number) => {
    let cancel: (() => void) | null = null;
    cancel = context.scheduler.timeout(() => {
      if (cancel) retryCancels.delete(cancel);
      if (!context.signal.aborted) replace();
    }, delayMs);
    retryCancels.add(cancel);
  };
  const scheduleBootRetries = () => {
    for (const delayMs of [120, 500, 1500, 3200, 7000]) scheduleReplace(delayMs);
  };

  const refresh = () => {
    replace();
    scheduleBootRetries();
  };
  refreshHomeLogo = refresh;
  window.addEventListener("resize", scheduleReplaceFrame, { passive: true });
  const themeObserver = new MutationObserver(scheduleReplaceFrame);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-color-mode", "data-theme", "data-milxdy-x-theme"] });
  if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-color-mode", "data-theme"] });
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleReplaceFrame)
    : null;
  const observeHeaderResize = () => {
    const header = document.querySelector<HTMLElement>('header[role="banner"]');
    const homeLink = document.querySelector<HTMLElement>(HOME_LOGO_LINK_SELECTOR);
    if (header !== observedHeaderResizeTarget) {
      if (observedHeaderResizeTarget) resizeObserver?.unobserve(observedHeaderResizeTarget);
      if (header) resizeObserver?.observe(header);
      observedHeaderResizeTarget = header;
    }
    if (homeLink !== observedHomeLinkResizeTarget) {
      if (observedHomeLinkResizeTarget) resizeObserver?.unobserve(observedHomeLinkResizeTarget);
      if (homeLink) resizeObserver?.observe(homeLink);
      observedHomeLinkResizeTarget = homeLink;
    }
  };
  const pageChromeObserver = new MutationObserver((mutations) => {
    if (!mutations.some(mutationMayAffectHomeLogoLayout)) return;
    observeHeaderResize();
    scheduleReplaceFrame();
  });
  const observePageChromeRoot = () => {
    const target = homeLogoPageChromeRoot();
    if (target === observedPageChromeRoot) return;
    pageChromeObserver.disconnect();
    observedPageChromeRoot = target;
    if (!target) return;
    pageChromeObserver.observe(target, {
      attributes: true,
      attributeFilter: ["aria-current", "aria-label", "class", "href", "role"],
      childList: true,
      subtree: true,
    });
  };
  refresh();
  context.addDisposable(() => {
    for (const cancel of Array.from(retryCancels)) cancel();
    retryCancels.clear();
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
    window.removeEventListener("resize", scheduleReplaceFrame);
    themeObserver.disconnect();
    pageChromeObserver.disconnect();
    resizeObserver?.disconnect();
    if (refreshHomeLogo === refresh) refreshHomeLogo = null;
  });
}

function homeLogoPageChromeRoot(): Element | null {
  const homeLink = document.querySelector<HTMLAnchorElement>(HOME_LOGO_LINK_SELECTOR);
  return homeLink?.closest(HOME_LOGO_PAGE_CHROME_SELECTOR)
    || document.querySelector(HOME_LOGO_PAGE_CHROME_SELECTOR);
}

function mutationMayAffectHomeLogoLayout(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof Element ? mutation.target : null;
  if (target && elementMayAffectHomeLogoLayout(target)) return true;
  for (const node of Array.from(mutation.addedNodes)) {
    if (node instanceof Element && elementMayAffectHomeLogoLayout(node)) return true;
  }
  for (const node of Array.from(mutation.removedNodes)) {
    if (node instanceof Element && elementMayAffectHomeLogoLayout(node)) return true;
  }
  return false;
}

function elementMayAffectHomeLogoLayout(element: Element): boolean {
  if (element.matches(`${HOME_LOGO_PAGE_CHROME_SELECTOR}, ${HOME_LOGO_LINK_SELECTOR}, nav, nav a, [data-testid^="AppTabBar_"]`)) return true;
  return Boolean(element.closest('header[role="banner"], h1'));
}

function replaceHomeLogo(): void {
  const homeLink = document.querySelector<HTMLAnchorElement>(HOME_LOGO_LINK_SELECTOR);
  if (!homeLink) return;

  removeLegacyMaxxerLogoArtifacts(homeLink);

  homeLink.style.overflow = "visible";
  let parent = homeLink.parentElement;
  for (let i = 0; i < 4 && parent; i += 1) {
    parent.style.overflow = "visible";
    parent = parent.parentElement;
  }

  let wrapper = homeLink.querySelector<HTMLElement>("[data-milxdy-home-logo-wrapper='true']");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.dataset.milxdyHomeLogoWrapper = "true";
    wrapper.style.cssText = `
      position: relative;
      display: inline-block;
      z-index: 10000;
    `;
    homeLink.prepend(wrapper);
  }

  let background = wrapper.querySelector<HTMLElement>(`.${HOME_LOGO_BACKGROUND_CLASS}`);
  if (!background) {
    background = document.createElement("span");
    background.className = HOME_LOGO_BACKGROUND_CLASS;
    background.setAttribute("aria-hidden", "true");
    wrapper.prepend(background);
  }

  let foreground = wrapper.querySelector<HTMLImageElement>(`.${HOME_LOGO_REPLACEMENT_CLASS}`);
  if (!foreground) {
    foreground = document.createElement("img");
    foreground.className = HOME_LOGO_REPLACEMENT_CLASS;
    foreground.alt = "milXdy";
    wrapper.appendChild(foreground);
  }

  updateHomeLogoVariant(homeLink, wrapper, background, foreground);
  Array.from(homeLink.children).forEach((child) => {
    if (child !== wrapper) (child as HTMLElement).style.display = "none";
  });
}

function removeLegacyMaxxerLogoArtifacts(homeLink: HTMLAnchorElement): void {
  for (const child of Array.from(homeLink.children)) {
    const element = child as HTMLElement;
    if (element.dataset.milxdyHomeLogoWrapper === "true") continue;
    if (element.querySelector(`img.${HOME_LOGO_REPLACEMENT_CLASS}:not([data-milxdy-home-logo-variant])`)) {
      element.remove();
    }
  }
}

function updateHomeLogoVariant(homeLink: HTMLAnchorElement, wrapper: HTMLElement, background: HTMLElement, foreground: HTMLImageElement): void {
  const fullNavigation = homeLinkHasVisibleNavigationLabels(homeLink);
  const variant = fullNavigation ? "wide" : "square";
  const foregroundSrc = chrome.runtime.getURL(fullNavigation ? "brand/milxdy-home-logo-wide-fg.png" : "brand/milxdy-home-logo-fg.png");
  const backgroundMaskSrc = chrome.runtime.getURL(fullNavigation ? "brand/milxdy-home-logo-wide-bg-mask.png" : "brand/milxdy-home-logo-bg-mask.png");
  if (foreground.src !== foregroundSrc) foreground.src = foregroundSrc;
  foreground.dataset.milxdyHomeLogoVariant = variant;
  wrapper.dataset.milxdyHomeLogoVariant = variant;
  homeLink.style.display = "inline-flex";
  homeLink.style.alignItems = "center";
  homeLink.style.justifyContent = fullNavigation ? "flex-start" : "center";
  homeLink.style.minWidth = fullNavigation ? "230px" : "46px";
  homeLink.style.minHeight = fullNavigation ? "62px" : "46px";
  homeLink.style.backgroundColor = "transparent";
  wrapper.style.cssText = `
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    z-index: 10000;
    border-radius: 6px;
    transition: none;
    overflow: hidden;
  `;
  wrapper.style.width = fullNavigation ? "220px" : "38px";
  wrapper.style.height = fullNavigation ? "54px" : "38px";
  wrapper.style.transform = fullNavigation ? "translate(0, 1px)" : "translate(1px, 1px)";

  background.style.cssText = `
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    background: ${resolveHomeLogoAccentColor()};
    -webkit-mask-image: url("${backgroundMaskSrc}");
    mask-image: url("${backgroundMaskSrc}");
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    pointer-events: none;
  `;
  foreground.style.cssText = fullNavigation
    ? `
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      image-rendering: auto;
      transition: none;
      cursor: pointer;
    `
    : `
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      image-rendering: auto;
      transition: none;
      cursor: pointer;
    `;
}

function homeLinkHasVisibleNavigationLabels(homeLink: HTMLAnchorElement): boolean {
  const header = homeLink.closest<HTMLElement>('header[role="banner"]');
  if (!header) return false;
  const navText = Array.from(header.querySelectorAll<HTMLElement>('nav a span, [data-testid^="AppTabBar_"] span'))
    .some((span) => {
      const text = (span.textContent || "").trim();
      if (!/^(Home|Explore|Notifications|Messages|Grok|Premium|Profile|More)$/i.test(text)) return false;
      const rect = span.getBoundingClientRect();
      const style = window.getComputedStyle(span);
      return rect.width > 20 && rect.height > 8 && style.display !== "none" && style.visibility !== "hidden";
    });
  return navText;
}

function resolveHomeLogoAccentColor(): string {
  if (document.documentElement.dataset.milxdyReskinProfile !== "max") return "#1d9bf0";
  const storedColor = detectStoredXAccentColor();
  if (storedColor) return storedColor;
  const sampledColor = sampleXAccentColor();
  if (sampledColor) return sampledColor;
  switch (visualTheme.tweetPngBorderPalette) {
    case "green":
      return "#3f6f16";
    case "blue":
      return "#1d9bf0";
    case "purple":
      return "#7856ff";
    case "gray":
    default:
      return "#3f6f16";
  }
}

function detectStoredXAccentColor(): string | null {
  const directKeys = ["color", "accentColor", "accent_color", "themeColor", "twitterAccentColor"];
  for (const key of directKeys) {
    const color = normalizeXAccentColor(localStorage.getItem(key));
    if (color) return color;
  }
  const settings = parseJsonObject(localStorage.getItem("rweb.settings"));
  if (!settings) return null;
  for (const key of directKeys) {
    const color = normalizeXAccentColor(settings[key]);
    if (color) return color;
  }
  return null;
}

function normalizeXAccentColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(normalized) || /^rgba?\(/i.test(normalized)) return normalized;
  switch (normalized.replace(/[^a-z]/g, "")) {
    case "blue":
      return "#1d9bf0";
    case "yellow":
      return "#ffd400";
    case "pink":
      return "#f91880";
    case "purple":
      return "#7856ff";
    case "orange":
      return "#ff7a00";
    case "green":
      return "#00ba7c";
    default:
      return null;
  }
}

function sampleXAccentColor(): string | null {
  const selectors = [
    'header[role="banner"] nav a[aria-current="page"]',
    'header[role="banner"] [data-testid^="AppTabBar_"][aria-current="page"]',
    'header[role="banner"] [data-testid="SideNav_NewTweet_Button"]',
    '[data-testid="primaryColumn"] [role="tab"][aria-selected="true"]',
  ];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    const color = element ? firstUsableAccentColor(element) : null;
    if (color) return color;
  }
  const header = document.querySelector<HTMLElement>('header[role="banner"]');
  return header ? firstUsableAccentColor(header) : null;
}

function firstUsableAccentColor(root: HTMLElement): string | null {
  const candidates: Element[] = [root, ...Array.from(root.querySelectorAll("svg, path, span, div"))].slice(0, 80);
  for (const candidate of candidates) {
    const style = getComputedStyle(candidate);
    for (const value of [style.color, style.fill, style.stroke, style.backgroundColor, style.borderColor]) {
      if (isUsableAccentColor(value)) return value;
    }
  }
  return null;
}

function isUsableAccentColor(value: string | null | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "transparent" || normalized === "currentcolor" || normalized === "none") return false;
  const match = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (!match) return /^#[0-9a-f]{3,8}$/i.test(normalized);
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (alpha < 0.25) return false;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max - min < 28) return false;
  if (red < 35 && green < 35 && blue < 35) return false;
  if (red > 220 && green > 220 && blue > 220) return false;
  return true;
}

function injectHomeLogoStyles(): void {
  if (document.getElementById("milxdy-home-logo-styles")) return;
  const style = document.createElement("style");
  style.id = "milxdy-home-logo-styles";
  style.textContent = `
    h1 a[href="/home"]:has(.${HOME_LOGO_REPLACEMENT_CLASS}),
    h1 a[aria-label="X"][role="link"]:has(.${HOME_LOGO_REPLACEMENT_CLASS}) {
      background-color: transparent !important;
      box-shadow: none !important;
      transition: none !important;
    }

    h1 a[href="/home"]:has(.${HOME_LOGO_REPLACEMENT_CLASS}):hover,
    h1 a[aria-label="X"][role="link"]:has(.${HOME_LOGO_REPLACEMENT_CLASS}):hover {
      background-color: transparent !important;
      box-shadow: none !important;
    }

    .${HOME_LOGO_REPLACEMENT_CLASS} {
      filter: none !important;
      transform: none !important;
    }

    .${HOME_LOGO_BACKGROUND_CLASS} {
      filter: saturate(0.85) brightness(1.08);
    }
  `;
  document.documentElement.appendChild(style);
}

function setupShowNewPostsMarkers(context: MilxdyContentAppContext): void {
  let cancelNextScan: (() => void) | null = null;
  const scan = () => {
    if (!visualTheme.newPostsPill || document.visibilityState !== "visible") return;
    const main = document.querySelector<HTMLElement>('main[role="main"], main');
    if (!main) return;
    let scanned = 0;
    for (const button of main.querySelectorAll<HTMLElement>('[role="button"], button')) {
      markShowNewPostsButton(button);
      scanned += 1;
      if (scanned >= SHOW_NEW_POST_SCAN_LIMIT) break;
    }
  };
  const scheduleNextScan = () => {
    cancelNextScan = context.scheduler.timeout(() => {
      cancelNextScan = null;
      if (context.signal.aborted) return;
      scan();
      scheduleNextScan();
    }, SHOW_NEW_POST_SCAN_INTERVAL_MS);
  };
  scan();
  scheduleNextScan();
  context.addDisposable(() => {
    cancelNextScan?.();
    cancelNextScan = null;
  });
}

function markShowNewPostsButton(button: HTMLElement): void {
  if (!button.isConnected) return;
  const isShowNewPosts = SHOW_NEW_POSTS_RE.test(button.textContent || "");
  if (isShowNewPosts) button.dataset.milxdyShowNewPosts = "true";
  else if (button.dataset.milxdyShowNewPosts === "true") delete button.dataset.milxdyShowNewPosts;
}

function setupNotificationUnreadMarkers(context: MilxdyContentAppContext): void {
  const pending = new Set<HTMLElement>();
  let frameId = 0;
  const flush = () => {
    frameId = 0;
    if (context.signal.aborted) return;
    const notifications = Array.from(pending);
    pending.clear();
    for (const notification of notifications) markNotificationUnread(notification);
  };
  const queueNotification = (notification: HTMLElement) => {
    pending.add(notification);
    if (!frameId) frameId = window.requestAnimationFrame(flush);
  };

  const notificationClickListener = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const notification = target?.closest<HTMLElement>('article[data-testid="notification"]');
    if (!notification) return;
    clickedNotificationKeys.set(notification, notificationReadKey(notification));
    notification.dataset.milxdyNotificationUnread = "false";
    notification.dataset.milxdyNotificationUnreadSource = "clicked";
    const cell = notification.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
    if (cell) cell.dataset.milxdyNotificationUnread = "false";
    if (cell) cell.dataset.milxdyNotificationUnreadSource = "clicked";
  };
  addRootVisualClickHandler(context, notificationClickListener);

  for (const notification of document.querySelectorAll<HTMLElement>('article[data-testid="notification"]')) {
    queueNotification(notification);
  }

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element ? mutation.target : null;
      if (mutation.type !== "childList") continue;
      const notification = target?.closest<HTMLElement>('article[data-testid="notification"]');
      if (notification) queueNotification(notification);
      for (const addedNode of mutation.addedNodes) {
        if (!(addedNode instanceof HTMLElement)) continue;
        const addedNotification = addedNode.matches('article[data-testid="notification"]')
          ? addedNode
          : addedNode.querySelector<HTMLElement>('article[data-testid="notification"]');
        if (addedNotification) queueNotification(addedNotification);
      }
    }
  });
  mutationObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  queueNotificationSurface = queueNotification;
  context.addDisposable(() => {
    mutationObserver.disconnect();
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    pending.clear();
    if (queueNotificationSurface === queueNotification) queueNotificationSurface = null;
  });
}

function markNotificationUnread(notification: HTMLElement): void {
  if (!notification.isConnected) return;
  const cell = notification.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  const unreadSource = getUnreadNotificationSource(notification, cell);
  const unread = Boolean(unreadSource);
  if (unread) clickedNotificationKeys.delete(notification);
  const state = unread ? "true" : "false";
  const source = unreadSource || "none";
  notification.dataset.milxdyNotificationUnread = state;
  notification.dataset.milxdyNotificationUnreadSource = source;
  if (cell) cell.dataset.milxdyNotificationUnread = state;
  if (cell) cell.dataset.milxdyNotificationUnreadSource = source;
}

function getUnreadNotificationSource(notification: HTMLElement, cell: HTMLElement | null): string | null {
  if (clickedNotificationKeys.get(notification) === notificationReadKey(notification)) return null;

  const labelText = [
    notification.getAttribute("aria-label"),
    cell?.getAttribute("aria-label"),
    notification.querySelector<HTMLElement>('[aria-label*="Unread"], [aria-label*="unread"], [aria-label*="New"], [aria-label*="new"]')?.getAttribute("aria-label"),
  ].filter(Boolean).join(" ");
  if (/\b(unread|new notification|new notifications)\b/i.test(labelText)) return "aria";

  const markerSource = getUnreadMarkerSource(notification, cell);
  if (markerSource) return markerSource;

  return withNotificationTintMarkersDisabled(notification, cell, () => getNativeUnreadBackgroundSource(notification, cell));
}

function getNativeUnreadBackgroundSource(notification: HTMLElement, cell: HTMLElement | null): string | null {
  const candidates = [
    cell,
    cell?.firstElementChild,
    notification,
    notification.parentElement,
  ].filter((element): element is Element => Boolean(element));
  for (const element of candidates) {
    if (element instanceof HTMLElement && isTwitterUnreadBackground(element.style.backgroundColor)) return "inline-style";
    const styleBackground = element.getAttribute("style")?.match(/background-color:\s*([^;]+)/i)?.[1];
    if (styleBackground && isTwitterUnreadBackground(styleBackground)) return "style-attribute";
    if (element instanceof HTMLElement && isTwitterUnreadBackground(window.getComputedStyle(element).backgroundColor)) return "computed-style";
  }
  return null;
}

function withNotificationTintMarkersDisabled<T>(
  notification: HTMLElement,
  cell: HTMLElement | null,
  callback: () => T,
): T {
  const notificationUnread = notification.getAttribute("data-milxdy-notification-unread");
  const cellUnread = cell?.getAttribute("data-milxdy-notification-unread") ?? null;
  const root = document.documentElement;
  const reskinProfile = root.getAttribute("data-milxdy-reskin-profile");
  notification.removeAttribute("data-milxdy-notification-unread");
  if (cell) cell.removeAttribute("data-milxdy-notification-unread");
  root.removeAttribute("data-milxdy-reskin-profile");
  try {
    return callback();
  } finally {
    restoreAttribute(notification, "data-milxdy-notification-unread", notificationUnread);
    if (cell) restoreAttribute(cell, "data-milxdy-notification-unread", cellUnread);
    restoreAttribute(root, "data-milxdy-reskin-profile", reskinProfile);
  }
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function setupOrphanReplyMarkers(context: MilxdyContentAppContext): void {
  injectOrphanReplyStyles();
  const pending = new Set<HTMLElement>();
  let frameId = 0;
  const flush = () => {
    frameId = 0;
    if (context.signal.aborted) return;
    const tweets = Array.from(pending);
    pending.clear();
    for (const tweet of tweets) markOrphanReply(tweet);
  };
  queueTweetSurface = (tweet: HTMLElement) => {
    pending.add(tweet);
    if (frameId) return;
    frameId = window.requestAnimationFrame(flush);
  };
  for (const tweet of document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')) queueTweetSurface(tweet);
  context.addDisposable(() => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    pending.clear();
    queueTweetSurface = null;
  });
}

function markOrphanReply(tweet: HTMLElement): void {
  if (!tweet.isConnected) return;
  const hasReplyContext = REPLY_CONTEXT_RE.test(tweet.textContent || "");
  if (!hasReplyContext) {
    setOrphanReplyState(tweet, false);
    return;
  }
  setOrphanReplyState(tweet, !tweet.querySelector(NATIVE_REPLY_CONNECTOR_SELECTOR));
}

function setOrphanReplyState(tweet: HTMLElement, orphan: boolean): void {
  const value = String(orphan);
  if (tweet.dataset.milxdyOrphanReply !== value) tweet.dataset.milxdyOrphanReply = value;
}

function injectOrphanReplyStyles(): void {
  if (document.getElementById("milxdy-orphan-reply-styles")) return;
  const style = document.createElement("style");
  style.id = "milxdy-orphan-reply-styles";
  style.textContent = `
    article[data-testid="tweet"][data-milxdy-orphan-reply="true"] {
      position: relative;
    }
    article[data-testid="tweet"][data-milxdy-orphan-reply="true"]::before {
      content: "";
      position: absolute;
      left: 38px;
      top: 0;
      width: 2px;
      height: 18px;
      background: rgba(83, 100, 113, 0.58);
      pointer-events: none;
      z-index: 1;
    }
    html[data-milxdy-x-theme="dark"] article[data-testid="tweet"][data-milxdy-orphan-reply="true"]::before,
    html[data-milxdy-x-theme="dim"] article[data-testid="tweet"][data-milxdy-orphan-reply="true"]::before {
      background: rgba(139, 152, 165, 0.62);
    }
  `;
  document.head.append(style);
}

function notificationReadKey(notification: HTMLElement): string {
  const statusHref = Array.from(notification.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .map((anchor) => anchor.href)
    .find(Boolean);
  if (statusHref) return statusHref;
  return (notification.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function getUnreadMarkerSource(notification: HTMLElement, cell: HTMLElement | null): string | null {
  const root = cell || notification;
  const marker = Array.from(root.querySelectorAll<HTMLElement>('[data-testid], [aria-label], [role="status"]'))
    .find((element) => {
      const label = `${element.getAttribute("data-testid") || ""} ${element.getAttribute("aria-label") || ""}`.toLowerCase();
      if (/\b(read|mark as read|settings|more)\b/.test(label)) return false;
      return /\b(unread|new notification|new notifications)\b/.test(label);
    });
  if (marker) return "marker-label";

  const statusText = Array.from(root.querySelectorAll<HTMLElement>('[role="status"], [aria-live]'))
    .map((element) => element.textContent || "")
    .join(" ");
  return /\b(unread|new notification|new notifications)\b/i.test(statusText) ? "status-text" : null;
}

export function isTwitterUnreadBackground(value: string): boolean {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (!match) return false;
  const [, redText, greenText, blueText, alphaText] = match;
  const red = Number(redText);
  const green = Number(greenText);
  const blue = Number(blueText);
  const alpha = alphaText === undefined ? 1 : Number(alphaText);
  if (alpha < 0.04) return false;
  if (red < 4 && green < 4 && blue < 4) return false;
  const lightBlueWash = blue >= green && green >= red && blue - red >= 8 && red > 210;
  const darkBlueWash = blue >= green && green >= red && blue - red >= 16 && blue - green >= 6 && blue < 96;
  const twitterBlueAlpha = blue > red + 24 && green > red + 16;
  return lightBlueWash || darkBlueWash || twitterBlueAlpha;
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
