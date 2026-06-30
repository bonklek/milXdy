import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type VisualThemeSettings,
} from "../../shared/reskinProfile";
import type { MilxdyContentAppContext } from "../../shared/appPlatform";
import { parseJsonObject } from "../../shared/json";

let postSoundContext: AudioContext | null = null;
let visualTheme: VisualThemeSettings = DEFAULT_VISUAL_THEME;
const xUnreadNotifications = new WeakSet<HTMLElement>();
const clickedNotificationKeys = new WeakMap<HTMLElement, string>();
const SHOW_NEW_POSTS_RE = /show\s+\d+\s+posts?/i;
const HOME_LOGO_REPLACEMENT_CLASS = "milady-logo-replacement";
const HOME_LOGO_BACKGROUND_CLASS = "milxdy-home-logo-background";
let booted = false;
let loadUserActionApp: MilxdyContentAppContext["loadAppById"] = async () => null;
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

export async function boot(context: MilxdyContentAppContext): Promise<void> {
  if (booted) return;
  booted = true;
  loadUserActionApp = context.loadAppById;
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
  setupHomeLogoReplacement(context);
  setupShowNewPostsMarkers();
  setupTweetPngShareActions(context);
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

export function disable(): void {
  document.querySelector("#milxdy-tweet-png-modal")?.remove();
}

export function dispose(): void {
  disable();
  postSoundContext?.close?.().catch(() => undefined);
  postSoundContext = null;
  loadUserActionApp = async () => null;
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
  const clickListener = (event: MouseEvent) => {
    if (document.documentElement.dataset.milxdyReskinProfile !== "max") return;
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
    if (document.documentElement.dataset.milxdyVisualPostSound === "false") return;
    const button = target?.closest<HTMLElement>('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    playPostButtonSound(button);
  };
  addRootVisualClickHandler(context, clickListener);

  const keydownListener = (event: KeyboardEvent) => {
    if (document.documentElement.dataset.milxdyReskinProfile !== "max") return;
    if (document.documentElement.dataset.milxdyVisualPostSound === "false") return;
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
  const replace = () => replaceHomeLogo();
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
    for (const delayMs of [120, 500, 1500, 3200]) scheduleReplace(delayMs);
  };

  replace();
  scheduleBootRetries();
  const refresh = () => {
    replace();
    scheduleBootRetries();
  };
  refreshHomeLogo = refresh;
  window.addEventListener("resize", scheduleReplaceFrame, { passive: true });
  const themeObserver = new MutationObserver(scheduleReplaceFrame);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-color-mode", "data-theme", "data-milxdy-x-theme"] });
  if (document.body) themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-color-mode", "data-theme"] });
  const observeHeaderResize = () => {
    const header = document.querySelector<HTMLElement>('header[role="banner"]');
    const homeLink = document.querySelector<HTMLElement>('h1 a[href="/home"], h1 a[aria-label="X"][role="link"]');
    if (header) resizeObserver?.observe(header);
    if (homeLink) resizeObserver?.observe(homeLink);
  };
  const navigationObserver = new MutationObserver((mutations) => {
    if (!mutations.some(mutationMayAffectHomeLogoLayout)) return;
    observeHeaderResize();
    scheduleReplaceFrame();
  });
  navigationObserver.observe(document.body || document.documentElement, {
    attributes: true,
    attributeFilter: ["aria-current", "aria-label", "class", "href", "role"],
    childList: true,
    subtree: true,
  });
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleReplaceFrame)
    : null;
  observeHeaderResize();
  context.addDisposable(() => {
    for (const cancel of Array.from(retryCancels)) cancel();
    retryCancels.clear();
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
    window.removeEventListener("resize", scheduleReplaceFrame);
    themeObserver.disconnect();
    navigationObserver.disconnect();
    resizeObserver?.disconnect();
    if (refreshHomeLogo === refresh) refreshHomeLogo = null;
  });
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
  if (element.matches('header[role="banner"], h1, h1 a[href="/home"], h1 a[aria-label="X"][role="link"], nav, nav a, [data-testid^="AppTabBar_"]')) return true;
  return Boolean(element.closest('header[role="banner"], h1'));
}

function replaceHomeLogo(): void {
  const homeLink = document.querySelector<HTMLAnchorElement>('h1 a[href="/home"], h1 a[aria-label="X"][role="link"]');
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
    border-radius: 0;
    transition: none;
    overflow: visible;
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

function setupShowNewPostsMarkers(): void {
  for (const button of document.querySelectorAll<HTMLElement>('[role="button"], button')) {
    markShowNewPostsButton(button);
  }
}

function markShowNewPostsButton(button: HTMLElement): void {
  if (!button.isConnected) return;
  const isShowNewPosts = SHOW_NEW_POSTS_RE.test(button.textContent || "");
  if (isShowNewPosts) button.dataset.milxdyShowNewPosts = "true";
  else if (button.dataset.milxdyShowNewPosts === "true") delete button.dataset.milxdyShowNewPosts;
}

function setupTweetPngShareActions(context: MilxdyContentAppContext): void {
  injectTweetPngStyles();
  let pendingShareTweet: { tweet: HTMLElement; statusUrl: string | null } | null = null;
  let menuObserver: MutationObserver | null = null;
  let cancelMenuObserverTimer: (() => void) | null = null;
  const cancelTimers = new Set<() => void>();

  const cancelPendingTimers = () => {
    for (const cancel of Array.from(cancelTimers)) cancel();
    cancelTimers.clear();
  };

  const scheduleTimeout = (callback: () => void, delayMs: number): void => {
    let cancel: (() => void) | null = null;
    cancel = context.scheduler.timeout(() => {
      if (cancel) cancelTimers.delete(cancel);
      if (!context.signal.aborted) callback();
    }, delayMs);
    cancelTimers.add(cancel);
  };

  const stopMenuObserver = () => {
    menuObserver?.disconnect();
    menuObserver = null;
    cancelMenuObserverTimer?.();
    cancelMenuObserverTimer = null;
  };

  const observeShareMenuBriefly = () => {
    stopMenuObserver();
    menuObserver = new MutationObserver(() => {
      if (pendingShareTweet && injectTweetPngShareMenuItem(pendingShareTweet, context, scheduleTimeout)) stopMenuObserver();
    });
    menuObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    cancelMenuObserverTimer = context.scheduler.timeout(stopMenuObserver, 1200);
  };

  const tweetPngClickListener = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const share = target?.closest<HTMLElement>('[data-testid="share"], [aria-label*="Share"], [aria-label*="share"]');
    if (!share || share.closest('[data-testid="quoteTweet"]')) return;
    const tweet = share.closest<HTMLElement>('article[data-testid="tweet"]');
    if (!tweet) return;
    pendingShareTweet = { tweet, statusUrl: findStatusUrl(tweet) };
    observeShareMenuBriefly();
    scheduleTimeout(() => {
      if (injectTweetPngShareMenuItem(pendingShareTweet, context, scheduleTimeout)) stopMenuObserver();
    }, 80);
  };
  addRootVisualClickHandler(context, tweetPngClickListener);
  context.addDisposable(cancelPendingTimers);
  context.addDisposable(stopMenuObserver);
}

function injectTweetPngShareMenuItem(
  shareContext: { tweet: HTMLElement; statusUrl: string | null } | null,
  runtimeContext: MilxdyContentAppContext,
  scheduleTimeout: (callback: () => void, delayMs: number) => void,
): boolean {
  if (runtimeContext.signal.aborted || !shareContext?.tweet.isConnected) return false;
  const menu = Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]'))
    .find((candidate) => candidate.offsetParent !== null && !candidate.querySelector('[data-milxdy-tweet-png-menu-item="true"]'));
  if (!menu) return false;
  const reference = menu.querySelector<HTMLElement>('[role="menuitem"]');
  if (!reference?.parentElement) return false;
  const item = reference.cloneNode(true) as HTMLElement;
  item.dataset.milxdyTweetPngMenuItem = "true";
  item.setAttribute("role", "menuitem");
  item.setAttribute("tabindex", "0");
  setTweetPngMenuItemState(item, "Copy tweet as PNG");
  item.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.dataset.milxdyTweetPngBusy === "true") return;
    item.dataset.milxdyTweetPngBusy = "true";
    setTweetPngMenuItemState(item, "Copying...");
    try {
      await copyTweetPngFromTweet(shareContext.tweet, shareContext.statusUrl);
      setTweetPngMenuItemState(item, "Copied PNG");
    } catch {
      setTweetPngMenuItemState(item, "Copy failed");
    } finally {
      const reset = () => {
        if (runtimeContext.signal.aborted) return;
        delete item.dataset.milxdyTweetPngBusy;
        if (item.isConnected) setTweetPngMenuItemState(item, "Copy tweet as PNG");
      };
      scheduleTimeout(reset, 1400);
    }
  });
  reference.parentElement.insertBefore(item, reference);
  return true;
}

function setTweetPngMenuItemState(item: HTMLElement, label: string): void {
  item.replaceChildren(tweetPngMenuIcon(), document.createTextNode(label));
}

function tweetPngMenuIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "milxdy-tweet-png-menu-icon");
  svg.innerHTML = `
    <path d="M5 3.75h14A1.25 1.25 0 0 1 20.25 5v14A1.25 1.25 0 0 1 19 20.25H5A1.25 1.25 0 0 1 3.75 19V5A1.25 1.25 0 0 1 5 3.75Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M6.75 16.75 10.2 13.3a1 1 0 0 1 1.42 0l1.13 1.13 2.23-2.23a1 1 0 0 1 1.42 0l.85.85" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
    <circle cx="8.4" cy="8.4" r="1.35" fill="currentColor"/>
  `;
  return svg;
}

async function copyTweetPngFromTweet(tweet: HTMLElement, statusUrl: string | null): Promise<void> {
  const module = await loadUserActionApp("tweetPng", "userAction:tweetPngShare");
  await (module as { copyTweetPngFromTweet: (tweet: HTMLElement, statusUrl: string | null) => Promise<void> }).copyTweetPngFromTweet(tweet, statusUrl);
}

function findStatusUrl(tweet: HTMLElement): string | null {
  const link = Array.from(tweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .find((anchor) => !anchor.closest('[data-testid="quoteTweet"]'));
  return link?.href || null;
}

function injectTweetPngStyles(): void {
  if (document.getElementById("milxdy-tweet-png-styles")) return;
  const style = document.createElement("style");
  style.id = "milxdy-tweet-png-styles";
  style.textContent = `
    [data-milxdy-tweet-png-menu-item="true"] {
      align-items: center !important;
      display: flex !important;
      gap: 12px !important;
      transition: background-color 120ms ease, color 120ms ease, transform 80ms ease !important;
    }
    [data-milxdy-tweet-png-menu-item="true"]:hover,
    [data-milxdy-tweet-png-menu-item="true"]:focus-visible {
      background: rgba(15, 20, 25, 0.1) !important;
      color: inherit !important;
    }
    [data-milxdy-tweet-png-menu-item="true"]:active,
    [data-milxdy-tweet-png-menu-item="true"][data-milxdy-tweet-png-busy="true"] {
      background: rgba(15, 20, 25, 0.16) !important;
      color: inherit !important;
      transform: translateY(1px) !important;
    }
    .milxdy-tweet-png-menu-icon {
      flex: 0 0 auto;
      height: 20px;
      width: 20px;
    }
  `;
  document.documentElement.appendChild(style);
}

function setupNotificationUnreadMarkers(context: MilxdyContentAppContext): void {
  const pending = new Set<HTMLElement>();
  let rafId = 0;
  const flush = () => {
    rafId = 0;
    if (context.signal.aborted) return;
    const notifications = Array.from(pending);
    pending.clear();
    for (const queued of notifications) markNotificationUnread(queued);
  };
  const queueNotification = (notification: HTMLElement) => {
    pending.add(notification);
    if (rafId) return;
    rafId = window.requestAnimationFrame(flush);
  };

  const notificationClickListener = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const notification = target?.closest<HTMLElement>('article[data-testid="notification"]');
    if (!notification) return;
    xUnreadNotifications.delete(notification);
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

  queueNotificationSurface = queueNotification;
  context.addDisposable(() => {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    pending.clear();
    if (queueNotificationSurface === queueNotification) queueNotificationSurface = null;
  });
}

function markNotificationUnread(notification: HTMLElement): void {
  if (!notification.isConnected) return;
  const cell = notification.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  const unreadSource = getUnreadNotificationSource(notification, cell);
  const unread = Boolean(unreadSource);
  if (unread && unreadSource !== "previous-x-unread") xUnreadNotifications.add(notification);
  if (unread) clickedNotificationKeys.delete(notification);
  notification.dataset.milxdyNotificationUnread = String(unread);
  notification.dataset.milxdyNotificationUnreadSource = unreadSource || "none";
  if (cell) cell.dataset.milxdyNotificationUnread = String(unread);
  if (cell) cell.dataset.milxdyNotificationUnreadSource = unreadSource || "none";
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

  const candidates = [
    cell,
    cell?.firstElementChild,
    notification,
    notification.parentElement,
    ...Array.from((cell || notification).querySelectorAll<HTMLElement>("div, article")).slice(0, 24),
  ].filter((element): element is Element => Boolean(element));
  for (const element of candidates) {
    if (element instanceof HTMLElement && isTwitterUnreadBackground(element.style.backgroundColor)) return "inline-style";
    const styleBackground = element.getAttribute("style")?.match(/background-color:\s*([^;]+)/i)?.[1];
    if (styleBackground && isTwitterUnreadBackground(styleBackground)) return "style-attribute";
    if (element instanceof HTMLElement && isTwitterUnreadBackground(window.getComputedStyle(element).backgroundColor)) return "computed-style";
  }
  if (xUnreadNotifications.has(notification)) return "previous-x-unread";
  return null;
}

function setupOrphanReplyMarkers(context: MilxdyContentAppContext): void {
  injectOrphanReplyStyles();
  const pending = new Set<HTMLElement>();
  let queued = false;
  const flush = () => {
    queued = false;
    const tweets = Array.from(pending);
    pending.clear();
    for (const tweet of tweets) markOrphanReply(tweet);
  };
  queueTweetSurface = (tweet: HTMLElement) => {
    pending.add(tweet);
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(flush);
  };
  for (const tweet of document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')) queueTweetSurface(tweet);
  context.addDisposable(() => {
    pending.clear();
    queueTweetSurface = null;
  });
}

function markOrphanReply(tweet: HTMLElement): void {
  if (!tweet.isConnected) return;
  const hasReplyContext = /\breplying to\b/i.test(tweet.textContent || "");
  const hasNativeConnector = Boolean(tweet.querySelector([
    'div[style*="background-color: rgb(207, 217, 222)"]',
    'div[style*="background-color: rgb(239, 243, 244)"]',
    'div[style*="background-color: rgb(196, 207, 214)"]',
    'div[style*="background-color: rgb(56, 68, 77)"]',
    'div[style*="background-color: rgb(61, 73, 82)"]',
    'div[style*="background-color: rgb(51, 54, 57)"]',
    'div[style*="background-color: rgb(47, 51, 54)"]',
    'div[style*="background-color: rgb(66, 83, 100)"]',
  ].join(", ")));
  tweet.dataset.milxdyOrphanReply = String(hasReplyContext && !hasNativeConnector);
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

function isTwitterUnreadBackground(value: string): boolean {
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
  const darkBlueWash = blue >= green && green >= red && blue - red >= 5 && blue < 96;
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
