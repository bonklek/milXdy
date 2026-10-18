import { refreshPokeAuthentication } from "./auth-poke-refresh";
import { maintainBadgeTextFlow, releaseBadgeTextFlow, insertBadgeSlot, positionBadgeSlotNearTweetTime, markBadgeSlotEmpty, removeEmptyBadgeRow } from "./badge-flow";
import { tweetOwnsNode, quotedTweetRoot, quotedTweetHandle, badgeMatchesTweetAuthor, tweetBadgeAnchor } from "../../lib/tweet-ownership";
import { resolveBadgeProfiles } from "./badge-profile-lookup";
import { BANNER_SETTING_DEFAULTS, readBannerSettings, updateBannerSettings } from "./profile-banner-sources";
import { readPokeCooldownMs, formatPokeCooldown } from "./poke-cooldown-time";
import { createPokeClickHandler, renderPokeButtonState } from "./poke-feedback";
import { recordFeatureTiming } from "../../platform/diagnostics/performance-diagnostics";
import { DEFAULT_VISUAL_THEME, normalizeVisualTheme } from "../../platform/visuals/reskin-profile";
import { createFallbackRuntimeScheduler } from "../../platform/runtime/scheduler";
import { profileBadgeIdentity, exactXProfileHandle, findExactProfileBannerRoot } from "./profile-page";
import { exactDirectoryProfileIdentity, shouldForceExactDirectoryProfileRetry } from "./profile-identity";
import { createTrophyBannerMedia, preloadDisplayImage } from "./trophy-banner-media";
import { clearBannerNftLabel, clearBannerOverlay, setBannerNftLabel, transitionBannerOverlay, transitionBannerToOriginal } from "./banner-overlay-view";
import { createProfileBannerController } from "./profile-banner-controller";
import { createBannerCycleService } from "./banner-cycle-service";
import { createRemiStatsEffects } from "./runtime-effects.js";

// Content script for overlaying user scores on X.com.
const REMINET_CONTENT_VERSION = 'reminet-poke-direct-2026-06-23';
const runtimeEffects = createRemiStatsEffects();

// Configuration
const CONFIG = {
  apiEndpoint: 'https://api.remistats.net/user', // Real API endpoint
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  observerDebounce: 100,
  batchSize: 50, // Max usernames per batch request
  batchDelay: 100 // Delay before sending batch (ms)
};

const REMILIA_BASE_URL = 'https://www.remilia.net';
let bannerSettings = readBannerSettings({});

// Cache for user scores
const scoreCache = new Map();
const SCORE_CACHE_LIMIT = 1000;
const reminetProcessingElements = new Set();

// Batch fetching queue
let batchQueue = new Set();
let batchTimeout = null;
const batchPromises = new Map();
let pokeTargetBatchQueue = new Set();
let pokeTargetBatchTimeout = null;
const pokeTargetBatchPromises = new Map();
const pokeTargetLatestRequests = new Map();
let pokeTargetRequestGeneration = 0;

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Routes that look like usernames in URLs but aren't
const ROUTE_BLOCKLIST = new Set([
  'home', 'explore', 'notifications', 'messages', 'settings', 'compose',
  'search', 'i', 'tos', 'privacy', 'login', 'signup', 'logout', 'about',
  'jobs', 'lists', 'bookmarks', 'communities', 'topics', 'verified-orgs-signup'
]);

function cleanRouteUsername(candidate) {
  const clean = cleanUsername(candidate);
  return clean && !ROUTE_BLOCKLIST.has(clean.toLowerCase()) ? clean : null;
}

function markReminetProcessing(element, timestamped = false) {
  if (!element) return;
  element.setAttribute('data-reminet-processing', 'true');
  if (timestamped) element.dataset.reminetProcessingAt = String(Date.now());
  reminetProcessingElements.add(element);
}

function clearReminetProcessing(element) {
  if (!element) return;
  element.removeAttribute('data-reminet-processing');
  delete element.dataset.reminetProcessingAt;
  reminetProcessingElements.delete(element);
}

function usernameFromStatusHref(href) {
  const match = String(href || '').match(/^(?:https?:\/\/(?:twitter|x)\.com)?\/([^\/\?#]+)\/status\/\d+/i);
  return match ? cleanRouteUsername(match[1]) : null;
}

function surfaceOwnsNode(surface, node) {
  return Boolean(surface && tweetOwnsNode(surface, node));
}

function surfaceIsInsideQuoteTweet(surface) {
  const quoteTweet = surface ? quotedTweetRoot(surface) : null;
  return Boolean(quoteTweet && quoteTweet !== surface);
}

function findOwnedNode(surface, selector) {
  return Array.from(surface?.querySelectorAll?.(selector) || [])
    .find((node) => surfaceOwnsNode(surface, node)) || null;
}

function findOwnedUserName(surface) {
  return findOwnedNode(surface, '[data-testid="User-Name"]');
}

function findOwnedHeaderTime(surface) {
  const userName = findOwnedUserName(surface);
  if (!userName) return null;
  return Array.from(userName.querySelectorAll('time'))
    .find((node) => surfaceOwnsNode(surface, node)) || null;
}

// Find the first profile-link username inside a container, skipping routes
// like /messages/<id> that appear in DM cells before the avatar link.
function findUsernameInLinks(container) {
  const links = container.querySelectorAll('a[href^="/"]');
  for (const link of links) {
    if (!surfaceOwnsNode(container, link)) continue;
    const href = link.getAttribute('href');
    if (href.includes('/status/')) continue;
    const match = href.match(/^\/([^\/\?#]+)(?:\/|$)/);
    if (!match) continue;
    const candidate = cleanRouteUsername(match[1]);
    if (!candidate) continue;
    return candidate;
  }
  return null;
}

function findTweetAuthorUsername(tweet) {
  const userNameContainer = Array.from(tweet.querySelectorAll('[data-testid="User-Name"]'))
    .find((node) => surfaceOwnsNode(tweet, node));
  if (userNameContainer) {
    for (const link of Array.from(userNameContainer.querySelectorAll('a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]'))) {
      const href = link.getAttribute('href');
      if (href?.includes('/status/')) continue;
      const match = String(href || '').match(/^(?:https?:\/\/(?:twitter|x)\.com)?\/([^\/\?#]+)(?:\/|$)/i);
      const handle = match ? cleanRouteUsername(match[1]) : null;
      if (handle) return handle;
    }
  }

  const statusLink = Array.from(tweet.querySelectorAll('a[href*="/status/"]'))
    .find((link) => surfaceOwnsNode(tweet, link));
  const fromStatus = usernameFromStatusHref(statusLink?.getAttribute('href'));
  if (fromStatus) return fromStatus;

  return null;
}

// Extract username from X's avatar testid convention: UserAvatar-Container-<username>
function extractUsernameFromAvatar(container) {
  const avatar = findOwnedNode(container, '[data-testid^="UserAvatar-Container-"]');
  if (avatar) {
    const testid = avatar.getAttribute('data-testid');
    const candidate = cleanRouteUsername(testid.replace('UserAvatar-Container-', '').trim());
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

// Extract username from various Twitter/X elements
function extractUsername(element) {
  if (quotedTweetRoot(element) === element) return quotedTweetHandle(element);
  const userCell = element.closest('[data-testid="UserCell"]');
  const tweet = element.closest('[data-testid="tweet"]');
  const container = userCell || tweet;

  let username = null;

  if (container) {
    if (tweet) {
      username = findTweetAuthorUsername(tweet);
    }

    if (!username) {
      username = extractUsernameFromAvatar(container);
    }

    if (!username) {
      username = findUsernameInLinks(container);
    }

    if (!username) {
      const screenNameEl = container.querySelector('[data-screen-name]');
      if (screenNameEl) {
        username = screenNameEl.getAttribute('data-screen-name');
      }
    }

    if (!username) {
      const profileLink = container.querySelector('a[aria-label*="@"]');
      if (profileLink) {
        const label = profileLink.getAttribute('aria-label');
        const match = label.match(/@(\w+)/);
        if (match) {
          username = match[1];
        }
      }
    }
  }

  return username ? username.replace('@', '') : null;
}

// Store max values globally
let maxBeetles = 100;
let maxScore = 1000;
let remistatsEnabled = true;
let reminetDelegationInstalled = false;
let removeRemiStatsDelegation = null;
let activeTooltipBadge = null;
let tooltipHideTimer = null;
const pokeCooldowns = new Map();
const pokeCooldownSources = new Map();
const pokeCountdownTimers = new Map();
const pokeButtonsByUsername = new Map();
const pokeEligibilityChecked = new Set();
const confirmedPokeTargets = new Map();
const confirmedProfileIdentities = new Map();
const profileIdentityPending = new Map();
const profileIdentityLatestRequests = new Map();
const profileIdentityForcedRouteKeys = new Set();
let profileIdentityRequestGeneration = 0;
let incomingPokeCache = null;
let recordRemiStatsRuntimePhase = () => undefined;

function recordRuntimePhase(channel, phase) {
  recordRemiStatsRuntimePhase('runtimePhase', { channel, phase });
}
let visualTheme = DEFAULT_VISUAL_THEME;
let likeAutoPokeEnabled = false;
let pokeAutoLikeEnabled = false;
const autoLikeClickTargets = new WeakSet();
const DEFAULT_ICON_SETTINGS = {
  enabled: true,
  score: true,
  beetle: true,
  poke: true,
};
let iconSettings = { ...DEFAULT_ICON_SETTINGS };
const POKE_THEME_COLORS = new Set(['red', 'green', 'gold', 'blue', 'purple']);
const POKE_THEME_MODES = new Set(['dark', 'light']);

function setScoreCache(key, value) {
  if (scoreCache.has(key)) scoreCache.delete(key);
  scoreCache.set(key, value);
  while (scoreCache.size > SCORE_CACHE_LIMIT) {
    const oldest = scoreCache.keys().next().value;
    if (oldest === undefined) break;
    scoreCache.delete(oldest);
  }
}

function setConfirmedPokeTarget(xHandle, remiliaUsername) {
  const cleanXHandle = cleanExactXHandle(xHandle).toLowerCase();
  const cleanRemilia = cleanRemiliaUsername(remiliaUsername).toLowerCase();
  if (!cleanXHandle) return null;
  if (!cleanRemilia) {
    confirmedPokeTargets.delete(cleanXHandle);
    return null;
  }
  if (confirmedPokeTargets.has(cleanXHandle)) confirmedPokeTargets.delete(cleanXHandle);
  confirmedPokeTargets.set(cleanXHandle, cleanRemilia);
  while (confirmedPokeTargets.size > SCORE_CACHE_LIMIT) {
    const oldest = confirmedPokeTargets.keys().next().value;
    if (oldest === undefined) break;
    confirmedPokeTargets.delete(oldest);
  }
  return { xHandle: cleanXHandle, remiliaUsername: cleanRemilia };
}

function isConfirmedPokeTarget(username, xHandle) {
  const cleanXHandle = cleanExactXHandle(xHandle).toLowerCase();
  const cleanRemilia = cleanRemiliaUsername(username).toLowerCase();
  return Boolean(
    cleanXHandle
    && cleanRemilia
    && confirmedPokeTargets.get(cleanXHandle) === cleanRemilia
  );
}

function setConfirmedProfileIdentity(xHandle, remiliaUsername) {
  const cleanXHandle = cleanExactXHandle(xHandle).toLowerCase();
  const cleanRemilia = cleanRemiliaUsername(remiliaUsername).toLowerCase();
  if (!cleanXHandle) return null;
  if (!cleanRemilia) {
    confirmedProfileIdentities.delete(cleanXHandle);
    return null;
  }
  if (confirmedProfileIdentities.has(cleanXHandle)) confirmedProfileIdentities.delete(cleanXHandle);
  confirmedProfileIdentities.set(cleanXHandle, cleanRemilia);
  while (confirmedProfileIdentities.size > SCORE_CACHE_LIMIT) {
    const oldest = confirmedProfileIdentities.keys().next().value;
    if (oldest === undefined) break;
    confirmedProfileIdentities.delete(oldest);
  }
  return { xHandle: cleanXHandle, remiliaUsername: cleanRemilia };
}

function isConfirmedProfileIdentity(username, xHandle) {
  const cleanXHandle = cleanExactXHandle(xHandle).toLowerCase();
  const cleanRemilia = cleanRemiliaUsername(username).toLowerCase();
  return Boolean(
    cleanXHandle
    && cleanRemilia
    && confirmedProfileIdentities.get(cleanXHandle) === cleanRemilia
  );
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function formatMetric(value, fallback = 0) {
  return String(nonNegativeNumber(value, fallback));
}

function cssEscape(value) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : String(value).replace(/["\\]/g, '\\$&');
}

async function loadIconSettings() {
  const settings = await chrome.storage.sync.get({
    'milxdy.remistats.icons.enabled': true,
    'milxdy.remistats.icons.score': true,
    'milxdy.remistats.icons.beetle': true,
    'milxdy.remistats.icons.poke': true,
  });
  iconSettings = {
    enabled: settings['milxdy.remistats.icons.enabled'] !== false,
    score: settings['milxdy.remistats.icons.score'] !== false,
    beetle: settings['milxdy.remistats.icons.beetle'] !== false,
    poke: settings['milxdy.remistats.icons.poke'] !== false,
  };
  applyIconSettings();
}

async function loadPokeAutoLikeSetting() {
  const settings = await chrome.storage.sync.get({
    'milxdy.remistats.likeAutoPoke': true,
    'milxdy.remistats.pokeAutoLike': false,
  });
  likeAutoPokeEnabled = settings['milxdy.remistats.likeAutoPoke'] === true;
  pokeAutoLikeEnabled = settings['milxdy.remistats.pokeAutoLike'] === true;
}

async function loadPokeThemeSettings() {
  const settings = await chrome.storage.local.get({
    beetolColor: 'red',
    beetolMode: 'dark',
  });
  applyPokeThemeSettings(settings.beetolColor, settings.beetolMode);
}

function applyPokeThemeSettings(color, mode) {
  document.documentElement.dataset.reminetPokeColor = POKE_THEME_COLORS.has(color) ? color : 'red';
  document.documentElement.dataset.reminetPokeMode = POKE_THEME_MODES.has(mode) ? mode : 'dark';
}

function normalizeRemistatsVisualTheme(value) {
  const normalized = normalizeVisualTheme(value);
  const record = value && typeof value === 'object' ? value : {};
  const pokePlacement = record.pokePlacement === 'top' || record.pokePlacement === 'actions'
    ? record.pokePlacement
    : DEFAULT_VISUAL_THEME.pokePlacement;
  return { ...normalized, pokePlacement };
}

async function loadVisualThemeSettings() {
  const settings = await chrome.storage.local.get({ 'milxdy.settings.visualTheme': DEFAULT_VISUAL_THEME });
  const nextTheme = normalizeRemistatsVisualTheme(settings['milxdy.settings.visualTheme']);
  const previousPlacement = visualTheme.pokePlacement;
  visualTheme = nextTheme;
  document.documentElement.dataset.milxdyVisualRemistatsBox = String(visualTheme.remistatsBox === true);
  document.documentElement.dataset.milxdyVisualPokePlacement = visualTheme.pokePlacement;
  document.documentElement.dataset.milxdyVisualIncomingPokeGold = String(visualTheme.incomingPokeGold !== false);
  patchExistingBadges();
  if (previousPlacement !== visualTheme.pokePlacement) {
    scheduleSurfaceReconciliation([450, 2200]);
  }
}

function applyIconSettings() {
  document.documentElement.dataset.reminetIconsEnabled = String(iconSettings.enabled);
  document.documentElement.dataset.reminetIconScore = String(iconSettings.score);
  document.documentElement.dataset.reminetIconBeetle = String(iconSettings.beetle);
  document.documentElement.dataset.reminetIconPoke = String(iconSettings.poke);
  patchExistingBadges();
}

function iconSettingChanged(changes) {
  return Boolean(
    changes['milxdy.remistats.icons.enabled']
    || changes['milxdy.remistats.icons.score']
    || changes['milxdy.remistats.icons.beetle']
    || changes['milxdy.remistats.icons.poke']
  );
}

// Process batch of usernames
async function processBatch(usernames) {
  const results = {};
  // Negative cache: every requested handle that isn't in the response is
  // stored as a "not found" sentinel so we don't refetch it on every
  // observer tick. Without this, 404s (or unknown users) trigger an
  // infinite retry loop as the MutationObserver keeps firing.
  const requested = Array.from(usernames).map(u => u.toLowerCase());
  try {
    const lookups = await resolveBadgeProfiles(requested, runtimeSendMessage);

    for (let index = 0; index < requested.length; index += 1) {
      const requestedHandle = requested[index];
      const resolved = lookups[index];
      if (resolved?.status === 'not_found') {
        setScoreCache(requestedHandle, { data: null, timestamp: Date.now() });
        results[requestedHandle] = null;
        continue;
      }
      if (resolved?.status !== 'resolved' || !resolved.profile) continue;
      const userData = transformSharedIdentityProfile(resolved.profile, requestedHandle);
      const normalized = cleanUsername(userData.twitterHandle || requestedHandle).toLowerCase();
      setScoreCache(requestedHandle, { data: userData, timestamp: Date.now() });
      results[requestedHandle] = userData;
      if (normalized && normalized !== requestedHandle) {
        setScoreCache(normalized, { data: userData, timestamp: Date.now() });
        results[normalized] = userData;
      }
    }
  } catch (error) {
    if (!/extension context/i.test(String(error?.message || error))) {
      console.debug('RemiStats API lookup skipped:', error.message);
    }
  }

  return results;
}

function transformSharedIdentityProfile(profile, fallbackHandle = '') {
  return {
    username: cleanRemiliaUsername(profile.remiliaUsername) || cleanUsername(fallbackHandle),
    remiliaUsername: cleanRemiliaUsername(profile.remiliaUsername) || null,
    twitterHandle: cleanUsername(profile.xHandle || fallbackHandle),
    displayName: profile.displayName,
    score: profile.remiStatsScore,
    beetleCount: profile.beetleCount,
    followers: nonNegativeNumber(profile.friendCount),
    pfpProject: profile.pfpProject,
    pfpId: profile.pfpId,
  };
}

async function fetchOfficialSelfProfileScore(xHandle) {
  const exactXHandle = cleanExactXHandle(xHandle);
  if (!exactXHandle) return null;
  try {
    const response = await runtimeSendMessage({
      type: 'remistats:getMyStatsForXProfile',
      xHandle: exactXHandle,
    }, 'remistats:getMyStatsForXProfile');
    if (!response?.ok || response.matched !== true || !response.data) return null;
    const remiliaUsername = cleanRemiliaUsername(response.data.remiliaUsername);
    if (!remiliaUsername) return null;
    return {
      username: remiliaUsername,
      remiliaUsername,
      twitterHandle: exactXHandle,
      displayName: response.data.displayName,
      score: response.data.score,
      beetleCount: response.data.beetleCount,
      followers: response.data.followers,
      pfpProject: null,
      pfpId: null,
    };
  } catch (error) {
    if (!/extension context/i.test(String(error?.message || error))) {
      console.debug('Official self-profile stats skipped:', error.message);
    }
    return null;
  }
}

// Transform API response to extension format
function transformApiResponse(apiUser, fallbackHandle = '', allowLegacyIdentityFields = false) {
  const explicitRemiliaUsername = cleanRemiliaUsername(
    apiUser.remiliaUsername
    || apiUser.profile?.username
    || (allowLegacyIdentityFields ? apiUser.username || apiUser.userHandle || apiUser.handle : '')
  );
  const displayUsername = explicitRemiliaUsername || cleanUsername(
    apiUser.username
    || apiUser.userHandle
    || apiUser.handle
    || fallbackHandle
  );
  return {
    username: displayUsername,
    remiliaUsername: explicitRemiliaUsername || null,
    twitterHandle: apiUser.twitterHandle,
    displayName: apiUser.displayName,
    score: apiUser.socialCreditScore,
    beetleCount: apiUser.beetles,
    followers: nonNegativeNumber(apiUser.friendCount),
    pfpProject: apiUser.pfpProject,
    pfpId: apiUser.pfpId,
  };
}

function cleanUsername(value) {
  if (typeof value !== 'string') return '';
  const match = value.replace(/^@/, '').trim().match(/[A-Za-z0-9_]{1,32}/);
  return match ? match[0] : '';
}

function cleanRemiliaUsername(value) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim().replace(/^[@~]+/, '');
  return /^[A-Za-z0-9_.-]{1,64}$/.test(candidate) ? candidate : '';
}

function cleanExactXHandle(value) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(candidate) ? candidate : '';
}

async function processPokeTargetBatch(xHandles) {
  const requested = [...new Set(xHandles.map((value) => cleanExactXHandle(value).toLowerCase()).filter(Boolean))];
  if (!requested.length) return new Map();
  recordRuntimePhase('poke', 'directory-requested');
  const requestGeneration = ++pokeTargetRequestGeneration;
  for (const xHandle of requested) {
    confirmedPokeTargets.delete(xHandle);
    if (pokeTargetLatestRequests.has(xHandle)) pokeTargetLatestRequests.delete(xHandle);
    pokeTargetLatestRequests.set(xHandle, requestGeneration);
  }
  while (pokeTargetLatestRequests.size > SCORE_CACHE_LIMIT) {
    const oldest = pokeTargetLatestRequests.keys().next().value;
    if (oldest === undefined) break;
    pokeTargetLatestRequests.delete(oldest);
  }
  try {
    const response = await runtimeSendMessage({
      type: 'remistats:resolvePokeTargets',
      xHandles: requested,
    }, 'remistats:resolvePokeTargets');
    if (!response) {
      recordRuntimePhase('poke', 'directory-no-response');
      return new Map();
    }
    if (!response.ok || !Array.isArray(response.targets)) {
      recordRuntimePhase('poke', response.authRequired ? 'directory-auth-required'
        : response.scopeRequired ? 'directory-scope-required'
        : response.category === 'rate_limit' ? 'directory-rate-limited'
        : response.error === 'MESSAGE_POLICY_REJECTED'
        ? 'directory-policy-rejected'
        : response.error === 'UNSUPPORTED_SENDER'
          ? 'directory-sender-rejected'
          : 'directory-rejected');
      return new Map();
    }
    const targets = new Map();
    for (const target of response.targets) {
      const xHandle = cleanExactXHandle(target?.xHandle).toLowerCase();
      if (!requested.includes(xHandle) || pokeTargetLatestRequests.get(xHandle) !== requestGeneration) continue;
      const confirmed = setConfirmedPokeTarget(xHandle, target?.remiliaUsername);
      if (confirmed) targets.set(confirmed.xHandle, confirmed);
    }
    recordRuntimePhase('poke', targets.size ? 'directory-confirmed' : 'directory-no-match');
    return targets;
  } catch (error) {
    recordRuntimePhase('poke', 'directory-no-response');
    if (!/extension context/i.test(String(error?.message || error))) {
      console.debug('RemiStats Poke target lookup skipped:', error.message);
    }
    return new Map();
  }
}

function schedulePokeTargetBatch() {
  if (pokeTargetBatchTimeout) clearTimeout(pokeTargetBatchTimeout);
  pokeTargetBatchTimeout = setTimeout(async () => {
    pokeTargetBatchTimeout = null;
    const xHandles = Array.from(pokeTargetBatchQueue).slice(0, 50);
    for (const xHandle of xHandles) pokeTargetBatchQueue.delete(xHandle);
    const targets = await processPokeTargetBatch(xHandles);
    for (const xHandle of xHandles) {
      const resolvers = pokeTargetBatchPromises.get(xHandle) || [];
      for (const resolve of resolvers) resolve(targets.get(xHandle) || null);
      pokeTargetBatchPromises.delete(xHandle);
    }
    if (pokeTargetBatchQueue.size > 0) schedulePokeTargetBatch();
  }, remistatsFetchPolicy().batchDelay);
}

function fetchPokeTarget(xHandle) {
  const cleanXHandle = cleanExactXHandle(xHandle).toLowerCase();
  if (!cleanXHandle) return Promise.resolve(null);
  return new Promise((resolve) => {
    const resolvers = pokeTargetBatchPromises.get(cleanXHandle) || [];
    resolvers.push(resolve);
    pokeTargetBatchPromises.set(cleanXHandle, resolvers);
    pokeTargetBatchQueue.add(cleanXHandle);
    schedulePokeTargetBatch();
  });
}

async function fetchProfileIdentity(xHandle) {
  const cleanXHandle = cleanExactXHandle(xHandle).toLowerCase();
  if (!cleanXHandle) return null;
  const cachedUsername = confirmedProfileIdentities.get(cleanXHandle);
  if (cachedUsername) {
    recordRuntimePhase('profile', 'directory-confirmed');
    return { xHandle: cleanXHandle, remiliaUsername: cachedUsername };
  }
  if (profileIdentityPending.has(cleanXHandle)) return profileIdentityPending.get(cleanXHandle);

  const requestGeneration = ++profileIdentityRequestGeneration;
  if (profileIdentityLatestRequests.has(cleanXHandle)) profileIdentityLatestRequests.delete(cleanXHandle);
  profileIdentityLatestRequests.set(cleanXHandle, requestGeneration);
  while (profileIdentityLatestRequests.size > SCORE_CACHE_LIMIT) {
    const oldest = profileIdentityLatestRequests.keys().next().value;
    if (oldest === undefined) break;
    profileIdentityLatestRequests.delete(oldest);
  }

  let pending;
  pending = (async () => {
    try {
      let forcedAttempted = false;
      let response = await requestProfileDirectoryIdentity(cleanXHandle, false);
      if (profileIdentityLatestRequests.get(cleanXHandle) !== requestGeneration) return null;
      if (
        shouldForceExactDirectoryProfileRetry(response)
        && reserveForcedProfileRoute(cleanXHandle)
      ) {
        recordRuntimePhase('profile', 'directory-cached-negative');
        forcedAttempted = true;
        response = await requestProfileDirectoryIdentity(cleanXHandle, true);
        if (profileIdentityLatestRequests.get(cleanXHandle) !== requestGeneration) return null;
      }
      const identity = exactProfileIdentityFromDirectoryResponse(response, cleanXHandle, forcedAttempted);
      if (!identity) return null;
      return setConfirmedProfileIdentity(identity.xHandle, identity.remiliaUsername);
    } catch (error) {
      recordRuntimePhase('profile', 'directory-no-response');
      if (!/extension context/i.test(String(error?.message || error))) {
        console.debug('RemiStats profile identity lookup skipped:', error.message);
      }
      return null;
    } finally {
      if (profileIdentityPending.get(cleanXHandle) === pending) profileIdentityPending.delete(cleanXHandle);
    }
  })();
  profileIdentityPending.set(cleanXHandle, pending);
  return pending;
}

async function requestProfileDirectoryIdentity(cleanXHandle, force) {
  recordRuntimePhase('profile', force ? 'directory-forced-requested' : 'directory-requested');
  const response = await runtimeSendMessage({
    type: 'reminetIdentity:resolve',
    identifiers: [{ type: 'x_handle', value: cleanXHandle }],
    ...(force ? { force: true, maxAgeMs: 0 } : {}),
  }, 'reminetIdentity:resolve');
  return response;
}

function exactProfileIdentityFromDirectoryResponse(response, cleanXHandle, forced) {
  const prefix = forced ? 'directory-forced' : 'directory';
  if (!response) {
    recordRuntimePhase('profile', `${prefix}-no-response`);
    return null;
  }
  if (!response.ok) {
    recordRuntimePhase('profile', response.error === 'MESSAGE_POLICY_REJECTED'
      ? 'directory-policy-rejected'
      : response.error === 'UNSUPPORTED_SENDER'
        ? 'directory-sender-rejected'
        : forced ? 'directory-forced-rejected' : 'directory-rejected');
    return null;
  }
  if (!Array.isArray(response.results) || response.results.length !== 1) {
    recordRuntimePhase('profile', `${prefix}-result-mismatch`);
    return null;
  }
  if (response.results[0]?.status === 'error') {
    recordRuntimePhase('profile', forced ? 'directory-forced-rejected' : 'directory-rejected');
    return null;
  }
  if (response.results[0]?.status === 'not_found') {
    recordRuntimePhase('profile', forced ? 'directory-forced-not-found' : 'directory-not-found');
    return null;
  }
  const identity = exactDirectoryProfileIdentity(response, cleanXHandle);
  if (!identity) {
    recordRuntimePhase('profile', `${prefix}-result-mismatch`);
    confirmedProfileIdentities.delete(cleanXHandle);
    return null;
  }
  recordRuntimePhase('profile', forced ? 'directory-forced-confirmed' : 'directory-confirmed');
  return identity;
}

function reserveForcedProfileRoute(cleanXHandle) {
  const key = `${window.location.pathname.toLowerCase()}#${cleanXHandle}`;
  if (profileIdentityForcedRouteKeys.has(key)) return false;
  profileIdentityForcedRouteKeys.add(key);
  while (profileIdentityForcedRouteKeys.size > 100) {
    const oldest = profileIdentityForcedRouteKeys.values().next().value;
    if (oldest === undefined) break;
    profileIdentityForcedRouteKeys.delete(oldest);
  }
  return true;
}

// Fetch user score with batching
async function fetchUserScore(username) {
  const normalizedUsername = username.toLowerCase();
  
  // Check cache first
  const cached = scoreCache.get(normalizedUsername);
  if (cached && Date.now() - cached.timestamp < CONFIG.cacheTimeout) {
    return cached.data;
  }
  if (cached) scoreCache.delete(normalizedUsername);
  
  // Add to batch queue
  return new Promise((resolve) => {
    // Store promise resolver
    if (!batchPromises.has(normalizedUsername)) {
      batchPromises.set(normalizedUsername, []);
    }
    batchPromises.get(normalizedUsername).push(resolve);
    
    // Add to queue
    batchQueue.add(normalizedUsername);
    
    // Clear existing timeout
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    
    // Set new timeout to process batch
    const policy = remistatsFetchPolicy();
    batchTimeout = setTimeout(async () => {
      const usernamesToFetch = Array.from(batchQueue).slice(0, policy.batchSize);
      for (const username of usernamesToFetch) batchQueue.delete(username);
      
      // Fetch batch
      const results = await processBatch(usernamesToFetch);
      
      // Resolve all waiting promises
      usernamesToFetch.forEach(user => {
        const resolvers = batchPromises.get(user);
        if (resolvers) {
          const userData = results[user]; // null/undefined if user not found
          resolvers.forEach(resolve => resolve(userData));
          batchPromises.delete(user);
        }
      });
      if (batchQueue.size > 0) {
        for (const username of Array.from(batchQueue)) {
          const resolvers = batchPromises.get(username);
          if (resolvers) resolvers.forEach(resolve => resolve(fetchUserScore(username)));
          batchPromises.delete(username);
        }
      }
    }, policy.batchDelay);
  });
}

function createPokeButton(username, standalone = false, xHandle = '') {
  const clean = cleanRemiliaUsername(username);
  const cleanXHandle = cleanExactXHandle(xHandle);
  if (!clean || !cleanXHandle || !isConfirmedPokeTarget(clean, cleanXHandle)) return null;

  const button = document.createElement('button');
  button.className = standalone
    ? 'reminet-poke-button reminet-poke-button--standalone'
    : 'reminet-poke-button';
  button.type = 'button';
  button.dataset.reminetPoke = 'true';
  button.dataset.reminetIcon = 'poke';
  button.dataset.reminetUsername = clean;
  button.dataset.reminetXHandle = cleanXHandle;
  if (standalone) {
    button.dataset.reminetStandalonePoke = 'true';
  }
  restorePokeButtonIcon(button);
  button.title = 'Poke';
  button.setAttribute('aria-label', button.title);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void handlePokeClick(button);
  }, true);
  registerPokeButton(button, clean);
  applyKnownPokeCooldown(button, clean);
  void refreshPokeEligibility(clean);
  return button;
}

function registerPokeButton(button, username) {
  const clean = cleanRemiliaUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  let buttons = pokeButtonsByUsername.get(key);
  if (!buttons) {
    buttons = new Set();
    pokeButtonsByUsername.set(key, buttons);
  }
  buttons.add(button);
}

function pokeButtonsForUsername(username) {
  const clean = cleanRemiliaUsername(username);
  if (!clean) return [];
  const key = clean.toLowerCase();
  const buttons = pokeButtonsByUsername.get(key);
  if (!buttons) return [];
  const connected = [];
  for (const button of Array.from(buttons)) {
    if (!button.isConnected || cleanRemiliaUsername(button.dataset.reminetUsername).toLowerCase() !== key) {
      buttons.delete(button);
      continue;
    }
    connected.push(button);
  }
  if (buttons.size === 0) pokeButtonsByUsername.delete(key);
  return connected;
}

function applyKnownPokeCooldown(button, username) {
  const clean = cleanRemiliaUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  const cooldownUntil = pokeCooldowns.get(key) || 0;
  if (cooldownUntil > Date.now()) {
    startPokeCooldown(button, clean, cooldownUntil - Date.now(), pokeCooldownSources.get(key));
  }
}

async function refreshPokeEligibility(username) {
  const clean = cleanRemiliaUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  if (pokeEligibilityChecked.has(key)) return;
  pokeEligibilityChecked.add(key);
  const response = await runtimeSendMessage({ type: 'beetol:pokeEligibility', username: clean }, 'beetol:pokeEligibility');
  const cooldownMs = readPokeCooldownMs(response);
  if (response?.ok && cooldownMs > 0) {
    startPokeCooldownForUsername(clean, cooldownMs, response.cooldownSource);
  }
}

function ensureStandalonePokeButton(badge, username) {
  const clean = cleanRemiliaUsername(username || badge.dataset.reminetUsername);
  if (!clean || !badge.parentElement || badge.dataset.reminetCompact === 'true') return;

  badge.dataset.reminetUsername = clean;
  const next = badge.nextElementSibling;
  if (next?.matches?.('[data-reminet-standalone-poke]')) {
    if (isConfirmedPokeTarget(clean, badge.dataset.reminetXHandle)) {
      next.dataset.reminetUsername = clean;
      next.dataset.reminetXHandle = cleanExactXHandle(badge.dataset.reminetXHandle);
      next.title = 'Poke';
      next.setAttribute('aria-label', next.title);
      return;
    }
    next.remove();
  }

  const button = createPokeButton(clean, true, badge.dataset.reminetXHandle);
  if (button) {
    badge.parentElement.insertBefore(button, badge.nextSibling);
  }
}

function createProfilePokeSlot(username = '') {
  const slot = document.createElement('span');
  slot.className = 'reminet-profile-poke-slot';
  slot.dataset.reminetProfilePokeSlot = 'true';
  const clean = cleanRemiliaUsername(username);
  if (clean) slot.dataset.reminetUsername = clean;
  return slot;
}

function fillProfilePokeSlot(slot, username, xHandle = '') {
  if (!slot) return;
  const clean = cleanRemiliaUsername(username);
  const cleanXHandle = cleanExactXHandle(xHandle || slot.dataset.reminetXHandle);
  const button = createPokeButton(clean, true, cleanXHandle);
  slot.replaceChildren();
  if (button) {
    slot.appendChild(button);
  }
  if (clean) slot.dataset.reminetUsername = clean;
  if (cleanXHandle) slot.dataset.reminetXHandle = cleanXHandle;
}

function createProfileActionPokeSlot(xHandle = '') {
  const slot = document.createElement('span');
  slot.className = 'reminet-profile-action-poke-slot';
  slot.dataset.reminetProfileActionPokeSlot = 'true';
  const clean = cleanExactXHandle(xHandle);
  if (clean) slot.dataset.reminetXHandle = clean;
  return slot;
}

function profileActionFollowButton(userNameSection) {
  const primaryColumn = userNameSection?.closest?.('[data-testid="primaryColumn"]') || document;
  const userNameRect = userNameSection?.getBoundingClientRect?.();
  const buttons = Array.from(primaryColumn.querySelectorAll('button, [role="button"]'));
  return buttons.find((button) => {
    const text = (button.textContent || '').trim();
    const label = button.getAttribute?.('aria-label') || '';
    const testid = button.getAttribute?.('data-testid') || '';
    if (!/(^|-)unfollow$|(^|-)follow$/i.test(testid) && !/^(Following|Follow)$/i.test(text) && !/^(Following|Follow)/i.test(label)) {
      return false;
    }
    const rect = button.getBoundingClientRect?.();
    return rect
      && rect.width >= 48
      && rect.height >= 24
      && (!userNameRect || rect.bottom <= userNameRect.top + 8);
  }) || null;
}

function directChildUnder(parent, node) {
  if (!parent || !node || !parent.contains(node)) return null;
  let current = node;
  while (current?.parentElement && current.parentElement !== parent) {
    current = current.parentElement;
  }
  return current?.parentElement === parent ? current : null;
}

function attachProfileActionPokeSlot(userNameSection, slot) {
  if (!userNameSection || !slot) return false;
  const followButton = profileActionFollowButton(userNameSection);
  if (!followButton?.parentElement) return false;
  const primaryColumn = userNameSection.closest?.('[data-testid="primaryColumn"]') || document;
  let actionRow = null;
  let current = followButton.parentElement;
  while (current && current !== primaryColumn) {
    const style = getComputedStyle(current);
    const hasPeerAction = Boolean(
      current.querySelector('[data-testid="userActions"], [data-testid="sendDMFromProfile"], [aria-label*="notifications" i]')
    );
    if (style.display === 'flex' && style.flexDirection === 'row' && hasPeerAction) {
      actionRow = current;
      break;
    }
    current = current.parentElement;
  }
  if (!actionRow) return false;
  const followChild = directChildUnder(actionRow, followButton) || followButton;
  for (const previous of Array.from(document.querySelectorAll('[data-reminet-profile-action-poke-slot="true"]'))) {
    if (previous !== slot) previous.remove();
  }
  if (slot.parentElement !== actionRow || slot.nextSibling !== followChild) {
    actionRow.insertBefore(slot, followChild);
  }
  return true;
}

function ensureProfileActionPokeSlot(userNameSection, username = '') {
  const clean = cleanExactXHandle(username);
  const existing = document.querySelector('[data-reminet-profile-action-poke-slot="true"]');
  const slot = existing || createProfileActionPokeSlot(clean);
  if (clean) slot.dataset.reminetXHandle = clean;
  fillProfilePokeSlot(slot, '');
  attachProfileActionPokeSlot(userNameSection, slot);
  return slot;
}

function normalizeProfilePokeGroup(badge, username) {
  const group = badge?.closest?.('[data-reminet-profile-badge-group]');
  if (!group) return false;
  const clean = cleanRemiliaUsername(username || badge.dataset.reminetUsername);

  for (const child of Array.from(badge.parentElement?.children || [])) {
    if (child.matches?.('[data-reminet-standalone-poke]')) child.remove();
  }

  group.querySelector('[data-reminet-profile-poke-slot]')?.remove();
  const xHandle = cleanExactXHandle(badge.dataset.reminetXHandle || profileUsernameFromUrl());
  const slot = ensureProfileActionPokeSlot(document.querySelector('[data-testid="UserName"]'), xHandle);
  fillProfilePokeSlot(slot, clean, xHandle);
  if (clean) {
    group.dataset.reminetUsername = clean;
    void updateIncomingPokeFlag(group, clean);
  } else {
    delete group.dataset.reminetUsername;
  }
  return true;
}

function closestProfileHandleRow(userNameSection, handleSpan, followsYou) {
  if (!userNameSection || !handleSpan) return null;
  const candidates = [];
  let current = handleSpan.parentElement;
  while (current && current !== userNameSection) {
    const rect = current.getBoundingClientRect?.();
    const text = current.textContent || '';
    if (
      rect
      && rect.height <= 30
      && text.includes('@')
      && (!followsYou || current.contains(followsYou))
    ) {
      candidates.push(current);
    }
    current = current.parentElement;
  }
  return candidates[0] || null;
}

function attachProfileBadgeGroup(userNameSection, group) {
  if (!userNameSection || !group) return false;
  const handleSpan = Array.from(userNameSection.querySelectorAll('span[style*="color"], span'))
    .find((span) => (span.textContent || '').trim().startsWith('@'));
  const followsYou = userNameSection.querySelector('[data-testid="userFollowIndicator"]')
    || Array.from(userNameSection.querySelectorAll('span, div'))
      .find((element) => (element.textContent || '').trim().toLowerCase() === 'follows you');
  const row = closestProfileHandleRow(userNameSection, handleSpan, followsYou);
  if (!row) {
    userNameSection.appendChild(group);
    return false;
  }
  for (const previous of Array.from(userNameSection.querySelectorAll('[data-reminet-profile-handle-row="true"]'))) {
    if (previous !== row) delete previous.dataset.reminetProfileHandleRow;
  }
  row.dataset.reminetProfileHandleRow = 'true';
  if (followsYou && !followsYou.closest('[data-reminet-profile-badge-group]')) {
    followsYou.dataset.reminetProfileFollowsYou = 'true';
  }
  if (group.parentElement !== row) row.appendChild(group);
  return true;
}

function createPokeCluster(username, xHandle = '') {
  const clean = cleanRemiliaUsername(username);
  if (!clean) return null;
  const group = document.createElement('div');
  group.className = 'reminet-action-poke-group';
  group.dataset.reminetActionPokeGroup = 'true';
  group.dataset.reminetUsername = clean;
  const pokeButton = createPokeButton(clean, true, xHandle);
  if (!pokeButton) return null;
  group.dataset.reminetPokeState = 'ready';
  group.appendChild(pokeButton);
  void updateIncomingPokeFlag(group, clean);
  return group;
}

function createActionPokeSlot(username = '') {
  const clean = cleanRemiliaUsername(username);
  const group = document.createElement('div');
  group.className = 'reminet-action-poke-group';
  group.dataset.reminetActionPokeGroup = 'true';
  group.dataset.reminetPokeState = 'loading';
  if (clean) group.dataset.reminetUsername = clean;
  return group;
}

function fillActionPokeSlot(group, username, xHandle = '') {
  if (!group) return;
  const clean = cleanRemiliaUsername(username);
  group.replaceChildren();
  const pokeButton = createPokeButton(clean, true, xHandle);
  group.dataset.reminetPokeState = pokeButton ? 'ready' : 'empty';
  if (!pokeButton) {
    group.setAttribute('aria-hidden', 'true');
    return;
  }
  if (group.dataset.milxdyTweetSlot === 'remistats-action-poke') delete group.dataset.milxdyTweetSlot;
  group.removeAttribute('aria-hidden');
  group.dataset.reminetUsername = clean;
  group.appendChild(pokeButton);
  recordRuntimePhase('poke', 'control-mounted');
  void updateIncomingPokeFlag(group, clean);
}

function createBadgeSlot(username = '', options = {}) {
  const slot = document.createElement('span');
  slot.className = 'reminet-badge-slot';
  slot.dataset.reminetBadgeSlot = 'true';
  slot.dataset.reminetState = 'loading';
  if (options.profile) slot.dataset.reminetProfileSlot = 'true';
  if (options.actionPoke) slot.dataset.reminetActionPoke = 'true';
  const clean = cleanUsername(username);
  if (clean) slot.dataset.reminetUsername = clean;
  slot.setAttribute('aria-hidden', 'true');
  return slot;
}

function prepareBadgeSlot(slot, username = '', options = {}) {
  if (!slot) return null;
  slot.classList.add('reminet-badge-slot');
  slot.dataset.reminetBadgeSlot = 'true';
  slot.dataset.reminetState = 'loading';
  if (options.profile) slot.dataset.reminetProfileSlot = 'true';
  if (options.actionPoke) slot.dataset.reminetActionPoke = 'true';
  const clean = cleanUsername(username);
  if (clean) slot.dataset.reminetUsername = clean;
  slot.setAttribute('aria-hidden', 'true');
  return slot;
}

function fillBadgeSlot(slot, badge, username = '') {
  if (!slot || !badge) return null;
  const clean = cleanUsername(username) || badge.dataset.reminetUsername || '';
  slot.replaceChildren(badge);
  slot.dataset.reminetState = 'ready';
  slot.removeAttribute('aria-hidden');
  if (clean) slot.dataset.reminetUsername = clean;
  return badge;
}

function cachedScoreData(username) {
  const clean = cleanUsername(username).toLowerCase();
  if (!clean) return undefined;
  const cached = scoreCache.get(clean);
  if (!cached) return undefined;
  if (Date.now() - cached.timestamp >= CONFIG.cacheTimeout) {
    scoreCache.delete(clean);
    return undefined;
  }
  return cached.data;
}

function fillProfileBadgeFromScore(slot, group, scoreData, username, pokeTargetUsername = '') {
  if (!slot || !group || !scoreData) return null;
  const badge = createScoreBadge(scoreData, { includePokeInside: false });
  badge.style.marginLeft = '0';
  badge.style.display = 'inline-flex';
  badge.style.verticalAlign = 'middle';
  badge.setAttribute('data-profile-badge', username);
  const remiliaUsername = cleanRemiliaUsername(scoreData.remiliaUsername || '');
  const confirmedPokeUsername = cleanRemiliaUsername(pokeTargetUsername);
  const displayUsername = remiliaUsername || cleanUsername(scoreData.username || username);
  if (confirmedPokeUsername) group.dataset.reminetUsername = confirmedPokeUsername;
  else delete group.dataset.reminetUsername;
  fillBadgeSlot(slot, badge, displayUsername);
  if (confirmedPokeUsername) void updateIncomingPokeFlag(group, confirmedPokeUsername);
  return { badge, remiliaUsername, xHandle: cleanExactXHandle(scoreData.twitterHandle || username) };
}

async function reconcileExistingPokeLauncher(element, badge) {
  const xHandle = cleanExactXHandle(badge?.dataset?.reminetXHandle || extractUsername(element));
  const target = xHandle ? await fetchPokeTarget(xHandle) : null;
  const remiliaUsername = cleanRemiliaUsername(target?.remiliaUsername);
  if (xHandle) badge.dataset.reminetXHandle = xHandle;

  if (visualTheme.pokePlacement === 'actions') {
    for (const node of badge.querySelectorAll('[data-reminet-poke]')) node.remove();
    if (remiliaUsername) insertActionPoke(element, remiliaUsername, xHandle);
    else {
      for (const group of Array.from(element.querySelectorAll('[data-reminet-action-poke-group]')).filter((node) => surfaceOwnsNode(element, node))) {
        fillActionPokeSlot(group, '', xHandle);
      }
    }
    return;
  }

  for (const group of Array.from(element.querySelectorAll('[data-reminet-action-poke-group]')).filter((node) => surfaceOwnsNode(element, node))) {
    group.remove();
  }
  for (const button of badge.querySelectorAll('[data-reminet-poke]')) button.remove();
  const content = badge.querySelector('.reminet-badge-content');
  const button = createPokeButton(remiliaUsername, false, xHandle);
  if (button && content) content.appendChild(button);
}

function stabilizeTweetBadgeSlot(element, slot) {
  if (!element || !slot || slot.dataset.reminetProfileSlot === 'true') return;
  const tweet = element.matches?.('[data-testid="tweet"]') ? element : element.closest?.('[data-testid="tweet"]');
  if (!tweet || !surfaceOwnsNode(tweet, slot)) return;
  requestAnimationFrame(() => {
    if (!document.body.contains(tweet) || !document.body.contains(slot)) return;
    if (tweetBadgeSlotNeedsWrap(tweet, slot)) moveBadgeSlotToRow(tweet, slot);
  });
}

function tweetBadgeSlotNeedsWrap(tweet, slot) {
  if (slot.dataset.reminetBadgeWrapped === 'true') return false;
  const slotRect = slot.getBoundingClientRect();
  if (slotRect.width <= 0 || slotRect.height <= 0) return false;

  const row = slot.parentElement;
  if (row && row.scrollWidth > row.clientWidth + 2) return true;

  const controlHost = tweet.querySelector('[data-milxdy-post-reading-header-controls="true"]');
  if (controlHost && rectsOverlap(slotRect, controlHost.getBoundingClientRect(), 4)) return true;

  const controls = Array.from(tweet.querySelectorAll('[data-milxdy-tweet-slot="post-reading-header-action"], [aria-label*="Grok" i], [data-testid="caret"], [aria-label*="More" i], [aria-label*="more" i]'))
    .filter((control) => surfaceOwnsNode(tweet, control));
  return controls.some((control) => rectsOverlap(slotRect, control.getBoundingClientRect(), 3));
}

function rectsOverlap(left, right, pad = 0) {
  return left.left < right.right + pad
    && left.right + pad > right.left
    && left.top < right.bottom + pad
    && left.bottom + pad > right.top;
}

function moveBadgeSlotToRow(tweet, slot) {
  const row = ensureTweetBadgeRow(tweet);
  if (!row) return;
  slot.dataset.reminetBadgeWrapped = 'true';
  row.appendChild(slot);
}

function ensureTweetBadgeRow(tweet) {
  const existing = Array.from(tweet.querySelectorAll('[data-reminet-badge-row]'))
    .find((row) => surfaceOwnsNode(tweet, row));
  if (existing) return existing;

  const row = document.createElement('div');
  row.className = 'reminet-badge-row';
  row.dataset.reminetBadgeRow = 'true';
  const tweetText = Array.from(tweet.querySelectorAll('[data-testid="tweetText"]'))
    .find((node) => surfaceOwnsNode(tweet, node));
  if (tweetText?.parentElement) {
    tweetText.parentElement.insertBefore(row, tweetText);
    return row;
  }

  const userName = Array.from(tweet.querySelectorAll('[data-testid="User-Name"]'))
    .find((node) => surfaceOwnsNode(tweet, node));
  const userNameBlock = userName?.parentElement;
  if (userNameBlock?.parentElement) {
    userNameBlock.parentElement.insertBefore(row, userNameBlock.nextSibling);
    return row;
  }

  return null;
}


// Create score badge element
function appendScoreBadgePoke(badge, options, xHandle) {
  if (options.includePokeInside !== false && visualTheme.pokePlacement !== 'actions') {
    const pokeTargetUsername = cleanRemiliaUsername(options.pokeTargetUsername);
    const inlinePoke = createPokeButton(pokeTargetUsername, false, xHandle);
    const content = badge.querySelector('.reminet-badge-content');
    if (inlinePoke && content) content.appendChild(inlinePoke);
    if (content && pokeTargetUsername) void updateIncomingPokeFlag(content, pokeTargetUsername);
  }
}

function createScoreBadge(scoreData, options = {}) {
  const badge = document.createElement('div');
  badge.className = 'reminet-score-badge';
  badge.setAttribute('data-reminet-badge', 'true');
  badge.tabIndex = 0;
  badge.setAttribute('role', 'link');
  const remiliaUsername = cleanRemiliaUsername(scoreData.remiliaUsername || '');
  const xHandle = cleanExactXHandle(scoreData.twitterHandle || '');
  if (remiliaUsername) {
    badge.dataset.reminetUsername = remiliaUsername;
  }
  if (xHandle) badge.dataset.reminetXHandle = xHandle;
  
  const score = nonNegativeNumber(scoreData.score);
  const beetleCount = nonNegativeNumber(scoreData.beetleCount, Math.floor(score / 10));
  const scoreLabel = formatMetric(score);
  const beetleLabel = formatMetric(beetleCount);
  const maxScoreLabel = formatMetric(maxScore, 1000);
  const maxBeetlesLabel = formatMetric(maxBeetles, 100);
  const followerLabel = formatMetric(scoreData.followers);
  
  // Get extension URLs for images
  const beetleUrl = chrome.runtime.getURL('remistats/beetle.png');
  const starUrl = chrome.runtime.getURL('remistats/star.svg');
  
  badge.innerHTML = `
    <div class="reminet-badge-content">
      <div class="reminet-badge-group" data-reminet-icon="score">
        <img src="${starUrl}" class="reminet-star" alt="" />
        <span class="reminet-label">${scoreLabel}</span>
      </div>
      <div class="reminet-badge-group" data-reminet-icon="beetle">
        <img src="${beetleUrl}" class="reminet-beetle" alt="" />
        <span class="reminet-label">${beetleLabel}</span>
      </div>
    </div>
  `;

  appendScoreBadgePoke(badge, options, xHandle);
  
  // Calculate progress percentages
  const scorePercent = Math.min(100, (score / Math.max(1, finiteNumber(maxScore, 1000))) * 100);
  const beetlePercent = Math.min(100, (beetleCount / Math.max(1, finiteNumber(maxBeetles, 100))) * 100);
  
  // Build PFP image URL if we have project and ID
  const pfpProject = scoreData.pfpProject ? String(scoreData.pfpProject) : '';
  const pfpId = scoreData.pfpId ? String(scoreData.pfpId) : '';
  const pfpImageUrl = (pfpProject && pfpId)
    ? `https://pfp.remilia.net/pfp/${encodeURIComponent(pfpProject.toLowerCase())}/${encodeURIComponent(pfpId)}`
    : '';
  
  const pfpInfo = pfpProject ? `${pfpProject} #${pfpId}` : '';
  const displayName = escapeHtml(scoreData.displayName || remiliaUsername || scoreData.username);
  const twitterHandle = escapeHtml(scoreData.twitterHandle || scoreData.username || remiliaUsername);
  const tooltipPfpInfo = escapeHtml(pfpInfo);
  
  badge.dataset.reminetProfileUrl = remiliaUsername ? `https://remilia.net/~${remiliaUsername}` : '';
  badge.setAttribute('aria-label', remiliaUsername
    ? `Open ${displayName || remiliaUsername} on Remilia`
    : `RemiStats for ${displayName || twitterHandle}`);
  badge.dataset.reminetTooltipHtml = `
    <div class="reminet-tooltip-header">
      <span class="reminet-tooltip-displayname">${displayName}</span>
      <span class="reminet-tooltip-handle">@${twitterHandle}</span>
    </div>
    ${pfpInfo ? `<div class="reminet-tooltip-pfp">
      ${pfpImageUrl ? `<img src="${pfpImageUrl}" alt="${tooltipPfpInfo}" class="pfp-image" />` : ''}
      <span class="pfp-label">${tooltipPfpInfo}</span>
    </div>` : ''}
    <div class="reminet-tooltip-metrics">
      <div class="metric">
        <span class="metric-label">Score</span>
        <div class="metric-bar">
          <div class="metric-fill" style="width: ${scorePercent}%;"></div>
        </div>
        <span class="metric-value">${scoreLabel} / ${maxScoreLabel}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Beetles</span>
        <div class="metric-bar">
          <div class="metric-fill" style="width: ${beetlePercent}%;"></div>
        </div>
        <span class="metric-value">${beetleLabel} / ${maxBeetlesLabel}</span>
      </div>
    </div>
    <div class="reminet-tooltip-footer">
      <span>${followerLabel} friends</span>
    </div>
  `;
  installRemiStatsDelegation();
  
  return badge;
}

function installRemiStatsDelegation() {
  if (reminetDelegationInstalled) return;
  reminetDelegationInstalled = true;

  const mouseoverHandler = async (event) => {
    const badge = event.target.closest?.('[data-reminet-badge]');
    if (!badge || !document.body.contains(badge)) return;
    event.stopPropagation();
    event.preventDefault();
    const settings = await chrome.storage.sync.get(['showTooltips', 'soundsEnabled']);
    if (settings.soundsEnabled !== false && window.reminetSounds) {
      window.reminetSounds.playHover();
    }
    if (settings.showTooltips === false) return;
    showSharedTooltip(badge);
  };

  const mouseoutHandler = (event) => {
    const badge = event.target.closest?.('[data-reminet-badge]');
    if (!badge) return;
    const related = event.relatedTarget;
    if (related instanceof Node && badge.contains(related)) return;
    scheduleHideSharedTooltip();
  };

  const focusinHandler = (event) => {
    const badge = event.target.closest?.('[data-reminet-badge]');
    if (!badge) return;
    showSharedTooltip(badge);
  };

  const focusoutHandler = (event) => {
    const badge = event.target.closest?.('[data-reminet-badge]');
    if (!badge || (event.relatedTarget instanceof Node && badge.contains(event.relatedTarget))) return;
    scheduleHideSharedTooltip();
  };

  const keydownHandler = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const badge = event.target.closest?.('[data-reminet-badge]');
    const profileUrl = badge?.dataset.reminetProfileUrl;
    if (!profileUrl) return;
    event.preventDefault();
    event.stopPropagation();
    window.open(profileUrl, '_blank', 'noopener');
  };

  const clickHandler = (event) => {
    const pokeButton = event.target.closest?.('[data-reminet-poke]');
    if (pokeButton) {
      event.stopPropagation();
      event.preventDefault();
      void handlePokeClick(pokeButton);
      return;
    }

    const likeButton = event.target.closest?.('[data-testid="like"]');
    if (likeButton) {
      maybePokeLikedTweet(likeButton);
      return;
    }

    const badge = event.target.closest?.('[data-reminet-badge]');
    if (!badge) return;
    const profileUrl = badge.dataset.reminetProfileUrl;
    if (!profileUrl) return;
    event.stopPropagation();
    event.preventDefault();
    window.open(profileUrl, '_blank');
  };

  const scrollHandler = () => {
    if (!activeTooltipBadge) return;
    positionSharedTooltip(activeTooltipBadge);
    scheduleHideSharedTooltip(300);
  };

  document.addEventListener('mouseover', mouseoverHandler, true);
  document.addEventListener('mouseout', mouseoutHandler, true);
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('focusin', focusinHandler, true);
  document.addEventListener('focusout', focusoutHandler, true);
  document.addEventListener('keydown', keydownHandler, true);
  window.addEventListener('scroll', scrollHandler, { passive: true, capture: true });

  removeRemiStatsDelegation = () => {
    document.removeEventListener('mouseover', mouseoverHandler, true);
    document.removeEventListener('mouseout', mouseoutHandler, true);
    document.removeEventListener('click', clickHandler, true);
    document.removeEventListener('focusin', focusinHandler, true);
    document.removeEventListener('focusout', focusoutHandler, true);
    document.removeEventListener('keydown', keydownHandler, true);
    window.removeEventListener('scroll', scrollHandler, { capture: true });
    reminetDelegationInstalled = false;
    removeRemiStatsDelegation = null;
  };
  addRuntimeDisposable(removeRemiStatsDelegation);
}

const handlePokeClick = createPokeClickHandler({
  target(button) {
    const badge = button.closest('[data-reminet-badge]');
    const username = cleanRemiliaUsername(button.dataset.reminetUsername || badge?.dataset.reminetUsername);
    const xHandle = cleanExactXHandle(button.dataset.reminetXHandle);
    return username && xHandle && isConfirmedPokeTarget(username, xHandle) ? { username, xHandle } : null;
  },
  cooldown: (username) => pokeCooldowns.get(username.toLowerCase()) || 0,
  startCooldown: startPokeCooldownForUsername,
  request: (payload) => runtimeSendMessage(payload, 'remistats:pokeXAuthor'),
  state: setPokeButtonState,
  playSound: () => window.reminetSounds?.playPoke?.(),
  successful: isSuccessfulPokeResponse,
  cooldownMs: readPokeCooldownMs,
  explicitCooldown: isExplicitPokeCooldownResponse,
  success(button, username) {
    notifyMiladymaxxerPokeCredit(button, username);
    maybeLikePokedTweet(button);
    clearPokeCooldownForUsername(username);
  },
});

function setPokeButtonState(button, state, label) {
  renderPokeButtonState(button, state, label, restorePokeButtonIcon);
}

function notifyMiladymaxxerPokeCredit(button, remiliaUsername) {
  const xHandle = cleanUsername(button.dataset.reminetXHandle || findPokeXHandle(button));
  if (!xHandle) return;
  window.dispatchEvent(new CustomEvent('milxdy:remistats-poke-credit', {
    detail: {
      handle: xHandle,
      remiliaUsername: cleanRemiliaUsername(remiliaUsername),
      source: 'reminet-poke',
    },
  }));
}

function isSuccessfulPokeResponse(response) {
  const data = response?.data || {};
  const nested = data?.data || {};
  return response?.ok === true
    && data.success !== false
    && data.ok !== false
    && nested.success !== false
    && nested.ok !== false
    && !isExplicitPokeCooldownResponse(response);
}

function maybeLikePokedTweet(button) {
  if (!pokeAutoLikeEnabled) return;
  const tweet = button.closest('[data-testid="tweet"]');
  if (!tweet || !surfaceOwnsNode(tweet, button)) return;
  const likeButton = Array.from(tweet.querySelectorAll('[data-testid="like"]'))
    .find((candidate) => surfaceOwnsNode(tweet, candidate));
  if (!likeButton || likeButton.disabled || likeButton.getAttribute('aria-disabled') === 'true') return;
  try {
    autoLikeClickTargets.add(likeButton);
    likeButton.click();
  } catch (error) {
    console.debug('RemiStats poke auto-like skipped:', error);
  } finally {
    queueMicrotask(() => autoLikeClickTargets.delete(likeButton));
  }
}

function maybePokeLikedTweet(likeButton) {
  if (!likeAutoPokeEnabled || autoLikeClickTargets.has(likeButton)) return;
  if (likeButton.disabled || likeButton.getAttribute('aria-disabled') === 'true') return;
  const tweet = likeButton.closest('[data-testid="tweet"]');
  if (!tweet || !surfaceOwnsNode(tweet, likeButton)) return;
  const pokeButton = Array.from(tweet.querySelectorAll('[data-reminet-poke]'))
    .find((candidate) => surfaceOwnsNode(tweet, candidate));
  if (!pokeButton || pokeButton.disabled || pokeButton.getAttribute('aria-disabled') === 'true') return;
  window.setTimeout(() => {
    if (!document.contains(pokeButton)) return;
    void handlePokeClick(pokeButton);
  }, 0);
}

function findPokeXHandle(button) {
  const tweet = button.closest('[data-testid="tweet"]');
  const miladyHandle = tweet?.dataset?.miladymaxxerHandle;
  if (miladyHandle) return miladyHandle;

  const profileHandle = profileUsernameFromUrl();
  if (profileHandle) return profileHandle;

  const container = button.closest('[data-testid="UserCell"], [data-testid="tweet"]');
  return container ? extractUsername(container) : '';
}

function isExplicitPokeCooldownResponse(response) {
  if (!response || response.authRequired) return false;
  if (response.code === 'poke_cooldown') return true;
  const data = response?.data || {};
  const nested = data?.data || {};
  const fields = [
    response?.error,
    data?.error,
    data?.message,
    data?.reason,
    data?.code,
    nested?.error,
    nested?.message,
    nested?.reason,
    nested?.code,
  ];
  return fields.some(isExplicitPokeCooldownText);
}

function isExplicitPokeCooldownText(value) {
  const text = String(value || '');
  return /already\s+poked|poke(?:\s+is)?\s+on\s+cool\s*down|poke\s+cool\s*down|cool\s*down/i.test(text)
    || /try again(?:\s+\w+){0,4}\s+to\s+poke/i.test(text)
    || /try again(?:\s+\w+){0,4}\s+(?:after|when|once)(?:\s+\w+){0,4}\s+cool\s*down/i.test(text);
}

function startPokeCooldown(button, username, cooldownMs, source = 'official') {
  if (!lifecycleActive()) return;
  const normalizedMs = Math.max(1000, Number(cooldownMs) || 0);
  const until = Date.now() + normalizedMs;
  const key = username.toLowerCase();
  pokeCooldowns.set(key, until);
  pokeCooldownSources.set(key, source);

  clearPokeCountdown(button);
  setPokeButtonState(
    button,
    'cooldown',
    source === 'offline-fallback' ? `Poke cooldown for ${username} (offline fallback)` : `Already poked ${username}`,
  );

  let cancelNextTick = null;
  const update = () => {
    cancelNextTick = null;
    if (!lifecycleActive() || !button.isConnected) {
      clearPokeCountdown(button);
      return;
    }
    const remaining = until - Date.now();
    if (remaining <= 0) {
      clearPokeCountdown(button);
      pokeCooldowns.delete(key);
      pokeCooldownSources.delete(key);
      setPokeButtonState(button, 'idle', 'Poke');
      return;
    }
    const label = formatPokeCooldown(remaining);
    button.textContent = label;
    const fallbackLabel = source === 'offline-fallback' ? ' (offline fallback)' : '';
    button.title = `Poke ${username} again in ${label}${fallbackLabel}`;
    button.setAttribute('aria-label', button.title);
    cancelNextTick = runtimeScheduler.timeout(update, 1000);
    pokeCountdownTimers.set(button, cancelNextTick);
  };

  update();
  if (cancelNextTick) pokeCountdownTimers.set(button, cancelNextTick);
}

function startPokeCooldownForUsername(username, cooldownMs, source = 'official') {
  const clean = cleanRemiliaUsername(username);
  if (!clean) return;
  const until = Date.now() + Math.max(1000, Number(cooldownMs) || 0);
  pokeCooldowns.set(clean.toLowerCase(), until);
  pokeCooldownSources.set(clean.toLowerCase(), source);
  for (const button of pokeButtonsForUsername(clean)) {
    startPokeCooldown(button, clean, until - Date.now(), source);
  }
}

function clearPokeCooldownForUsername(username) {
  const clean = cleanRemiliaUsername(username);
  if (!clean) return;
  pokeCooldowns.delete(clean.toLowerCase());
  pokeCooldownSources.delete(clean.toLowerCase());
  for (const button of pokeButtonsForUsername(clean)) {
    clearPokeCountdown(button);
    setPokeButtonState(button, 'idle', 'Poke');
  }
}

function clearPokeCountdown(button) {
  const cancelTimer = pokeCountdownTimers.get(button);
  if (cancelTimer) cancelTimer();
  pokeCountdownTimers.delete(button);
}

function clearAllPokeCountdowns() {
  for (const cancelTimer of pokeCountdownTimers.values()) {
    cancelTimer();
  }
  pokeCountdownTimers.clear();
  pokeButtonsByUsername.clear();
  pokeCooldowns.clear();
  pokeCooldownSources.clear();
  pokeEligibilityChecked.clear();
  confirmedPokeTargets.clear();
  confirmedProfileIdentities.clear();
  profileIdentityRequestGeneration += 1;
  profileIdentityPending.clear();
  profileIdentityLatestRequests.clear();
  profileIdentityForcedRouteKeys.clear();
  pokeTargetRequestGeneration += 1;
  pokeTargetLatestRequests.clear();
  pokeTargetBatchQueue.clear();
  if (pokeTargetBatchTimeout) clearTimeout(pokeTargetBatchTimeout);
  pokeTargetBatchTimeout = null;
  for (const resolvers of pokeTargetBatchPromises.values()) {
    for (const resolve of resolvers) resolve(null);
  }
  pokeTargetBatchPromises.clear();
}

function restorePokeButtonIcon(button) {
  clearPokeCountdown(button);
  button.textContent = '';
  const icon = document.createElement('span');
  icon.className = 'reminet-poke-outline-icon';
  icon.setAttribute('aria-hidden', 'true');
  const iconUrl = chrome.runtime.getURL('remistats/poke-outline.png');
  icon.style.webkitMaskImage = `url("${iconUrl}")`;
  icon.style.maskImage = `url("${iconUrl}")`;
  button.appendChild(icon);
}


async function updateIncomingPokeFlag(group, username) {
  const clean = cleanRemiliaUsername(username || group?.dataset?.reminetUsername);
  if (!group || !clean) return;
  group.dataset.reminetUsername = clean;

  const row = incomingPokeFlagContainer(group);
  if (!row) return;
  row.dataset.reminetUsername = clean;
  const currentFlag = row.querySelector('[data-reminet-incoming-poke]');
  if (currentFlag && cleanRemiliaUsername(currentFlag.dataset.reminetUsername).toLowerCase() !== clean.toLowerCase()) {
    currentFlag.remove();
  }

  const pokers = await getIncomingPokeHandles();
  if (!document.body.contains(group) || !document.body.contains(row) || cleanRemiliaUsername(row.dataset.reminetUsername).toLowerCase() !== clean.toLowerCase()) {
    return;
  }

  const hasPokedYou = pokers.has(clean.toLowerCase());
  const existingFlag = row.querySelector('[data-reminet-incoming-poke]');
  if (!hasPokedYou) {
    existingFlag?.remove();
    removeEmptyIncomingPokeRow(row);
    return;
  }

  if (existingFlag) return;
  const flag = document.createElement('span');
  flag.className = 'reminet-incoming-poke-flag';
  flag.dataset.reminetIncomingPoke = 'true';
  flag.dataset.reminetUsername = clean;
  flag.textContent = 'poked you!';
  flag.title = `${clean} poked you on RemiliaNET`;
  flag.setAttribute('aria-label', flag.title);
  row.appendChild(flag);
  void markIncomingPokesRead(clean);
}


function incomingPokeFlagContainer(group) {
  if (!group) return null;
  const tweet = group.closest('[data-testid="tweet"]');
  if (!tweet || !surfaceOwnsNode(tweet, group)) return group;
  return ensureTweetIncomingPokeRow(tweet);
}

function ensureTweetIncomingPokeRow(tweet) {
  const existing = Array.from(tweet.querySelectorAll('[data-reminet-incoming-poke-row]'))
    .find((row) => surfaceOwnsNode(tweet, row));
  if (existing) return existing;

  const row = document.createElement('div');
  row.className = 'reminet-incoming-poke-row';
  row.dataset.reminetIncomingPokeRow = 'true';
  const anchor = Array.from(tweet.querySelectorAll('[data-testid="tweetText"]'))
    .find((node) => surfaceOwnsNode(tweet, node));
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(row, anchor.nextSibling);
    return row;
  }

  const timeElement = findOwnedNode(tweet, 'time');
  const userName = timeElement?.closest('[data-testid="User-Name"]');
  const userNameBlock = userName?.parentElement;
  if (userNameBlock?.parentElement) {
    userNameBlock.parentElement.insertBefore(row, userNameBlock.nextSibling);
    return row;
  }

  return null;
}

function removeEmptyIncomingPokeRow(row) {
  if (!row?.matches?.('[data-reminet-incoming-poke-row]')) return;
  if (!row.querySelector('[data-reminet-incoming-poke]')) row.remove();
}

async function getIncomingPokeHandles() {
  if (incomingPokeCache && Date.now() - incomingPokeCache.fetchedAt < 60 * 1000) {
    return incomingPokeCache.handles;
  }

  const response = await runtimeSendMessage({ type: 'beetol:incomingPokes' }, 'beetol:incomingPokes');
  const handles = new Set(
    Array.isArray(response?.pokers)
      ? response.pokers.map(handle => cleanRemiliaUsername(handle).toLowerCase()).filter(Boolean)
      : []
  );
  const keysByHandle = new Map();
  for (const poke of Array.isArray(response?.pokes) ? response.pokes : []) {
    const handle = cleanRemiliaUsername(poke?.handle).toLowerCase();
    const key = typeof poke?.key === 'string' ? poke.key : '';
    if (!handle || !key) continue;
    if (!keysByHandle.has(handle)) keysByHandle.set(handle, []);
    keysByHandle.get(handle).push(key);
  }
  incomingPokeCache = { fetchedAt: Date.now(), handles, keysByHandle };
  return handles;
}

async function markIncomingPokesRead(username) {
  const handle = cleanRemiliaUsername(username).toLowerCase();
  const keys = incomingPokeCache?.keysByHandle?.get(handle) || [];
  if (keys.length === 0) return;
  await runtimeSendMessage({ type: 'remistats:markNotificationsRead', keys }, 'remistats:markNotificationsRead');
}

function patchExistingBadges() {
  for (const badge of document.querySelectorAll('[data-reminet-badge]:not([data-reminet-compact])')) {
    const username = badge.dataset.reminetUsername || profileUsernameFromUrl();
    if (badge.hasAttribute('data-profile-badge')) {
      if (!normalizeProfilePokeGroup(badge, username)) {
        ensureStandalonePokeButton(badge, username);
      }
      continue;
    }
    if (visualTheme.pokePlacement === 'actions') {
      for (const node of badge.querySelectorAll('[data-reminet-poke], [data-reminet-incoming-poke]')) node.remove();
      const tweet = badge.closest('[data-testid="tweet"]');
      if (tweet) insertActionPoke(tweet, username);
      continue;
    }
    if (badge.querySelector('[data-reminet-poke]')) continue;
    const content = badge.querySelector('.reminet-badge-content');
    if (!username || !content) continue;
    badge.dataset.reminetUsername = username;
    const tweet = badge.closest('[data-testid="tweet"]');
    const button = createPokeButton(username, false, badge.dataset.reminetXHandle || (tweet ? extractUsername(tweet) : ''));
    if (!button) continue;
    content.appendChild(button);
  }
}

function profileUsernameFromUrl() {
  const match = location.pathname.match(/^\/([^\/\?]+)/);
  if (!match || ROUTE_BLOCKLIST.has(match[1])) return '';
  return cleanUsername(match[1]);
}

function getSharedTooltip() {
  let tooltip = document.querySelector('[data-reminet-tooltip="true"]');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'reminet-tooltip';
    tooltip.setAttribute('data-reminet-tooltip', 'true');
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showSharedTooltip(badge) {
  const html = badge.dataset.reminetTooltipHtml;
  if (!html) return;
  if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
  activeTooltipBadge = badge;
  const tooltip = getSharedTooltip();
  tooltip.innerHTML = html;
  tooltip.classList.add('visible');
  positionSharedTooltip(badge);
}

function positionSharedTooltip(badge) {
  const content = badge.querySelector('.reminet-badge-content') || badge;
  const tooltip = getSharedTooltip();
  const rect = content.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.bottom + 8}px`;
}

function scheduleHideSharedTooltip(delay = 120) {
  if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(() => {
    const tooltip = getSharedTooltip();
    tooltip.classList.remove('visible');
    activeTooltipBadge = null;
  }, delay);
}

// Find a sensible anchor element next to which the badge should sit.
// Order of preference:
//   1. <time> element inside the owned tweet header
//   2. [data-testid="User-Name"] (tweets)
//   3. Any [dir="ltr"][class*="css"] block as a last resort
function existingAuthorBadge(element) {
  let ownBadge = Array.from(element.querySelectorAll('[data-reminet-badge]'))
    .find((badge) => surfaceOwnsNode(element, badge));
  if (ownBadge && !badgeMatchesTweetAuthor(ownBadge.dataset.reminetXHandle || '', extractUsername(element) || '')) {
    ownBadge.remove();
    ownBadge = null;
  }
  return ownBadge;
}

// Insert badge into the DOM for tweets and user cells
async function insertBadge(element, usernameOverride = null) {
  if (surfaceIsInsideQuoteTweet(element)) {
    return markSurfaceResult(element, 'quote-skip');
  }
  const tweet = element.matches?.('[data-testid="tweet"]') ? element : element.closest?.('[data-testid="tweet"]');
  if (tweet && quotedTweetRoot(element) !== element && !surfaceOwnsNode(tweet, element)) {
    return markSurfaceResult(element, 'quote-skip');
  }
  const ownBadge = existingAuthorBadge(element);
  if (ownBadge) {
    const existingSlot = Array.from(element.querySelectorAll('[data-reminet-badge-slot], [data-milxdy-tweet-slot="remistats-badge"]'))
      .find((slot) => surfaceOwnsNode(element, slot));
    // Repeated surface delivery is normal as X virtualizes the timeline. Avoid
    // another measured layout pass unless X actually moved the existing slot.
    positionBadgeSlotNearTweetTime(element, existingSlot);
    if (existingSlot) maintainBadgeTextFlow(element, existingSlot);
    await reconcileExistingPokeLauncher(element, ownBadge);
    return markSurfaceResult(element, 'already-has-badge');
  }
  
  // Mark element as processing to prevent duplicate insertions during async operations
  if (element.hasAttribute('data-reminet-processing')) {
    if (!surfaceProcessingIsStale(element)) {
      return markSurfaceResult(element, 'processing');
    }
    clearReminetProcessing(element);
  }
  markReminetProcessing(element, true);
  
  const username = cleanUsername(usernameOverride) || extractUsername(element);
  if (!username) {
    clearReminetProcessing(element);
    return markSurfaceResult(element, 'no-handle');
  }
  element.dataset.reminetLookupHandle = username;

  const existingSlot = Array.from(element.querySelectorAll('[data-milxdy-tweet-slot="remistats-badge"], [data-reminet-badge-slot]'))
    .find((slot) => surfaceOwnsNode(element, slot));
  const badgeSlot = existingSlot
    ? prepareBadgeSlot(existingSlot, username, { actionPoke: visualTheme.pokePlacement !== 'actions' })
    : createBadgeSlot(username, { actionPoke: visualTheme.pokePlacement !== 'actions' });
  positionBadgeSlotNearTweetTime(element, badgeSlot);
  maintainBadgeTextFlow(element, badgeSlot);
  if (!existingSlot && !insertBadgeSlot(element, badgeSlot, findOwnedHeaderTime, findOwnedUserName, findOwnedNode)) {
    clearReminetProcessing(element);
    return markSurfaceResult(element, 'slot-missing', username);
  }
  const actionPokeSlot = visualTheme.pokePlacement === 'actions'
    ? reserveActionPoke(element, username)
    : null;
  
  try {
    const [scoreData, pokeTarget] = await Promise.all([
      fetchUserScore(username),
      fetchPokeTarget(username),
    ]);
    // X recycles post nodes while identity requests are in flight.
    if (!badgeMatchesTweetAuthor(username, extractUsername(element) || '')
      || (scoreData && !badgeMatchesTweetAuthor(scoreData.twitterHandle || '', username))) {
      markBadgeSlotEmpty(badgeSlot);
      clearReminetProcessing(element);
      return markSurfaceResult(element, 'author-changed');
    }
    const pokeUsername = cleanRemiliaUsername(pokeTarget?.remiliaUsername);

    if (!scoreData) {
      markBadgeSlotEmpty(badgeSlot);
      if (actionPokeSlot) fillActionPokeSlot(actionPokeSlot, pokeUsername, username);
      else if (pokeUsername) insertActionPoke(element, pokeUsername, username);
      clearReminetProcessing(element);
      return markSurfaceResult(element, pokeUsername ? 'poke-only' : 'fetch-empty', username);
    }

    const badge = createScoreBadge(scoreData, { pokeTargetUsername: pokeUsername });
    
    // Remove processing flag since we're about to insert the badge
    clearReminetProcessing(element);
    
    fillBadgeSlot(badgeSlot, badge, scoreData.remiliaUsername || scoreData.username || username);
    maintainBadgeTextFlow(element, badgeSlot);
    if (visualTheme.pokePlacement === 'actions') {
      insertActionPoke(element, pokeUsername, username);
    }
    return markSurfaceResult(element, 'rendered', scoreData.remiliaUsername || scoreData.username || username);
  } catch (error) {
    console.error('Error inserting badge:', error);
    markBadgeSlotEmpty(badgeSlot);
    fillActionPokeSlot(actionPokeSlot, '');
    clearReminetProcessing(element);
    return markSurfaceResult(element, 'api-error', username);
  }
}

function markSurfaceResult(element, status, username = '') {
  if (element?.dataset) {
    element.dataset.reminetDebug = status;
    if (username) element.dataset.reminetLookupHandle = cleanUsername(username);
  }
  return { status, username: cleanUsername(username) };
}

function surfaceProcessingIsStale(element) {
  const startedAt = Number(element.dataset.reminetProcessingAt || 0);
  return !Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt > 10000;
}

function insertActionPoke(element, username, xHandle = '') {
  const clean = cleanRemiliaUsername(username);
  const existingGroups = Array.from(element.querySelectorAll('[data-reminet-action-poke-group]'))
    .filter((group) => surfaceOwnsNode(element, group));
  const existing = existingGroups.shift();
  for (const duplicate of existingGroups) duplicate.remove();
  if (existing) {
    fillActionPokeSlot(existing, clean, xHandle || extractUsername(element));
    return;
  }
  if (!clean) return;
  const actions = findTweetActionRow(element);
  if (!actions) return;
  const cluster = createPokeCluster(clean, xHandle || extractUsername(element));
  if (!cluster) return;
  insertActionPokeGroup(actions, cluster);
}

function reserveActionPoke(element, username, xHandle = '') {
  if (Array.from(element.querySelectorAll('[data-reminet-action-poke-group]')).some((group) => surfaceOwnsNode(element, group))) return null;
  const actions = findTweetActionRow(element);
  if (!actions) return null;
  const cluster = createActionPokeSlot(username);
  insertActionPokeGroup(actions, cluster, xHandle);
  return cluster;
}

function insertActionPokeGroup(actions, cluster) {
  const like = actions.querySelector('[data-testid="like"], [data-testid="unlike"]');
  const likeSlot = like?.closest('[role="group"] > div') || like?.parentElement?.parentElement;
  if (likeSlot) {
    likeSlot.insertAdjacentElement('afterend', cluster);
  } else {
    actions.appendChild(cluster);
  }
}

function findTweetActionRow(element) {
  const action = findOwnedNode(element, '[data-testid="reply"], [data-testid="like"], [data-testid="unlike"]');
  const labeledGroup = action?.closest?.('[role="group"][aria-label]');
  if (labeledGroup && surfaceOwnsNode(element, labeledGroup)) return labeledGroup;
  const group = action?.closest?.('[role="group"]');
  if (group && surfaceOwnsNode(element, group)) return group;
  return findOwnedNode(element, '[role="group"][aria-label]');
}

const trophyBannerMedia = createTrophyBannerMedia({
  baseUrl: REMILIA_BASE_URL,
  cleanUsername: cleanRemiliaUsername,
  send: (message, type) => runtimeSendMessage(message, type),
});

function renderTrophyBanner(remiliaUsername) {
  return trophyBannerMedia.render(remiliaUsername);
}

function findProfileBannerRoot(xHandle = profileUsernameFromUrl()) {
  return findExactProfileBannerRoot(document, cleanExactXHandle(xHandle));
}

function clearTrophyBannerOverlay(root) {
  clearBannerOverlay(root);
}

const bannerCycleService = createBannerCycleService({
    send: (message, type) => runtimeSendMessage(message, type), preload: preloadDisplayImage, renderTrophy: renderTrophyBanner, transition: transitionBannerOverlay, toOriginal: transitionBannerToOriginal,
    clearLabel: clearBannerNftLabel, setLabel: setBannerNftLabel, cleanUsername: cleanRemiliaUsername, runtimeUrl: (path) => chrome.runtime.getURL(path),
    playSpin: () => window.reminetSounds?.playSpin?.(), settings: () => bannerSettings, pathname: () => window.location.pathname,
});
const ensureBannerCycleButton = bannerCycleService.ensureButton;

const profileBannerController = createProfileBannerController({
    profileUsername: profileUsernameFromUrl, exactXHandle: exactXProfileHandle, cleanXHandle: cleanExactXHandle, cleanRemilia: cleanRemiliaUsername,
    fetchIdentity: fetchProfileIdentity, confirmed: isConfirmedProfileIdentity, findRoot: findProfileBannerRoot, clearOverlay: clearTrophyBannerOverlay,
    transitionOverlay: transitionBannerOverlay, clearNftLabel: clearBannerNftLabel, renderBanner: renderTrophyBanner, ensureCycleButton: ensureBannerCycleButton,
    applyInitial: bannerCycleService.renderInitial, cycleAvailable: () => bannerCycleService.cycleAvailable(),
    phase: recordRuntimePhase, scheduler: () => runtimeScheduler, pathname: () => window.location.pathname,
});
const reconcileProfileTrophy = profileBannerController.reconcile;
const resetProfileTrophyBanner = profileBannerController.reset;
const upgradeProfileTrophyBanner = profileBannerController.upgrade;

// Track which profiles have been processed
const processedProfiles = new Set();
let lastProfileUrl = location.href;
let groupChatScanTimer = null;
let routeProfileTimer = null;
let reconciliationTimer = null;
let reconciliationScheduled = false;
let reconciliationDueAt = 0;
let reconciliationRunning = false;
let reconciliationFollowUp = false;
let reconciliationFollowUpDelay = 900;
let booted = false;
let runtimeScheduleScan = () => undefined;
let addRuntimeDisposable = () => undefined;
const unavailableRuntimeSendMessage = () => Promise.resolve(null);
let runtimeSendMessage = unavailableRuntimeSendMessage;
let lifecycleSignal = null;
let runtimeScheduler = createFallbackRuntimeScheduler({ idleTimeoutMs: 1500, timeoutFallbackMs: 250 });

// Insert badge on profile pages

async function insertProfileBadge() {
  // Find the username/handle section
  const userNameSection = document.querySelector('[data-testid="primaryColumn"] [data-testid="UserName"]');
  if (!userNameSection) {
    return;
  }

  const { username, exactProfileXHandle } = profileBadgeIdentity(
    userNameSection, window.location.pathname, ROUTE_BLOCKLIST, cleanExactXHandle, cleanUsername,
  );

  if (!username) {
    clearReminetProcessing(userNameSection);
    return;
  }

  const profileKey = `${username}-${window.location.pathname}`;
  
  // Check if badge already exists in this specific location
  const existingBadge = userNameSection.querySelector('[data-reminet-badge]:not([data-reminet-compact])');
  if (existingBadge) {
    const existingProfileUsername = cleanUsername(existingBadge.getAttribute('data-profile-badge'));
    if (existingProfileUsername && existingProfileUsername.toLowerCase() !== username.toLowerCase()) {
      const group = existingBadge.closest('[data-reminet-profile-badge-group]');
      (group || existingBadge).remove();
    } else {
      const existingTarget = exactProfileXHandle ? await fetchPokeTarget(exactProfileXHandle) : null;
      const existingUsername = cleanRemiliaUsername(existingTarget?.remiliaUsername);
      const group = existingBadge.closest('[data-reminet-profile-badge-group]');
      if (group) attachProfileBadgeGroup(userNameSection, group);
      if (!normalizeProfilePokeGroup(existingBadge, existingUsername)) {
        ensureStandalonePokeButton(existingBadge, existingUsername);
      }
      return;
    }
  }

  const existingSlot = userNameSection.querySelector('[data-reminet-profile-slot]');
  if (existingSlot) {
    const existingSlotUsername = cleanUsername(existingSlot.dataset.reminetUsername);
    if (existingSlotUsername && existingSlotUsername.toLowerCase() !== username.toLowerCase()) {
      const group = existingSlot.closest('[data-reminet-profile-badge-group]');
      (group || existingSlot).remove();
    } else {
      if (existingSlot.dataset.reminetState === 'empty') {
        const group = existingSlot.closest('[data-reminet-profile-badge-group]');
        (group || existingSlot).remove();
        processedProfiles.delete(profileKey);
      } else {
        const group = existingSlot.closest('[data-reminet-profile-badge-group]');
        const slotXHandle = cleanExactXHandle(existingSlot.querySelector('[data-reminet-badge]')?.dataset.reminetXHandle || exactProfileXHandle || username);
        if (group) attachProfileBadgeGroup(userNameSection, group);
        const slotTarget = slotXHandle ? await fetchPokeTarget(slotXHandle) : null;
        const existingPokeSlot = ensureProfileActionPokeSlot(userNameSection, slotXHandle);
        const confirmedUsername = cleanRemiliaUsername(slotTarget?.remiliaUsername);
        if (confirmedUsername) fillProfilePokeSlot(existingPokeSlot, confirmedUsername, slotXHandle);
        return;
      }
    }
  }
  
  // Check if already processing
  if (userNameSection.hasAttribute('data-reminet-processing')) {
    return;
  }
  markReminetProcessing(userNameSection);
  
  // Create a unique key for this profile + location
  if (processedProfiles.has(profileKey)) {
    const cachedTarget = exactProfileXHandle ? await fetchPokeTarget(exactProfileXHandle) : null;
    const cachedPublicScore = cachedScoreData(username);
    const officialSelfScore = exactProfileXHandle
      ? await fetchOfficialSelfProfileScore(exactProfileXHandle)
      : null;
    const cached = officialSelfScore || cachedPublicScore;
    if (cached) {
      const profileBadgeSlot = createBadgeSlot(username, { profile: true });
      const profilePokeSlot = ensureProfileActionPokeSlot(userNameSection, username);
      const profileBadgeGroup = document.createElement('span');
      profileBadgeGroup.className = 'reminet-profile-badge-group';
      profileBadgeGroup.dataset.reminetProfileBadgeGroup = 'true';
      profileBadgeGroup.dataset.reminetUsername = username;
      profileBadgeGroup.append(profileBadgeSlot);
      attachProfileBadgeGroup(userNameSection, profileBadgeGroup);
      const filled = fillProfileBadgeFromScore(profileBadgeSlot, profileBadgeGroup, cached, username, cachedTarget?.remiliaUsername);
      if (filled) fillProfilePokeSlot(profilePokeSlot, cachedTarget?.remiliaUsername, exactProfileXHandle);
    }
    clearReminetProcessing(userNameSection);
    return;
  }

  const profileBadgeSlot = createBadgeSlot(username, { profile: true });
  const profilePokeSlot = ensureProfileActionPokeSlot(userNameSection, username);
  const profileBadgeGroup = document.createElement('span');
  profileBadgeGroup.className = 'reminet-profile-badge-group';
  profileBadgeGroup.dataset.reminetProfileBadgeGroup = 'true';
  profileBadgeGroup.dataset.reminetUsername = username;
  profileBadgeGroup.append(profileBadgeSlot);

  attachProfileBadgeGroup(userNameSection, profileBadgeGroup);

  try {
    const [publicScoreData, profileTarget] = await Promise.all([
      fetchUserScore(username),
      exactProfileXHandle ? fetchPokeTarget(exactProfileXHandle) : Promise.resolve(null),
    ]);
    const officialSelfScoreData = exactProfileXHandle
      ? await fetchOfficialSelfProfileScore(exactProfileXHandle)
      : null;
    const scoreData = officialSelfScoreData || publicScoreData;

    if (scoreData === null) {
      processedProfiles.add(profileKey);
      markBadgeSlotEmpty(profileBadgeSlot);
      const pokeTarget = exactProfileXHandle ? confirmedPokeTargets.get(exactProfileXHandle.toLowerCase()) : '';
      fillProfilePokeSlot(profilePokeSlot, pokeTarget, exactProfileXHandle);
      clearReminetProcessing(userNameSection);
      return;
    }

    if (!scoreData) {
      markBadgeSlotEmpty(profileBadgeSlot);
      const pokeTarget = exactProfileXHandle ? confirmedPokeTargets.get(exactProfileXHandle.toLowerCase()) : '';
      fillProfilePokeSlot(profilePokeSlot, pokeTarget, exactProfileXHandle);
      clearReminetProcessing(userNameSection);
      return;
    }

    processedProfiles.add(profileKey);

    clearReminetProcessing(userNameSection);
    const filled = fillProfileBadgeFromScore(profileBadgeSlot, profileBadgeGroup, scoreData, username, profileTarget?.remiliaUsername);
    if (filled) fillProfilePokeSlot(profilePokeSlot, profileTarget?.remiliaUsername, exactProfileXHandle);
  } catch (error) {
    console.error('Error inserting profile badge:', error);
    markBadgeSlotEmpty(profileBadgeSlot);
    clearReminetProcessing(userNameSection);
    // Remove from processed set on error so we can retry
    processedProfiles.delete(profileKey);
  }
}

// Compact score-only "ribbon" anchored under sender avatars in group chats.
function createCompactBadge(scoreData) {
  const badge = document.createElement('div');
  badge.className = 'reminet-compact-badge';
  badge.setAttribute('data-reminet-badge', 'true');
  badge.setAttribute('data-reminet-compact', 'true');

  const starUrl = chrome.runtime.getURL('remistats/star.svg');
  badge.innerHTML = `
    <img src="${starUrl}" class="reminet-compact-star" alt="" />
    <span class="reminet-compact-score">${formatMetric(scoreData.score)}</span>
  `;

  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const remiliaUsername = cleanRemiliaUsername(scoreData.remiliaUsername || '');
    if (remiliaUsername) window.open(`https://remilia.net/~${remiliaUsername}`, '_blank');
  });

  return badge;
}

// Group chats only: URL pattern /i/chat/g<id>. 1-on-1 DMs are ignored.
function isInGroupChat() {
  return /^\/i\/chat\/g/.test(location.pathname);
}

// Avatar links we've already badged. WeakSet so removed nodes get GC'd.
const processedMessageAvatars = new WeakSet();

// In group chats X renders each sender's avatar as
// <a href="https://x.com/<handle>"> inside the message bubble. The avatar
// itself has overflow-hidden, so the ribbon attaches to the parent grid
// slot (style="grid-area: avatar") to escape clipping.
async function processGroupChatAvatars() {
  if (!isInGroupChat()) return;
  const startedAt = performance.now();

  try {
    const messageList = document.querySelector('[data-testid="dm-message-list"]')
      || document.querySelector('[data-testid="dm-message-list-container"]');
    if (!messageList) return;

    const links = messageList.querySelectorAll('a[href]');

    for (const link of links) {
      if (processedMessageAvatars.has(link)) continue;

      const href = link.getAttribute('href') || '';
      // Match /handle, https://x.com/handle, https://twitter.com/handle.
      // Reject anything with a second path segment (status urls, etc.).
      const match = href.match(/^(?:https?:\/\/(?:twitter|x)\.com)?\/([^\/\?#]+)\/?$/);
      if (!match) continue;

      const username = match[1];
      if (!username || ROUTE_BLOCKLIST.has(username)) continue;

      // Only badge the chat sender's avatar. Embedded post cards (shared
      // tweets, link previews) also contain author avatar links but lack the
      // grid-area: avatar wrapper. Reject anything inside such embeds.
      const avatarSlot = link.closest('[style*="grid-area: avatar"]');
      if (!avatarSlot) continue;
      if (link.closest('article, [data-testid="tweet"], [data-testid="card.wrapper"]')) continue;
      if (avatarSlot.querySelector('[data-reminet-compact]')) continue;

      processedMessageAvatars.add(link);

      try {
        const scoreData = await fetchUserScore(username);
        if (!scoreData) continue;
        if (avatarSlot.querySelector('[data-reminet-compact]')) continue;

        if (getComputedStyle(avatarSlot).position === 'static') {
          avatarSlot.style.position = 'relative';
        }
        avatarSlot.style.overflow = 'visible';

        avatarSlot.appendChild(createCompactBadge(scoreData));
      } catch (error) {
        console.error('RemiStats group avatar error:', error);
      }
    }
  } finally {
    recordFeatureTiming('remistats', 'groupChatAvatars', startedAt);
  }
}

async function processSurfaceElement(element, username = null) {
  if (!remistatsEnabled) return { status: 'disabled', username: '' };
  if (element.matches?.('[data-testid="tweet"], [data-testid="UserCell"], [data-testid="user-cell"]')) {
    const startedAt = performance.now();
    try {
      const result = await insertBadge(element, username);
      if (element.matches('[data-testid="tweet"]')) {
        const quotes = Array.from(element.querySelectorAll('[data-testid="quoteTweet"], div[role="link"][tabindex="0"]'))
          .filter(root => quotedTweetRoot(root) === root && root.querySelector('[data-testid="User-Name"]'));
        await Promise.all(quotes.map(root => insertBadge(root, quotedTweetHandle(root))));
      }
      return result;
    } finally {
      recordFeatureTiming('remistats', 'insertBadge', startedAt);
    }
  }
  return { status: 'unsupported-surface', username: '' };
}

function currentPerformanceMode() {
  return document.documentElement.dataset.milxdyPerformanceMode || 'balanced';
}

function remistatsReconciliationPolicy() {
  const mode = currentPerformanceMode();
  if (mode === 'fast') return { limit: 48, batchSize: 3 };
  if (mode === 'balanced') return { limit: 96, batchSize: 4 };
  if (mode === 'developer') return { limit: 320, batchSize: 12 };
  return { limit: 160, batchSize: 6 };
}

function remistatsFetchPolicy() {
  const mode = currentPerformanceMode();
  if (mode === 'fast') return { batchSize: 6, batchDelay: 350 };
  if (mode === 'balanced') return { batchSize: 16, batchDelay: 180 };
  if (mode === 'developer') return { batchSize: CONFIG.batchSize, batchDelay: 50 };
  return { batchSize: 32, batchDelay: 100 };
}

function finishSurfaceReconciliation() {
  reconciliationRunning = false;
  if (!reconciliationFollowUp || !lifecycleActive() || !remistatsEnabled) return;
  const delay = reconciliationFollowUpDelay;
  reconciliationFollowUp = false;
  reconciliationFollowUpDelay = 900;
  scheduleSurfaceReconciliation([delay]);
}

function reconcileMountedSurfaces(limit = remistatsReconciliationPolicy().limit) {
  if (!lifecycleActive() || !remistatsEnabled) return;
  if (reconciliationRunning) {
    reconciliationFollowUp = true;
    return;
  }
  reconciliationRunning = true;
  const policy = remistatsReconciliationPolicy();
  const surfaces = Array.from(document.querySelectorAll('[data-testid="tweet"], [data-testid="UserCell"], [data-testid="user-cell"]'))
    .filter(shouldReconcileSurface)
    .slice(0, Math.max(1, limit));
  let index = 0;
  const processNext = () => {
    if (!lifecycleActive() || !remistatsEnabled) {
      finishSurfaceReconciliation();
      return;
    }
    if (index >= surfaces.length) {
      finishSurfaceReconciliation();
      return;
    }
    const batch = surfaces.slice(index, index + policy.batchSize);
    index += batch.length;
    for (const element of batch) {
      prepareSurfaceForReconcile(element);
      void processSurfaceElement(element);
    }
    if (index < surfaces.length) {
      runtimeScheduler.idle(processNext, { timeout: 1200 });
    } else {
      finishSurfaceReconciliation();
    }
  };
  runtimeScheduler.idle(processNext, { timeout: 250 });
}

function normalizeReconciliationDelays(delays) {
  const list = Array.isArray(delays) ? delays : [delays];
  const normalized = list
    .map((delay) => Number(delay))
    .filter((delay) => Number.isFinite(delay) && delay >= 0)
    .sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [250];
}

function scheduleSurfaceReconciliation(delays = [250, 1500, 4000]) {
  if (!lifecycleActive() || !remistatsEnabled) return;
  const normalized = normalizeReconciliationDelays(delays);
  if (normalized.length > 1) {
    reconciliationFollowUp = true;
    reconciliationFollowUpDelay = Math.max(reconciliationFollowUpDelay, normalized[normalized.length - 1]);
  }
  if (reconciliationRunning) {
    reconciliationFollowUp = true;
    return;
  }
  const dueAt = Date.now() + normalized[0];
  if (reconciliationScheduled) {
    reconciliationFollowUp = true;
    if (reconciliationDueAt && reconciliationDueAt <= dueAt) return;
    reconciliationTimer?.();
  }
  reconciliationScheduled = true;
  reconciliationDueAt = dueAt;
  reconciliationTimer = runtimeScheduler.timeout(() => {
    reconciliationTimer = null;
    reconciliationScheduled = false;
    reconciliationDueAt = 0;
    reconcileMountedSurfaces();
  }, normalized[0]);
}

function shouldReconcileSurface(element) {
  if (!element?.isConnected) return false;
  if (surfaceIsInsideQuoteTweet(element)) return false;
  const tweet = element.matches?.('[data-testid="tweet"]') ? element : element.closest?.('[data-testid="tweet"]');
  if (tweet && !surfaceOwnsNode(tweet, element)) return false;
  const hasOwnBadge = Array.from(element.querySelectorAll('[data-reminet-badge]'))
    .some((badge) => surfaceOwnsNode(element, badge));
  if (hasOwnBadge) return false;
  return Boolean(
    element.matches?.('[data-testid="tweet"], [data-testid="UserCell"], [data-testid="user-cell"]')
  );
}

function prepareSurfaceForReconcile(element) {
  if (surfaceProcessingIsStale(element)) {
    clearReminetProcessing(element);
  }
  for (const slot of Array.from(element.querySelectorAll('[data-reminet-badge-slot][data-reminet-state="empty"], [data-milxdy-tweet-slot="remistats-badge"][data-reminet-state="empty"]'))) {
    if (!surfaceOwnsNode(element, slot)) continue;
    slot.dataset.reminetState = 'reserved';
    slot.removeAttribute('aria-hidden');
  }
}

function scheduleGroupChatAvatars(delay = 250) {
  if (!lifecycleActive() || !isInGroupChat()) return;
  if (groupChatScanTimer) groupChatScanTimer();
  groupChatScanTimer = runtimeScheduler.timeout(() => {
    groupChatScanTimer = null;
    if (!lifecycleActive()) return;
    void processGroupChatAvatars();
  }, delay);
}

export function boot(context = {}) {
  runtimeScheduleScan = context.scheduleScan || runtimeScheduleScan;
  runtimeScheduler = context.scheduler || runtimeScheduler;
  runtimeSendMessage = context.sendMessage || unavailableRuntimeSendMessage;
  recordRemiStatsRuntimePhase = context.recordDiagnostic || (() => undefined);
  addRuntimeDisposable = context.addDisposable || (() => undefined);
  lifecycleSignal = context.signal || null;
  if (booted) return;
  booted = true;
  runtimeEffects.install(REMINET_CONTENT_VERSION, context.resolveAssetUrl);
  addRuntimeDisposable(runtimeEffects.dispose);
  recordRuntimePhase('activation', 'module-started');
  const bootSignal = lifecycleSignal;
  bootSignal?.addEventListener?.('abort', disable, { once: true });
  addRuntimeDisposable(() => bootSignal?.removeEventListener?.('abort', disable));
  init();
}

function init() {
  Promise.all([
    chrome.storage.sync.get({ 'milxdy.remistats.enabled': true, ...BANNER_SETTING_DEFAULTS }),
    loadIconSettings(),
    loadPokeAutoLikeSetting(),
    loadPokeThemeSettings(),
    loadVisualThemeSettings(),
  ]).then(([settings]) => {
    if (!lifecycleActive()) return;
    bannerSettings = readBannerSettings(settings);
    remistatsEnabled = settings['milxdy.remistats.enabled'] !== false;
    if (remistatsEnabled) {
      recordRuntimePhase('activation', 'feature-enabled');
      runtimeScheduleScan();
      scheduleSurfaceReconciliation();
      void reconcileProfileTrophy();
      insertProfileBadge();
      scheduleGroupChatAvatars();
    } else {
      recordRuntimePhase('activation', 'feature-disabled');
      clearRemiStatsBadges();
    }
  }).catch(() => {
    recordRuntimePhase('activation', 'initialization-failed');
  });

  observeStorageSettings();

  runtimeScheduleScan();
  scheduleSurfaceReconciliation([5000]);
}

function observeStorageSettings() {
  const storageListener = (changes, area) => {
    if (!lifecycleActive()) return;
    if (area === 'sync') window.reminetSounds?.applySettings?.(changes);
    if (area === 'local' && changes['milxdy.remiliaAuth.control.v1']) {
      refreshPokeAuthentication({ confirmedPokeTargets, pokeTargetLatestRequests, fillActionPokeSlot, isEnabled: () => remistatsEnabled, runtimeScheduler, lifecycleActive, surfaceIsInsideQuoteTweet, remistatsReconciliationPolicy, processSurfaceElement, insertProfileBadge });
      return;
    }
    if (area === 'local' && (changes.beetolColor || changes.beetolMode)) {
      applyPokeThemeSettings(changes.beetolColor?.newValue, changes.beetolMode?.newValue);
      return;
    }
    if (area === 'local' && changes['milxdy.settings.visualTheme']) {
      void loadVisualThemeSettings().then(() => {
        if (!lifecycleActive() || !remistatsEnabled) return;
        runtimeScheduleScan();
        scheduleSurfaceReconciliation([300, 2200]);
        void reconcileProfileTrophy();
        void insertProfileBadge();
      });
      return;
    }
    if (area !== 'sync') return;
    if (Object.keys(BANNER_SETTING_DEFAULTS).some(key => changes[key])) {
      bannerCycleService.invalidate();
      // Preserve overlays until their replacement is ready, while invalidating pending work.
      profileBannerController.invalidate();
      for (const root of document.querySelectorAll('[data-milxdy-trophy-banner-state]')) {
        root.dataset.milxdyTrophyBannerState = 'loading';
      }
      bannerSettings = updateBannerSettings(bannerSettings, changes);
      if (remistatsEnabled) void reconcileProfileTrophy();
    }
    if (changes['milxdy.remistats.enabled']) {
      remistatsEnabled = changes['milxdy.remistats.enabled'].newValue !== false;
      if (remistatsEnabled) {
        recordRuntimePhase('activation', 'feature-enabled');
        runtimeScheduleScan();
        scheduleSurfaceReconciliation();
        void reconcileProfileTrophy();
        insertProfileBadge();
        scheduleGroupChatAvatars();
      } else {
        recordRuntimePhase('activation', 'feature-disabled');
        clearRemiStatsBadges();
      }
      return;
    }
    if (changes['milxdy.remistats.likeAutoPoke']) {
      likeAutoPokeEnabled = changes['milxdy.remistats.likeAutoPoke'].newValue === true;
    }
    if (changes['milxdy.remistats.pokeAutoLike']) {
      pokeAutoLikeEnabled = changes['milxdy.remistats.pokeAutoLike'].newValue === true;
    }
    if (iconSettingChanged(changes)) {
      void loadIconSettings().then(() => {
        if (!lifecycleActive() || !remistatsEnabled) return;
        runtimeScheduleScan();
        scheduleSurfaceReconciliation([100, 1000]);
        void reconcileProfileTrophy();
        void insertProfileBadge();
      });
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
  addRuntimeDisposable(() => chrome.storage.onChanged.removeListener(storageListener));
}

export function onSurface(surface) {
  if (!lifecycleActive() || !remistatsEnabled) return;
  if (surface.kind === 'tweet' || surface.kind === 'userCell') {
    void processSurfaceElement(surface.element, surface.handle);
  }
  if (surface.kind === 'profile') {
    void reconcileProfileTrophy(surface.handle || profileUsernameFromUrl());
    void insertProfileBadge();
  }
  if (surface.kind === 'directMessage') {
    scheduleGroupChatAvatars();
  }
}

export function onRouteChange(route) {
  if (!lifecycleActive() || !remistatsEnabled || route.href === lastProfileUrl) return;
  lastProfileUrl = route.href;
  resetProfileTrophyBanner();
  processedProfiles.clear();
  incomingPokeCache = null;
  runtimeScheduleScan();
  scheduleSurfaceReconciliation([200, 1200, 3500]);
  if (routeProfileTimer) routeProfileTimer();
  routeProfileTimer = runtimeScheduler.timeout(() => {
    routeProfileTimer = null;
    if (!lifecycleActive()) return;
    void reconcileProfileTrophy();
    void insertProfileBadge();
  }, 350);
  scheduleGroupChatAvatars(350);
}

export function disable() {
  remistatsEnabled = false;
  recordRuntimePhase('activation', 'feature-disabled');
  clearAllPokeCountdowns();
  if (tooltipHideTimer) {
    window.clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
  activeTooltipBadge = null;
  clearRemiStatsBadges();
}

export function dispose() {
  disable();
  removeRemiStatsDelegation?.();
  if (groupChatScanTimer) {
    groupChatScanTimer();
    groupChatScanTimer = null;
  }
  if (routeProfileTimer) {
    routeProfileTimer();
    routeProfileTimer = null;
  }
  if (reconciliationTimer) {
    reconciliationTimer();
    reconciliationTimer = null;
  }
  reconciliationScheduled = false;
  reconciliationDueAt = 0;
  reconciliationRunning = false;
  reconciliationFollowUp = false;
  reconciliationFollowUpDelay = 900;
  runtimeEffects.dispose();
  addRuntimeDisposable = () => undefined;
  runtimeSendMessage = unavailableRuntimeSendMessage;
  recordRemiStatsRuntimePhase = () => undefined;
  lifecycleSignal = null;
  booted = false;
}

function lifecycleActive() {
  return booted && lifecycleSignal?.aborted !== true;
}

function clearRemiStatsBadges() {
  resetProfileTrophyBanner();
  for (const container of document.querySelectorAll('[data-reminet-flow-text]')) container.removeAttribute('data-reminet-flow-text');
  for (const node of document.querySelectorAll('[data-reminet-flow-badge], [data-reminet-profile-badge-group], [data-reminet-profile-action-poke-slot], [data-reminet-action-poke-group], [data-reminet-badge-slot], [data-reminet-badge], [data-reminet-tooltip], [data-reminet-standalone-poke]')) {
    node.remove();
  }
  for (const node of Array.from(reminetProcessingElements)) {
    clearReminetProcessing(node);
  }
}
