import { scheduleTwitterScan, subscribeTwitterSurfaces } from "../../shared/twitterScanner";
import { safeRuntimeMessage } from "../../shared/extensionRuntime";

// Content script for overlaying user scores on X.com.

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

// Cache for user scores
const scoreCache = new Map();

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

// Find the first profile-link username inside a container, skipping routes
// like /messages/<id> that appear in DM cells before the avatar link.
function findUsernameInLinks(container) {
  const links = container.querySelectorAll('a[href^="/"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href.includes('/status/')) continue;
    const match = href.match(/^\/([^\/\?#]+)(?:\/|$)/);
    if (!match) continue;
    const candidate = match[1];
    if (ROUTE_BLOCKLIST.has(candidate)) continue;
    return candidate;
  }
  return null;
}

// Extract username from X's avatar testid convention: UserAvatar-Container-<username>
function extractUsernameFromAvatar(container) {
  const avatar = container.querySelector('[data-testid^="UserAvatar-Container-"]');
  if (avatar) {
    const testid = avatar.getAttribute('data-testid');
    const candidate = testid.replace('UserAvatar-Container-', '').trim();
    if (candidate && !ROUTE_BLOCKLIST.has(candidate)) {
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
    // Most reliable: X's own avatar testid always has the username baked in
    username = extractUsernameFromAvatar(container);

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
let activeTooltipBadge = null;
let tooltipHideTimer = null;
const pokeCooldowns = new Map();
const DEFAULT_ICON_SETTINGS = {
  enabled: true,
  score: true,
  beetle: true,
  poke: true,
};
let iconSettings = { ...DEFAULT_ICON_SETTINGS };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
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
  const cacheNotFound = () => {
    const now = Date.now();
    for (const handle of requested) {
      if (!scoreCache.has(handle)) {
        scoreCache.set(handle, { data: null, timestamp: now });
      }
    }
  };

  try {
    const responses = await Promise.all(requested.map(async (handle) => {
      const response = await safeRuntimeMessage({ type: 'remistats:getUser', handle });
      return [handle, response];
    }));

    for (const [requestedHandle, response] of responses) {
      if (!response?.ok) {
        if (!scoreCache.has(requestedHandle)) {
          scoreCache.set(requestedHandle, { data: null, timestamp: Date.now() });
        }
        continue;
      }

      const data = response.data || {};
      if (data.max_beetles !== undefined) maxBeetles = data.max_beetles;
      if (data.max_score !== undefined) maxScore = data.max_score;

      if (data.user) {
        const user = data.user;
        const userData = transformApiResponse(user, requestedHandle);
        const normalized = (user.twitterHandle || requestedHandle).toLowerCase();
        scoreCache.set(normalized, { data: userData, timestamp: Date.now() });
        results[normalized] = userData;
      }
    }
  } catch (error) {
    if (!/extension context/i.test(String(error?.message || error))) {
      console.debug('RemiStats API lookup skipped:', error.message);
    }
  }

  cacheNotFound();
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

function createPokeButton(username, standalone = false) {
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
  if (standalone) {
    button.dataset.reminetStandalonePoke = 'true';
  }
  button.textContent = String.fromCodePoint(0x1FAF5);
  button.title = `Poke ${clean} on remilia.net`;
  button.setAttribute('aria-label', button.title);
  return button;
}

function ensureStandalonePokeButton(badge, username) {
  const clean = cleanUsername(username || badge.dataset.reminetUsername || profileUsernameFromUrl());
  if (!clean || !badge.parentElement || badge.dataset.reminetCompact === 'true') return;

  badge.dataset.reminetUsername = clean;
  const next = badge.nextElementSibling;
  if (next?.matches?.('[data-reminet-standalone-poke]')) {
    next.dataset.reminetUsername = clean;
    next.title = `Poke ${clean} on remilia.net`;
    next.setAttribute('aria-label', next.title);
    return;
  }

  const button = createPokeButton(clean, true);
  if (button) {
    badge.parentElement.insertBefore(button, badge.nextSibling);
  }
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

  if (options.includePokeInside !== false) {
    const inlinePoke = createPokeButton(remiliaUsername);
    const content = badge.querySelector('.reminet-badge-content');
    if (inlinePoke && content) content.appendChild(inlinePoke);
  }
  
  // Calculate progress percentages
  const scorePercent = Math.min(100, (scoreData.score / maxScore) * 100);
  const beetlePercent = Math.min(100, (beetleCount / maxBeetles) * 100);
  
  // Build PFP image URL if we have project and ID
  const pfpImageUrl = (scoreData.pfpProject && scoreData.pfpId) 
    ? `https://pfp.remilia.net/pfp/${scoreData.pfpProject.toLowerCase()}/${scoreData.pfpId}`
    : '';
  
  const pfpInfo = scoreData.pfpProject ? `${scoreData.pfpProject} #${scoreData.pfpId}` : '';
  
  badge.dataset.reminetProfileUrl = remiliaUsername ? `https://remilia.net/~${remiliaUsername}` : '';
  badge.dataset.reminetTooltipHtml = `
    <div class="reminet-tooltip-header">
      <span class="reminet-tooltip-displayname">${scoreData.displayName || remiliaUsername}</span>
      <span class="reminet-tooltip-handle">@${scoreData.twitterHandle || remiliaUsername}</span>
    </div>
    ${pfpInfo ? `<div class="reminet-tooltip-pfp">
      ${pfpImageUrl ? `<img src="${pfpImageUrl}" alt="${pfpInfo}" class="pfp-image" onerror="this.style.display='none';" />` : ''}
      <span class="pfp-label">${pfpInfo}</span>
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

  document.addEventListener('mouseover', async (event) => {
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
  }, true);

  document.addEventListener('mouseout', (event) => {
    const badge = event.target.closest?.('[data-reminet-badge]');
    if (!badge) return;
    const related = event.relatedTarget;
    if (related instanceof Node && badge.contains(related)) return;
    scheduleHideSharedTooltip();
  }, true);

  document.addEventListener('click', (event) => {
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
  }, true);

  window.addEventListener('scroll', () => {
    if (!activeTooltipBadge) return;
    positionSharedTooltip(activeTooltipBadge);
    scheduleHideSharedTooltip(300);
  }, { passive: true, capture: true });
}

async function handlePokeClick(button) {
  const badge = button.closest('[data-reminet-badge]');
  const username = cleanUsername(button.dataset.reminetUsername || badge?.dataset.reminetUsername || profileUsernameFromUrl());
  if (!username || button.disabled) return;

  const cooldownUntil = pokeCooldowns.get(username.toLowerCase()) || 0;
  if (cooldownUntil > Date.now()) {
    setPokeButtonState(button, 'cooldown', `Already poked ${username}`);
    window.setTimeout(() => setPokeButtonState(button, 'idle', `Poke ${username} on remilia.net`), 1400);
    return;
  }

  setPokeButtonState(button, 'loading', `Poking ${username}...`);
  const response = await safeRuntimeMessage({ type: 'beetol:poke', username });
  if (response?.ok) {
    pokeCooldowns.set(username.toLowerCase(), Date.now() + 24 * 60 * 60 * 1000);
    setPokeButtonState(button, 'success', `Poked ${username}`);
    return;
  }

  if (response?.authRequired) {
    setPokeButtonState(button, 'error', 'Sign in to remilia.net to poke');
    return;
  }

  const message = response?.data?.error || response?.data?.message || response?.error || `Could not poke ${username}`;
  setPokeButtonState(button, 'error', message);
}

function setPokeButtonState(button, state, label) {
  button.dataset.reminetPokeState = state;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.disabled = state === 'loading' || state === 'success';
}

function patchExistingBadges() {
  for (const badge of document.querySelectorAll('[data-reminet-badge]:not([data-reminet-compact])')) {
    const username = badge.dataset.reminetUsername || profileUsernameFromUrl();
    if (badge.hasAttribute('data-profile-badge')) {
      ensureStandalonePokeButton(badge, username);
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
function insertBadgeIntoElement(element, badge) {
  const timeElement = element.querySelector('time');
  if (timeElement && timeElement.parentElement) {
    timeElement.parentElement.insertBefore(badge, timeElement.nextSibling);
    return true;
  }

  const userNameContainer = element.querySelector('[data-testid="User-Name"]');
  if (userNameContainer) {
    const insertPoint = userNameContainer.querySelector('[dir="ltr"]') || userNameContainer;
    if (insertPoint.parentElement) {
      insertPoint.parentElement.insertBefore(badge, insertPoint.nextSibling);
      return true;
    }
  }

  const fallback = element.querySelector('[dir="ltr"][class*="css"]');
  if (fallback && fallback.parentElement) {
    const insertPoint = fallback.querySelector('[dir="ltr"]') || fallback;
    insertPoint.parentElement.insertBefore(badge, insertPoint.nextSibling);
    return true;
  }

  return false;
}

// Insert badge into the DOM for tweets and user cells
async function insertBadge(element) {
  // Check if badge already exists
  if (element.querySelector('[data-reminet-badge]')) {
    return;
  }
  
  // Mark element as processing to prevent duplicate insertions during async operations
  if (element.hasAttribute('data-reminet-processing')) {
    return;
  }
  element.setAttribute('data-reminet-processing', 'true');
  
  const username = extractUsername(element);
  if (!username) {
    element.removeAttribute('data-reminet-processing');
    return;
  }
  
  try {
    const scoreData = await fetchUserScore(username);

    if (!scoreData) {
      element.removeAttribute('data-reminet-processing');
      return;
    }

    const badge = createScoreBadge(scoreData);
    
    // Remove processing flag since we're about to insert the badge
    element.removeAttribute('data-reminet-processing');
    
    insertBadgeIntoElement(element, badge);
  } catch (error) {
    console.error('Error inserting badge:', error);
    element.removeAttribute('data-reminet-processing');
  }
}

// Track which profiles have been processed
const processedProfiles = new Set();
let lastProfileUrl = location.href;

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
  
  // Check if badge already exists in this specific location
  if (userNameSection.querySelector('[data-reminet-badge]')) {
    return;
  }
  
  // Check if already processing
  if (userNameSection.hasAttribute('data-reminet-processing')) {
    return;
  }
  userNameSection.setAttribute('data-reminet-processing', 'true');
  
  // Extract username from URL or from the handle in the profile
  let username = null;
  
  // Try to get from URL first
  const urlMatch = window.location.pathname.match(/^\/([^\/\?]+)/);
  if (urlMatch && urlMatch[1] && !['home', 'explore', 'notifications', 'messages', 'settings', 'i'].includes(urlMatch[1])) {
    username = urlMatch[1];
  }
  
  // Fallback: try to extract from the page
  if (!username) {
    const handleElement = userNameSection.querySelector('[href^="/"]');
    if (handleElement) {
      const href = handleElement.getAttribute('href');
      const match = href.match(/^\/([^\/\?]+)/);
      if (match) {
        username = match[1];
      }
    }
  }
  
  if (!username) {
    userNameSection.removeAttribute('data-reminet-processing');
    return;
  }
  
  // Create a unique key for this profile + location
  const profileKey = `${username}-${window.location.pathname}`;
  if (processedProfiles.has(profileKey)) {
    userNameSection.removeAttribute('data-reminet-processing');
    return;
  }
  processedProfiles.add(profileKey);
  
  try {
    const scoreData = await fetchUserScore(username);

    if (!scoreData) {
      userNameSection.removeAttribute('data-reminet-processing');
      return;
    }

    userNameSection.removeAttribute('data-reminet-processing');
    const badge = createScoreBadge(scoreData, { includePokeInside: false });
    badge.style.marginLeft = '8px';
    badge.style.display = 'inline-flex';
    badge.style.verticalAlign = 'middle';
    badge.setAttribute('data-profile-badge', username);
    
    // Find the handle text (the @username part)
    const handleSpan = userNameSection.querySelector('span[style*="color"]');
    if (handleSpan && handleSpan.textContent.startsWith('@')) {
      handleSpan.parentElement.appendChild(badge);
    } else {
      // Fallback: append to the username section
      userNameSection.appendChild(badge);
    }
    ensureStandalonePokeButton(badge, scoreData.remiliaUsername || username);
  } catch (error) {
    console.error('Error inserting profile badge:', error);
    userNameSection.removeAttribute('data-reminet-processing');
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
}

// Process all visible user elements
async function processUserElements() {
  if (!remistatsEnabled) return;
  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  const userCells = document.querySelectorAll('[data-testid="UserCell"]');

  const elements = [...tweets, ...userCells];

  for (const element of elements) {
    await insertBadge(element);
  }

  await insertProfileBadge();
  await processGroupChatAvatars();
}

async function processSurfaceElement(element) {
  if (!remistatsEnabled) return;
  if (element.matches?.('[data-testid="tweet"], [data-testid="UserCell"], [data-testid="user-cell"]')) {
    await insertBadge(element);
  }
}

function init() {
  Promise.all([
    chrome.storage.sync.get({ 'milxdy.remistats.enabled': true }),
    loadIconSettings(),
  ]).then(([settings]) => {
    remistatsEnabled = settings['milxdy.remistats.enabled'] !== false;
    if (remistatsEnabled) {
      scheduleTwitterScan();
      insertProfileBadge();
      processGroupChatAvatars();
    } else {
      clearRemiStatsBadges();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes['milxdy.remistats.enabled']) {
      remistatsEnabled = changes['milxdy.remistats.enabled'].newValue !== false;
      if (remistatsEnabled) {
        scheduleTwitterScan();
        insertProfileBadge();
        processGroupChatAvatars();
      } else {
        clearRemiStatsBadges();
      }
      return;
    }
    if (iconSettingChanged(changes)) {
      void loadIconSettings().then(() => {
        if (!remistatsEnabled) return;
        processUserElements();
      });
    }
  });

  subscribeTwitterSurfaces((surface) => {
    if (surface.kind === 'tweet' || surface.kind === 'userCell') {
      void processSurfaceElement(surface.element);
    }
    if (surface.kind === 'profile') {
      void insertProfileBadge();
    }
  });

  window.setInterval(() => {
    if (!remistatsEnabled) return;
    if (location.href !== lastProfileUrl) {
      lastProfileUrl = location.href;
      processedProfiles.clear();
      scheduleTwitterScan();
      window.setTimeout(insertProfileBadge, 350);
    }
    if (isInGroupChat()) void processGroupChatAvatars();
  }, 1500);
}

function clearRemiStatsBadges() {
  for (const node of document.querySelectorAll('[data-reminet-badge], [data-reminet-tooltip], [data-reminet-standalone-poke]')) {
    node.remove();
  }
  for (const node of document.querySelectorAll('[data-reminet-processing]')) {
    node.removeAttribute('data-reminet-processing');
  }
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {};
