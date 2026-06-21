import { DEFAULT_SETTINGS, DEFAULT_STATS, DEFAULT_PLAYER_STATS } from "./shared/constants";
import { getLevel, getLevelProgress, getPlayerLevel, getPlayerLevelProgress } from "./shared/levels";
import { normalizeProfileImageUrl } from "./shared/image-core";
import {
  loadCollectedAvatars,
  loadMatchedAccounts,
  loadPlayerStats,
  loadSettings,
  loadStats,
  normalizeCollectedAvatars,
  normalizeHandle,
  normalizeMatchedAccounts,
  normalizeStats,
  normalizeWhitelistHandles,
  saveCollectedAvatars,
  saveMatchedAccounts,
  savePlayerStats,
  saveStats,
} from "./shared/storage";
import type {
  CollectedAvatarMap,
  DetectionResult,
  DetectionStats,
  ExtensionSettings,
  MatchedAccountMap,
  PlayerStats,
} from "./shared/types";

import { detectAvatar } from "./detection";
import { applyMode, clearEffects, revealed, triggerLevelUpAnimation } from "./effects";
import type { EffectsContext } from "./effects";
import {
  TWEET,
  NOTIFICATION,
  USER_CELL,
  DM_MESSAGE,
  TWEET_USER_AVATAR,
  TWEET_USER_AVATAR_LINK,
  USER_NAME,
  PROFILE_IMAGE,
  QUOTE_TWEET,
  STATUS_LINK,
  NOTIFICATION_AVATAR_CONTAINER,
  PROFILE_USER_NAME,
  PROFILE_AVATAR,
  PROFILE_HEADER_ITEMS,
  PROFILE_CONTAINER_FALLBACK,
  PRIMARY_COLUMN,
  HOME_LINK,
  LOGO_REPLACEMENT_CLASS,
  SELF_PROFILE_LINK,
  REPLY_TO_LINK,
} from "./selectors";
import {
  setSoundSettings,
  attachSoundEvents,
  attachPostButtonSound,
  attachDMSounds,
  attachGlobalMediaHoverSounds,
  observeIncomingMessages,
  playCatchSound,
  playLevelUpSound,
  playLogoTune,
  playLetterPip,
  playLogoHoverSound,
} from "./sounds";
import { injectStyles } from "./styles";
import { scheduleTwitterScan, subscribeTwitterSurfaces } from "../../shared/twitterScanner";
import { safeRuntimeMessage } from "../../shared/extensionRuntime";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESCAN_INTERVAL_MS = 5000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const processed = new WeakMap<HTMLElement, string>();
const processedNotifications = new WeakMap<HTMLElement, string>();
const remiStatsBeetleCache = new Map<string, Promise<boolean>>();

let settings: ExtensionSettings = DEFAULT_SETTINGS;
let scanScheduled = false;
let delayedScanTimer: number | null = null;
let stats: DetectionStats | null = null;
let matchedAccounts: MatchedAccountMap | null = null;
let collectedAvatars: CollectedAvatarMap | null = null;
let playerStats: PlayerStats = DEFAULT_PLAYER_STATS;
let localStateWriteScheduled = false;
let playerStatsWriteScheduled = false;
let selfHandle: string | null = null;
const creditedReplies = new WeakSet<HTMLElement>();

// ---------------------------------------------------------------------------
// Effects context — wires effects module to our shared state
// ---------------------------------------------------------------------------

function effectsCtx(): EffectsContext {
  return {
    settings,
    processed,
    onTweetVisible: attachSoundEvents,
    onCatch: markAccountCaught,
    onLevelUp: handleLevelUp,
    onUnlike: handleUnlike,
    onAddToMiladyList: addToMiladyList,
    onRemoveFromMiladyList: removeFromMiladyList,
    isAccountCaught: (handle: string) => matchedAccounts?.[handle]?.caught === true,
    getAccountPostsLiked: (handle: string) => matchedAccounts?.[handle]?.postsLiked ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

void boot().catch(() => {
  // Extension context invalidated — normal after extension reload
});

async function boot(): Promise<void> {
  injectStyles();
  [settings, stats, matchedAccounts, collectedAvatars, playerStats] = await Promise.all([
    loadSettings(),
    loadStats(),
    loadMatchedAccounts(),
    loadCollectedAvatars(),
    loadPlayerStats(),
  ]);
  setSoundSettings(settings);
  prevPlayerLevel = getPlayerLevel(playerStats.totalLikesGiven);
  observeStorage();
  subscribeTwitterSurfaces((surface) => {
    if (surface.kind === "tweet") void processTweet(surface.element);
    if (surface.kind === "userCell") void processUserCell(surface.element);
    if (surface.kind === "notification") void processNotificationGroup(surface.element);
    if (surface.kind === "directMessage") void processDirectMessage(surface.element);
    if (surface.kind === "profile") void processProfilePage();
    scheduleDelayedProcessVisibleTweets();
  });
  window.addEventListener("scroll", scheduleDelayedProcessVisibleTweets, { passive: true });
  window.addEventListener("resize", () => updatePlayerLevelBadge(), { passive: true });
  document.addEventListener("click", () => scheduleDelayedProcessVisibleTweets(), { passive: true, capture: true });
  window.setInterval(() => {
    replaceXLogo();
    updatePlayerLevelBadge();
    processProfilePage();
  }, RESCAN_INTERVAL_MS);
  scheduleTwitterScan();
  scheduleDelayedProcessVisibleTweets();
  attachPostButtonSound();
  attachDMSounds();
  attachGlobalMediaHoverSounds();
  replaceXLogo();
  observeIncomingMessages();
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function scheduleProcessVisibleTweets(): void {
  if (scanScheduled) {
    return;
  }
  scanScheduled = true;
  queueMicrotask(() => {
    scanScheduled = false;
    scheduleTwitterScan();
    void processProfilePage();
  });
}

function scheduleDelayedProcessVisibleTweets(): void {
  if (delayedScanTimer !== null) {
    window.clearTimeout(delayedScanTimer);
  }
  delayedScanTimer = window.setTimeout(() => {
    delayedScanTimer = null;
    scheduleProcessVisibleTweets();
  }, 350);
}

// ---------------------------------------------------------------------------
// Tweet processing
// ---------------------------------------------------------------------------

async function processTweet(tweet: HTMLElement): Promise<void> {
  try {
    const avatar = findAvatar(tweet);
    const author = findAuthor(tweet);
    if (!avatar) {
      tweet.dataset.miladymaxxerState = "miss";
      delete tweet.dataset.miladymaxxerDebug;
      applyMode(effectsCtx(), tweet);
      scheduleDelayedProcessVisibleTweets();
      return;
    }

    if (!avatar.currentSrc && !avatar.src) {
      tweet.dataset.miladymaxxerState = "miss";
      delete tweet.dataset.miladymaxxerDebug;
      applyMode(effectsCtx(), tweet);
      scheduleDelayedProcessVisibleTweets();
      return;
    }

    const normalizedUrl = normalizeProfileImageUrl(avatar.currentSrc || avatar.src);
    if (revealed.get(tweet) && revealed.get(tweet) !== normalizedUrl) {
      revealed.delete(tweet);
    }

    if (processed.get(tweet) === normalizedUrl && tweet.dataset.miladymaxxerState) {
      // Re-check milady list in case it changed since last processing
      if (author && settings.miladyListHandles.includes(author.handle) && tweet.dataset.miladymaxxerState !== "match") {
        processed.delete(tweet);
        // Fall through to re-process
      } else {
        applyMode(effectsCtx(), tweet, normalizedUrl);
        return;
      }
    }

    processed.set(tweet, normalizedUrl);

    if (author) {
      tweet.dataset.miladymaxxerHandle = author.handle;
    }

    if (author && settings.whitelistHandles.includes(author.handle)) {
      recordCollectedAvatar({
        normalizedUrl,
        originalUrl: avatar.currentSrc || avatar.src,
        author,
        whitelisted: true,
        exampleTweetUrl: findTweetUrl(tweet),
        exampleNotificationUrl: null,
        sourceSurface: "tweet",
      });
      revealed.delete(tweet);
      clearEffects(tweet);
      delete tweet.dataset.miladymaxxer;
      delete tweet.dataset.miladymaxxerState;
      return;
    }

    // Manual milady list — skip detection, treat as match
    if (author && settings.miladyListHandles.includes(author.handle)) {
      tweet.dataset.miladymaxxer = "manual";
      tweet.dataset.miladymaxxerState = "match";
      delete tweet.dataset.miladymaxxerDebug;
      incrementStat("tweetsScanned");
      incrementMatchStats({ matched: true, source: null, score: null, tokenId: null });
      recordMatchedAccount(author.handle, author.displayName, null);
      applyMode(effectsCtx(), tweet, normalizedUrl);
      checkReplyXP(tweet, author);
      processQuoteTweet(tweet);
      return;
    }

    if (author && await hasRemiStatsBeetles(author.handle)) {
      tweet.dataset.miladymaxxer = "remistats";
      tweet.dataset.miladymaxxerState = "match";
      tweet.dataset.miladymaxxerDebug = "remistats";
      incrementStat("tweetsScanned");
      incrementMatchStats({ matched: true, source: "remistats", score: null, tokenId: null });
      recordMatchedAccount(author.handle, author.displayName, null);
      applyMode(effectsCtx(), tweet, normalizedUrl);
      checkReplyXP(tweet, author);
      processQuoteTweet(tweet);
      return;
    }

    tweet.dataset.miladymaxxerState = "miss";
    tweet.dataset.miladymaxxerDebug = "\u2026";
    applyMode(effectsCtx(), tweet, normalizedUrl);
    incrementStat("tweetsScanned");
    const result = await detectAvatar(avatar, normalizedUrl, {
      onCacheHit: () => incrementStat("cacheHits"),
      onAvatarChecked: () => incrementStat("avatarsChecked"),
      onError: () => incrementStat("errors"),
    });
    if (result.debugLabel) {
      tweet.dataset.miladymaxxerDebug = result.debugLabel;
    } else {
      delete tweet.dataset.miladymaxxerDebug;
    }
    recordCollectedAvatar({
      normalizedUrl,
      originalUrl: avatar.currentSrc || avatar.src,
      author,
      whitelisted: false,
      exampleTweetUrl: findTweetUrl(tweet),
      exampleNotificationUrl: null,
      sourceSurface: "tweet",
      result,
    });
    if (result.matched) {
      tweet.dataset.miladymaxxer = result.source ?? "match";
      tweet.dataset.miladymaxxerState = "match";
      incrementMatchStats(result);
      if (author) {
        recordMatchedAccount(author.handle, author.displayName, result.score);
      }
      applyMode(effectsCtx(), tweet, normalizedUrl);
      return;
    }

    revealed.delete(tweet);
    clearEffects(tweet);
    delete tweet.dataset.miladymaxxer;
    tweet.dataset.miladymaxxerState = "miss";
    if (result.debugLabel) {
      tweet.dataset.miladymaxxerDebug = result.debugLabel;
    }
    applyMode(effectsCtx(), tweet, normalizedUrl);
    checkReplyXP(tweet, author);
  } catch (error) {
    console.error("Milady post processing failed", error);
    clearEffects(tweet);
    delete tweet.dataset.miladymaxxer;
    tweet.dataset.miladymaxxerState = "miss";
    tweet.dataset.miladymaxxerDebug = "err";
    applyMode(effectsCtx(), tweet);
  }

  processQuoteTweet(tweet);
}

// ---------------------------------------------------------------------------
// Quote tweets
// ---------------------------------------------------------------------------

const processedQuoteTweets = new WeakMap<HTMLElement, string>();

async function processQuoteTweet(tweet: HTMLElement): Promise<void> {
  const quoteTweet = tweet.querySelector<HTMLElement>(QUOTE_TWEET);
  if (!quoteTweet) return;

  const quoteAvatar = quoteTweet.querySelector<HTMLImageElement>(PROFILE_IMAGE);
  if (!quoteAvatar?.src) {
    quoteTweet.dataset.miladymaxxerQuote = "other";
    return;
  }

  const normalizedUrl = normalizeProfileImageUrl(quoteAvatar.currentSrc || quoteAvatar.src);

  if (processedQuoteTweets.get(quoteTweet) === normalizedUrl) return;
  processedQuoteTweets.set(quoteTweet, normalizedUrl);

  try {
    const result = await detectAvatar(quoteAvatar, normalizedUrl, {
      onCacheHit: () => incrementStat("cacheHits"),
      onAvatarChecked: () => incrementStat("avatarsChecked"),
      onError: () => incrementStat("errors"),
    });
    quoteTweet.dataset.miladymaxxerQuote = result.matched ? "milady" : "other";
  } catch {
    quoteTweet.dataset.miladymaxxerQuote = "other";
  }
}

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

async function processProfilePage(): Promise<void> {
  if (settings.mode === "off") return;

  const profileHeader = document.querySelector<HTMLElement>(PROFILE_USER_NAME);
  if (!profileHeader) return;

  const avatar = document.querySelector<HTMLImageElement>(PROFILE_AVATAR);
  if (!avatar?.src) return;

  const normalizedUrl = normalizeProfileImageUrl(avatar.src);

  const userProfileContainer = profileHeader.closest(PROFILE_HEADER_ITEMS)?.parentElement?.parentElement ||
                                profileHeader.closest(PROFILE_CONTAINER_FALLBACK);
  if (!userProfileContainer) return;

  // Extract profile handle from URL
  const profileHandle = normalizeHandle(window.location.pathname.split("/")[1] ?? "");

  // Always refresh badges even if already processed (skip own profile)
  const self = resolveSelfHandle();
  if (profileHandle && profileHandle !== self) {
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    if (primaryColumn?.dataset.miladymaxxerProfile === "milady") {
      injectProfileLevelBadge(profileHandle);
    }
  }

  if (processed.get(userProfileContainer as HTMLElement) === normalizedUrl) return;
  processed.set(userProfileContainer as HTMLElement, normalizedUrl);

  // Manual milady list — skip detection for profile page too
  if (profileHandle && settings.miladyListHandles.includes(profileHandle)) {
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    if (primaryColumn) {
      primaryColumn.dataset.miladymaxxerProfile = "milady";
    }
    if (profileHandle !== self) {
      injectProfileLevelBadge(profileHandle);
    }
    return;
  }

  // Player level is shown next to the logo — don't duplicate on profile

  if (profileHandle && await hasRemiStatsBeetles(profileHandle)) {
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    if (primaryColumn) {
      primaryColumn.dataset.miladymaxxerProfile = "milady";
    }
    if (profileHandle !== self) {
      injectProfileLevelBadge(profileHandle);
    }
    return;
  }

  try {
    const result = await detectAvatar(avatar, normalizedUrl, {
      onCacheHit: () => incrementStat("cacheHits"),
      onAvatarChecked: () => incrementStat("avatarsChecked"),
      onError: () => incrementStat("errors"),
    });
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    if (primaryColumn) {
      if (result.matched) {
        primaryColumn.dataset.miladymaxxerProfile = "milady";
        if (profileHandle !== self) {
          injectProfileLevelBadge(profileHandle);
        }
      } else {
        delete primaryColumn.dataset.miladymaxxerProfile;
      }
    }
  } catch {
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    if (primaryColumn) {
      delete primaryColumn.dataset.miladymaxxerProfile;
    }
  }
}

// ---------------------------------------------------------------------------
// User cells
// ---------------------------------------------------------------------------

async function processUserCell(cell: HTMLElement): Promise<void> {
  if (settings.mode === "off") return;

  const avatar = cell.querySelector<HTMLImageElement>(PROFILE_IMAGE);
  if (!avatar?.src) return;

  const normalizedUrl = normalizeProfileImageUrl(avatar.src);

  if (processed.get(cell) === normalizedUrl) return;
  processed.set(cell, normalizedUrl);

  // Check milady list by extracting handle from the cell's profile link
  const cellLink = cell.querySelector<HTMLAnchorElement>('a[href^="/"]');
  const cellHandle = normalizeHandle(cellLink?.getAttribute("href"));
  if (cellHandle && settings.miladyListHandles.includes(cellHandle)) {
    cell.dataset.miladymaxxerEffect = "milady";
    attachSoundEvents(cell);
    return;
  }

  if (cellHandle && await hasRemiStatsBeetles(cellHandle)) {
    cell.dataset.miladymaxxerEffect = "milady";
    attachSoundEvents(cell);
    return;
  }

  try {
    const result = await detectAvatar(avatar, normalizedUrl, {
      onCacheHit: () => incrementStat("cacheHits"),
      onAvatarChecked: () => incrementStat("avatarsChecked"),
      onError: () => incrementStat("errors"),
    });
    if (result.matched) {
      cell.dataset.miladymaxxerEffect = "milady";
      attachSoundEvents(cell);
    } else {
      delete cell.dataset.miladymaxxerEffect;
    }
  } catch {
    delete cell.dataset.miladymaxxerEffect;
  }
}

// ---------------------------------------------------------------------------
// Direct messages
// ---------------------------------------------------------------------------

async function processDirectMessage(message: HTMLElement): Promise<void> {
  if (settings.mode === "off") {
    // Clear stale DM highlights when the extension is turned off.
    clearDirectMessageHighlight(message);
    return;
  }

  const avatar = findDirectMessageAvatar(message);
  if (!avatar) {
    processed.delete(message);
    clearDirectMessageHighlight(message);
    return;
  }

  const avatarSrc = avatar.currentSrc || avatar.src;
  if (!avatarSrc) {
    processed.delete(message);
    clearDirectMessageHighlight(message);
    return;
  }

  const normalizedUrl = normalizeProfileImageUrl(avatarSrc);
  // Reuse the avatar URL cache just like tweets so we avoid re-detecting unchanged messages.
  const author = findDirectMessageAuthor(avatar);

  if (processed.get(message) === normalizedUrl && message.dataset.miladymaxxerState) {
    // Re-process if the sender was added to the manual list after this message was cached.
    if (author && settings.miladyListHandles.includes(author.handle) && message.dataset.miladymaxxerState !== "match") {
      processed.delete(message);
    } else {
      applyDirectMessageMode(message);
      return;
    }
  }

  processed.set(message, normalizedUrl);

  const handle = author?.handle;
  if (!handle) {
    delete message.dataset.miladymaxxerHandle;
  } else {
    message.dataset.miladymaxxerHandle = handle;
  }

  const isWhitelisted = handle ? settings.whitelistHandles.includes(handle) : false;
  if (isWhitelisted) {
    recordDirectMessageAvatar(normalizedUrl, avatarSrc, author, true);
    clearDirectMessageHighlight(message);
    return;
  }

  const isOnMiladyList = handle ? settings.miladyListHandles.includes(handle) : false;
  if (isOnMiladyList) {
    // Manual list entries are treated as matches without avatar detection.
    recordDirectMessageAvatar(normalizedUrl, avatarSrc, author, false);
    message.dataset.miladymaxxer = "manual";
    message.dataset.miladymaxxerState = "match";
    delete message.dataset.miladymaxxerDebug;
    applyDirectMessageMode(message);
    return;
  }

  if (handle && await hasRemiStatsBeetles(handle)) {
    recordDirectMessageAvatar(normalizedUrl, avatarSrc, author, false);
    message.dataset.miladymaxxer = "remistats";
    message.dataset.miladymaxxerState = "match";
    message.dataset.miladymaxxerDebug = "remistats";
    applyDirectMessageMode(message);
    return;
  }

  message.dataset.miladymaxxerState = "miss";
  delete message.dataset.miladymaxxer;
  delete message.dataset.miladymaxxerDebug;
  applyDirectMessageMode(message);

  try {
    const result = await detectAvatar(avatar, normalizedUrl, {
      onCacheHit: () => incrementStat("cacheHits"),
      onAvatarChecked: () => incrementStat("avatarsChecked"),
      onError: () => incrementStat("errors"),
    });

    if (result.debugLabel) {
      message.dataset.miladymaxxerDebug = result.debugLabel;
    } else {
      delete message.dataset.miladymaxxerDebug;
    }

    recordDirectMessageAvatar(normalizedUrl, avatarSrc, author, false, result);

    if (result.matched) {
      message.dataset.miladymaxxer = result.source ?? "match";
      message.dataset.miladymaxxerState = "match";
      applyDirectMessageMode(message);
      return;
    }

    delete message.dataset.miladymaxxer;
    message.dataset.miladymaxxerState = "miss";
    applyDirectMessageMode(message);
  } catch (error) {
    console.error("Milady DM processing failed", error);
    delete message.dataset.miladymaxxer;
    message.dataset.miladymaxxerState = "miss";
    message.dataset.miladymaxxerDebug = "err";
    applyDirectMessageMode(message);
  }
}

function clearDirectMessageHighlight(message: HTMLElement): void {
  // DMs only use a small subset of the tweet data attributes.
  delete message.dataset.miladymaxxer;
  delete message.dataset.miladymaxxerState;
  delete message.dataset.miladymaxxerEffect;
  delete message.dataset.miladymaxxerHandle;
  delete message.dataset.miladymaxxerDebug;
}

function applyDirectMessageMode(message: HTMLElement): void {
  delete message.dataset.miladymaxxerEffect;

  const isMatch = message.dataset.miladymaxxerState === "match";
  if (settings.mode === "debug") {
    // Reuse the existing debug visuals instead of inventing a DM-specific variant.
    message.dataset.miladymaxxerEffect = isMatch ? "debug-match" : "debug-miss";
    return;
  }

  if (settings.mode === "milady" && isMatch) {
    message.dataset.miladymaxxerEffect = "milady-dm";
  }
}

function recordDirectMessageAvatar(
  normalizedUrl: string,
  originalUrl: string,
  author: { handle: string; displayName: string | null } | null,
  whitelisted: boolean,
  result?: DetectionResult,
): void {
  // DMs share the same avatar catalog; tweet/notification example URLs simply do not apply here.
  recordCollectedAvatar({
    normalizedUrl,
    originalUrl,
    author,
    whitelisted,
    exampleTweetUrl: null,
    exampleNotificationUrl: null,
    sourceSurface: "dm-message",
    result,
  });
}

// ---------------------------------------------------------------------------
// Notification groups
// ---------------------------------------------------------------------------

async function processNotificationGroup(notification: HTMLElement): Promise<void> {
  const avatarEntries = collectNotificationAvatarEntries(notification);
  if (avatarEntries.length === 0) return;

  const signature = avatarEntries
    .map((entry) => `${entry.handle}:${entry.normalizedUrl}`)
    .sort()
    .join("|");
  if (processedNotifications.get(notification) === signature) return;
  processedNotifications.set(notification, signature);

  for (const entry of avatarEntries) {
    recordCollectedAvatar({
      normalizedUrl: entry.normalizedUrl,
      originalUrl: entry.originalUrl,
      author: { handle: entry.handle, displayName: null },
      whitelisted: settings.whitelistHandles.includes(entry.handle),
      exampleTweetUrl: null,
      exampleNotificationUrl: window.location.href,
      sourceSurface: "notification-group",
    });
  }
}

// ---------------------------------------------------------------------------
// Logo replacement
// ---------------------------------------------------------------------------

let logoTypewriterTimer: number | null = null;
let logoFadeTimer: number | null = null;

function replaceXLogo(): void {
  try {
    const logoUrl = chrome.runtime.getURL("milady-logo.png");
    const homeLink = document.querySelector<HTMLAnchorElement>(HOME_LINK);
    if (homeLink && !homeLink.querySelector(`.${LOGO_REPLACEMENT_CLASS}`)) {
      // Ensure the logo area doesn't get clipped when sidebar narrows (DMs)
      homeLink.style.overflow = "visible";
      let parent = homeLink.parentElement;
      for (let i = 0; i < 4 && parent; i++) {
        parent.style.overflow = "visible";
        parent = parent.parentElement;
      }
      Array.from(homeLink.children).forEach(child => {
        (child as HTMLElement).style.display = "none";
      });

      // Wrapper for logo + typewriter text
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        position: relative;
        display: inline-block;
        transform: translate(10px, 10px);
        z-index: 10000;
      `;

      const img = document.createElement("img");
      img.src = logoUrl;
      img.className = LOGO_REPLACEMENT_CLASS;
      img.style.cssText = `
        width: 30px;
        height: 30px;
        object-fit: contain;
        image-rendering: pixelated;
        border: 1.5px solid rgba(47, 77, 12, 0.4);
        border-radius: 6px;
        box-shadow: 0 0 8px rgba(47, 77, 12, 0.3), 0 0 16px rgba(47, 77, 12, 0.1);
        transition: transform 0.3s ease, box-shadow 0.3s ease, filter 0.3s ease;
        cursor: pointer;
      `;

      // Typewriter text element — to the right of logo
      const typeText = document.createElement("span");
      typeText.style.cssText = `
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        margin-left: -44px;
        color: #2f4d0c;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 1px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      // Hover animation
      img.addEventListener("mouseenter", () => {
        img.style.transform = "translateY(-1px) scale(1.05)";
        img.style.boxShadow = "0 0 12px rgba(47, 77, 12, 0.5), 0 0 24px rgba(47, 77, 12, 0.2)";
        playLogoHoverSound();
      }, { passive: true });

      img.addEventListener("mouseleave", () => {
        img.style.transform = "";
        img.style.boxShadow = "0 0 8px rgba(47, 77, 12, 0.3), 0 0 16px rgba(47, 77, 12, 0.1)";
      }, { passive: true });

      // Click: tune + typewriter "milady"
      img.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Cancel any in-progress typewriter and fade
        if (logoTypewriterTimer !== null) {
          window.clearInterval(logoTypewriterTimer);
          logoTypewriterTimer = null;
        }
        if (logoFadeTimer !== null) {
          window.clearTimeout(logoFadeTimer);
          logoFadeTimer = null;
        }

        // Play the 3-note tune
        playLogoTune();

        // Typewriter effect
        const word = "milady";
        let i = 0;
        typeText.textContent = "";
        typeText.style.opacity = "1";

        logoTypewriterTimer = window.setInterval(() => {
          if (i < word.length) {
            typeText.textContent += word[i];
            playLetterPip(i);
            i++;
          } else {
            window.clearInterval(logoTypewriterTimer!);
            logoTypewriterTimer = null;
            // Fade out after a pause
            logoFadeTimer = window.setTimeout(() => {
              typeText.style.opacity = "0";
              logoFadeTimer = null;
            }, 600);
          }
        }, 60);
      }, { capture: true });

      wrapper.appendChild(img);
      wrapper.appendChild(typeText);
      homeLink.appendChild(wrapper);
    }
  } catch {
    // Extension context invalidated
  }
}


// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function findAvatar(tweet: HTMLElement): HTMLImageElement | null {
  const avatarContainer = tweet.querySelector<HTMLElement>(TWEET_USER_AVATAR);
  if (avatarContainer) {
    const images = Array.from(avatarContainer.querySelectorAll<HTMLImageElement>(PROFILE_IMAGE));
    if (images.length > 0) {
      // Prefer the image inside an <a> link (the actual avatar, not badge overlays)
      const linked = images.filter(img => img.closest("a"));
      const candidates = linked.length > 0 ? linked : images;
      // Pick the largest by URL dimensions or natural size
      return candidates.reduce((best, img) => {
        const bestSize = getImageSize(best);
        const imgSize = getImageSize(img);
        return imgSize > bestSize ? img : best;
      });
    }
  }
  return tweet.querySelector<HTMLImageElement>(PROFILE_IMAGE);
}

function findDirectMessageAvatar(message: HTMLElement): HTMLImageElement | null {
  // In DMs, the sender avatar is usually the profile-linked image in the row.
  const linkedImages = Array.from(message.querySelectorAll<HTMLImageElement>('a[href^="/"] img[src*="profile_images"]'));
  for (const image of linkedImages) {
    const href = image.closest<HTMLAnchorElement>('a[href^="/"]')?.getAttribute("href");
    if (normalizeProfileHandleFromHref(href)) {
      return image;
    }
  }

  return message.querySelector<HTMLImageElement>(PROFILE_IMAGE);
}

function getImageSize(img: HTMLImageElement): number {
  // Try natural dimensions first
  const natural = (img.naturalWidth || 0) * (img.naturalHeight || 0);
  if (natural > 0) return natural;
  // Try URL size hint (e.g. /profile_images/.../photo_48x48.jpg)
  const urlMatch = img.src.match(/(\d+)x(\d+)/);
  if (urlMatch) return parseInt(urlMatch[1], 10) * parseInt(urlMatch[2], 10);
  // Fall back to rendered size
  return (img.width || 0) * (img.height || 0);
}

function findAuthor(tweet: HTMLElement): { handle: string; displayName: string | null } | null {
  const avatarLink = tweet.querySelector<HTMLAnchorElement>(TWEET_USER_AVATAR_LINK);
  const handle = normalizeHandle(avatarLink?.getAttribute("href"));
  if (!handle) return null;

  const userName = tweet.querySelector<HTMLElement>(USER_NAME);
  return {
    handle,
    displayName: userName ? extractDisplayName(userName) : null,
  };
}

function findDirectMessageAuthor(
  avatar: HTMLImageElement,
): { handle: string; displayName: string | null } | null {
  const avatarLink = avatar.closest<HTMLAnchorElement>('a[href^="/"]');
  const handle = normalizeProfileHandleFromHref(avatarLink?.getAttribute("href"));
  if (!handle) return null;

  return {
    handle,
    // DM rows rarely expose a clean display-name node, so use link metadata when present.
    displayName: avatarLink?.getAttribute("aria-label")?.trim() || avatarLink?.getAttribute("title")?.trim() || null,
  };
}

function normalizeProfileHandleFromHref(value: string | null | undefined): string | null {
  const absoluteUrl = toAbsoluteUrl(value);
  if (!absoluteUrl) return null;

  try {
    const url = new URL(absoluteUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    // Ignore internal DM routes like /messages/... and only accept profile-style paths.
    if (segments.length !== 1) {
      return null;
    }

    const handle = normalizeHandle(segments[0]);
    return /^[a-z0-9_]{1,15}$/i.test(handle) ? handle : null;
  } catch {
    return null;
  }
}

function injectProfileLevelBadge(handle: string): void {
  if (!settings.showLevelBadge) return;
  const account = matchedAccounts?.[handle];
  const postsLiked = account?.postsLiked ?? 0;
  const progress = getLevelProgress(postsLiked);

  // Check if we already have a badge with the same content — skip if unchanged
  const existingBadge = document.querySelector(".miladymaxxer-profile-level");

  const pct = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 100) : 0;
  const filled = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 5) : 0;
  const ascii = "\u2593".repeat(filled) + "\u2591".repeat(5 - filled);

  // Build detailed tooltip
  const tooltipLines = [`Level ${progress.level} \u00b7 ${progress.current}/${progress.needed} to next level`];
  if (account?.postsMatched && account.postsMatched > 0) tooltipLines.push(`Posts seen: ${account.postsMatched}`);
  if (postsLiked > 0) tooltipLines.push(`Posts liked: ${postsLiked}`);
  if (account?.caughtAt) {
    const caughtDate = new Date(account.caughtAt);
    tooltipLines.push(`Caught: ${caughtDate.toLocaleDateString()}`);
  }
  if (account?.lastDetectionScore != null) {
    tooltipLines.push(`Detection score: ${(account.lastDetectionScore * 100).toFixed(0)}%`);
  }

  // Detect if user follows this milady — grey pill if not following
  // Scope follow button search to profile header area (above the tab bar)
  const profileUserNameEl = document.querySelector<HTMLElement>(PROFILE_USER_NAME);
  const profileHeaderArea = profileUserNameEl?.closest('[data-testid="primaryColumn"] > div > div') ?? document.querySelector<HTMLElement>(PRIMARY_COLUMN);
  if (!profileHeaderArea) return;
  const followBtn = profileHeaderArea.querySelector<HTMLElement>('[data-testid$="-follow"], [data-testid$="-unfollow"]');
  const isFollowing = followBtn ? !!followBtn.closest('[data-testid$="-unfollow"]') || !!followBtn.querySelector('[aria-label*="Following"]') : false;
  const pillClass = isFollowing ? "miladymaxxer-profile-level-pill" : "miladymaxxer-profile-level-pill miladymaxxer-profile-level-pill-grey";

  const badge = document.createElement("div");
  badge.className = "miladymaxxer-profile-level";
  badge.title = tooltipLines.join("\n");
  badge.innerHTML =
    `<span class="${pillClass}">Milady Lvl: ${progress.level}</span>` +
    `<span class="miladymaxxer-profile-level-xp">${ascii} ${pct}%</span>`;

  // If badge already exists and content matches, keep it
  if (existingBadge?.isConnected) {
    if (existingBadge.textContent?.includes(`Lvl: ${progress.level}`)) return;
    existingBadge.remove();
  }

  // Inject after @handle span
  const profileUserName = document.querySelector<HTMLElement>(PROFILE_USER_NAME);
  if (!profileUserName) return;
  const allSpans = profileUserName.querySelectorAll("span");
  for (const span of Array.from(allSpans)) {
    const text = span.textContent?.trim();
    if (text?.startsWith("@") && span.children.length === 0) {
      span.after(badge);
      return;
    }
  }
}

function injectPlayerProfileBadge(): void {
  if (!settings.showLevelBadge) return;

  // Remove existing
  document.querySelector(".miladymaxxer-player-profile-level")?.remove();

  const progress = getPlayerLevelProgress(playerStats.totalLikesGiven);
  const pct = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 100) : 0;
  const filled = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 5) : 0;
  const ascii = "\u2593".repeat(filled) + "\u2591".repeat(5 - filled);

  const badge = document.createElement("div");
  badge.className = "miladymaxxer-player-profile-level";
  badge.title = `Player Level ${progress.level} \u00b7 ${progress.current}/${progress.needed} to next level\n${playerStats.totalLikesGiven} total milady likes`;
  badge.innerHTML =
    `<span class="miladymaxxer-profile-level-pill">Milady Lvl: ${progress.level}</span>` +
    `<span class="miladymaxxer-profile-level-xp">${ascii} ${pct}%</span>`;

  // Inject after @handle on own profile
  const profileUserName = document.querySelector<HTMLElement>(PROFILE_USER_NAME);
  if (!profileUserName) return;
  const allSpans = profileUserName.querySelectorAll("span");
  for (const span of Array.from(allSpans)) {
    const text = span.textContent?.trim();
    if (text?.startsWith("@") && span.children.length === 0) {
      span.after(badge);
      return;
    }
  }
}

function resolveSelfHandle(): string | null {
  if (selfHandle) return selfHandle;
  const link = document.querySelector<HTMLAnchorElement>(SELF_PROFILE_LINK);
  const href = link?.getAttribute("href");
  if (href) {
    selfHandle = normalizeHandle(href);
  }
  return selfHandle;
}

function findReplyToHandle(tweet: HTMLElement): string | null {
  const links = tweet.querySelectorAll<HTMLAnchorElement>(REPLY_TO_LINK);
  for (const link of Array.from(links)) {
    const text = link.textContent?.trim();
    if (text?.startsWith("@")) {
      return normalizeHandle(text);
    }
  }
  return null;
}

function checkReplyXP(_tweet: HTMLElement, _author: { handle: string } | null): void {
  // Disabled — XP should only come from like actions
}

function extractDisplayName(userName: HTMLElement): string | null {
  for (const span of Array.from(userName.querySelectorAll("span"))) {
    const text = span.textContent?.trim();
    if (!text || text.startsWith("@") || text === "\u00b7") continue;
    return text;
  }
  return null;
}

function collectNotificationAvatarEntries(notification: HTMLElement): Array<{
  handle: string;
  normalizedUrl: string;
  originalUrl: string;
}> {
  const results = new Map<string, { handle: string; normalizedUrl: string; originalUrl: string }>();

  for (const container of Array.from(notification.querySelectorAll<HTMLElement>(NOTIFICATION_AVATAR_CONTAINER))) {
    const testId = container.dataset.testid ?? "";
    const handle = normalizeHandle(testId.replace(/^UserAvatar-Container-/, ""));
    const images = Array.from(container.querySelectorAll<HTMLImageElement>(PROFILE_IMAGE));
    const image = images.length > 0
      ? images.reduce((largest, img) => {
          const largestSize = (largest.naturalWidth || largest.width || 0) * (largest.naturalHeight || largest.height || 0);
          const imgSize = (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0);
          return imgSize > largestSize ? img : largest;
        })
      : null;
    const source = image?.currentSrc || image?.src;
    if (!handle || !source) continue;

    const normalizedUrl = normalizeProfileImageUrl(source);
    results.set(`${handle}:${normalizedUrl}`, { handle, normalizedUrl, originalUrl: source });
  }

  return Array.from(results.values());
}

function findTweetUrl(tweet: HTMLElement): string | null {
  const link = tweet.querySelector<HTMLAnchorElement>(STATUS_LINK);
  return toAbsoluteUrl(link?.getAttribute("href"));
}

function toAbsoluteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stats & data persistence
// ---------------------------------------------------------------------------

function incrementMatchStats(result: DetectionResult): void {
  incrementStat("postsMatched");
  if (result.source === "onnx") {
    incrementStat("modelMatches");
  }
  if (!stats) return;
  stats.lastMatchAt = new Date().toISOString();
  scheduleLocalStateWrite();
}

function incrementStat(key: keyof Omit<DetectionStats, "lastMatchAt">): void {
  if (!stats) return;
  stats[key] += 1;
  scheduleLocalStateWrite();
}

function markAccountCaught(handle: string): void {
  if (!matchedAccounts) return;

  const existing = matchedAccounts[handle];
  if (!existing || existing.caught) return;

  existing.caught = true;
  existing.caughtAt = new Date().toISOString();
  existing.postsLiked += 1;

  // Allow-listed accounts give 25% player XP to prevent gaming
  const isOnList = settings.miladyListHandles.includes(handle);
  playerStats.totalLikesGiven += isOnList ? 0.25 : 1;
  schedulePlayerStatsWrite();
  scheduleLocalStateWrite();
  updatePlayerLevelBadge();
  playCatchSound();
}

function handleLevelUp(handle: string, _newLevel: number): void {
  if (!matchedAccounts) return;

  const existing = matchedAccounts[handle];
  if (!existing || !existing.caught) return;

  const prevLevel = getLevel(existing.postsLiked);
  existing.postsLiked += 1;
  const newLevel = getLevel(existing.postsLiked);

  const isOnList = settings.miladyListHandles.includes(handle);
  playerStats.totalLikesGiven += isOnList ? 0.25 : 1;
  schedulePlayerStatsWrite();
  scheduleLocalStateWrite();
  updatePlayerLevelBadge();

  if (newLevel > prevLevel) {
    playLevelUpSound();
    // Find the tweet for this handle and trigger visual
    const tweet = document.querySelector<HTMLElement>(
      `[data-miladymaxxer-handle="${handle}"][data-miladymaxxer-state="match"]`,
    );
    if (tweet) {
      triggerLevelUpAnimation(tweet);
    }
  }
}

function addToMiladyList(handle: string): void {
  if (settings.miladyListHandles.includes(handle)) return;
  settings = {
    ...settings,
    miladyListHandles: [...settings.miladyListHandles, handle],
  };
  chrome.storage.sync.set({ miladyListHandles: settings.miladyListHandles });

  // Ensure the account exists in matchedAccounts so it shows in the popup
  if (matchedAccounts && !matchedAccounts[handle]) {
    matchedAccounts[handle] = {
      handle,
      displayName: null,
      postsMatched: 0,
      postsLiked: 0,
      lastMatchedAt: new Date().toISOString(),
      lastDetectionScore: null,
      caught: true,
      caughtAt: new Date().toISOString(),
      verificationStatus: "unverified",
    };
    scheduleLocalStateWrite();
  } else if (matchedAccounts?.[handle] && !matchedAccounts[handle].caught) {
    matchedAccounts[handle].caught = true;
    matchedAccounts[handle].caughtAt = matchedAccounts[handle].caughtAt ?? new Date().toISOString();
    scheduleLocalStateWrite();
  }

  // Clear processed state and effects so tweets get re-evaluated as matches
  for (const tweet of Array.from(document.querySelectorAll<HTMLElement>(`[data-miladymaxxer-handle="${handle}"]`))) {
    processed.delete(tweet);
    delete tweet.dataset.miladymaxxerState;
    delete tweet.dataset.miladymaxxer;
    clearEffects(tweet);
  }
  scheduleProcessVisibleTweets();
}

function removeFromMiladyList(handle: string): void {
  if (!settings.miladyListHandles.includes(handle)) return;
  settings = {
    ...settings,
    miladyListHandles: settings.miladyListHandles.filter((h) => h !== handle),
  };
  chrome.storage.sync.set({ miladyListHandles: settings.miladyListHandles });

  // Uncatch the account so it disappears from the popup caught list
  if (matchedAccounts?.[handle]) {
    matchedAccounts[handle].caught = false;
    scheduleLocalStateWrite();
  }

  // Clear processed state and effects so tweets get re-evaluated
  for (const tweet of Array.from(document.querySelectorAll<HTMLElement>(`[data-miladymaxxer-handle="${handle}"]`))) {
    processed.delete(tweet);
    delete tweet.dataset.miladymaxxerState;
    delete tweet.dataset.miladymaxxer;
    clearEffects(tweet);
  }
  scheduleProcessVisibleTweets();
}

function handleUnlike(handle: string): void {
  if (!matchedAccounts) return;

  const existing = matchedAccounts[handle];
  if (!existing || !existing.caught || existing.postsLiked <= 0) return;

  existing.postsLiked = Math.max(0, existing.postsLiked - 1);
  const isOnList = settings.miladyListHandles.includes(handle);
  playerStats.totalLikesGiven = Math.max(0, playerStats.totalLikesGiven - (isOnList ? 0.25 : 1));
  schedulePlayerStatsWrite();
  scheduleLocalStateWrite();
  updatePlayerLevelBadge();
}

function recordMatchedAccount(handle: string, displayName: string | null, score: number | null): void {
  if (!matchedAccounts) return;

  const existing = matchedAccounts[handle];
  matchedAccounts[handle] = {
    handle,
    displayName: displayName ?? existing?.displayName ?? null,
    postsMatched: (existing?.postsMatched ?? 0) + 1,
    postsLiked: existing?.postsLiked ?? 0,
    lastMatchedAt: new Date().toISOString(),
    lastDetectionScore: score ?? existing?.lastDetectionScore ?? null,
    caught: existing?.caught ?? false,
    caughtAt: existing?.caughtAt ?? null,
    verificationStatus: existing?.verificationStatus ?? "unverified",
  };
  scheduleLocalStateWrite();
}

function recordCollectedAvatar(input: {
  normalizedUrl: string;
  originalUrl: string;
  author: { handle: string; displayName: string | null } | null;
  whitelisted: boolean;
  exampleTweetUrl: string | null;
  exampleNotificationUrl: string | null;
  sourceSurface: string;
  result?: DetectionResult;
}): void {
  if (!collectedAvatars) return;

  const existing = collectedAvatars[input.normalizedUrl];
  const now = new Date().toISOString();
  collectedAvatars[input.normalizedUrl] = {
    normalizedUrl: input.normalizedUrl,
    originalUrl: input.originalUrl || existing?.originalUrl || input.normalizedUrl,
    handles: mergeUniqueStrings(existing?.handles, input.author?.handle ?? null, true),
    displayNames: mergeUniqueStrings(existing?.displayNames, input.author?.displayName ?? null, false),
    sourceSurfaces: mergeUniqueStrings(existing?.sourceSurfaces, input.sourceSurface, false),
    seenCount: (existing?.seenCount ?? 0) + 1,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    exampleProfileUrl:
      existing?.exampleProfileUrl ?? (input.author ? toAbsoluteUrl(`/${input.author.handle}`) : null),
    exampleNotificationUrl: existing?.exampleNotificationUrl ?? input.exampleNotificationUrl,
    exampleTweetUrl: existing?.exampleTweetUrl ?? input.exampleTweetUrl,
    heuristicMatch:
      typeof input.result?.matched === "boolean" ? input.result.matched : existing?.heuristicMatch ?? null,
    heuristicSource: input.result?.source ?? existing?.heuristicSource ?? null,
    heuristicScore:
      typeof input.result?.score === "number" ? input.result.score : existing?.heuristicScore ?? null,
    heuristicTokenId:
      typeof input.result?.tokenId === "number" ? input.result.tokenId : existing?.heuristicTokenId ?? null,
    whitelisted: input.whitelisted || existing?.whitelisted === true,
  };
  scheduleLocalStateWrite();
}

function scheduleLocalStateWrite(): void {
  if (localStateWriteScheduled || !stats || !matchedAccounts || !collectedAvatars) return;
  localStateWriteScheduled = true;
  window.setTimeout(async () => {
    localStateWriteScheduled = false;
    if (!stats || !matchedAccounts || !collectedAvatars) return;
    await Promise.all([
      saveStats(stats),
      saveMatchedAccounts(matchedAccounts),
      saveCollectedAvatars(collectedAvatars),
    ]);
  }, 250);
}

function schedulePlayerStatsWrite(): void {
  if (playerStatsWriteScheduled) return;
  playerStatsWriteScheduled = true;
  window.setTimeout(async () => {
    playerStatsWriteScheduled = false;
    await savePlayerStats(playerStats);
  }, 250);
}

let prevPlayerLevel = 0;

function updatePlayerLevelBadge(): void {
  const logoImg = document.querySelector(`.${LOGO_REPLACEMENT_CLASS}`);
  if (!logoImg) return;
  const wrapper = logoImg.parentElement;
  if (!wrapper) return;

  const progress = getPlayerLevelProgress(playerStats.totalLikesGiven);
  const newLevel = progress.level;

  // Check for level up
  if (newLevel > prevPlayerLevel && prevPlayerLevel > 0) {
    playLevelUpSound();
    try { chrome.runtime.sendMessage({ type: "milady:levelup", level: newLevel }); } catch {};
    const existing = wrapper.querySelector(".miladymaxxer-player-level") as HTMLElement | null;
    if (existing) {
      existing.style.transform = "scale(1.3)";
      existing.style.transition = "transform 0.3s ease";
      setTimeout(() => {
        existing.style.transform = "";
      }, 400);
    }
  }
  prevPlayerLevel = newLevel;

  // Update extension badge with player level
  try { chrome.runtime.sendMessage({ type: "milady:badge", count: newLevel > 0 ? newLevel : 0 }); } catch {}

  let badge = wrapper.querySelector(".miladymaxxer-player-level") as HTMLElement | null;
  const filled = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 4) : 0;
  const ascii = "\u2593".repeat(filled) + "\u2591".repeat(4 - filled);
  const pct = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 100) : 0;

  // Responsive: detect sidebar width and adjust text
  const sidebar = logoImg.closest('[role="heading"]')?.parentElement?.parentElement ?? logoImg.closest("header, nav")?.parentElement ?? logoImg.closest('[data-testid="primaryColumn"]')?.previousElementSibling;
  const sidebarWidth = sidebar ? (sidebar as HTMLElement).offsetWidth : window.innerWidth;
  let text: string;
  if (sidebarWidth < 88) {
    // Ultra narrow (collapsed sidebar) — just level number
    text = `Lv.${progress.level}`;
  } else if (sidebarWidth < 200) {
    // Narrow (DMs open) — compact
    text = `Lv.${progress.level} ${pct}%`;
  } else {
    // Normal — full display
    text = `Lv. ${progress.level} ${ascii} ${pct}%`;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "miladymaxxer-player-level";
    wrapper.appendChild(badge);
  }
  badge.textContent = text;
  badge.title = `Player Level ${progress.level} \u00b7 ${progress.current}/${progress.needed} to next level\n${playerStats.totalLikesGiven} total milady likes`;
}

function mergeUniqueStrings(
  existing: string[] | undefined,
  incoming: string | null,
  normalizeHandles: boolean,
): string[] {
  const values = new Set(existing ?? []);
  const normalized = incoming
    ? (normalizeHandles ? normalizeHandle(incoming) : incoming.trim())
    : "";
  if (normalized) {
    values.add(normalized);
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

// ---------------------------------------------------------------------------
// Storage observation
// ---------------------------------------------------------------------------

function isFilterMode(value: unknown): value is ExtensionSettings["mode"] {
  return value === "off" || value === "milady" || value === "debug";
}

async function hasRemiStatsBeetles(handle: string): Promise<boolean> {
  if (!settings.includeRemiStatsBeetles) return false;
  const normalized = normalizeHandle(handle);
  if (!normalized) return false;
  let cached = remiStatsBeetleCache.get(normalized);
  if (!cached) {
    cached = fetchRemiStatsBeetles(normalized);
    remiStatsBeetleCache.set(normalized, cached);
  }
  return cached;
}

async function fetchRemiStatsBeetles(handle: string): Promise<boolean> {
  try {
    const response = await safeRuntimeMessage<{
      ok: boolean;
      data?: { user?: { beetles?: unknown } };
    }>({ type: "remistats:getUser", handle });
    if (!response?.ok) return false;
    const beetles = Number(response.data?.user?.beetles);
    return Number.isFinite(beetles) && beetles > 0;
  } catch {
    return false;
  }
}

function observeStorage(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.mode || changes.whitelistHandles || changes.miladyListHandles || changes.includeRemiStatsBeetles || changes.soundEnabled || changes.showLevelBadge || changes.cardTheme)) {
      const nextMode = changes.mode?.newValue;
      const nextIncludeRemiStatsBeetles = changes.includeRemiStatsBeetles?.newValue;
      const nextSoundEnabled = changes.soundEnabled?.newValue;
      const nextShowLevelBadge = changes.showLevelBadge?.newValue;
      const nextCardTheme = changes.cardTheme?.newValue;
      const validThemes: ExtensionSettings["cardTheme"][] = ["full", "no-premium", "silver-only", "off"];
      settings = {
        mode: isFilterMode(nextMode) ? nextMode : settings.mode,
        whitelistHandles: normalizeWhitelistHandles(
          changes.whitelistHandles?.newValue ?? settings.whitelistHandles,
        ),
        miladyListHandles: normalizeWhitelistHandles(
          changes.miladyListHandles?.newValue ?? settings.miladyListHandles,
        ),
        includeRemiStatsBeetles: typeof nextIncludeRemiStatsBeetles === "boolean"
          ? nextIncludeRemiStatsBeetles
          : settings.includeRemiStatsBeetles,
        soundEnabled: typeof nextSoundEnabled === "boolean" ? nextSoundEnabled : settings.soundEnabled,
        showLevelBadge: typeof nextShowLevelBadge === "boolean" ? nextShowLevelBadge : settings.showLevelBadge,
        cardTheme: isCardTheme(nextCardTheme, validThemes) ? nextCardTheme : settings.cardTheme,
      };
      setSoundSettings(settings);
      scheduleProcessVisibleTweets();
    }

    if (area === "local" && changes.stats) {
      stats = normalizeStats(changes.stats.newValue);
    }

    if (area === "local" && changes.matchedAccounts) {
      matchedAccounts = normalizeMatchedAccounts(changes.matchedAccounts.newValue);
    }

    if (area === "local" && changes.collectedAvatars) {
      collectedAvatars = normalizeCollectedAvatars(changes.collectedAvatars.newValue);
    }

    if (area === "local" && changes.playerStats) {
      const raw = changes.playerStats.newValue;
      const candidate = raw && typeof raw === "object" ? raw as { totalLikesGiven?: unknown } : null;
      playerStats = candidate ? { totalLikesGiven: typeof candidate.totalLikesGiven === "number" ? candidate.totalLikesGiven : 0 } : DEFAULT_PLAYER_STATS;
      updatePlayerLevelBadge();
    }
  });
}

function isCardTheme(value: unknown, validThemes: ExtensionSettings["cardTheme"][]): value is ExtensionSettings["cardTheme"] {
  return typeof value === "string" && validThemes.includes(value as ExtensionSettings["cardTheme"]);
}
