import { safeLocalGet, safeLocalSet } from "./extensionRuntime";

export type TwitterSurfaceKind = "tweet" | "userCell" | "notification" | "directMessage" | "profile";

export type TwitterSurface = {
  kind: TwitterSurfaceKind;
  element: HTMLElement;
};

type Listener = (surface: TwitterSurface) => void;

const TWEET = 'article[data-testid="tweet"]';
const USER_CELL = '[data-testid="UserCell"], [data-testid="user-cell"]';
const NOTIFICATION = 'article[data-testid="notification"]';
const DIRECT_MESSAGE = '[data-testid^="message-"]:not([data-testid^="message-text-"])';
const PROFILE = '[data-testid="primaryColumn"] [data-testid="UserName"]';
const ALL_SURFACES = [TWEET, USER_CELL, NOTIFICATION, DIRECT_MESSAGE, PROFILE].join(",");

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
    counters.safetyScans += 1;
    scheduleFullScan();
  }, 10000);
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
    for (const listener of Array.from(listeners)) {
      listener({ kind, element });
    }
  }
  counters.lastFlushMs = Math.round((performance.now() - startedAt) * 10) / 10;
  counters.updatedAt = Date.now();
  scheduleDiagnosticsWrite();
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
