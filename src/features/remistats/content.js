import { safeRuntimeMessage } from "../../shared/extensionRuntime";
import { recordFeatureTiming } from "../../shared/performanceDiagnostics";
import { DEFAULT_VISUAL_THEME, normalizeVisualTheme } from "../../shared/reskinProfile";
import { createFallbackRuntimeScheduler } from "../../shared/runtimeScheduler";

// Content script for overlaying user scores on X.com.
const REMINET_CONTENT_VERSION = 'reminet-poke-direct-2026-06-23';
document.documentElement.dataset.milxdyReminetContentVersion = REMINET_CONTENT_VERSION;

// Inject font into page
const fontUrl = chrome.runtime.getURL('remistats/RemiliaMincho-Regular.otf');
const fontStyle = document.createElement('style');
fontStyle.textContent = `
  @font-face {
    font-family: 'Remilia Mincho';
    src: url('${fontUrl}') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
`;
document.head.appendChild(fontStyle);

// Configuration
const CONFIG = {
  apiEndpoint: 'https://api.remistats.net/user', // Real API endpoint
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  observerDebounce: 100,
  batchSize: 50, // Max usernames per batch request
  batchDelay: 100 // Delay before sending batch (ms)
};

const REMILIA_BASE_URL = 'https://www.remilia.net';
const TROPHY_BANNER_WIDTH = 1500;
const TROPHY_BANNER_HEIGHT = 500;
const TROPHY_BANNER_CACHE_LIMIT = 50;
const BANNERS_NFT_SUPPLY = 2000;
const BANNERS_NFT_CONTRACT = '0x1352149Cd78D686043B504e7e7D96C5946b0C39c';
const BANNER_MODES = ['original', 'shelf', 'nft'];
const POKE_COOLDOWN_STORAGE_KEY = 'milxdy.remistats.pokeCooldowns';

// Cache for user scores
const scoreCache = new Map();
const trophyBannerCache = new Map();
const trophyBannerPending = new Map();
let prefetchedBannersNft = null;
let prefetchedBannersNftPending = null;
const reminetProcessingElements = new Set();

// Batch fetching queue
let batchQueue = new Set();
let batchTimeout = null;
const batchPromises = new Map();

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

// Find the first profile-link username inside a container, skipping routes
// like /messages/<id> that appear in DM cells before the avatar link.
function findUsernameInLinks(container) {
  const links = container.querySelectorAll('a[href^="/"]');
  for (const link of links) {
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
    .find((node) => !node.closest('[data-testid="quoteTweet"]'));
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
    .find((link) => !link.closest('[data-testid="quoteTweet"]'));
  const fromStatus = usernameFromStatusHref(statusLink?.getAttribute('href'));
  if (fromStatus) return fromStatus;

  return null;
}

// Extract username from X's avatar testid convention: UserAvatar-Container-<username>
function extractUsernameFromAvatar(container) {
  const avatar = container.querySelector('[data-testid^="UserAvatar-Container-"]');
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
const pokeCountdownTimers = new Map();
const pokeButtonsByUsername = new Map();
let incomingPokeCache = null;
let visualTheme = DEFAULT_VISUAL_THEME;
const DEFAULT_ICON_SETTINGS = {
  enabled: true,
  score: true,
  beetle: true,
  poke: true,
};
let iconSettings = { ...DEFAULT_ICON_SETTINGS };
const POKE_THEME_COLORS = new Set(['red', 'green', 'gold', 'blue', 'purple']);
const POKE_THEME_MODES = new Set(['dark', 'light']);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
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
    const responses = await Promise.all(requested.map(async (handle) => {
      const response = await runtimeSendMessage({ type: 'remistats:getUser', handle }, 'remistats:getUser');
      return [handle, response];
    }));

    for (const [requestedHandle, response] of responses) {
      if (!response?.ok) {
        if (response?.notFound || response?.status === 404) {
          scoreCache.set(requestedHandle, { data: null, timestamp: Date.now() });
          results[requestedHandle] = null;
        }
        continue;
      }

      const data = response.data || {};
      if (data.max_beetles !== undefined) maxBeetles = data.max_beetles;
      if (data.max_score !== undefined) maxScore = data.max_score;

      if (data.user) {
        const user = data.user;
        const userData = transformApiResponse(user, requestedHandle);
        const normalized = cleanUsername(user.twitterHandle || requestedHandle).toLowerCase();
        scoreCache.set(requestedHandle, { data: userData, timestamp: Date.now() });
        results[requestedHandle] = userData;
        if (normalized && normalized !== requestedHandle) {
          scoreCache.set(normalized, { data: userData, timestamp: Date.now() });
          results[normalized] = userData;
        }
      } else {
        scoreCache.set(requestedHandle, { data: null, timestamp: Date.now() });
        results[requestedHandle] = null;
      }
    }
  } catch (error) {
    if (!/extension context/i.test(String(error?.message || error))) {
      console.debug('RemiStats API lookup skipped:', error.message);
    }
  }

  return results;
}

// Transform API response to extension format
function transformApiResponse(apiUser, fallbackHandle = '') {
  const remiliaUsername = cleanUsername(
    apiUser.username
    || apiUser.userHandle
    || apiUser.handle
    || apiUser.remiliaUsername
    || apiUser.profile?.username
    || fallbackHandle
  );
  return {
    username: remiliaUsername,
    remiliaUsername,
    twitterHandle: apiUser.twitterHandle,
    displayName: apiUser.displayName,
    score: apiUser.socialCreditScore,
    beetleCount: apiUser.beetles,
    followers: apiUser.friendCount,
    pfpProject: apiUser.pfpProject,
    pfpId: apiUser.pfpId,
  };
}

function cleanUsername(value) {
  return typeof value === 'string' ? value.replace(/^@/, '').trim() : '';
}

// Fetch user score with batching
async function fetchUserScore(username) {
  const normalizedUsername = username.toLowerCase();
  
  // Check cache first
  const cached = scoreCache.get(normalizedUsername);
  if (cached && Date.now() - cached.timestamp < CONFIG.cacheTimeout) {
    return cached.data;
  }
  
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
    batchTimeout = setTimeout(async () => {
      const usernamesToFetch = Array.from(batchQueue).slice(0, CONFIG.batchSize);
      batchQueue.clear();
      
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
    }, CONFIG.batchDelay);
  });
}

function createPokeButton(username, standalone = false, xHandle = '') {
  const clean = cleanUsername(username);
  if (!clean) return null;

  const button = document.createElement('button');
  button.className = standalone
    ? 'reminet-poke-button reminet-poke-button--standalone'
    : 'reminet-poke-button';
  button.type = 'button';
  button.dataset.reminetPoke = 'true';
  button.dataset.reminetIcon = 'poke';
  button.dataset.reminetUsername = clean;
  const cleanXHandle = cleanUsername(xHandle);
  if (cleanXHandle) button.dataset.reminetXHandle = cleanXHandle;
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
  return button;
}

function registerPokeButton(button, username) {
  const clean = cleanUsername(username);
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
  const clean = cleanUsername(username);
  if (!clean) return [];
  const key = clean.toLowerCase();
  const buttons = pokeButtonsByUsername.get(key);
  if (!buttons) return [];
  const connected = [];
  for (const button of Array.from(buttons)) {
    if (!button.isConnected || cleanUsername(button.dataset.reminetUsername).toLowerCase() !== key) {
      buttons.delete(button);
      continue;
    }
    connected.push(button);
  }
  if (buttons.size === 0) pokeButtonsByUsername.delete(key);
  return connected;
}

function applyKnownPokeCooldown(button, username) {
  const clean = cleanUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  const cooldownUntil = pokeCooldowns.get(key) || 0;
  if (cooldownUntil > Date.now()) {
    startPokeCooldown(button, clean, cooldownUntil - Date.now());
  }
}

async function loadStoredPokeCooldowns() {
  const stored = await chrome.storage.local.get({ [POKE_COOLDOWN_STORAGE_KEY]: {} });
  const records = stored[POKE_COOLDOWN_STORAGE_KEY];
  if (!records || typeof records !== 'object') return;

  const now = Date.now();
  const next = {};
  let changed = false;
  for (const [rawUsername, rawUntil] of Object.entries(records)) {
    const clean = cleanUsername(rawUsername);
    const until = Number(rawUntil);
    if (!clean || !Number.isFinite(until) || until <= now) {
      changed = true;
      continue;
    }
    const key = clean.toLowerCase();
    pokeCooldowns.set(key, until);
    next[key] = until;
    if (key !== rawUsername || until !== rawUntil) changed = true;
  }
  if (changed) {
    await chrome.storage.local.set({ [POKE_COOLDOWN_STORAGE_KEY]: next });
  }
}

async function persistPokeCooldown(username, until) {
  const key = cleanUsername(username).toLowerCase();
  if (!key || !Number.isFinite(until)) return;
  const stored = await chrome.storage.local.get({ [POKE_COOLDOWN_STORAGE_KEY]: {} });
  const records = stored[POKE_COOLDOWN_STORAGE_KEY] && typeof stored[POKE_COOLDOWN_STORAGE_KEY] === 'object'
    ? stored[POKE_COOLDOWN_STORAGE_KEY]
    : {};
  await chrome.storage.local.set({
    [POKE_COOLDOWN_STORAGE_KEY]: {
      ...records,
      [key]: until,
    },
  });
}

async function removeStoredPokeCooldown(username) {
  const key = cleanUsername(username).toLowerCase();
  if (!key) return;
  const stored = await chrome.storage.local.get({ [POKE_COOLDOWN_STORAGE_KEY]: {} });
  const records = stored[POKE_COOLDOWN_STORAGE_KEY];
  if (!records || typeof records !== 'object' || !(key in records)) return;
  const next = { ...records };
  delete next[key];
  await chrome.storage.local.set({ [POKE_COOLDOWN_STORAGE_KEY]: next });
}

function ensureStandalonePokeButton(badge, username) {
  const clean = cleanUsername(username || badge.dataset.reminetUsername || profileUsernameFromUrl());
  if (!clean || !badge.parentElement || badge.dataset.reminetCompact === 'true') return;

  badge.dataset.reminetUsername = clean;
  const next = badge.nextElementSibling;
  if (next?.matches?.('[data-reminet-standalone-poke]')) {
    next.dataset.reminetUsername = clean;
    next.title = 'Poke';
    next.setAttribute('aria-label', next.title);
    return;
  }

  const button = createPokeButton(clean, true);
  if (button) {
    badge.parentElement.insertBefore(button, badge.nextSibling);
  }
}

function createProfileBadgeGroup(badge, username) {
  const clean = cleanUsername(username);
  const group = document.createElement('span');
  group.className = 'reminet-profile-badge-group';
  group.dataset.reminetProfileBadgeGroup = 'true';
  if (clean) group.dataset.reminetUsername = clean;
  group.appendChild(badge);

  const pokeButton = createPokeButton(clean, true);
  if (pokeButton) {
    group.appendChild(pokeButton);
  }

  void updateIncomingPokeFlag(group, clean);
  return group;
}

function createProfilePokeSlot(username = '') {
  const slot = document.createElement('span');
  slot.className = 'reminet-profile-poke-slot';
  slot.dataset.reminetProfilePokeSlot = 'true';
  const clean = cleanUsername(username);
  if (clean) slot.dataset.reminetUsername = clean;
  return slot;
}

function fillProfilePokeSlot(slot, username) {
  if (!slot) return;
  const clean = cleanUsername(username);
  const button = createPokeButton(clean, true);
  slot.replaceChildren();
  if (button) {
    slot.appendChild(button);
  }
  if (clean) slot.dataset.reminetUsername = clean;
}

function createProfileActionPokeSlot(username = '') {
  const slot = document.createElement('span');
  slot.className = 'reminet-profile-action-poke-slot';
  slot.dataset.reminetProfileActionPokeSlot = 'true';
  const clean = cleanUsername(username);
  if (clean) slot.dataset.reminetUsername = clean;
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
  const clean = cleanUsername(username);
  const existing = document.querySelector('[data-reminet-profile-action-poke-slot="true"]');
  const slot = existing || createProfileActionPokeSlot(clean);
  if (clean) slot.dataset.reminetUsername = clean;
  fillProfilePokeSlot(slot, clean);
  attachProfileActionPokeSlot(userNameSection, slot);
  return slot;
}

function normalizeProfilePokeGroup(badge, username) {
  const group = badge?.closest?.('[data-reminet-profile-badge-group]');
  if (!group) return false;
  const clean = cleanUsername(username || badge.dataset.reminetUsername || profileUsernameFromUrl());

  for (const child of Array.from(badge.parentElement?.children || [])) {
    if (child.matches?.('[data-reminet-standalone-poke]')) child.remove();
  }

  group.querySelector('[data-reminet-profile-poke-slot]')?.remove();
  ensureProfileActionPokeSlot(document.querySelector('[data-testid="UserName"]'), clean);
  if (clean) group.dataset.reminetUsername = clean;
  void updateIncomingPokeFlag(group, clean);
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
  const clean = cleanUsername(username);
  if (!clean) return null;
  const group = document.createElement('div');
  group.className = 'reminet-action-poke-group';
  group.dataset.reminetActionPokeGroup = 'true';
  group.dataset.reminetUsername = clean;
  const pokeButton = createPokeButton(clean, true, xHandle);
  if (pokeButton) group.appendChild(pokeButton);
  void updateIncomingPokeFlag(group, clean);
  return group;
}

function createActionPokeSlot(username = '') {
  const clean = cleanUsername(username);
  const group = document.createElement('div');
  group.className = 'reminet-action-poke-group';
  group.dataset.reminetActionPokeGroup = 'true';
  group.dataset.reminetPokeState = 'loading';
  if (clean) group.dataset.reminetUsername = clean;
  return group;
}

function fillActionPokeSlot(group, username, xHandle = '') {
  if (!group) return;
  const clean = cleanUsername(username);
  group.replaceChildren();
  group.dataset.reminetPokeState = clean ? 'ready' : 'empty';
  if (!clean) {
    group.setAttribute('aria-hidden', 'true');
    return;
  }
  if (group.dataset.milxdyTweetSlot === 'remistats-action-poke') delete group.dataset.milxdyTweetSlot;
  group.removeAttribute('aria-hidden');
  group.dataset.reminetUsername = clean;
  const pokeButton = createPokeButton(clean, true, xHandle);
  if (pokeButton) group.appendChild(pokeButton);
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
  if (!cached || Date.now() - cached.timestamp >= CONFIG.cacheTimeout) return undefined;
  return cached.data;
}

function fillProfileBadgeFromScore(slot, group, scoreData, username) {
  if (!slot || !group || !scoreData) return null;
  const badge = createScoreBadge(scoreData, { includePokeInside: false });
  badge.style.marginLeft = '0';
  badge.style.display = 'inline-flex';
  badge.style.verticalAlign = 'middle';
  badge.setAttribute('data-profile-badge', username);
  const remiliaUsername = scoreData.remiliaUsername || scoreData.username || username;
  group.dataset.reminetUsername = remiliaUsername;
  fillBadgeSlot(slot, badge, remiliaUsername);
  void updateIncomingPokeFlag(group, remiliaUsername);
  return { badge, remiliaUsername };
}

function positionBadgeSlotNearTweetTime(element, slot) {
  if (!element || !slot || slot.dataset.reminetProfileSlot === 'true') return false;
  const timeElement = Array.from(element.querySelectorAll('time')).find((time) => !time.closest('[data-testid="quoteTweet"]'));
  if (!timeElement?.parentElement) return false;
  if (slot.parentElement !== timeElement.parentElement || slot.previousSibling !== timeElement) {
    timeElement.parentElement.insertBefore(slot, timeElement.nextSibling);
  }
  return true;
}

function markBadgeSlotEmpty(slot) {
  if (!slot) return;
  slot.replaceChildren();
  slot.dataset.reminetState = 'empty';
  slot.setAttribute('aria-hidden', 'true');
}

// Create score badge element
function createScoreBadge(scoreData, options = {}) {
  const badge = document.createElement('div');
  badge.className = 'reminet-score-badge';
  badge.setAttribute('data-reminet-badge', 'true');
  const remiliaUsername = scoreData.remiliaUsername || scoreData.username || scoreData.twitterHandle || '';
  if (remiliaUsername) {
    badge.dataset.reminetUsername = remiliaUsername;
  }
  
  const beetleCount = scoreData.beetleCount || Math.floor(scoreData.score / 10);
  
  // Get extension URLs for images
  const beetleUrl = chrome.runtime.getURL('remistats/beetle.png');
  const starUrl = chrome.runtime.getURL('remistats/star.svg');
  
  badge.innerHTML = `
    <div class="reminet-badge-content">
      <div class="reminet-badge-group" data-reminet-icon="score">
        <img src="${starUrl}" class="reminet-star" alt="" />
        <span class="reminet-label">${scoreData.score}</span>
      </div>
      <div class="reminet-badge-group" data-reminet-icon="beetle">
        <img src="${beetleUrl}" class="reminet-beetle" alt="" />
        <span class="reminet-label">${beetleCount}</span>
      </div>
    </div>
  `;

  if (options.includePokeInside !== false && visualTheme.pokePlacement !== 'actions') {
    const inlinePoke = createPokeButton(remiliaUsername);
    const content = badge.querySelector('.reminet-badge-content');
    if (inlinePoke && content) content.appendChild(inlinePoke);
    if (content) void updateIncomingPokeFlag(content, remiliaUsername);
  }
  
  // Calculate progress percentages
  const scorePercent = Math.min(100, (scoreData.score / maxScore) * 100);
  const beetlePercent = Math.min(100, (beetleCount / maxBeetles) * 100);
  
  // Build PFP image URL if we have project and ID
  const pfpProject = scoreData.pfpProject ? String(scoreData.pfpProject) : '';
  const pfpId = scoreData.pfpId ? String(scoreData.pfpId) : '';
  const pfpImageUrl = (pfpProject && pfpId)
    ? `https://pfp.remilia.net/pfp/${encodeURIComponent(pfpProject.toLowerCase())}/${encodeURIComponent(pfpId)}`
    : '';
  
  const pfpInfo = pfpProject ? `${pfpProject} #${pfpId}` : '';
  const displayName = escapeHtml(scoreData.displayName || remiliaUsername);
  const twitterHandle = escapeHtml(scoreData.twitterHandle || remiliaUsername);
  const tooltipPfpInfo = escapeHtml(pfpInfo);
  
  badge.dataset.reminetProfileUrl = remiliaUsername ? `https://remilia.net/~${remiliaUsername}` : '';
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
        <span class="metric-value">${scoreData.score} / ${maxScore}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Beetles</span>
        <div class="metric-bar">
          <div class="metric-fill" style="width: ${beetlePercent}%;"></div>
        </div>
        <span class="metric-value">${beetleCount} / ${maxBeetles}</span>
      </div>
    </div>
    <div class="reminet-tooltip-footer">
      <span>${scoreData.followers?.toLocaleString() || 0} friends</span>
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

  const clickHandler = (event) => {
    const pokeButton = event.target.closest?.('[data-reminet-poke]');
    if (pokeButton) {
      event.stopPropagation();
      event.preventDefault();
      void handlePokeClick(pokeButton);
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
  window.addEventListener('scroll', scrollHandler, { passive: true, capture: true });

  removeRemiStatsDelegation = () => {
    document.removeEventListener('mouseover', mouseoverHandler, true);
    document.removeEventListener('mouseout', mouseoutHandler, true);
    document.removeEventListener('click', clickHandler, true);
    window.removeEventListener('scroll', scrollHandler, { capture: true });
    reminetDelegationInstalled = false;
    removeRemiStatsDelegation = null;
  };
  addRuntimeDisposable(removeRemiStatsDelegation);
}

async function handlePokeClick(button) {
  const badge = button.closest('[data-reminet-badge]');
  const username = cleanUsername(button.dataset.reminetUsername || badge?.dataset.reminetUsername || profileUsernameFromUrl());
  if (!username || button.disabled) return;

  const cooldownUntil = pokeCooldowns.get(username.toLowerCase()) || 0;
  if (cooldownUntil > Date.now()) {
    startPokeCooldown(button, username, cooldownUntil - Date.now());
    return;
  }

  window.reminetSounds?.playPoke?.();
  button.dataset.reminetPokeShaking = 'true';
  setPokeButtonState(button, 'loading', `Poking ${username}...`);
  const response = await runtimeSendMessage({ type: 'beetol:poke', username }, 'beetol:poke');
  delete button.dataset.reminetPokeShaking;

  if (response?.ok) {
    notifyMiladymaxxerPokeCredit(button, username);
    const cooldownMs = extractPokeCooldownMs(response) || 24 * 60 * 60 * 1000;
    startPokeCooldown(button, username, cooldownMs);
    return;
  }

  const cooldownMs = extractPokeCooldownMs(response);
  if (cooldownMs > 0) {
    startPokeCooldown(button, username, cooldownMs);
    return;
  }

  if (response?.authRequired) {
    setPokeButtonState(button, 'error', 'Sign in to remilia.net to poke');
    return;
  }

  const details = [
    response?.authMethod,
    response?.status ? `HTTP ${response.status}` : '',
  ].filter(Boolean).join(' ');
  const message = response?.data?.error || response?.data?.message || response?.error || `Could not poke ${username}`;
  console.warn('RemiNet poke failed', { username, response });
  setPokeButtonState(button, 'error', details ? `${message} (${details})` : message);
}

function setPokeButtonState(button, state, label) {
  button.dataset.reminetPokeState = state;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.disabled = state === 'loading' || state === 'cooldown';
  if (state === 'loading') {
    button.textContent = String.fromCodePoint(0x1FAF5);
  } else if (state !== 'cooldown') {
    restorePokeButtonIcon(button);
  }
}

function notifyMiladymaxxerPokeCredit(button, remiliaUsername) {
  const xHandle = cleanUsername(button.dataset.reminetXHandle || findPokeXHandle(button));
  if (!xHandle) return;
  window.dispatchEvent(new CustomEvent('milxdy:remistats-poke-credit', {
    detail: {
      handle: xHandle,
      remiliaUsername: cleanUsername(remiliaUsername),
      source: 'reminet-poke',
    },
  }));
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

function extractPokeCooldownMs(response) {
  const data = response?.data || {};
  const nested = data?.data || {};
  const values = [
    response?.cooldownMs,
    data?.cooldownMs,
    data?.cooldown,
    data?.cooldownRemaining,
    data?.cooldownRemainingMs,
    data?.remainingMs,
    data?.remaining,
    data?.retryAfterMs,
    data?.retryAfter,
    data?.nextPokeInMs,
    data?.nextPokeIn,
    data?.pokeCooldownMs,
    data?.pokeCooldown,
    data?.pokeCooldownSeconds,
    nested?.cooldownMs,
    nested?.cooldown,
    nested?.cooldownRemaining,
    nested?.cooldownRemainingMs,
    nested?.remainingMs,
    nested?.remaining,
    nested?.retryAfterMs,
    nested?.retryAfter,
    nested?.nextPokeInMs,
    nested?.nextPokeIn,
    nested?.pokeCooldownMs,
    nested?.pokeCooldown,
    nested?.pokeCooldownSeconds,
  ];

  for (const value of values) {
    const ms = normalizeCooldownMs(value);
    if (ms > 0) return ms;
  }

  const untilValues = [
    response?.cooldownUntil,
    data?.cooldownUntil,
    data?.nextPokeAt,
    data?.pokeAvailableAt,
    data?.availableAt,
    nested?.cooldownUntil,
    nested?.nextPokeAt,
    nested?.pokeAvailableAt,
    nested?.availableAt,
  ];
  for (const value of untilValues) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp > Date.now()) {
      return timestamp - Date.now();
    }
  }

  return 0;
}

function normalizeCooldownMs(value) {
  if (value == null || value === false) return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 1000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return normalizeCooldownMs(numeric);
    const match = trimmed.match(/(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
    if (match && match[0].trim()) {
      const days = Number(match[1] || 0);
      const hours = Number(match[2] || 0);
      const minutes = Number(match[3] || 0);
      const seconds = Number(match[4] || 0);
      return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    }
  }
  return 0;
}

function startPokeCooldown(button, username, cooldownMs) {
  if (!lifecycleActive()) return;
  const normalizedMs = Math.max(1000, Number(cooldownMs) || 0);
  const until = Date.now() + normalizedMs;
  const key = username.toLowerCase();
  pokeCooldowns.set(key, until);
  void persistPokeCooldown(username, until);

  clearPokeCountdown(button);
  setPokeButtonState(button, 'cooldown', `Already poked ${username}`);

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
      void removeStoredPokeCooldown(username);
      setPokeButtonState(button, 'idle', 'Poke');
      return;
    }
    const label = formatPokeCooldown(remaining);
    button.textContent = label;
    button.title = `Poke ${username} again in ${label}`;
    button.setAttribute('aria-label', button.title);
    cancelNextTick = runtimeScheduler.timeout(update, 1000);
    pokeCountdownTimers.set(button, cancelNextTick);
  };

  update();
  if (cancelNextTick) pokeCountdownTimers.set(button, cancelNextTick);
}

function startPokeCooldownForUsername(username, cooldownMs) {
  const clean = cleanUsername(username);
  if (!clean) return;
  const until = Date.now() + Math.max(1000, Number(cooldownMs) || 0);
  pokeCooldowns.set(clean.toLowerCase(), until);
  void persistPokeCooldown(clean, until);
  for (const button of pokeButtonsForUsername(clean)) {
    startPokeCooldown(button, clean, until - Date.now());
  }
}

function clearPokeCooldownForUsername(username) {
  const clean = cleanUsername(username);
  if (!clean) return;
  pokeCooldowns.delete(clean.toLowerCase());
  void removeStoredPokeCooldown(clean);
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

function formatPokeCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

async function updateIncomingPokeFlag(group, username) {
  const clean = cleanUsername(username || group?.dataset?.reminetUsername);
  if (!group || !clean) return;
  group.dataset.reminetUsername = clean;

  const currentFlag = group.querySelector('[data-reminet-incoming-poke]');
  if (currentFlag && cleanUsername(currentFlag.dataset.reminetUsername).toLowerCase() !== clean.toLowerCase()) {
    currentFlag.remove();
  }

  const pokers = await getIncomingPokeHandles();
  if (!document.body.contains(group) || cleanUsername(group.dataset.reminetUsername).toLowerCase() !== clean.toLowerCase()) {
    return;
  }

  const hasPokedYou = pokers.has(clean.toLowerCase());
  const existingFlag = group.querySelector('[data-reminet-incoming-poke]');
  if (!hasPokedYou) {
    existingFlag?.remove();
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
  group.appendChild(flag);
}

async function getIncomingPokeHandles() {
  if (incomingPokeCache && Date.now() - incomingPokeCache.fetchedAt < 60 * 1000) {
    return incomingPokeCache.handles;
  }

  const response = await runtimeSendMessage({ type: 'beetol:incomingPokes' }, 'beetol:incomingPokes');
  const handles = new Set(
    Array.isArray(response?.pokers)
      ? response.pokers.map(handle => cleanUsername(handle).toLowerCase()).filter(Boolean)
      : []
  );
  incomingPokeCache = { fetchedAt: Date.now(), handles };
  return handles;
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
    const button = createPokeButton(username);
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
//   1. <time> element (tweets and user cells)
//   2. [data-testid="User-Name"] (tweets)
//   3. Any [dir="ltr"][class*="css"] block as a last resort
function insertBadgeIntoElement(element, badgeOrSlot) {
  const timeElement = Array.from(element.querySelectorAll('time')).find((time) => !time.closest('[data-testid="quoteTweet"]'));
  if (timeElement && timeElement.parentElement) {
    timeElement.parentElement.insertBefore(badgeOrSlot, timeElement.nextSibling);
    return true;
  }

  const userNameContainer = Array.from(element.querySelectorAll('[data-testid="User-Name"]')).find((node) => !node.closest('[data-testid="quoteTweet"]'));
  if (userNameContainer) {
    const insertPoint = userNameContainer.querySelector('[dir="ltr"]') || userNameContainer;
    if (insertPoint.parentElement) {
      insertPoint.parentElement.insertBefore(badgeOrSlot, insertPoint.nextSibling);
      return true;
    }
  }

  const fallback = element.querySelector('[dir="ltr"][class*="css"]');
  if (fallback && fallback.parentElement) {
    const insertPoint = fallback.querySelector('[dir="ltr"]') || fallback;
    insertPoint.parentElement.insertBefore(badgeOrSlot, insertPoint.nextSibling);
    return true;
  }

  return false;
}

// Insert badge into the DOM for tweets and user cells
async function insertBadge(element, usernameOverride = null) {
  if (element.closest('[data-testid="quoteTweet"]')) {
    return markSurfaceResult(element, 'quote-skip');
  }
  // Check if badge already exists
  const hasOwnBadge = Array.from(element.querySelectorAll('[data-reminet-badge]'))
    .some((badge) => !badge.closest('[data-testid="quoteTweet"]'));
  if (hasOwnBadge) {
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
    .find((slot) => !slot.closest('[data-testid="quoteTweet"]'));
  const badgeSlot = existingSlot
    ? prepareBadgeSlot(existingSlot, username, { actionPoke: visualTheme.pokePlacement !== 'actions' })
    : createBadgeSlot(username, { actionPoke: visualTheme.pokePlacement !== 'actions' });
  positionBadgeSlotNearTweetTime(element, badgeSlot);
  if (!existingSlot && !insertBadgeIntoElement(element, badgeSlot)) {
    clearReminetProcessing(element);
    return markSurfaceResult(element, 'slot-missing', username);
  }
  const actionPokeSlot = visualTheme.pokePlacement === 'actions'
    ? reserveActionPoke(element, username)
    : null;
  
  try {
    const scoreData = await fetchUserScore(username);

    if (!scoreData) {
      markBadgeSlotEmpty(badgeSlot);
      fillActionPokeSlot(actionPokeSlot, '');
      clearReminetProcessing(element);
      return markSurfaceResult(element, 'fetch-empty', username);
    }

    const badge = createScoreBadge(scoreData);
    
    // Remove processing flag since we're about to insert the badge
    clearReminetProcessing(element);
    
    fillBadgeSlot(badgeSlot, badge, scoreData.remiliaUsername || username);
    if (visualTheme.pokePlacement === 'actions') {
      insertActionPoke(element, scoreData.remiliaUsername || username, username);
    }
    return markSurfaceResult(element, 'rendered', scoreData.remiliaUsername || username);
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
  const clean = cleanUsername(username);
  const existing = element.querySelector('[data-reminet-action-poke-group]');
  if (existing) {
    fillActionPokeSlot(existing, clean, xHandle || extractUsername(element));
    return;
  }
  if (!clean) return;
  const actions = element.querySelector('[role="group"]');
  if (!actions) return;
  const cluster = createPokeCluster(clean, xHandle || extractUsername(element));
  if (!cluster) return;
  insertActionPokeGroup(actions, cluster);
}

function reserveActionPoke(element, username, xHandle = '') {
  if (element.querySelector('[data-reminet-action-poke-group]')) return null;
  const actions = element.querySelector('[role="group"]');
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

function idle() {
  return new Promise((resolve) => runtimeScheduler.idle(resolve, { timeout: 1500 }));
}

function remiliaUrl(path) {
  return new URL(path, REMILIA_BASE_URL).href;
}

async function fetchTrophyProfile(remiliaUsername) {
  const clean = cleanUsername(remiliaUsername);
  if (!clean) return null;

  const response = await fetch(`${REMILIA_BASE_URL}/api/profile/~${encodeURIComponent(clean)}`, {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  return data?.user || null;
}

function firstShelfRow(user) {
  const shelves = Array.isArray(user?.trophyShelves) ? user.trophyShelves.slice(0, 5) : [];
  const trophies = Array.isArray(user?.allTrophies) ? user.allTrophies : [];
  const byId = new Map(trophies.map((trophy) => [String(trophy.id), trophy]));
  return shelves
    .filter(Boolean)
    .map((id) => byId.get(String(id)))
    .filter((trophy) => trophy?.icon);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function preloadDisplayImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  ctx.drawImage(
    image,
    x + (width - scaledWidth) / 2,
    y + (height - scaledHeight) / 2,
    scaledWidth,
    scaledHeight
  );
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.9);
  });
}

function rememberTrophyBanner(username, url) {
  const key = username.toLowerCase();
  trophyBannerCache.set(key, { url, touchedAt: Date.now() });
  if (trophyBannerCache.size <= TROPHY_BANNER_CACHE_LIMIT) return;

  const [oldestKey, oldest] = Array.from(trophyBannerCache.entries())
    .sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0] || [];
  if (!oldestKey) return;
  if (oldest?.url) URL.revokeObjectURL(oldest.url);
  trophyBannerCache.delete(oldestKey);
}

async function renderTrophyBanner(remiliaUsername) {
  const clean = cleanUsername(remiliaUsername);
  if (!clean) return null;

  const key = clean.toLowerCase();
  const cached = trophyBannerCache.get(key);
  if (cached?.url) {
    cached.touchedAt = Date.now();
    return cached.url;
  }

  if (trophyBannerPending.has(key)) return trophyBannerPending.get(key);

  const pending = (async () => {
    const user = await fetchTrophyProfile(clean);
    const row = firstShelfRow(user);
    if (!row.length) return null;

    const texture = await loadImage(`${REMILIA_BASE_URL}/api/beetle/trophy/~${encodeURIComponent(clean)}/shelf`);
    const icons = await Promise.all(row.map((trophy) => loadImage(remiliaUrl(trophy.icon))));

    const canvas = document.createElement('canvas');
    canvas.width = TROPHY_BANNER_WIDTH;
    canvas.height = TROPHY_BANNER_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawImageCover(ctx, texture, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shelfY = Math.round(canvas.height * 0.72);
    const ledgeHeight = Math.round(canvas.height * 0.07);
    ctx.fillStyle = 'rgba(38, 20, 8, 0.5)';
    ctx.fillRect(0, shelfY, canvas.width, ledgeHeight);
    ctx.fillStyle = 'rgba(255, 236, 188, 0.22)';
    ctx.fillRect(0, shelfY, canvas.width, 4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, shelfY + ledgeHeight - 5, canvas.width, 5);

    const slotWidth = canvas.width / 5;
    const iconSize = Math.round(canvas.height * 0.62);
    const iconY = shelfY - iconSize + Math.round(canvas.height * 0.05);

    for (let i = 0; i < icons.length; i += 1) {
      const x = Math.round(i * slotWidth + (slotWidth - iconSize) / 2);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 13;
      ctx.drawImage(icons[i], x, iconY, iconSize, iconSize);
      ctx.restore();
    }

    const blob = await canvasToBlob(canvas);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    rememberTrophyBanner(clean, url);
    return url;
  })().finally(() => {
    trophyBannerPending.delete(key);
  });

  trophyBannerPending.set(key, pending);
  return pending;
}

function findProfileBannerRoot() {
  const image = document.querySelector('main img[src*="/profile_banners/"], main img[src*="profile_banners"]');
  if (!image) return null;

  let root = image.parentElement;
  for (let i = 0; i < 3 && root?.parentElement; i += 1) {
    const rect = root.getBoundingClientRect();
    const parentRect = root.parentElement.getBoundingClientRect();
    if (parentRect.width >= rect.width && parentRect.height >= rect.height) {
      root = root.parentElement;
    }
  }
  return root || image.parentElement;
}

function clearTrophyBannerOverlay(root) {
  clearBannerOverlay(root);
}

function randomBannersNft() {
  const tokenId = Math.floor(Math.random() * BANNERS_NFT_SUPPLY) + 1;
  return {
    tokenId,
    imageUrl: `https://miladymaker.net/banners/nft/${tokenId}.png`,
    tokenUrl: `https://etherscan.io/nft/${BANNERS_NFT_CONTRACT}/${tokenId}`,
  };
}

async function fetchBannerImageDataUrl(imageUrl) {
  const response = await runtimeSendMessage({ type: 'milxdy:fetchImageDataUrl', url: imageUrl }, 'milxdy:fetchImageDataUrl');
  return response?.ok && typeof response.dataUrl === 'string' ? response.dataUrl : imageUrl;
}

async function fetchBannersNftDisplay(nft) {
  const displayUrl = await fetchBannerImageDataUrl(nft.imageUrl);
  await preloadDisplayImage(displayUrl);
  return { ...nft, displayUrl };
}

function prefetchRandomBannersNft() {
  if (prefetchedBannersNft || prefetchedBannersNftPending) return;
  prefetchedBannersNftPending = fetchBannersNftDisplay(randomBannersNft())
    .then((nft) => {
      prefetchedBannersNft = nft;
      return nft;
    })
    .catch((error) => {
      console.debug('RemiStats Banners NFT prefetch skipped:', error);
      return null;
    })
    .finally(() => {
      prefetchedBannersNftPending = null;
    });
}

async function takePrefetchedBannersNft() {
  const ready = prefetchedBannersNft;
  if (ready) {
    prefetchedBannersNft = null;
    prefetchRandomBannersNft();
    return ready;
  }

  if (prefetchedBannersNftPending) {
    const pending = await prefetchedBannersNftPending;
    if (pending) {
      prefetchedBannersNft = null;
      prefetchRandomBannersNft();
      return pending;
    }
  }

  const nft = await fetchBannersNftDisplay(randomBannersNft());
  prefetchRandomBannersNft();
  return nft;
}

function getBannerStage(root) {
  let stage = root.querySelector(':scope > .milxdy-banner-stage');
  if (stage) return stage;

  stage = document.createElement('div');
  stage.className = 'milxdy-banner-stage';
  root.appendChild(stage);
  return stage;
}

function clearBannerNftLabel(root) {
  const label = root.querySelector(':scope > .milxdy-banner-nft-label');
  if (label) label.remove();
}

function setBannerNftLabel(root, nft) {
  clearBannerNftLabel(root);
  if (!nft?.tokenId || !nft?.tokenUrl) return;

  const link = document.createElement('a');
  link.className = 'milxdy-banner-nft-label';
  link.href = nft.tokenUrl;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = `Banners NFT #${nft.tokenId}`;
  link.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  root.appendChild(link);
}

function makeBannerPanel(type, url, role) {
  const panel = document.createElement('div');
  panel.className = `milxdy-banner-panel milxdy-banner-panel--${role}`;
  panel.dataset.milxdyBannerOverlay = type;
  panel.style.backgroundImage = `url("${url}")`;
  return panel;
}

function originalBannerUrl(root) {
  const image = root?.querySelector?.('img[src*="/profile_banners/"], img[src*="profile_banners"]')
    || document.querySelector('main img[src*="/profile_banners/"], main img[src*="profile_banners"]');
  return typeof image?.currentSrc === 'string' && image.currentSrc
    ? image.currentSrc
    : typeof image?.src === 'string'
      ? image.src
      : '';
}

function transitionBannerOverlay(root, type, url) {
  const stage = getBannerStage(root);
  let current = stage.querySelector(':scope > .milxdy-banner-panel--current');
  if (!current) {
    const originalUrl = originalBannerUrl(root);
    if (originalUrl) {
      current = makeBannerPanel('original', originalUrl, 'current');
      stage.appendChild(current);
    }
  }
  const next = makeBannerPanel(type, url, 'next');
  stage.appendChild(next);

  if (!current) {
    delete root.dataset.milxdyBannerLoading;
    next.classList.remove('milxdy-banner-panel--next');
    next.classList.add('milxdy-banner-panel--current');
    return Promise.resolve();
  }

  delete root.dataset.milxdyBannerLoading;
  stage.dataset.spinning = 'true';
  current.classList.add('milxdy-banner-panel--exit');

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      current.remove();
      next.classList.remove('milxdy-banner-panel--next');
      next.classList.remove('milxdy-banner-panel--enter');
      next.classList.add('milxdy-banner-panel--current');
      delete stage.dataset.spinning;
      resolve();
    };
    next.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 900);
    requestAnimationFrame(() => {
      next.classList.add('milxdy-banner-panel--enter');
    });
  });
}

function clearBannerOverlay(root) {
  const stage = root.querySelector(':scope > .milxdy-banner-stage');
  if (stage) stage.remove();
  clearBannerNftLabel(root);
}

function transitionBannerToOriginal(root) {
  const stage = root.querySelector(':scope > .milxdy-banner-stage');
  const current = stage?.querySelector(':scope > .milxdy-banner-panel--current');
  clearBannerNftLabel(root);
  if (!stage || !current) return Promise.resolve();

  delete root.dataset.milxdyBannerLoading;
  stage.dataset.spinning = 'true';
  current.classList.add('milxdy-banner-panel--exit');

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      stage.remove();
      resolve();
    };
    current.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 900);
    requestAnimationFrame(() => {
      current.style.transform = 'translateY(-100%)';
    });
  });
}

async function applyBannerMode(root, mode, remiliaUsername) {
  root.dataset.milxdyBannerMode = mode;

  if (mode === 'original') {
    await transitionBannerToOriginal(root);
    return true;
  }

  if (mode === 'shelf') {
    const bannerUrl = await renderTrophyBanner(remiliaUsername);
    if (!bannerUrl) return false;
    await transitionBannerOverlay(root, 'shelf', bannerUrl);
    clearBannerNftLabel(root);
    root.dataset.milxdyTrophyBannerState = 'ready';
    return true;
  }

  if (mode === 'nft') {
    const nft = await takePrefetchedBannersNft();
    await transitionBannerOverlay(root, 'nft', nft.displayUrl);
    setBannerNftLabel(root, nft);
    return true;
  }

  return false;
}

async function cycleProfileBanner(root) {
  const remiliaUsername = cleanUsername(root.dataset.milxdyTrophyBannerUser);
  if (!remiliaUsername || root.dataset.milxdyBannerCycling === 'true') return;

  root.dataset.milxdyBannerCycling = 'true';
  root.dataset.milxdyBannerLoading = 'true';
  window.reminetSounds?.playSpin?.();

  const current = root.dataset.milxdyBannerMode || 'shelf';
  const startIndex = Math.max(0, BANNER_MODES.indexOf(current));

  try {
    for (let offset = 1; offset <= BANNER_MODES.length; offset += 1) {
      const mode = BANNER_MODES[(startIndex + offset) % BANNER_MODES.length];
      if (await applyBannerMode(root, mode, remiliaUsername)) {
        const button = root.querySelector(':scope > .milxdy-banner-cycle-button');
        if (button) button.title = `Banner mode: ${mode}. Click to cycle.`;
        return;
      }
    }
  } catch (error) {
    console.debug('RemiStats banner cycle skipped:', error);
  } finally {
    delete root.dataset.milxdyBannerLoading;
    delete root.dataset.milxdyBannerCycling;
  }
}

function ensureBannerCycleButton(root) {
  prefetchRandomBannersNft();
  if (root.querySelector(':scope > .milxdy-banner-cycle-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'milxdy-banner-cycle-button';
  button.title = 'Cycle banner: original, trophy shelf, random Banners NFT';
  button.setAttribute('aria-label', button.title);
  button.innerHTML = `
    <img class="milxdy-banner-lever milxdy-banner-lever--idle" src="${chrome.runtime.getURL('remistats/banner-lever-idle.png')}" alt="" />
    <img class="milxdy-banner-lever milxdy-banner-lever--pulled" src="${chrome.runtime.getURL('remistats/banner-lever-pulled.png')}" alt="" />
  `;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void cycleProfileBanner(root);
  });
  root.appendChild(button);
}

async function upgradeProfileTrophyBanner(remiliaUsername, profilePath) {
  const clean = cleanUsername(remiliaUsername);
  if (!clean) return;

  await idle();

  if (profilePath !== window.location.pathname) return;
  const root = findProfileBannerRoot();
  if (!root) return;

  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  root.style.overflow = 'hidden';
  ensureBannerCycleButton(root);

  const key = clean.toLowerCase();
  if (root.dataset.milxdyTrophyBannerUser === key && root.dataset.milxdyTrophyBannerState === 'ready') return;
  if (root.dataset.milxdyTrophyBannerUser === key && root.dataset.milxdyTrophyBannerState === 'loading') return;

  if (root.dataset.milxdyTrophyBannerUser !== key) {
    clearTrophyBannerOverlay(root);
  }
  root.dataset.milxdyTrophyBannerUser = key;
  root.dataset.milxdyTrophyBannerState = 'loading';

  try {
    const bannerUrl = await renderTrophyBanner(clean);
    if (!bannerUrl || profilePath !== window.location.pathname) {
      root.dataset.milxdyTrophyBannerState = bannerUrl ? 'stale' : 'empty';
      if (!bannerUrl) {
        clearTrophyBannerOverlay(root);
        root.dataset.milxdyBannerMode = 'original';
      }
      return;
    }

    await transitionBannerOverlay(root, 'shelf', bannerUrl);
    clearBannerNftLabel(root);
    root.dataset.milxdyBannerMode = 'shelf';
    root.dataset.milxdyTrophyBannerState = 'ready';
  } catch (error) {
    root.dataset.milxdyTrophyBannerState = 'error';
    console.debug('RemiStats trophy banner skipped:', error);
  }
}

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
let runtimeSendMessage = safeRuntimeMessage;
let lifecycleSignal = null;
let runtimeScheduler = createFallbackRuntimeScheduler({ idleTimeoutMs: 1500, timeoutFallbackMs: 250 });

// Insert badge on profile pages
async function insertProfileBadge() {
  // Check if we're on a profile page
  const profileHeader = document.querySelector('[data-testid="UserProfileHeader_Items"]');
  if (!profileHeader) {
    return;
  }
  
  // Find the username/handle section
  const userNameSection = document.querySelector('[data-testid="UserName"]');
  if (!userNameSection) {
    return;
  }

  // Extract username from URL or from the handle in the profile before
  // deciding whether an existing badge is still valid. X reuses header DOM
  // during SPA navigation, so stale profile badges can remain attached.
  let username = null;

  const urlMatch = window.location.pathname.match(/^\/([^\/\?]+)/);
  if (urlMatch && urlMatch[1] && !ROUTE_BLOCKLIST.has(urlMatch[1])) {
    username = cleanUsername(urlMatch[1]);
  }

  if (!username) {
    const handleElement = userNameSection.querySelector('[href^="/"]');
    if (handleElement) {
      const href = handleElement.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && !ROUTE_BLOCKLIST.has(match[1])) {
        username = cleanUsername(match[1]);
      }
    }
  }

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
      const existingUsername = existingBadge.dataset.reminetUsername || username;
      const group = existingBadge.closest('[data-reminet-profile-badge-group]');
      if (group) attachProfileBadgeGroup(userNameSection, group);
      void upgradeProfileTrophyBanner(existingUsername, window.location.pathname);
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
        const slotUsername = existingSlotUsername || username;
        if (group) attachProfileBadgeGroup(userNameSection, group);
        ensureProfileActionPokeSlot(userNameSection, slotUsername);
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
    const cached = cachedScoreData(username);
    if (cached) {
      const profileBadgeSlot = createBadgeSlot(username, { profile: true });
      const profilePokeSlot = ensureProfileActionPokeSlot(userNameSection, username);
      const profileBadgeGroup = document.createElement('span');
      profileBadgeGroup.className = 'reminet-profile-badge-group';
      profileBadgeGroup.dataset.reminetProfileBadgeGroup = 'true';
      profileBadgeGroup.dataset.reminetUsername = username;
      profileBadgeGroup.append(profileBadgeSlot);
      attachProfileBadgeGroup(userNameSection, profileBadgeGroup);
      const filled = fillProfileBadgeFromScore(profileBadgeSlot, profileBadgeGroup, cached, username);
      if (filled) fillProfilePokeSlot(profilePokeSlot, filled.remiliaUsername);
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
    const scoreData = await fetchUserScore(username);

    if (scoreData === null) {
      processedProfiles.add(profileKey);
      markBadgeSlotEmpty(profileBadgeSlot);
      clearReminetProcessing(userNameSection);
      return;
    }

    if (!scoreData) {
      markBadgeSlotEmpty(profileBadgeSlot);
      clearReminetProcessing(userNameSection);
      return;
    }

    processedProfiles.add(profileKey);

    clearReminetProcessing(userNameSection);
    void upgradeProfileTrophyBanner(scoreData.remiliaUsername || scoreData.username || username, window.location.pathname);
    const filled = fillProfileBadgeFromScore(profileBadgeSlot, profileBadgeGroup, scoreData, username);
    if (filled) fillProfilePokeSlot(profilePokeSlot, filled.remiliaUsername);
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
    <span class="reminet-compact-score">${scoreData.score}</span>
  `;

  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const remiliaUsername = scoreData.remiliaUsername || scoreData.username || scoreData.twitterHandle;
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
      return await insertBadge(element, username);
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
  if (element.closest('[data-testid="quoteTweet"]')) return false;
  const hasOwnBadge = Array.from(element.querySelectorAll('[data-reminet-badge]'))
    .some((badge) => !badge.closest('[data-testid="quoteTweet"]'));
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
    if (slot.closest('[data-testid="quoteTweet"]')) continue;
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
  runtimeSendMessage = context.sendMessage || runtimeSendMessage;
  addRuntimeDisposable = context.addDisposable || (() => undefined);
  lifecycleSignal = context.signal || null;
  if (booted) return;
  booted = true;
  const bootSignal = lifecycleSignal;
  bootSignal?.addEventListener?.('abort', disable, { once: true });
  addRuntimeDisposable(() => bootSignal?.removeEventListener?.('abort', disable));
  init();
}

function init() {
  Promise.all([
    chrome.storage.sync.get({ 'milxdy.remistats.enabled': true }),
    loadStoredPokeCooldowns(),
    loadIconSettings(),
    loadPokeThemeSettings(),
    loadVisualThemeSettings(),
  ]).then(([settings]) => {
    if (!lifecycleActive()) return;
    remistatsEnabled = settings['milxdy.remistats.enabled'] !== false;
    if (remistatsEnabled) {
      runtimeScheduleScan();
      scheduleSurfaceReconciliation();
      insertProfileBadge();
      scheduleGroupChatAvatars();
    } else {
      clearRemiStatsBadges();
    }
  });

  const storageListener = (changes, area) => {
    if (!lifecycleActive()) return;
    if (area === 'local' && (changes.beetolColor || changes.beetolMode)) {
      applyPokeThemeSettings(changes.beetolColor?.newValue, changes.beetolMode?.newValue);
      return;
    }
    if (area === 'local' && changes['milxdy.settings.visualTheme']) {
      void loadVisualThemeSettings().then(() => {
        if (!lifecycleActive() || !remistatsEnabled) return;
        runtimeScheduleScan();
        scheduleSurfaceReconciliation([300, 2200]);
        void insertProfileBadge();
      });
      return;
    }
    if (area !== 'sync') return;
    if (changes['milxdy.remistats.enabled']) {
      remistatsEnabled = changes['milxdy.remistats.enabled'].newValue !== false;
      if (remistatsEnabled) {
        runtimeScheduleScan();
        scheduleSurfaceReconciliation();
        insertProfileBadge();
        scheduleGroupChatAvatars();
      } else {
        clearRemiStatsBadges();
      }
      return;
    }
    if (iconSettingChanged(changes)) {
      void loadIconSettings().then(() => {
        if (!lifecycleActive() || !remistatsEnabled) return;
        runtimeScheduleScan();
        scheduleSurfaceReconciliation([100, 1000]);
        void insertProfileBadge();
      });
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
  addRuntimeDisposable(() => chrome.storage.onChanged.removeListener(storageListener));

  runtimeScheduleScan();
  scheduleSurfaceReconciliation([5000]);
}

export function onSurface(surface) {
  if (!lifecycleActive() || !remistatsEnabled) return;
  if (surface.kind === 'tweet' || surface.kind === 'userCell') {
    void processSurfaceElement(surface.element, surface.handle);
  }
  if (surface.kind === 'profile') {
    void insertProfileBadge();
  }
  if (surface.kind === 'directMessage') {
    scheduleGroupChatAvatars();
  }
}

export function onRouteChange(route) {
  if (!lifecycleActive() || !remistatsEnabled || route.href === lastProfileUrl) return;
  lastProfileUrl = route.href;
  processedProfiles.clear();
  incomingPokeCache = null;
  runtimeScheduleScan();
  scheduleSurfaceReconciliation([200, 1200, 3500]);
  if (routeProfileTimer) routeProfileTimer();
  routeProfileTimer = runtimeScheduler.timeout(() => {
    routeProfileTimer = null;
    if (!lifecycleActive()) return;
    void insertProfileBadge();
  }, 350);
  scheduleGroupChatAvatars(350);
}

export function disable() {
  remistatsEnabled = false;
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
  addRuntimeDisposable = () => undefined;
  lifecycleSignal = null;
  booted = false;
}

function lifecycleActive() {
  return booted && lifecycleSignal?.aborted !== true;
}

function clearRemiStatsBadges() {
  for (const node of document.querySelectorAll('[data-reminet-profile-badge-group], [data-reminet-profile-action-poke-slot], [data-reminet-action-poke-group], [data-reminet-badge-slot], [data-reminet-badge], [data-reminet-tooltip], [data-reminet-standalone-poke]')) {
    node.remove();
  }
  for (const node of Array.from(reminetProcessingElements)) {
    clearReminetProcessing(node);
  }
}

