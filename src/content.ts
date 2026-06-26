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
import { subscribeTwitterSurfaces } from "./shared/twitterScanner";

type FeatureDefinition = {
  id: FeatureId;
  isEnabled: () => Promise<boolean>;
  script: string;
};

const loaded = new Set<FeatureId>();
let postSoundContext: AudioContext | null = null;
let activeVisualTheme: VisualThemeSettings = DEFAULT_VISUAL_THEME;
const unreadNotifications = new WeakSet<HTMLElement>();
const SHOW_NEW_POSTS_RE = /show\s+\d+\s+posts?/i;

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
  setupTweetHeaderMarkers();
  setupTweetPngShareActions();
}

async function setupReskinProfile(): Promise<void> {
  setupNotificationUnreadMarkers();
  injectReskinStyles();
  setupMaxPostSound();
  setupXThemeDetection();
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
  activeVisualTheme = theme;
  const root = document.documentElement;
  root.dataset.milxdyReskinProfile = theme.profile;
  root.dataset.milxdyVisualBackgroundFade = String(theme.backgroundFade);
  root.dataset.milxdyVisualSquareMedia = String(theme.squareMedia);
  root.dataset.milxdyVisualPfpShape = theme.pfpShape;
  root.dataset.milxdyVisualPfpFeed = String(theme.pfpFeed);
  root.dataset.milxdyVisualPfpNotifications = String(theme.pfpNotifications);
  root.dataset.milxdyVisualPfpChat = String(theme.pfpChat);
  root.dataset.milxdyVisualQuoteMediaGap = String(theme.quoteMediaGap);
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

function setupXThemeDetection(): void {
  let queued = false;
  let lastAppliedTheme: "light" | "dim" | "dark" | null = null;
  const update = () => {
    const root = document.documentElement;
    const theme = detectXTheme(findXBackgroundColor());
    root.dataset.milxdyXTheme = theme;
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
  if (document.body) observer.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ["class"] });
  window.setTimeout(scheduleUpdate, 250);
  window.setTimeout(scheduleUpdate, 1000);
}

function findXBackgroundColor(): string {
  const candidates = [
    document.querySelector<HTMLElement>('[data-testid="primaryColumn"]'),
    document.querySelector<HTMLElement>('main[role="main"]'),
    document.body,
    document.documentElement,
  ];
  for (const element of candidates) {
    if (!element) continue;
    const color = getComputedStyle(element).backgroundColor;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
  }
  return "";
}

function detectXTheme(backgroundColor: string): "light" | "dim" | "dark" {
  const match = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const [, red, green, blue] = match.map(Number);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  if (luminance <= 8) return "dark";
  if (luminance <= 48) return "dim";
  return "light";
}

function applySidebarThemeOverride(theme: "light" | "dim" | "dark", force = false): void {
  const header = document.querySelector<HTMLElement>('header[role="banner"]');
  if (!header) return;
  const dark = theme === "dark" || theme === "dim";
  const color = dark ? "#f4ffe8" : "";
  if (!force && header.dataset.milxdySidebarThemeOverride === theme) return;
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
}

function setupMaxPostSound(): void {
  document.addEventListener("click", (event) => {
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
    playPostSendSound();
  }, true);
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

function setupTweetHeaderMarkers(): void {
  subscribeTwitterSurfaces((surface) => {
    if (surface.kind !== "tweet") return;
    markTweetHeader(surface.element);
  });
}

function markTweetHeader(tweet: HTMLElement): void {
  for (const userName of Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="User-Name"]'))) {
    if (userName.closest('[data-testid="quoteTweet"]')) continue;
    const displayNameLink = findDisplayNameLink(userName);
    if (!displayNameLink) continue;
    const displayRow = displayNameLink.parentElement;
    const metadataRow = findMetadataRow(userName, displayRow);
    userName.dataset.milxdyTweetHeader = "true";
    displayRow?.setAttribute("data-milxdy-display-name-row", "true");
    displayNameLink.setAttribute("data-milxdy-display-name", "true");
    metadataRow?.setAttribute("data-milxdy-metadata-row", "true");
  }
}

function findDisplayNameLink(userName: HTMLElement): HTMLElement | null {
  const links = Array.from(userName.querySelectorAll<HTMLElement>('a[role="link"], a[href^="/"]'));
  return links.find((link) => {
    if (link.querySelector("time")) return false;
    const text = (link.textContent || "").trim();
    return Boolean(text) && !text.startsWith("@");
  }) || null;
}

function findMetadataRow(userName: HTMLElement, displayRow: HTMLElement | null): HTMLElement | null {
  const time = userName.querySelector("time");
  const handle = Array.from(userName.querySelectorAll<HTMLElement>("span")).find((span) => {
    return (span.textContent || "").trim().startsWith("@");
  });
  const candidates = [time, handle].flatMap((element): HTMLElement[] => {
    const rows: HTMLElement[] = [];
    let current = element?.parentElement;
    while (current && current !== userName) {
      if (current.tagName === "DIV") rows.push(current);
      current = current.parentElement;
    }
    return rows;
  });
  return candidates.find((row) => row !== displayRow && !row.contains(displayRow)) || (displayRow?.parentElement ?? null);
}

function setupTweetPngShareActions(): void {
  injectTweetPngStyles();
  let pendingShareTweet: { tweet: HTMLElement; statusUrl: string | null } | null = null;

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const share = target?.closest<HTMLElement>('[data-testid="share"], [aria-label*="Share"], [aria-label*="share"]');
    if (!share || share.closest('[data-testid="quoteTweet"]')) return;
    const tweet = share.closest<HTMLElement>('article[data-testid="tweet"]');
    if (!tweet) return;
    pendingShareTweet = { tweet, statusUrl: findStatusUrl(tweet) };
    window.setTimeout(() => injectTweetPngShareMenuItem(pendingShareTweet), 80);
  }, true);

  const observer = new MutationObserver(() => {
    if (pendingShareTweet) injectTweetPngShareMenuItem(pendingShareTweet);
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
}

function injectTweetPngShareMenuItem(context: { tweet: HTMLElement; statusUrl: string | null } | null): void {
  if (!context?.tweet.isConnected) return;
  const menu = Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]'))
    .find((candidate) => candidate.offsetParent !== null && !candidate.querySelector('[data-milxdy-tweet-png-menu-item="true"]'));
  if (!menu) return;
  const reference = menu.querySelector<HTMLElement>('[role="menuitem"]');
  if (!reference?.parentElement) return;
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
      await copyTweetPngFromTweet(context.tweet, context.statusUrl);
      setTweetPngMenuItemState(item, "Copied PNG");
    } catch {
      setTweetPngMenuItemState(item, "Copy failed");
    } finally {
      window.setTimeout(() => {
        delete item.dataset.milxdyTweetPngBusy;
        if (item.isConnected) setTweetPngMenuItemState(item, "Copy tweet as PNG");
      }, 1400);
    }
  });
  reference.parentElement.insertBefore(item, reference);
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
  const data = extractTweetPngData(tweet, statusUrl);
  if (!data.text && !data.images.length && !data.quote) return;
  const blob = await renderTweetPng(data);
  await copyTweetPng(blob);
}

function findStatusUrl(tweet: HTMLElement): string | null {
  const link = Array.from(tweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .find((anchor) => !anchor.closest('[data-testid="quoteTweet"]'));
  return link?.href || null;
}

async function openTweetPngReview(tweet: HTMLElement, statusUrl: string | null): Promise<void> {
  const data = extractTweetPngData(tweet, statusUrl);
  if (!data.text && !data.images.length && !data.quote) return;
  const blob = await renderTweetPng(data);
  showTweetPngModal(blob, data);
}

type TweetPngData = {
  author: string;
  handle: string;
  text: string;
  statusUrl: string;
  date: string;
  avatarUrl: string;
  images: string[];
  quote: TweetPngQuoteData | null;
  stats: TweetPngStats | null;
};

type TweetPngQuoteData = {
  author: string;
  handle: string;
  text: string;
  images: string[];
};

type TweetPngStats = {
  score: string;
  beetles: string;
};

type TweetPngPalette = {
  border: string;
  mediaBorder: string;
  quoteBorder: string;
  quoteFill: string;
  mediaFill: string;
};

type TweetPngRenderAssets = {
  lotus: HTMLImageElement | null;
};

function extractTweetPngData(tweet: HTMLElement, statusUrl: string | null): TweetPngData {
  const settings = activeVisualTheme;
  const userName = Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="User-Name"]'))
    .find((node) => !node.closest('[data-testid="quoteTweet"]')) || null;
  const author = findDisplayNameLink(userName || tweet)?.textContent?.trim() || "X post";
  const handleText = Array.from(userName?.querySelectorAll<HTMLElement>("span") || [])
    .map((span) => span.textContent?.trim() || "")
    .find((text) => text.startsWith("@")) || "";
  const text = Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    .filter((node) => !node.closest('[data-testid="quoteTweet"]'))
    .map((node) => node.innerText || node.textContent || "")
    .join("\n")
    .trim();
  const avatar = tweet.querySelector<HTMLImageElement>('img[src*="profile_images"]');
  const images = settings.tweetPngIncludeImages
    ? Array.from(tweet.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img'))
      .filter((image) => !image.closest('[data-testid="quoteTweet"]'))
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .slice(0, 4)
    : [];
  const quote = extractTweetPngQuoteData(tweet, statusUrl);
  const stats = settings.tweetPngIncludeStats ? extractTweetPngStats(tweet) : null;
  return {
    author,
    handle: handleText,
    text,
    statusUrl: statusUrl || "",
    date: settings.tweetPngIncludeDate ? extractTweetPngDate(tweet) : "",
    avatarUrl: avatar?.currentSrc || avatar?.src || "",
    images,
    quote,
    stats,
  };
}

function extractTweetPngDate(tweet: HTMLElement): string {
  const time = Array.from(tweet.querySelectorAll<HTMLTimeElement>("time"))
    .find((node) => !node.closest('[data-testid="quoteTweet"]'));
  const label = time?.getAttribute("aria-label")?.trim();
  if (label) return label;
  const dateTime = time?.dateTime;
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return dateTime;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function extractTweetPngStats(tweet: HTMLElement): TweetPngStats | null {
  const badge = Array.from(tweet.querySelectorAll<HTMLElement>('[data-reminet-badge="true"]'))
    .find((node) => !node.closest('[data-testid="quoteTweet"]'));
  if (!badge) return null;
  const score = badge.querySelector<HTMLElement>('[data-reminet-icon="score"] .reminet-label')?.textContent?.trim() || "";
  const beetles = badge.querySelector<HTMLElement>('[data-reminet-icon="beetle"] .reminet-label')?.textContent?.trim() || "";
  if (!score && !beetles) return null;
  return { score, beetles };
}

function extractTweetPngQuoteData(tweet: HTMLElement, statusUrl: string | null): TweetPngQuoteData | null {
  const settings = activeVisualTheme;
  const quote = findTweetPngQuoteElement(tweet, statusUrl);
  if (!quote) return null;
  const userName = quote.querySelector<HTMLElement>('[data-testid="User-Name"]');
  const author = findDisplayNameLink(userName || quote)?.textContent?.trim() || "Quoted post";
  const handle = Array.from(userName?.querySelectorAll<HTMLElement>("span") || [])
    .map((span) => span.textContent?.trim() || "")
    .find((text) => text.startsWith("@")) || "";
  const text = settings.tweetPngIncludeQuoteText
    ? extractTweetPngTextFromQuoteElement(quote)
    : "";
  const images = settings.tweetPngIncludeQuoteImages
    ? Array.from(quote.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img'))
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .slice(0, 4)
    : [];
  if (!text && !images.length) return null;
  return { author, handle, text, images };
}

function extractTweetPngTextFromQuoteElement(quote: HTMLElement): string {
  const explicit = Array.from(quote.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    .map((node) => node.innerText || node.textContent || "")
    .join("\n")
    .trim();
  if (explicit) return explicit;
  return Array.from(quote.querySelectorAll<HTMLElement>('[dir="auto"], [lang]'))
    .filter((node) => !node.closest('[data-testid="User-Name"]') && !node.querySelector("time"))
    .map((node) => node.innerText || node.textContent || "")
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("@"))
    .slice(0, 4)
    .join("\n")
    .trim();
}

function findTweetPngQuoteElement(tweet: HTMLElement, statusUrl: string | null): HTMLElement | null {
  const explicit = tweet.querySelector<HTMLElement>('[data-testid="quoteTweet"]');
  if (explicit) return explicit;
  const normalizedStatus = normalizeTweetStatusHref(statusUrl || "");
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>('a[href*="/status/"], div[role="link"]'));
  return candidates.find((candidate) => {
    const href = candidate instanceof HTMLAnchorElement ? normalizeTweetStatusHref(candidate.href) : "";
    if (href && normalizedStatus && href === normalizedStatus) return false;
    if (candidate.closest('article[data-testid="tweet"]') !== tweet) return false;
    return Boolean(candidate.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"] img'));
  }) || null;
}

function normalizeTweetStatusHref(value: string): string {
  const match = value.match(/\/([^/?#]+)\/status\/(\d+)/);
  return match ? `/${match[1]}/status/${match[2]}` : value;
}

async function renderTweetPng(data: TweetPngData): Promise<Blob> {
  const scale = 2;
  const width = 1200;
  const maxHeight = Math.round(width * 5 / 3);
  const padding = 56;
  const footerHeight = data.date ? 42 : 0;
  const avatarSize = 96;
  const bodyX = padding + avatarSize + 24;
  const bodyWidth = width - bodyX - padding;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const palette = tweetPngPalette(activeVisualTheme.tweetPngBorderPalette);

  context.font = "34px TwitterChirp, Arial, sans-serif";
  const textLines = wrapCanvasText(context, data.text || data.date || data.handle, bodyWidth, 16);
  context.font = "26px TwitterChirp, Arial, sans-serif";
  const quoteTextLines = data.quote?.text ? wrapCanvasText(context, data.quote.text, bodyWidth - 48, 8) : [];
  const mediaImages = await Promise.all(data.images.map(loadImageForCanvas));
  const quoteImages = data.quote ? await Promise.all(data.quote.images.map(loadImageForCanvas)) : [];
  const assets = await loadTweetPngRenderAssets();
  const avatarImage = data.avatarUrl ? await loadImageForCanvas(data.avatarUrl).catch(() => null) : null;
  const mediaHeight = measureTweetPngMediaHeight(mediaImages, bodyWidth, 520);
  const quoteMediaHeight = measureTweetPngMediaHeight(quoteImages, bodyWidth - 48, 300);
  const textHeight = textLines.length * 44;
  const quoteHeight = data.quote
    ? 30 + (quoteTextLines.length ? quoteTextLines.length * 34 + 14 : 0) + (quoteMediaHeight ? quoteMediaHeight + 14 : 0) + 34
    : 0;
  const uncappedHeight = padding * 2 + Math.max(
    avatarSize,
    86 + textHeight + (mediaHeight ? mediaHeight + 28 : 0) + (quoteHeight ? quoteHeight + 22 : 0) + footerHeight + 36,
  );
  const height = Math.min(maxHeight, Math.max(360, uncappedHeight));

  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  context.fillStyle = "#f6e9ff";
  context.fillRect(0, 0, width, height);
  drawDottedBackground(context, width, height);
  roundRect(context, 28, 28, width - 56, height - 56, 28);
  context.fillStyle = "#fffaff";
  context.fill();
  if (activeVisualTheme.tweetPngBorder) {
    context.strokeStyle = palette.border;
    context.lineWidth = 2;
    context.stroke();
  }

  if (avatarImage) {
    context.save();
    context.beginPath();
    context.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(avatarImage, padding, padding, avatarSize, avatarSize);
    context.restore();
  } else {
    context.fillStyle = "#d9c3ff";
    context.beginPath();
    context.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#261447";
  context.font = "700 34px TwitterChirp, Arial, sans-serif";
  context.fillText(data.author, bodyX, padding + 36);
  context.fillStyle = "#6d5a7f";
  context.font = "26px TwitterChirp, Arial, sans-serif";
  context.fillText(data.handle || "x.com", bodyX, padding + 72);
  drawTweetPngHeaderStats(context, data.stats, assets, bodyX, padding + 34, bodyWidth);

  context.fillStyle = "#1b1324";
  context.font = "34px TwitterChirp, Arial, sans-serif";
  let y = padding + 126;
  const footerY = height - padding - (data.date ? 8 : 0);
  const maxContentY = data.date ? footerY - footerHeight : height - padding;
  for (const line of textLines) {
    if (y > maxContentY - 34) break;
    context.fillText(line, bodyX, y);
    y += 44;
  }

  if (mediaImages.some(Boolean)) {
    y += 10;
    const reservedQuoteHeight = quoteHeight ? quoteHeight + 22 : 0;
    const boundedMediaHeight = Math.min(mediaHeight, Math.max(0, maxContentY - y - reservedQuoteHeight - 28));
    if (boundedMediaHeight >= 80) {
      drawTweetPngMediaGrid(context, mediaImages, bodyX, y, bodyWidth, boundedMediaHeight, palette);
      y += boundedMediaHeight + 28;
    }
  }

  if (data.quote) {
    y = drawTweetPngQuote(context, {
      quote: data.quote,
      images: quoteImages,
      textLines: quoteTextLines,
      x: bodyX,
      y,
      width: bodyWidth,
      mediaHeight: quoteMediaHeight,
      maxY: maxContentY,
      palette,
    });
  }

  if (data.date) {
    context.fillStyle = "#7d5aaa";
    context.font = "22px TwitterChirp, Arial, sans-serif";
    context.fillText(data.date, bodyX, footerY);
  }

  return await canvasToPngBlob(canvas);
}

async function loadTweetPngRenderAssets(): Promise<TweetPngRenderAssets> {
  const lotusUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("remistats/star.svg")
    : "";
  return {
    lotus: lotusUrl ? await loadImageForCanvas(lotusUrl) : null,
  };
}

function drawTweetPngHeaderStats(
  context: CanvasRenderingContext2D,
  stats: TweetPngStats | null,
  assets: TweetPngRenderAssets,
  x: number,
  y: number,
  width: number,
): void {
  if (!stats?.score && !stats?.beetles) return;
  const gap = 12;
  const groups: Array<{ icon: "lotus" | "beetle"; value: string; width: number }> = [];
  context.font = "700 24px TwitterChirp, Arial, sans-serif";
  if (stats.score) groups.push({ icon: "lotus", value: stats.score, width: 28 + 8 + context.measureText(stats.score).width });
  if (stats.beetles) groups.push({ icon: "beetle", value: stats.beetles, width: 28 + 8 + context.measureText(stats.beetles).width });
  const totalWidth = groups.reduce((sum, group) => sum + group.width, 0) + Math.max(0, groups.length - 1) * gap;
  let cursor = x + width - totalWidth;
  for (const group of groups) {
    if (group.icon === "lotus" && assets.lotus) {
      context.drawImage(assets.lotus, cursor, y - 24, 26, 26);
    } else {
      context.font = "24px TwitterChirp, Arial, sans-serif";
      context.fillText(group.icon === "beetle" ? "🪲" : "✦", cursor, y - 1);
    }
    context.fillStyle = "#261447";
    context.font = "700 24px TwitterChirp, Arial, sans-serif";
    context.fillText(group.value, cursor + 34, y);
    cursor += group.width + gap;
  }
}

function tweetPngPalette(value: VisualThemeSettings["tweetPngBorderPalette"]): TweetPngPalette {
  switch (value) {
    case "gray":
      return { border: "#cfd6df", mediaBorder: "#d8dee7", quoteBorder: "#d8dee7", quoteFill: "#fbfcfd", mediaFill: "#f4f6f8" };
    case "blue":
      return { border: "#78aee8", mediaBorder: "#a8cef5", quoteBorder: "#a8cef5", quoteFill: "#f5faff", mediaFill: "#edf6ff" };
    case "green":
      return { border: "#82b98a", mediaBorder: "#add8b1", quoteBorder: "#add8b1", quoteFill: "#f6fff7", mediaFill: "#eff9f0" };
    case "purple":
    default:
      return { border: "#b67cff", mediaBorder: "#c9a5ff", quoteBorder: "#d5b7ff", quoteFill: "#fbf6ff", mediaFill: "#f4eaff" };
  }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && context.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trim()}...`;
  }
  return lines.length ? lines : [""];
}

function drawTweetPngQuote(
  context: CanvasRenderingContext2D,
  options: {
    quote: TweetPngQuoteData;
    images: Array<HTMLImageElement | null>;
    textLines: string[];
    x: number;
    y: number;
    width: number;
    mediaHeight: number;
    maxY: number;
    palette: TweetPngPalette;
  },
): number {
  const padding = 24;
  const lineHeight = 34;
  const cardHeight = Math.min(
    options.maxY - options.y,
    30 + (options.textLines.length ? options.textLines.length * lineHeight + 14 : 0) + (options.mediaHeight ? options.mediaHeight + 14 : 0) + 34,
  );
  if (cardHeight < 88) return options.y;
  roundRect(context, options.x, options.y, options.width, cardHeight, 22);
  context.fillStyle = options.palette.quoteFill;
  context.fill();
  if (activeVisualTheme.tweetPngBorder) {
    context.strokeStyle = options.palette.quoteBorder;
    context.lineWidth = 2;
    context.stroke();
  }

  let y = options.y + padding + 6;
  context.fillStyle = "#261447";
  context.font = "700 24px TwitterChirp, Arial, sans-serif";
  context.fillText(options.quote.author, options.x + padding, y);
  if (options.quote.handle) {
    context.fillStyle = "#6d5a7f";
    context.font = "22px TwitterChirp, Arial, sans-serif";
    context.fillText(options.quote.handle, options.x + padding + Math.min(360, context.measureText(options.quote.author).width + 14), y);
  }

  y += 38;
  context.fillStyle = "#21182a";
  context.font = "26px TwitterChirp, Arial, sans-serif";
  for (const line of options.textLines) {
    if (y + lineHeight > options.y + cardHeight - padding) break;
    context.fillText(line, options.x + padding, y);
    y += lineHeight;
  }

  if (options.images.some(Boolean) && y + 76 < options.y + cardHeight) {
    y += 8;
    drawTweetPngMediaGrid(
      context,
      options.images,
      options.x + padding,
      y,
      options.width - padding * 2,
      Math.min(options.mediaHeight, options.y + cardHeight - y - padding),
      options.palette,
    );
  }
  return options.y + cardHeight + 22;
}

function measureTweetPngMediaHeight(images: Array<HTMLImageElement | null>, width: number, maxHeight: number): number {
  const visible = images.filter((image): image is HTMLImageElement => Boolean(image));
  if (!visible.length) return 0;
  if (visible.length > 1) return Math.min(maxHeight, 420);
  const image = visible[0];
  const ratio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 16 / 9;
  if (ratio >= 1) return Math.min(maxHeight, Math.max(260, width / ratio));
  return Math.min(maxHeight, Math.max(240, width * 0.62 / ratio));
}

function drawTweetPngMediaGrid(
  context: CanvasRenderingContext2D,
  images: Array<HTMLImageElement | null>,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: TweetPngPalette,
): void {
  const visible = images.filter((image): image is HTMLImageElement => Boolean(image));
  const gap = 10;
  if (visible.length === 1) {
    drawTweetPngSingleMedia(context, visible[0], x, y, width, height, palette);
    return;
  }
  const cells = visible.length === 1
    ? [{ x, y, width, height }]
    : visible.length === 2
      ? [{ x, y, width: (width - gap) / 2, height }, { x: x + (width + gap) / 2, y, width: (width - gap) / 2, height }]
      : [
        { x, y, width: (width - gap) / 2, height: (height - gap) / 2 },
        { x: x + (width + gap) / 2, y, width: (width - gap) / 2, height: (height - gap) / 2 },
        { x, y: y + (height + gap) / 2, width: (width - gap) / 2, height: (height - gap) / 2 },
        { x: x + (width + gap) / 2, y: y + (height + gap) / 2, width: (width - gap) / 2, height: (height - gap) / 2 },
      ];
  visible.slice(0, cells.length).forEach((image, index) => {
    const cell = cells[index];
    roundRect(context, cell.x, cell.y, cell.width, cell.height, 22);
    context.save();
    context.clip();
    drawImageCover(context, image, cell.x, cell.y, cell.width, cell.height);
    context.restore();
    if (activeVisualTheme.tweetPngBorder) {
      context.strokeStyle = palette.mediaBorder;
      context.lineWidth = 2;
      context.stroke();
    }
  });
}

function drawTweetPngSingleMedia(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: TweetPngPalette,
): void {
  const imageRatio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 16 / 9;
  const tallImage = activeVisualTheme.tweetPngShrinkTallImages && imageRatio < 0.85;
  const drawHeight = height;
  const drawWidth = tallImage ? Math.min(width * 0.62, drawHeight * imageRatio) : Math.min(width, drawHeight * imageRatio);
  const drawX = x + (width - drawWidth) / 2;
  roundRect(context, drawX, y, drawWidth, drawHeight, 22);
  context.save();
  context.clip();
  context.fillStyle = palette.mediaFill;
  context.fillRect(drawX, y, drawWidth, drawHeight);
  drawImageContain(context, image, drawX, y, drawWidth, drawHeight);
  context.restore();
  if (activeVisualTheme.tweetPngBorder) {
    context.strokeStyle = palette.mediaBorder;
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawImageContain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG render failed")), "image/png");
  });
}

function drawDottedBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "rgba(139, 95, 191, 0.16)";
  for (let y = 0; y < height; y += 12) {
    for (let x = 0; x < width; x += 12) context.fillRect(x, y, 1, 1);
  }
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const next = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + next, y);
  context.arcTo(x + width, y, x + width, y + height, next);
  context.arcTo(x + width, y + height, x, y + height, next);
  context.arcTo(x, y + height, x, y, next);
  context.arcTo(x, y, x + width, y, next);
  context.closePath();
}

function showTweetPngModal(blob: Blob, data: TweetPngData): void {
  document.querySelector("#milxdy-tweet-png-modal")?.remove();
  const url = URL.createObjectURL(blob);
  const modal = document.createElement("div");
  modal.id = "milxdy-tweet-png-modal";
  modal.innerHTML = `
    <div class="milxdy-tweet-png-dialog" role="dialog" aria-modal="true" aria-label="Tweet PNG preview">
      <header>
        <strong>Tweet PNG</strong>
        <button type="button" data-action="close" aria-label="Close">&times;</button>
      </header>
      <img src="${url}" alt="Rendered tweet preview">
      <p>Review before sharing. Nothing is sent automatically.</p>
      <footer>
        <button type="button" data-action="copy">Copy PNG</button>
        <button type="button" data-action="download">Download</button>
        <button type="button" data-action="share">Share</button>
      </footer>
    </div>
  `;
  const close = () => {
    URL.revokeObjectURL(url);
    modal.remove();
  };
  modal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === modal || target?.closest('[data-action="close"]')) close();
  });
  modal.querySelector('[data-action="copy"]')?.addEventListener("click", () => {
    void copyTweetPng(blob);
  });
  modal.querySelector('[data-action="download"]')?.addEventListener("click", () => {
    downloadBlob(blob, tweetPngFileName(data));
  });
  modal.querySelector('[data-action="share"]')?.addEventListener("click", () => {
    void shareTweetPng(blob, data);
  });
  document.body.appendChild(modal);
}

async function copyTweetPng(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") return;
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function shareTweetPng(blob: Blob, data: TweetPngData): Promise<void> {
  const file = new File([blob], tweetPngFileName(data), { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: data.author, text: data.statusUrl });
    return;
  }
  downloadBlob(blob, file.name);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tweetPngFileName(data: TweetPngData): string {
  const handle = data.handle.replace(/^@/, "") || "tweet";
  return `milxdy-${handle}-${Date.now()}.png`;
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
    #milxdy-tweet-png-modal {
      align-items: center;
      background: rgba(0, 0, 0, 0.54);
      display: flex;
      inset: 0;
      justify-content: center;
      padding: 24px;
      position: fixed;
      z-index: 2147483647;
    }
    .milxdy-tweet-png-dialog {
      background: #fffaff;
      border: 1px solid #b67cff;
      border-radius: 8px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.24);
      color: #20122f;
      display: grid;
      gap: 12px;
      max-height: min(760px, calc(100vh - 48px));
      max-width: min(620px, calc(100vw - 48px));
      overflow: auto;
      padding: 14px;
    }
    .milxdy-tweet-png-dialog header,
    .milxdy-tweet-png-dialog footer {
      align-items: center;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .milxdy-tweet-png-dialog img {
      border: 1px solid #d7b8ff;
      border-radius: 6px;
      display: block;
      max-width: 100%;
    }
    .milxdy-tweet-png-dialog p {
      color: #6d5a7f;
      font: 12px/1.35 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
    }
    .milxdy-tweet-png-dialog button {
      border: 1px solid #b67cff;
      border-radius: 6px;
      background: #ead8ff;
      color: #281447;
      cursor: pointer;
      font: 700 12px/1 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 30px;
      padding: 0 10px;
    }
  `;
  document.documentElement.appendChild(style);
}

function setupNotificationUnreadMarkers(): void {
  const pending = new Set<HTMLElement>();
  let timer: number | null = null;
  const queueNotification = (notification: HTMLElement) => {
    pending.add(notification);
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      const notifications = Array.from(pending);
      pending.clear();
      for (const queued of notifications) markNotificationUnread(queued);
    }, 150);
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const notification = target?.closest<HTMLElement>('article[data-testid="notification"]');
    if (!notification) return;
    unreadNotifications.delete(notification);
    notification.dataset.milxdyNotificationUnread = "false";
    const cell = notification.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
    if (cell) delete cell.dataset.milxdyNotificationUnread;
  }, true);

  for (const notification of document.querySelectorAll<HTMLElement>('article[data-testid="notification"]')) {
    queueNotification(notification);
  }

  subscribeTwitterSurfaces((surface) => {
    if (surface.kind === "notification") queueNotification(surface.element);
  });
}

function markNotificationUnread(notification: HTMLElement): void {
  if (!notification.isConnected) return;
  const cell = notification.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
  const unread = isUnreadNotification(notification, cell);
  if (unread) unreadNotifications.add(notification);
  notification.dataset.milxdyNotificationUnread = String(unread);
  if (cell) delete cell.dataset.milxdyNotificationUnread;
}

function isUnreadNotification(notification: HTMLElement, cell: HTMLElement | null): boolean {
  if (unreadNotifications.has(notification)) return true;
  const labelText = [
    notification.getAttribute("aria-label"),
    cell?.getAttribute("aria-label"),
    notification.querySelector<HTMLElement>('[aria-label*="Unread"], [aria-label*="unread"], [aria-label*="New"], [aria-label*="new"]')?.getAttribute("aria-label"),
  ].filter(Boolean).join(" ");
  if (/\b(unread|new notification|new notifications)\b/i.test(labelText)) return true;

  const candidates = [
    cell,
    cell?.firstElementChild,
    notification,
    notification.parentElement,
    ...Array.from((cell || notification).querySelectorAll<HTMLElement>("div, article")).slice(0, 24),
  ].filter((element): element is Element => Boolean(element));
  return candidates.some((element) => isTwitterUnreadBackground(window.getComputedStyle(element).backgroundColor));
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
  const importUrl = new URL(chrome.runtime.getURL(feature.script));
  importUrl.searchParams.set("milxdyLoad", String(Date.now()));
  await import(importUrl.href);
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
