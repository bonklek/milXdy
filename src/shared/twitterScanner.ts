import { safeLocalGet, safeLocalSet } from "./extensionRuntime";

export type TwitterSurfaceKind = "tweet" | "userCell" | "notification" | "directMessage" | "profile";

export type TwitterSurface = {
  kind: TwitterSurfaceKind;
  element: HTMLElement;
  handle: string | null;
  avatarUrl: string | null;
  textContainers: HTMLElement[];
  statusUrl: string | null;
  actionRow: HTMLElement | null;
  cacheKey: string;
  emittedAt: number;
};

type Listener = (surface: TwitterSurface) => void;

const TWEET = 'article[data-testid="tweet"]';
const USER_CELL = '[data-testid="UserCell"], [data-testid="user-cell"]';
const NOTIFICATION = 'article[data-testid="notification"]';
const DIRECT_MESSAGE = '[data-testid^="message-"]:not([data-testid^="message-text-"])';
const PROFILE = '[data-testid="primaryColumn"] [data-testid="UserName"]';
const ROUTE_BLOCKLIST = new Set([
  "home", "explore", "notifications", "messages", "settings", "compose",
  "search", "i", "tos", "privacy", "login", "signup", "logout", "about",
  "jobs", "lists", "bookmarks", "communities", "topics", "verified-orgs-signup",
]);

const listeners = new Set<Listener>();
const pending = new Map<HTMLElement, TwitterSurfaceKind>();
let observer: MutationObserver | null = null;
let scanScheduled = false;
let fullScanFrame: number | null = null;
let flushTimer: number | null = null;
let flushFrame: number | null = null;
let safetyTimer: number | null = null;
let diagnosticsWriteTimer: number | null = null;
let safetyScanIntervalMs: number | null = 10000;
let maxSurfacesPerFlush = 24;
let maxSurfacesPerScrollFlush = 6;
let maxSurfacesPerFullScan = 72;
let maxPendingSurfaces = 144;
let scrollSettleMs = 160;
let lastScrollAt = 0;
let deferredFullScanTimer: number | null = null;
let removeVisibilityListener: (() => void) | null = null;
let removeScrollListener: (() => void) | null = null;
let enabledSurfaceKinds = new Set<TwitterSurfaceKind>(["tweet", "userCell", "notification", "directMessage", "profile"]);

function createScannerCounters() {
  return {
  mutations: 0,
  surfacesQueued: 0,
  surfacesEmitted: 0,
  surfacesDropped: 0,
  surfacesDroppedPendingCap: 0,
  safetyScans: 0,
  scrollEvents: 0,
  fullScanRequestsDeferredForScroll: 0,
  fullScanRequests: 0,
  fullScanRequestsCoalesced: 0,
  fullScanRequestsSkippedHidden: 0,
  fullScans: 0,
  lazyFieldsComputed: 0,
  activeSurfaceKinds: 5,
  maxSurfacesPerFlushBudget: 24,
  maxSurfacesPerScrollFlushBudget: 6,
  maxSurfacesPerFullScanBudget: 72,
  maxPendingSurfacesBudget: 144,
  lastFullScanQueued: 0,
  lastFullScanDropped: 0,
  lastFullScanMs: 0,
  flushes: 0,
  scrollFlushesThrottled: 0,
  maxPendingSurfaces: 0,
  lastFlushBatchSize: 0,
  lastFlushRemaining: 0,
  lastFlushLimit: 0,
  lastFlushReason: "" as "normal" | "scroll" | "",
  lastFlushMs: 0,
  updatedAt: 0,
  };
}

const counters = createScannerCounters();

export function subscribeTwitterSurfaces(listener: Listener): () => void {
  listeners.add(listener);
  ensureScanner();
  scheduleFullScan();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopScanner();
  };
}

export function scheduleTwitterScan(): void {
  ensureScanner();
  scheduleFullScan();
}

export function getTwitterScannerCounters(): typeof counters {
  return { ...counters };
}

export function resetTwitterScannerCounters(): void {
  Object.assign(counters, createScannerCounters(), {
    activeSurfaceKinds: enabledSurfaceKinds.size,
    maxSurfacesPerFlushBudget: maxSurfacesPerFlush,
    maxSurfacesPerScrollFlushBudget: maxSurfacesPerScrollFlush,
    maxSurfacesPerFullScanBudget: maxSurfacesPerFullScan,
    maxPendingSurfacesBudget: maxPendingSurfaces,
    updatedAt: Date.now(),
  });
}

export function configureTwitterScanner(options: {
  safetyScanIntervalMs?: number | null;
  surfaceKinds?: readonly TwitterSurfaceKind[];
  maxSurfacesPerFlush?: number;
  maxSurfacesPerScrollFlush?: number;
  maxSurfacesPerFullScan?: number;
  maxPendingSurfaces?: number;
  scrollSettleMs?: number;
}): void {
  safetyScanIntervalMs = options.safetyScanIntervalMs ?? null;
  if (typeof options.maxSurfacesPerFlush === "number" && Number.isFinite(options.maxSurfacesPerFlush)) {
    maxSurfacesPerFlush = Math.max(1, Math.floor(options.maxSurfacesPerFlush));
    counters.maxSurfacesPerFlushBudget = maxSurfacesPerFlush;
  }
  if (typeof options.maxSurfacesPerScrollFlush === "number" && Number.isFinite(options.maxSurfacesPerScrollFlush)) {
    maxSurfacesPerScrollFlush = Math.max(1, Math.floor(options.maxSurfacesPerScrollFlush));
    counters.maxSurfacesPerScrollFlushBudget = maxSurfacesPerScrollFlush;
  }
  if (typeof options.maxSurfacesPerFullScan === "number" && Number.isFinite(options.maxSurfacesPerFullScan)) {
    maxSurfacesPerFullScan = Math.max(1, Math.floor(options.maxSurfacesPerFullScan));
    counters.maxSurfacesPerFullScanBudget = maxSurfacesPerFullScan;
  }
  if (typeof options.maxPendingSurfaces === "number" && Number.isFinite(options.maxPendingSurfaces)) {
    maxPendingSurfaces = Math.max(maxSurfacesPerFlush, Math.floor(options.maxPendingSurfaces));
    counters.maxPendingSurfacesBudget = maxPendingSurfaces;
  }
  if (typeof options.scrollSettleMs === "number" && Number.isFinite(options.scrollSettleMs)) {
    scrollSettleMs = Math.max(0, Math.floor(options.scrollSettleMs));
  }
  if (options.surfaceKinds) {
    enabledSurfaceKinds = new Set(options.surfaceKinds);
    counters.activeSurfaceKinds = enabledSurfaceKinds.size;
  }
  counters.updatedAt = Date.now();
  scheduleDiagnosticsWrite();
  restartSafetyTimer();
}

function ensureScanner(): void {
  if (observer || !document.body) return;
  observer = new MutationObserver((mutations) => {
    counters.mutations += mutations.length;
    collectMutations(mutations);
    debounceFlush();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  restartSafetyTimer();
  const visibilityListener = () => {
    if (!document.hidden) scheduleFullScan();
  };
  document.addEventListener("visibilitychange", visibilityListener, { passive: true });
  removeVisibilityListener = () => document.removeEventListener("visibilitychange", visibilityListener);
  const scrollListener = () => {
    lastScrollAt = performance.now();
    counters.scrollEvents += 1;
    counters.updatedAt = Date.now();
  };
  window.addEventListener("scroll", scrollListener, { passive: true });
  removeScrollListener = () => window.removeEventListener("scroll", scrollListener);
}

function stopScanner(): void {
  observer?.disconnect();
  observer = null;
  pending.clear();
  scanScheduled = false;
  removeVisibilityListener?.();
  removeVisibilityListener = null;
  removeScrollListener?.();
  removeScrollListener = null;
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (flushFrame !== null) {
    window.cancelAnimationFrame(flushFrame);
    flushFrame = null;
  }
  if (fullScanFrame !== null) {
    window.cancelAnimationFrame(fullScanFrame);
    fullScanFrame = null;
  }
  if (safetyTimer !== null) {
    window.clearInterval(safetyTimer);
    safetyTimer = null;
  }
  if (diagnosticsWriteTimer !== null) {
    window.clearTimeout(diagnosticsWriteTimer);
    diagnosticsWriteTimer = null;
  }
  if (deferredFullScanTimer !== null) {
    window.clearTimeout(deferredFullScanTimer);
    deferredFullScanTimer = null;
  }
}

function restartSafetyTimer(): void {
  if (safetyTimer !== null) {
    window.clearInterval(safetyTimer);
    safetyTimer = null;
  }
  if (!observer || safetyScanIntervalMs === null) return;
  safetyTimer = window.setInterval(() => {
    if (document.hidden) return;
    counters.safetyScans += 1;
    scheduleFullScan();
  }, safetyScanIntervalMs);
}

function collectMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    if (mutation.type !== "childList") continue;
    for (const node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof HTMLElement)) continue;
      queueSurfacesFrom(node);
    }
  }
}

function scheduleFullScan(): void {
  counters.fullScanRequests += 1;
  if (document.hidden) {
    counters.fullScanRequestsSkippedHidden += 1;
    counters.updatedAt = Date.now();
    scheduleDiagnosticsWrite();
    return;
  }
  const remainingScrollSettle = scrollSettleRemainingMs();
  if (remainingScrollSettle > 0) {
    counters.fullScanRequestsDeferredForScroll += 1;
    counters.updatedAt = Date.now();
    if (deferredFullScanTimer === null) {
      deferredFullScanTimer = window.setTimeout(() => {
        deferredFullScanTimer = null;
        scheduleFullScan();
      }, remainingScrollSettle);
    }
    scheduleDiagnosticsWrite();
    return;
  }
  if (fullScanFrame !== null) {
    counters.fullScanRequestsCoalesced += 1;
    return;
  }
  fullScanFrame = window.requestAnimationFrame(() => {
    fullScanFrame = null;
    runFullScan();
  });
}

function runFullScan(): void {
  const startedAt = performance.now();
  counters.fullScans += 1;
  const selector = activeSurfaceSelector();
  if (!selector) {
    counters.lastFullScanQueued = 0;
    counters.lastFullScanDropped = 0;
    counters.lastFullScanMs = Math.round((performance.now() - startedAt) * 10) / 10;
    return;
  }
  let queued = 0;
  let dropped = 0;
  for (const surface of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    if (queued >= maxSurfacesPerFullScan) {
      dropped += 1;
      continue;
    }
    queueSurface(surface);
    queued += 1;
  }
  counters.lastFullScanQueued = queued;
  counters.lastFullScanDropped = dropped;
  counters.lastFullScanMs = Math.round((performance.now() - startedAt) * 10) / 10;
  counters.surfacesDropped += dropped;
  scheduleFlush();
}

function queueSurfacesFrom(node: HTMLElement): void {
  queueSurface(node);
  const selector = activeSurfaceSelector();
  if (!selector) return;
  const nearest = node.closest<HTMLElement>(selector);
  if (nearest) queueSurface(nearest);
  for (const surface of Array.from(node.querySelectorAll<HTMLElement>(selector))) {
    queueSurface(surface);
  }
}

function queueSurface(element: HTMLElement): void {
  const kind = surfaceKind(element);
  if (!kind) return;
  if (!pending.has(element) && pending.size >= maxPendingSurfaces) {
    counters.surfacesDropped += 1;
    counters.surfacesDroppedPendingCap += 1;
    return;
  }
  pending.set(element, kind);
  counters.surfacesQueued += 1;
  counters.maxPendingSurfaces = Math.max(counters.maxPendingSurfaces, pending.size);
}

function surfaceKind(element: HTMLElement): TwitterSurfaceKind | null {
  if (enabledSurfaceKinds.has("tweet") && element.matches(TWEET)) return "tweet";
  if (enabledSurfaceKinds.has("userCell") && element.matches(USER_CELL)) return "userCell";
  if (enabledSurfaceKinds.has("notification") && element.matches(NOTIFICATION)) return "notification";
  if (enabledSurfaceKinds.has("directMessage") && element.matches(DIRECT_MESSAGE)) return "directMessage";
  if (enabledSurfaceKinds.has("profile") && element.matches(PROFILE)) return "profile";
  return null;
}

function activeSurfaceSelector(): string {
  const selectors: string[] = [];
  if (enabledSurfaceKinds.has("tweet")) selectors.push(TWEET);
  if (enabledSurfaceKinds.has("userCell")) selectors.push(USER_CELL);
  if (enabledSurfaceKinds.has("notification")) selectors.push(NOTIFICATION);
  if (enabledSurfaceKinds.has("directMessage")) selectors.push(DIRECT_MESSAGE);
  if (enabledSurfaceKinds.has("profile")) selectors.push(PROFILE);
  return selectors.join(",");
}

function debounceFlush(): void {
  if (flushTimer !== null) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    scheduleFlush();
  }, 150);
}

function scheduleFlush(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  flushFrame = window.requestAnimationFrame(() => {
    flushFrame = null;
    flush();
  });
}

function flush(): void {
  scanScheduled = false;
  const startedAt = performance.now();
  const surfaces: Array<[HTMLElement, TwitterSurfaceKind]> = [];
  const flushReason = activeFlushReason();
  const flushLimit = activeFlushLimit(flushReason);
  for (const entry of pending.entries()) {
    surfaces.push(entry);
    pending.delete(entry[0]);
    if (surfaces.length >= flushLimit) break;
  }
  for (const [element, kind] of surfaces) {
    if (!element.isConnected) {
      counters.surfacesDropped += 1;
      continue;
    }
    counters.surfacesEmitted += 1;
    const surface = buildSurface(kind, element);
    for (const listener of Array.from(listeners)) {
      listener(surface);
    }
  }
  counters.flushes += 1;
  if (flushReason === "scroll") counters.scrollFlushesThrottled += 1;
  counters.lastFlushBatchSize = surfaces.length;
  counters.lastFlushRemaining = pending.size;
  counters.lastFlushLimit = flushLimit;
  counters.lastFlushReason = flushReason;
  counters.lastFlushMs = Math.round((performance.now() - startedAt) * 10) / 10;
  counters.updatedAt = Date.now();
  scheduleDiagnosticsWrite();
  if (pending.size > 0) scheduleFlush();
}

function activeFlushReason(): "normal" | "scroll" {
  return scrollSettleRemainingMs() > 0 ? "scroll" : "normal";
}

function activeFlushLimit(reason = activeFlushReason()): number {
  const limit = reason === "scroll"
    ? Math.min(maxSurfacesPerFlush, maxSurfacesPerScrollFlush)
    : maxSurfacesPerFlush;
  counters.lastFlushLimit = limit;
  counters.lastFlushReason = reason;
  return limit;
}

function scrollSettleRemainingMs(): number {
  if (scrollSettleMs <= 0 || lastScrollAt <= 0) return 0;
  return Math.max(0, Math.ceil(scrollSettleMs - (performance.now() - lastScrollAt)));
}

function buildSurface(kind: TwitterSurfaceKind, element: HTMLElement): TwitterSurface {
  const emittedAt = Date.now();
  const lazy = <T>(compute: () => T): (() => T) => {
    let computed = false;
    let value: T;
    return () => {
      if (!computed) {
        value = compute();
        computed = true;
        counters.lazyFieldsComputed += 1;
      }
      return value;
    };
  };
  const handle = lazy(() => extractHandle(kind, element));
  const avatarUrl = lazy(() => extractAvatarUrl(kind, element));
  const textContainers = lazy(() => extractTextContainers(kind, element));
  const statusUrl = lazy(() => extractStatusUrl(kind, element));
  const actionRow = lazy(() => extractActionRow(kind, element));
  const cacheKey = lazy(() => stableSurfaceKey(kind, element, handle(), statusUrl()));
  return {
    kind,
    element,
    get handle() { return handle(); },
    get avatarUrl() { return avatarUrl(); },
    get textContainers() { return textContainers(); },
    get statusUrl() { return statusUrl(); },
    get actionRow() { return actionRow(); },
    get cacheKey() { return cacheKey(); },
    emittedAt,
  };
}

function extractHandle(kind: TwitterSurfaceKind, element: HTMLElement): string | null {
  if (kind !== "tweet" && kind !== "userCell" && kind !== "profile") return null;
  if (kind === "profile") return normalizeHandle(location.pathname.split("/")[1] ?? "");

  if (kind === "tweet") {
    const fromUserName = tweetAuthorFromUserName(element);
    if (fromUserName) return fromUserName;

    const fromStatus = tweetAuthorFromStatusLink(element);
    if (fromStatus) return fromStatus;
  }

  const avatar = element.querySelector<HTMLElement>('[data-testid^="UserAvatar-Container-"]');
  const testId = avatar?.getAttribute("data-testid");
  const fromAvatar = testId?.replace("UserAvatar-Container-", "").trim();
  if (fromAvatar && !ROUTE_BLOCKLIST.has(fromAvatar)) return normalizeHandle(fromAvatar);

  let checked = 0;
  for (const link of Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]'))) {
    checked += 1;
    if (checked > 8) break;
    if (link.closest('[data-testid="quoteTweet"]')) continue;
    const handle = normalizeHandle(link.getAttribute("href"));
    if (handle) return handle;
  }

  const labelLink = element.querySelector<HTMLAnchorElement>('a[aria-label*="@"]');
  const labelMatch = labelLink?.getAttribute("aria-label")?.match(/@([a-z0-9_]{1,15})/i);
  return labelMatch ? normalizeHandle(labelMatch[1]) : null;
}

function tweetAuthorFromStatusLink(element: HTMLElement): string | null {
  const link = Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .find((anchor) => !anchor.closest('[data-testid="quoteTweet"]'));
  const href = link?.getAttribute("href") || "";
  const match = href.match(/^(?:https?:\/\/(?:twitter|x)\.com)?\/([^/?#]+)\/status\/\d+/i);
  return match ? normalizeHandle(match[1]) : null;
}

function tweetAuthorFromUserName(element: HTMLElement): string | null {
  const userName = Array.from(element.querySelectorAll<HTMLElement>('[data-testid="User-Name"]'))
    .find((node) => !node.closest('[data-testid="quoteTweet"]'));
  if (!userName) return null;
  for (const link of Array.from(userName.querySelectorAll<HTMLAnchorElement>('a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]'))) {
    const href = link.getAttribute("href") || "";
    if (href.includes("/status/")) continue;
    const handle = normalizeHandle(href);
    if (handle) return handle;
  }
  return null;
}

function extractAvatarUrl(kind: TwitterSurfaceKind, element: HTMLElement): string | null {
  if (kind !== "tweet" && kind !== "userCell" && kind !== "profile" && kind !== "directMessage") return null;
  const image = element.querySelector<HTMLImageElement>(
    'img[src*="profile_images"], img[src*="pbs.twimg.com/profile_images"], img[src*="twimg.com/profile_images"]',
  );
  return image?.currentSrc || image?.src || null;
}

function extractTextContainers(kind: TwitterSurfaceKind, element: HTMLElement): HTMLElement[] {
  if (kind === "tweet") {
    return Array.from(element.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
      .filter((node) => !node.closest('[data-testid="quoteTweet"]'));
  }
  if (kind === "directMessage") {
    return Array.from(element.querySelectorAll<HTMLElement>('[data-testid^="message-text-"], [dir="auto"]'))
      .slice(0, 6);
  }
  if (kind === "notification") {
    return Array.from(element.querySelectorAll<HTMLElement>('[dir="auto"], span'))
      .slice(0, 8);
  }
  if (kind === "profile") {
    const primaryColumn = element.closest<HTMLElement>('[data-testid="primaryColumn"]');
    const description = primaryColumn?.querySelector<HTMLElement>('[data-testid="UserDescription"]');
    const containers = description
      ? [description, ...Array.from(description.querySelectorAll<HTMLElement>('span, [dir="auto"]'))]
      : Array.from(element.querySelectorAll<HTMLElement>('span, [dir="auto"]'));
    return Array.from(new Set(containers)).slice(0, 8);
  }
  return Array.from(element.querySelectorAll<HTMLElement>('[dir="auto"], span')).slice(0, 8);
}

function extractStatusUrl(kind: TwitterSurfaceKind, element: HTMLElement): string | null {
  if (kind !== "tweet" && kind !== "notification") return null;
  const link = Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .find((anchor) => !anchor.closest('[data-testid="quoteTweet"]'));
  return link?.href || null;
}

function extractActionRow(kind: TwitterSurfaceKind, element: HTMLElement): HTMLElement | null {
  if (kind !== "tweet") return null;
  return element.querySelector<HTMLElement>('[role="group"][aria-label], [data-testid="reply"], [data-testid="like"]')?.closest<HTMLElement>('[role="group"], div') || null;
}

function stableSurfaceKey(kind: TwitterSurfaceKind, element: HTMLElement, handle: string | null, statusUrl: string | null): string {
  if (statusUrl) return `${kind}:${normalizeStatusUrl(statusUrl)}`;
  if (kind === "profile" && handle) return `${kind}:${handle}`;
  const testId = element.getAttribute("data-testid") || "";
  const text = element.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) || "";
  return `${kind}:${handle || "unknown"}:${testId}:${text}`;
}

function normalizeStatusUrl(value: string): string {
  const match = value.match(/\/([^/?#]+)\/status\/(\d+)/);
  return match ? `/${match[1].toLowerCase()}/status/${match[2]}` : value;
}

function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(?:https?:\/\/(?:twitter|x)\.com)?\/?([^/?#]+)/i);
  const candidate = (match ? match[1] : value).replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(candidate)) return null;
  if (ROUTE_BLOCKLIST.has(candidate)) return null;
  return candidate;
}

function scheduleDiagnosticsWrite(): void {
  if (diagnosticsWriteTimer !== null) return;
  diagnosticsWriteTimer = window.setTimeout(async () => {
    diagnosticsWriteTimer = null;
    const stored = await safeLocalGet({ "milxdy.diagnostics.enabled": false });
    if (stored?.["milxdy.diagnostics.enabled"] !== true) return;
    await safeLocalSet({ "milxdy.diagnostics.scanner": getTwitterScannerCounters() });
  }, 1000);
}
