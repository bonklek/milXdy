import { getLevel, getLevelProgress } from "./shared/levels";
import { parseCount } from "./shared/parse-count";
import {
  TWEET,
  CELL_INNER_DIV,
  TWEET_USER_AVATAR,
  LIKE_BUTTON,
  LIKE_COUNT,
  UNLIKE_BUTTON,
  UNFOLLOW_BUTTON,
  FOLLOW_BUTTON,
  FOLLOWING_INDICATOR,
  FOLLOWS_YOU_INDICATOR,
  USER_NAME,
} from "./selectors";
import type { ExtensionSettings } from "./shared/types";

// ---------------------------------------------------------------------------
// Context passed in from content.ts so effects can read shared state without
// creating circular dependencies.
// ---------------------------------------------------------------------------

export interface EffectsContext {
  settings: ExtensionSettings;
  processed: WeakMap<HTMLElement, string>;
  onTweetVisible: (tweet: HTMLElement) => void;
  onCatch: (handle: string) => void;
  onLevelUp: (handle: string, newLevel: number) => void;
  onUnlike: (handle: string) => void;
  onAddToMiladyList: (handle: string) => void;
  onRemoveFromMiladyList: (handle: string) => void;
  isAccountCaught: (handle: string) => boolean;
  getAccountPostsLiked: (handle: string) => number;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const placeholders = new WeakMap<HTMLElement, HTMLDivElement>();
const levelBadges = new WeakMap<HTMLElement, HTMLSpanElement>();
const miladyListButtons = new WeakMap<HTMLElement, HTMLButtonElement>();
export const revealed = new WeakMap<HTMLElement, string>();
let miladyLikesThisSession = 0;
const countedLikes = new WeakSet<HTMLElement>();
const xpCreditedKeys = new Set<string>();
const seenTweets = new WeakSet<HTMLElement>(); // tracks tweets we've seen before (for like transition detection)

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasTweetAbove(tweet: HTMLElement): boolean {
  const container = tweet.closest(CELL_INNER_DIV) ?? tweet.parentElement;
  if (!container) return false;
  const prev = container.previousElementSibling;
  return !!prev?.querySelector(TWEET);
}

function hasTweetBelow(tweet: HTMLElement): boolean {
  const container = tweet.closest(CELL_INNER_DIV) ?? tweet.parentElement;
  if (!container) return false;
  const next = container.nextElementSibling;
  return !!next?.querySelector(TWEET);
}

function getEdgeFade(tweet: HTMLElement): string {
  // Only apply edge fades in detail/thread view (/status/ URL)
  if (!/\/status\//.test(window.location.href)) return "none";

  const above = hasTweetAbove(tweet);
  const below = hasTweetBelow(tweet);
  if (above && below) return "both";
  if (above) return "top";
  if (below) return "bottom";
  return "none";
}

function isOnProfilePage(): boolean {
  // Profile pages have /{handle} as the path with no /status/ or /home
  const path = window.location.pathname;
  return !path.includes("/status/") && !path.includes("/home") && !path.includes("/search") && !path.includes("/explore") && !path.includes("/notifications") && /^\/[^/]+\/?$/.test(path);
}

function isCellInThread(container: Element): boolean {
  // Twitter removes the bottom border on cells that are part of a reply chain
  const style = getComputedStyle(container);
  return style.borderBottomWidth === "0px" || style.borderBottomStyle === "none";
}

function hasMiladyAbove(tweet: HTMLElement): boolean {
  const container = tweet.closest(CELL_INNER_DIV) ?? tweet.parentElement;
  if (!container) return false;
  const prev = container.previousElementSibling;
  const prevTweet = prev?.querySelector<HTMLElement>(TWEET);
  return prevTweet?.dataset.miladymaxxerState === "match";
}

function hasMiladyBelow(tweet: HTMLElement): boolean {
  const nextTweet = getNextTweet(tweet);
  return nextTweet?.dataset.miladymaxxerState === "match";
}

function getPreviousTweet(tweet: HTMLElement): HTMLElement | null {
  const container = tweet.closest(CELL_INNER_DIV) ?? tweet.parentElement;
  if (!container) return null;
  const prev = container.previousElementSibling;
  return prev?.querySelector<HTMLElement>(TWEET) ?? null;
}

function getNextTweet(tweet: HTMLElement): HTMLElement | null {
  const container = tweet.closest(CELL_INNER_DIV) ?? tweet.parentElement;
  if (!container) return null;
  const next = container.nextElementSibling;
  return next?.querySelector<HTMLElement>(TWEET) ?? null;
}

function isMiladyReplyContext(tweet: HTMLElement): boolean {
  return /\/status\//.test(window.location.pathname) && hasMiladyBelow(tweet);
}

function revealRepliedToContext(tweet: HTMLElement): void {
  if (!/\/status\//.test(window.location.pathname)) return;
  const previousTweet = getPreviousTweet(tweet);
  if (!previousTweet || previousTweet.dataset.miladymaxxerState === "match") return;
  clearPlaceholder(previousTweet);
  previousTweet.style.display = "";
}

function applyDebugState(tweet: HTMLElement): void {
  if (tweet.dataset.miladymaxxerState === "match") {
    tweet.dataset.miladymaxxerEffect = "debug-match";
    return;
  }

  tweet.dataset.miladymaxxerEffect = "debug-miss";
}

function fullAppearanceActive(): boolean {
  return document.documentElement.dataset.milxdyReskinProfile === "max";
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export function clearVisualState(tweet: HTMLElement): void {
  delete tweet.dataset.miladymaxxerEffect;
  delete tweet.dataset.miladymaxxerDiamond;
  delete tweet.dataset.miladymaxxerNoLikes;
  delete tweet.dataset.miladymaxxerUncaught;
  delete tweet.dataset.miladymaxxerMint;
  delete tweet.dataset.miladymaxxerLiked;
  delete tweet.dataset.miladymaxxerFade;
  delete tweet.dataset.miladymaxxerAdjacentAbove;
  delete tweet.dataset.miladymaxxerAdjacentBelow;
  delete tweet.dataset.miladymaxxerRetweeted;
}

export function clearPlaceholder(tweet: HTMLElement): void {
  const placeholder = placeholders.get(tweet);
  if (placeholder) {
    placeholder.remove();
    placeholders.delete(tweet);
  }
}

export function clearEffects(tweet: HTMLElement): void {
  clearVisualState(tweet);
  delete tweet.dataset.miladymaxxerDebug;
  clearPlaceholder(tweet);
  tweet.style.display = "";
}

function getLikeCount(tweet: HTMLElement): number {
  // Check both like (not yet liked) and unlike (already liked) buttons
  const button = tweet.querySelector<HTMLElement>(LIKE_BUTTON) ||
                 tweet.querySelector<HTMLElement>(UNLIKE_BUTTON);
  if (!button) return -1;

  // Parse from aria-label (e.g., "123 Likes. Like" or "5 Likes. Unlike")
  const ariaLabel = button.getAttribute("aria-label") || "";
  const ariaMatch = ariaLabel.match(/^([\d,.]+)\s/);
  if (ariaMatch) {
    return parseCount(ariaMatch[1].replace(/,/g, ""));
  }

  // No number prefix means 0 likes
  if (/^(Like|Unlike|Likes)/.test(ariaLabel)) return 0;

  // Fallback: visible text count
  const countSpan = button.querySelector(LIKE_COUNT);
  if (!countSpan) return 0;

  const countText = countSpan.textContent?.trim();
  return countText ? parseCount(countText) : 0;
}

export function hasLowLikes(tweet: HTMLElement): boolean {
  const count = getLikeCount(tweet);
  return count >= 0 && count < 75;
}

export function hasHighLikes(tweet: HTMLElement): boolean {
  return getLikeCount(tweet) >= 250;
}

export function hasUserLiked(tweet: HTMLElement): boolean {
  // If unlike button exists, user has liked this post
  return !!tweet.querySelector<HTMLElement>(UNLIKE_BUTTON);
}

export function hasUserRetweeted(tweet: HTMLElement): boolean {
  return !!tweet.querySelector('[data-testid="unretweet"]');
}

export function doesUserFollow(tweet: HTMLElement): boolean {
  // Check for unfollow button - if it exists, user definitely follows them
  const unfollowButton = tweet.querySelector<HTMLElement>(UNFOLLOW_BUTTON);
  if (unfollowButton) {
    return true;
  }

  // Check for "Following" in any button aria-label
  const followingButton = tweet.querySelector<HTMLElement>(FOLLOWING_INDICATOR);
  if (followingButton) {
    return true;
  }

  // Check for Follow button with specific aria-label pattern
  const followButton = tweet.querySelector<HTMLElement>(FOLLOW_BUTTON);
  if (followButton) {
    const ariaLabel = followButton.getAttribute("aria-label") || "";
    // "Follow @username" means NOT following
    if (ariaLabel.startsWith("Follow @")) {
      return false;
    }
    // "Following @username" means following
    if (ariaLabel.startsWith("Following")) {
      return true;
    }
  }

  // Check if there's a "Follows you" badge - they follow you but you might not follow back
  const followsYou = tweet.querySelector(FOLLOWS_YOU_INDICATOR);
  if (followsYou) {
    return false;
  }

  // No follow-related buttons found — assume not following
  return false;
}

const XP_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function isTweetTooOldForXP(tweet: HTMLElement): boolean {
  const timeEl = tweet.querySelector("time");
  const datetime = timeEl?.getAttribute("datetime");
  if (!datetime) return false;
  const age = Date.now() - new Date(datetime).getTime();
  return age > XP_MAX_AGE_MS;
}

function updateMiladyListButton(ctx: EffectsContext, tweet: HTMLElement): void {
  const handle = tweet.dataset.miladymaxxerHandle;

  if (!handle || ctx.settings.mode !== "milady") {
    removeMiladyListButton(tweet);
    return;
  }

  const isOnList = ctx.settings.miladyListHandles.includes(handle);
  const isMiss = tweet.dataset.miladymaxxerState === "miss";

  // Show "+" on non-milady tweets, or "-" on manually-added milady tweets
  if (!isMiss && !isOnList) {
    removeMiladyListButton(tweet);
    return;
  }

  let btn = miladyListButtons.get(tweet);
  if (!btn) {
    btn = document.createElement("button");
    btn.className = "miladymaxxer-add-btn";
    btn.type = "button";
    miladyListButtons.set(tweet, btn);
  }

  // Re-bind click handler every time so it captures current ctx
  btn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const h = tweet.dataset.miladymaxxerHandle;
    if (!h) return;
    if (btn!.dataset.miladyListState === "remove") {
      ctx.onRemoveFromMiladyList(h);
    } else {
      ctx.onAddToMiladyList(h);
    }
  };

  // Update button appearance based on list state
  if (isOnList) {
    btn.textContent = "\u2212"; // minus sign
    btn.title = `Remove @${handle} from milady list`;
    btn.dataset.miladyListState = "remove";
  } else {
    btn.textContent = "+";
    btn.title = `Add @${handle} to milady list`;
    btn.dataset.miladyListState = "add";
  }

  if (!btn.isConnected) {
    // Place after the level badge if it exists
    const existingBadge = levelBadges.get(tweet);
    if (existingBadge?.isConnected) {
      existingBadge.after(btn);
    } else {
      // Use the same injection logic as the level badge
      injectInlineElement(tweet, btn);
    }
  }
}

function removeMiladyListButton(tweet: HTMLElement): void {
  const btn = miladyListButtons.get(tweet);
  if (btn) {
    btn.remove();
    miladyListButtons.delete(tweet);
  }
}

function xpKeyForTweet(handle: string, tweet: HTMLElement): string | null {
  const statusLink = tweet.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
  const href = statusLink?.getAttribute("href");
  return href ? `${handle}:${href}` : handle;
}

function asciiProgressBar(current: number, needed: number, width: number = 3): string {
  const filled = needed > 0 ? Math.round((current / needed) * width) : 0;
  return "\u2593".repeat(filled) + "\u2591".repeat(width - filled);
}

function findTopUserName(tweet: HTMLElement): HTMLElement | null {
  const userNames = tweet.querySelectorAll<HTMLElement>(USER_NAME);
  for (const el of Array.from(userNames)) {
    if (!el.closest('[data-testid="quoteTweet"]')) {
      return el;
    }
  }
  return null;
}

function injectInlineElement(tweet: HTMLElement, element: HTMLElement): void {
  const topUserName = findTopUserName(tweet);
  if (!topUserName) return;

  // Timeline view: timestamp is inside User-Name row
  const timeEl = topUserName.querySelector("time");
  if (timeEl) {
    const anchor = timeEl.closest("a") ?? timeEl.parentElement;
    if (anchor?.parentElement) {
      anchor.parentElement.appendChild(element);
      return;
    }
  }

  // Detail view: place after the @handle span
  const allSpans = topUserName.querySelectorAll("span");
  for (const span of Array.from(allSpans)) {
    if (span.textContent?.trim()?.startsWith("@") && span.children.length === 0) {
      span.after(element);
      return;
    }
  }
}

const badgePrevText = new WeakMap<HTMLElement, string>();

function updateLevelBadge(ctx: EffectsContext, tweet: HTMLElement): void {
  const handle = tweet.dataset.miladymaxxerHandle;
  if (!handle || !ctx.settings.showLevelBadge) {
    removeLevelBadge(tweet);
    return;
  }

  const postsLiked = ctx.getAccountPostsLiked(handle);
  const progress = getLevelProgress(postsLiked);
  const newText = ` \u00b7 Lv.${progress.level} ${asciiProgressBar(progress.current, progress.needed)}`;

  let badge = levelBadges.get(tweet);
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "miladymaxxer-level-inline";
    levelBadges.set(tweet, badge);
  }

  // Flash when text changes (XP gained or level up)
  const prevText = badgePrevText.get(tweet);
  if (prevText && prevText !== newText) {
    badge.classList.remove("miladymaxxer-level-flash");
    void badge.offsetWidth; // force reflow to restart animation
    badge.classList.add("miladymaxxer-level-flash");
  }
  badgePrevText.set(tweet, newText);

  badge.textContent = newText;

  if (!badge.isConnected) {
    injectInlineElement(tweet, badge);
  }
}

function removeLevelBadge(tweet: HTMLElement): void {
  const badge = levelBadges.get(tweet);
  if (badge) {
    badge.remove();
    levelBadges.delete(tweet);
  }
}

function triggerCatchAnimation(tweet: HTMLElement): void {
  if (tweet.dataset.miladymaxxerCatchAnim) return;
  tweet.dataset.miladymaxxerCatchAnim = "catch";
  tweet.addEventListener("animationend", () => {
    delete tweet.dataset.miladymaxxerCatchAnim;
  }, { once: true });
}

export function triggerLevelUpAnimation(tweet: HTMLElement): void {
  if (tweet.dataset.miladymaxxerCatchAnim) return;
  tweet.dataset.miladymaxxerCatchAnim = "levelup";
  tweet.addEventListener("animationend", () => {
    delete tweet.dataset.miladymaxxerCatchAnim;
  }, { once: true });
}

export function applyHiddenState(ctx: EffectsContext, tweet: HTMLElement): void {
  let placeholder = placeholders.get(tweet);
  if (!placeholder) {
    placeholder = document.createElement("div");
    placeholder.className = "miladymaxxer-placeholder";
    const label = document.createElement("span");
    label.textContent = "Milady post hidden";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Show";
    button.addEventListener("click", () => {
      const normalizedUrl = ctx.processed.get(tweet);
      if (normalizedUrl) {
        revealed.set(tweet, normalizedUrl);
      }
      tweet.style.display = "";
      placeholder?.remove();
      placeholders.delete(tweet);
    });
    placeholder.append(label, button);
    placeholders.set(tweet, placeholder);
  }

  if (!placeholder.isConnected) {
    tweet.insertAdjacentElement("beforebegin", placeholder);
  }

  tweet.style.display = "none";
}

export function applyMode(ctx: EffectsContext, tweet: HTMLElement, normalizedUrl?: string): void {
  if (document.documentElement.dataset.milxdyVisualDisableMaxxer === "true") {
    clearEffects(tweet);
    return;
  }
  ctx.onTweetVisible(tweet);
  clearVisualState(tweet);
  const isMatch = tweet.dataset.miladymaxxerState === "match";
  const miladyOnly = document.documentElement.dataset.milxdyVisualMiladyOnly === "true";
  const disableSelfTracking = document.documentElement.dataset.milxdyVisualDisableSelfTracking === "true";
  const isSelf = tweet.dataset.miladymaxxerSelf === "true";
  const allowPostHighlight = fullAppearanceActive();

  switch (ctx.settings.mode) {
    case "milady":
      // Enhance milady posts, diminish non-milady posts
      clearPlaceholder(tweet);
      tweet.style.display = "";
      if (isMatch) {
        // Card theming off — skip visual effects but keep XP/catch
        if (ctx.settings.cardTheme === "off" || !allowPostHighlight) {
          delete tweet.dataset.miladymaxxerEffect;
        } else {
          tweet.dataset.miladymaxxerEffect = "milady";
        }
        // Tighten margin between adjacent milady cards in threads
        const canTighten = /\/status\//.test(window.location.href);
        if (canTighten && hasMiladyAbove(tweet)) {
          tweet.dataset.miladymaxxerAdjacentAbove = "true";
        } else {
          delete tweet.dataset.miladymaxxerAdjacentAbove;
        }
        if (canTighten && hasMiladyBelow(tweet)) {
          tweet.dataset.miladymaxxerAdjacentBelow = "true";
        } else {
          delete tweet.dataset.miladymaxxerAdjacentBelow;
        }
        // Set edge fade based on adjacent tweets
        const fade = getEdgeFade(tweet);
        if (fade !== "none") {
          tweet.dataset.miladymaxxerFade = fade;
        } else {
          delete tweet.dataset.miladymaxxerFade;
        }
        // Card tier based on cardTheme setting
        const handle_ = tweet.dataset.miladymaxxerHandle;
        const isCaught = handle_ ? ctx.isAccountCaught(handle_) : false;
        const postsLiked_ = handle_ ? ctx.getAccountPostsLiked(handle_) : 0;
        const theme = ctx.settings.cardTheme ?? "full";
        if (theme === "off" || theme === "silver-only") {
          // Force all milady cards to silver
          tweet.dataset.miladymaxxerUncaught = "true";
          delete tweet.dataset.miladymaxxerMint;
        } else if (!isCaught || postsLiked_ === 0) {
          tweet.dataset.miladymaxxerUncaught = "true";
          delete tweet.dataset.miladymaxxerMint;
        } else if (hasLowLikes(tweet) || theme === "no-premium") {
          // no-premium: treat everything as mint (no gold/diamond)
          tweet.dataset.miladymaxxerMint = "true";
          delete tweet.dataset.miladymaxxerUncaught;
        } else {
          delete tweet.dataset.miladymaxxerUncaught;
          delete tweet.dataset.miladymaxxerMint;
        }
        // Diamond tier — only in full theme
        if (theme === "full" && hasHighLikes(tweet)) {
          tweet.dataset.miladymaxxerDiamond = "true";
        } else {
          delete tweet.dataset.miladymaxxerDiamond;
        }
        // Check if user has liked
        if (hasUserLiked(tweet)) {
          tweet.dataset.miladymaxxerLiked = "true";
          if (!countedLikes.has(tweet)) {
            countedLikes.add(tweet);
            miladyLikesThisSession += 1;
            // Only credit XP if we previously saw this tweet as unliked
            // (meaning the user clicked like during this session)
            if (!seenTweets.has(tweet)) {
              // First time seeing this element and it's already liked — pre-existing like, skip XP
              seenTweets.add(tweet);
            } else {
              // We saw it before (as unliked), now it's liked — real like action
              const handle = tweet.dataset.miladymaxxerHandle;
              const xpKey = handle ? xpKeyForTweet(handle, tweet) : null;
          if (handle && xpKey && !isSelf && !isTweetTooOldForXP(tweet) && !xpCreditedKeys.has(xpKey)) {
                xpCreditedKeys.add(xpKey);
                if (!ctx.isAccountCaught(handle)) {
                  ctx.onCatch(handle);
                  triggerCatchAnimation(tweet);
                } else {
                  ctx.onLevelUp(handle, 0);
                }
              }
            }
          }
        } else {
          // Mark as seen (unliked state) so future like click is credited
          seenTweets.add(tweet);
          delete tweet.dataset.miladymaxxerLiked;
          if (countedLikes.has(tweet)) {
            countedLikes.delete(tweet);
            miladyLikesThisSession = Math.max(0, miladyLikesThisSession - 1);
            const handle = tweet.dataset.miladymaxxerHandle;
            const xpKey = handle ? xpKeyForTweet(handle, tweet) : null;
            if (handle && xpKey && !isTweetTooOldForXP(tweet) && xpCreditedKeys.has(xpKey)) {
              xpCreditedKeys.delete(xpKey);
              ctx.onUnlike(handle);
            }
          }
        }
        // Retweet boost — thicker outline
        if (hasUserRetweeted(tweet)) {
          tweet.dataset.miladymaxxerRetweeted = "true";
        } else {
          delete tweet.dataset.miladymaxxerRetweeted;
        }
        if (disableSelfTracking && isSelf) removeLevelBadge(tweet);
        else updateLevelBadge(ctx, tweet);
        updateMiladyListButton(ctx, tweet);
        revealRepliedToContext(tweet);
        return;
      }
      removeLevelBadge(tweet);
      updateMiladyListButton(ctx, tweet);
      if (ctx.settings.hideNonMiladyOrBeetlePosts && !isMiladyReplyContext(tweet)) {
        tweet.style.display = "none";
        return;
      }
      if (miladyOnly && !isAllowedMiladyOnlyContext(tweet)) {
        tweet.style.display = "none";
        return;
      }
      tweet.dataset.miladymaxxerEffect = "diminish";
      delete tweet.dataset.miladymaxxerThread;
      delete tweet.dataset.miladymaxxerNoLikes;
      delete tweet.dataset.miladymaxxerLiked;
      return;
    case "debug":
      removeLevelBadge(tweet);
      removeMiladyListButton(tweet);
      clearPlaceholder(tweet);
      applyDebugState(tweet);
      tweet.style.display = "";
      return;
    case "off":
    default:
      removeLevelBadge(tweet);
      removeMiladyListButton(tweet);
      clearPlaceholder(tweet);
      tweet.style.display = "";
  }
}

function isAllowedMiladyOnlyContext(tweet: HTMLElement): boolean {
  if (/\/status\//.test(window.location.pathname)) return true;
  if (tweet.querySelector('[data-testid="quoteTweet"]')) return true;
  if (tweet.querySelector('a[href*="/status/"]')) {
    const replyText = tweet.textContent || "";
    if (/replying to/i.test(replyText)) return true;
  }
  return false;
}
