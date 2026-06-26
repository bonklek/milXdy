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
};

type Listener = (surface: TwitterSurface) => void;

const TWEET = 'article[data-testid="tweet"]';
const USER_CELL = '[data-testid="UserCell"], [data-testid="user-cell"]';
const NOTIFICATION = 'article[data-testid="notification"]';
const DIRECT_MESSAGE = '[data-testid^="message-"]:not([data-testid^="message-text-"])';
const PROFILE = '[data-testid="primaryColumn"] [data-testid="UserName"]';
const ALL_SURFACES = [TWEET, USER_CELL, NOTIFICATION, DIRECT_MESSAGE, PROFILE].join(",");
const ROUTE_BLOCKLIST = new Set([
  "home", "explore", "notifications", "messages", "settings", "compose",
  "search", "i", "tos", "privacy", "login", "signup", "logout", "about",
  "jobs", "lists", "bookmarks", "communities", "topics", "verified-orgs-signup",
]);

const listeners = new Set<Listener>();
const pending = new Map<HTMLElement, TwitterSurfaceKind>();
let observer: MutationObserver | null = null;
let scanScheduled = false;
let flushTimer: number | null = null;
let safetyTimer: number | null = null;
let diagnosticsWriteTimer: number | null = null;

const counters = {
  mutations: 0,
  surfacesQueued: 0,
  surfacesEmitted: 0,
  safetyScans: 0,
  lastFlushMs: 0,
  updatedAt: 0,
};

export function subscribeTwitterSurfaces(listener: Listener): () => void {
  listeners.add(listener);
  ensureScanner();
  scheduleFullScan();
  return () => listeners.delete(listener);
}

export function scheduleTwitterScan(): void {
  ensureScanner();
  scheduleFullScan();
}

export function getTwitterScannerCounters(): typeof counters {
  return { ...counters };
}

function ensureScanner(): void {
  if (observer || !document.body) return;
  observer = new MutationObserver((mutations) => {
    counters.mutations += mutations.length;
    collectMutations(mutations);
    debounceFlush();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  safetyTimer = window.setInterval(() => {
    if (document.hidden) return;
    counters.safetyScans += 1;
    scheduleFullScan();
  }, 10000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleFullScan();
  }, { passive: true });
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
  for (const surface of Array.from(document.querySelectorAll<HTMLElement>(ALL_SURFACES))) {
    queueSurface(surface);
  }
  scheduleFlush();
}

function queueSurfacesFrom(node: HTMLElement): void {
  queueSurface(node);
  const nearest = node.closest<HTMLElement>(ALL_SURFACES);
  if (nearest) queueSurface(nearest);
  for (const surface of Array.from(node.querySelectorAll<HTMLElement>(ALL_SURFACES))) {
    queueSurface(surface);
  }
}

function queueSurface(element: HTMLElement): void {
  const kind = surfaceKind(element);
  if (!kind) return;
  pending.set(element, kind);
  counters.surfacesQueued += 1;
}

function surfaceKind(element: HTMLElement): TwitterSurfaceKind | null {
  if (element.matches(TWEET)) return "tweet";
  if (element.matches(USER_CELL)) return "userCell";
  if (element.matches(NOTIFICATION)) return "notification";
  if (element.matches(DIRECT_MESSAGE)) return "directMessage";
  if (element.matches(PROFILE)) return "profile";
  return null;
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
  queueMicrotask(flush);
}

function flush(): void {
  scanScheduled = false;
  const startedAt = performance.now();
  const surfaces = Array.from(pending.entries());
  pending.clear();
  for (const [element, kind] of surfaces) {
    if (!element.isConnected) continue;
    counters.surfacesEmitted += 1;
    const surface = buildSurface(kind, element);
    for (const listener of Array.from(listeners)) {
      listener(surface);
    }
  }
  counters.lastFlushMs = Math.round((performance.now() - startedAt) * 10) / 10;
  counters.updatedAt = Date.now();
  scheduleDiagnosticsWrite();
}

function buildSurface(kind: TwitterSurfaceKind, element: HTMLElement): TwitterSurface {
  return {
    kind,
    element,
    handle: extractHandle(kind, element),
    avatarUrl: null,
    textContainers: [],
    statusUrl: null,
    actionRow: null,
  };
}

function extractHandle(kind: TwitterSurfaceKind, element: HTMLElement): string | null {
  if (kind !== "tweet" && kind !== "userCell" && kind !== "profile") return null;
  if (kind === "profile") return normalizeHandle(location.pathname.split("/")[1] ?? "");

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
