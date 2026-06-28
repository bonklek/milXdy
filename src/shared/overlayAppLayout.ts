import type { OverlayDockSide } from "./overlayDock";

export const OVERLAY_APP_LAYOUTS_KEY = "milxdy.overlayApps.layouts.v1";

export type OverlayAppSnapRecord = {
  kind: "free" | "milxdyRail" | "hostRail" | "viewport" | "app";
  edge?: "left" | "right" | "top" | "bottom" | "centerX" | "centerY";
  targetId?: string;
};

export type OverlayAppLayoutRecord = {
  appId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  snap?: OverlayAppSnapRecord;
  viewport: {
    width: number;
    height: number;
    scale?: number;
  };
  railSide: OverlayDockSide;
  updatedAt: number;
};

export type OverlayAppLayoutStoreV1 = {
  version: 1;
  apps: Record<string, OverlayAppLayoutRecord>;
};

export type OverlayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlayViewportRect = OverlayRect & {
  scale?: number;
};

export type OverlayProtectedZone = {
  id: string;
  kind: "milxdyRail" | "hostLeftRail" | "hostRightRail" | "viewportUnsafe" | "app";
  rect: OverlayRect;
  hard: boolean;
  guideEdges: Array<"left" | "right" | "top" | "bottom" | "centerX" | "centerY">;
};

export type OverlayGuideLine = {
  id: string;
  axis: "x" | "y";
  value: number;
  kind: OverlayProtectedZone["kind"] | "viewport" | "app";
  active?: boolean;
};

export type OverlaySnapResult = {
  rect: OverlayRect;
  snap?: OverlayAppSnapRecord;
  guides: OverlayGuideLine[];
};

type LegacyLayout = {
  width?: unknown;
  height?: unknown;
  topOffset?: unknown;
};

type RestoreOptions = {
  appId: string;
  side: OverlayDockSide;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  legacy?: LegacyLayout;
};

type SaveOptions = {
  appId: string;
  side: OverlayDockSide;
  rect: OverlayRect;
  snap?: OverlayAppSnapRecord;
};

const GUIDE_ROOT_ID = "milxdy-overlay-app-guides";
const GUIDE_STYLE_ID = "milxdy-overlay-app-guides-style";
const VIEWPORT_MARGIN_PX = 8;
const HEADER_RECOVERY_PX = 48;
const RAIL_GAP_PX = 8;
const FALLBACK_RAIL_WIDTH_PX = 64;
const FALLBACK_RAIL_HEIGHT_PX = 420;
const SNAP_SHOW_PX = 24;
const SNAP_COMMIT_PX = 12;
const RAIL_SNAP_PX = 32;
const DEFAULT_Z = 2147483000;
const STACK_Z_BASE = 2147483000;
const STACK_Z_STEP = 20;

let loadPromise: Promise<OverlayAppLayoutStoreV1> | null = null;
let storeCache: OverlayAppLayoutStoreV1 | null = null;
let zCounter = DEFAULT_Z;
let stackOrder: string[] = [];
const stackRoots = new Map<string, HTMLElement>();

export function getViewportRect(): OverlayViewportRect {
  const visual = window.visualViewport;
  if (visual) {
    return {
      x: Math.floor(visual.offsetLeft),
      y: Math.floor(visual.offsetTop),
      width: Math.floor(visual.width),
      height: Math.floor(visual.height),
      scale: visual.scale,
    };
  }
  return {
    x: 0,
    y: 0,
    width: Math.floor(window.innerWidth || document.documentElement.clientWidth || 1024),
    height: Math.floor(window.innerHeight || document.documentElement.clientHeight || 768),
  };
}

export async function restoreOverlayAppLayout(options: RestoreOptions): Promise<OverlayAppLayoutRecord> {
  const store = await loadOverlayAppLayoutStore();
  const saved = normalizeLayoutRecord(store.apps[options.appId], options.appId);
  const viewport = getViewportRect();
  const legacy = options.legacy || {};
  const legacyWidth = finiteNumber(legacy.width);
  const legacyHeight = finiteNumber(legacy.height);
  const legacyTop = finiteNumber(legacy.topOffset);
  const base = saved || {
    appId: options.appId,
    ...defaultRectForApp({
      side: options.side,
      width: legacyWidth ?? options.defaultWidth,
      height: legacyHeight ?? options.defaultHeight,
      y: legacyTop ?? VIEWPORT_MARGIN_PX * 2,
      minWidth: options.minWidth,
      minHeight: options.minHeight,
      existingCount: Object.keys(store.apps).length,
    }),
    railSide: options.side,
    viewport: viewportMeta(viewport),
    updatedAt: Date.now(),
  };
  const rect = clampOverlayRectToSafeArea(base, options.minWidth, options.minHeight, options.side);
  const record = {
    ...base,
    ...rect,
    railSide: options.side,
    viewport: viewportMeta(viewport),
  };
  if (!saved) {
    store.apps[options.appId] = record;
    void saveOverlayAppLayoutStore(store);
  }
  return record;
}

export async function saveOverlayAppLayout(options: SaveOptions): Promise<OverlayAppLayoutRecord> {
  const store = await loadOverlayAppLayoutStore();
  const viewport = getViewportRect();
  const record: OverlayAppLayoutRecord = {
    appId: options.appId,
    x: Math.round(options.rect.x),
    y: Math.round(options.rect.y),
    width: Math.round(options.rect.width),
    height: Math.round(options.rect.height),
    z: nextOverlayAppZ(),
    snap: options.snap || { kind: "free" },
    viewport: viewportMeta(viewport),
    railSide: options.side,
    updatedAt: Date.now(),
  };
  store.apps[options.appId] = record;
  await saveOverlayAppLayoutStore(store);
  return record;
}

export async function resetOverlayAppLayouts(): Promise<void> {
  storeCache = { version: 1, apps: {} };
  loadPromise = Promise.resolve(storeCache);
  await chrome.storage.local.set({ [OVERLAY_APP_LAYOUTS_KEY]: storeCache });
}

export function setOverlayAppStackOrder(order: readonly string[]): void {
  stackOrder = order.filter((id): id is string => typeof id === "string");
  applyOverlayAppStackOrder();
}

export function registerOverlayAppRoot(appId: string, root: HTMLElement): void {
  stackRoots.set(appId, root);
  root.dataset.milxdyOverlayAppId = appId;
  const z = zForOverlayApp(appId);
  if (z !== null) root.style.zIndex = String(z);
}

export function bringOverlayAppToFront(root: HTMLElement, appId?: string): number {
  if (appId) registerOverlayAppRoot(appId, root);
  const z = appId ? zForOverlayApp(appId) ?? nextOverlayAppZ() : nextOverlayAppZ();
  root.style.zIndex = String(z);
  return z;
}

export function clampOverlayRectToSafeArea(
  rect: OverlayRect,
  minWidth: number,
  minHeight: number,
  side: OverlayDockSide,
  protectedZones = snapshotOverlayProtectedZones(side),
): OverlayRect {
  const viewport = getViewportRect();
  const availableWidth = maxAvailableWidth(viewport, protectedZones, minWidth);
  const width = clampNumber(Math.round(rect.width), minWidth, availableWidth);
  const maxHeight = Math.max(minHeight, viewport.height - VIEWPORT_MARGIN_PX * 2);
  let height = clampNumber(Math.round(rect.height), minHeight, maxHeight);
  let candidate: OverlayRect = shrinkRectForVerticalOverflow({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width,
    height,
  }, minHeight, viewport);
  candidate = clampRectToViewport(candidate, viewport);
  candidate = resolveProtectedZoneOverlap(candidate, protectedZones);
  candidate = shrinkRectForVerticalOverflow(candidate, minHeight, viewport);
  return clampRectToViewport(candidate, viewport);
}

export function clampRectToViewport(rect: OverlayRect, viewport = getViewportRect()): OverlayRect {
  const maxX = viewport.x + viewport.width - Math.min(rect.width, viewport.width - VIEWPORT_MARGIN_PX * 2) - VIEWPORT_MARGIN_PX;
  const maxY = viewport.y + viewport.height - HEADER_RECOVERY_PX;
  return {
    ...rect,
    x: clampNumber(rect.x, viewport.x + VIEWPORT_MARGIN_PX, Math.max(viewport.x + VIEWPORT_MARGIN_PX, maxX)),
    y: clampNumber(rect.y, viewport.y + VIEWPORT_MARGIN_PX, Math.max(viewport.y + VIEWPORT_MARGIN_PX, maxY)),
  };
}

export function resolveProtectedZoneOverlap(rect: OverlayRect, zones: OverlayProtectedZone[]): OverlayRect {
  let next = { ...rect };
  for (const zone of zones) {
    if (!zone.hard || !rectsOverlap(next, zone.rect)) continue;
    if (zone.kind === "milxdyRail") {
      next = resolveHardZoneOverlap(next, zone.rect);
    }
  }
  return next;
}

function shrinkRectForVerticalOverflow(rect: OverlayRect, minHeight: number, viewport: OverlayViewportRect): OverlayRect {
  const topLimit = viewport.y + VIEWPORT_MARGIN_PX;
  const bottomLimit = viewport.y + viewport.height - VIEWPORT_MARGIN_PX;
  let next = { ...rect };
  if (next.y < topLimit && next.height > minHeight) {
    const shrink = Math.min(topLimit - next.y, next.height - minHeight);
    next = {
      ...next,
      y: topLimit,
      height: next.height - shrink,
    };
  }
  const bottomOverflow = next.y + next.height - bottomLimit;
  if (bottomOverflow > 0 && next.height > minHeight) {
    next = {
      ...next,
      height: next.height - Math.min(bottomOverflow, next.height - minHeight),
    };
  }
  return next;
}

export function snapRectToGuides(
  rect: OverlayRect,
  zones: OverlayProtectedZone[],
  options: { disabled?: boolean; commitThreshold?: number; showThreshold?: number } = {},
): OverlaySnapResult {
  if (options.disabled) return { rect, guides: [] };
  const commitThreshold = options.commitThreshold ?? SNAP_COMMIT_PX;
  const showThreshold = options.showThreshold ?? SNAP_SHOW_PX;
  const viewport = getViewportRect();
  const lines = guideLinesFromZones(zones, viewport);
  const result: OverlaySnapResult = { rect: { ...rect }, guides: [] };
  const edges = {
    left: rect.x,
    right: rect.x + rect.width,
    centerX: rect.x + rect.width / 2,
    top: rect.y,
    bottom: rect.y + rect.height,
    centerY: rect.y + rect.height / 2,
  };
  let bestX: { line: OverlayGuideLine; edge: keyof typeof edges; delta: number } | null = null;
  let bestY: { line: OverlayGuideLine; edge: keyof typeof edges; delta: number } | null = null;
  for (const line of lines) {
    const candidates = line.axis === "x"
      ? (["left", "right", "centerX"] as const)
      : (["top", "bottom", "centerY"] as const);
    for (const edge of candidates) {
      const delta = line.value - edges[edge];
      const abs = Math.abs(delta);
      const strongThreshold = line.kind === "milxdyRail" ? Math.max(showThreshold, RAIL_SNAP_PX) : showThreshold;
      if (abs > strongThreshold) continue;
      result.guides.push({ ...line, active: abs <= (line.kind === "milxdyRail" ? strongThreshold : commitThreshold) });
      if (abs > commitThreshold) continue;
      if (line.axis === "x" && (!bestX || abs < Math.abs(bestX.delta))) bestX = { line, edge, delta };
      if (line.axis === "y" && (!bestY || abs < Math.abs(bestY.delta))) bestY = { line, edge, delta };
    }
  }
  if (bestX) {
    result.rect.x += bestX.delta;
    result.snap = { kind: snapKind(bestX.line.kind), edge: bestX.edge, targetId: bestX.line.id };
  }
  if (bestY) {
    result.rect.y += bestY.delta;
    result.snap = { kind: snapKind(bestY.line.kind), edge: bestY.edge, targetId: bestY.line.id };
  }
  return result;
}

export function snapshotOverlayProtectedZones(side: OverlayDockSide, excludeAppId?: string): OverlayProtectedZone[] {
  const zones: OverlayProtectedZone[] = [];
  const railRect = measureMilxdyDockRect(side);
  if (railRect) {
    zones.push({
      id: "milxdyRail",
      kind: "milxdyRail",
      rect: railRect,
      hard: true,
      guideEdges: ["left", "right"],
    });
  } else {
    const viewport = getViewportRect();
    const height = Math.min(FALLBACK_RAIL_HEIGHT_PX, Math.max(120, viewport.height - 32));
    zones.push({
      id: "milxdyRailFallback",
      kind: "milxdyRail",
      rect: side === "left"
        ? { x: 8, y: 16, width: FALLBACK_RAIL_WIDTH_PX, height }
        : { x: viewport.x + viewport.width - 8 - FALLBACK_RAIL_WIDTH_PX, y: 16, width: FALLBACK_RAIL_WIDTH_PX, height },
      hard: true,
      guideEdges: ["left", "right"],
    });
  }
  zones.push(...detectHostRailZones());
  zones.push(...snapshotOpenAppGuideZones(excludeAppId));
  return zones;
}

export function renderOverlayGuideLines(guides: OverlayGuideLine[], forbiddenZones: OverlayProtectedZone[] = []): void {
  injectGuideStyles();
  const root = ensureGuideRoot();
  root.textContent = "";
  for (const zone of forbiddenZones.filter((zone) => zone.hard)) {
    const shade = document.createElement("div");
    shade.className = "milxdy-overlay-app-guide-forbidden";
    shade.style.left = `${zone.rect.x}px`;
    shade.style.top = `${zone.rect.y}px`;
    shade.style.width = `${zone.rect.width}px`;
    shade.style.height = `${zone.rect.height}px`;
    root.append(shade);
  }
  const unique = new Map<string, OverlayGuideLine>();
  for (const guide of guides) unique.set(`${guide.axis}:${Math.round(guide.value)}:${guide.kind}:${guide.active}`, guide);
  for (const guide of unique.values()) {
    const line = document.createElement("div");
    line.className = `milxdy-overlay-app-guide-line ${guide.active ? "is-active" : "is-passive"}`;
    line.dataset.axis = guide.axis;
    if (guide.axis === "x") line.style.left = `${Math.round(guide.value)}px`;
    else line.style.top = `${Math.round(guide.value)}px`;
    root.append(line);
  }
}

export function clearOverlayGuideLines(): void {
  document.getElementById(GUIDE_ROOT_ID)?.remove();
}

function defaultRectForApp(options: {
  side: OverlayDockSide;
  width: number;
  height: number;
  y: number;
  minWidth: number;
  minHeight: number;
  existingCount: number;
}): OverlayRect {
  const viewport = getViewportRect();
  const width = clampNumber(options.width, options.minWidth, Math.max(options.minWidth, viewport.width - VIEWPORT_MARGIN_PX * 2));
  const height = clampNumber(options.height, options.minHeight, Math.max(options.minHeight, viewport.height - 24));
  const stagger = Math.min(96, options.existingCount * 24);
  const zones = snapshotOverlayProtectedZones(options.side);
  const rail = zones.find((zone) => zone.kind === "milxdyRail" && zone.hard);
  const x = options.side === "left" && rail
    ? rail.rect.x + rail.rect.width + RAIL_GAP_PX + stagger
    : options.side === "right" && rail
      ? rail.rect.x - width - RAIL_GAP_PX - stagger
      : options.side === "left"
        ? VIEWPORT_MARGIN_PX + stagger
        : viewport.x + viewport.width - width - VIEWPORT_MARGIN_PX - stagger;
  return clampOverlayRectToSafeArea({ x, y: options.y + stagger, width, height }, options.minWidth, options.minHeight, options.side, zones);
}

async function loadOverlayAppLayoutStore(): Promise<OverlayAppLayoutStoreV1> {
  if (storeCache) return storeCache;
  if (loadPromise) return loadPromise;
  loadPromise = chrome.storage.local.get({ [OVERLAY_APP_LAYOUTS_KEY]: { version: 1, apps: {} } })
    .then((stored) => {
      storeCache = normalizeStore(stored[OVERLAY_APP_LAYOUTS_KEY]);
      return storeCache;
    })
    .catch(() => {
      storeCache = { version: 1, apps: {} };
      return storeCache;
    });
  return loadPromise;
}

async function saveOverlayAppLayoutStore(store: OverlayAppLayoutStoreV1): Promise<void> {
  storeCache = store;
  loadPromise = Promise.resolve(store);
  await chrome.storage.local.set({ [OVERLAY_APP_LAYOUTS_KEY]: store });
}

function normalizeStore(value: unknown): OverlayAppLayoutStoreV1 {
  const input = value && typeof value === "object" ? value as { apps?: unknown } : {};
  const apps: Record<string, OverlayAppLayoutRecord> = {};
  if (input.apps && typeof input.apps === "object") {
    for (const [appId, record] of Object.entries(input.apps as Record<string, unknown>)) {
      const normalized = normalizeLayoutRecord(record, appId);
      if (normalized) apps[appId] = normalized;
    }
  }
  return { version: 1, apps };
}

function normalizeLayoutRecord(value: unknown, appId: string): OverlayAppLayoutRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const x = finiteNumber(record.x);
  const y = finiteNumber(record.y);
  const width = finiteNumber(record.width);
  const height = finiteNumber(record.height);
  if (x === null || y === null || width === null || height === null || width < 80 || height < 80) return null;
  const viewport = record.viewport && typeof record.viewport === "object" ? record.viewport as Record<string, unknown> : {};
  const viewportWidth = finiteNumber(viewport.width) ?? getViewportRect().width;
  const viewportHeight = finiteNumber(viewport.height) ?? getViewportRect().height;
  return {
    appId,
    x,
    y,
    width,
    height,
    z: finiteNumber(record.z) ?? undefined,
    snap: normalizeSnap(record.snap),
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
      scale: finiteNumber(viewport.scale) ?? undefined,
    },
    railSide: record.railSide === "left" ? "left" : "right",
    updatedAt: finiteNumber(record.updatedAt) ?? Date.now(),
  };
}

function normalizeSnap(value: unknown): OverlayAppSnapRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== "free" && kind !== "milxdyRail" && kind !== "hostRail" && kind !== "viewport" && kind !== "app") return undefined;
  return {
    kind,
    edge: typeof record.edge === "string" ? record.edge as OverlayAppSnapRecord["edge"] : undefined,
    targetId: typeof record.targetId === "string" ? record.targetId : undefined,
  };
}

function viewportMeta(viewport: OverlayViewportRect): OverlayAppLayoutRecord["viewport"] {
  return { width: viewport.width, height: viewport.height, scale: viewport.scale };
}

function applyOverlayAppStackOrder(): void {
  for (const [appId, root] of Array.from(stackRoots.entries())) {
    if (!root.isConnected) {
      stackRoots.delete(appId);
      continue;
    }
    const z = zForOverlayApp(appId);
    if (z !== null) root.style.zIndex = String(z);
  }
}

function zForOverlayApp(appId: string): number | null {
  const index = stackOrder.indexOf(appId);
  if (index < 0) return null;
  return STACK_Z_BASE + (stackOrder.length - index) * STACK_Z_STEP;
}

function maxAvailableWidth(viewport: OverlayViewportRect, zones: OverlayProtectedZone[], minWidth: number): number {
  const rail = zones.find((zone) => zone.kind === "milxdyRail" && zone.hard);
  if (!rail) return Math.max(minWidth, viewport.width - VIEWPORT_MARGIN_PX * 2);
  const leftSpace = Math.max(0, rail.rect.x - viewport.x - RAIL_GAP_PX - VIEWPORT_MARGIN_PX);
  const rightSpace = Math.max(0, viewport.x + viewport.width - (rail.rect.x + rail.rect.width) - RAIL_GAP_PX - VIEWPORT_MARGIN_PX);
  return Math.max(minWidth, Math.floor(Math.max(leftSpace, rightSpace)));
}

function measureMilxdyDockRect(side: OverlayDockSide): OverlayRect | null {
  const root = document.getElementById("milxdy-overlay-dock-root");
  if (!root) return null;
  const parts = Array.from(root.querySelectorAll<HTMLElement>(".milxdy-overlay-dock-rail, .milxdy-overlay-dock-settings"))
    .map((element) => rectFromElement(element))
    .filter((rect): rect is OverlayRect => Boolean(rect));
  if (!parts.length) return rectFromElement(root);
  return unionRects(parts, side);
}

function unionRects(rects: OverlayRect[], side: OverlayDockSide): OverlayRect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  const rect = {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
  if (rects.length > 1) return rect;
  const rail = rects[0];
  return side === "left"
    ? { ...rail, width: Math.max(rail.width, rect.width) }
    : { ...rail, x: Math.min(rail.x, rect.x), width: Math.max(rail.width, rect.width) };
}

function guideLinesFromZones(zones: OverlayProtectedZone[], viewport: OverlayViewportRect): OverlayGuideLine[] {
  const lines: OverlayGuideLine[] = [
    { id: "viewportLeft", axis: "x", value: viewport.x + VIEWPORT_MARGIN_PX, kind: "viewport" },
    { id: "viewportRight", axis: "x", value: viewport.x + viewport.width - VIEWPORT_MARGIN_PX, kind: "viewport" },
    { id: "viewportTop", axis: "y", value: viewport.y + VIEWPORT_MARGIN_PX, kind: "viewport" },
    { id: "viewportBottom", axis: "y", value: viewport.y + viewport.height - VIEWPORT_MARGIN_PX, kind: "viewport" },
  ];
  for (const zone of zones) {
    if (zone.kind === "milxdyRail") {
      lines.push(
        { id: `${zone.id}:safeLeft`, axis: "x", value: zone.rect.x - RAIL_GAP_PX, kind: zone.kind },
        { id: `${zone.id}:safeRight`, axis: "x", value: zone.rect.x + zone.rect.width + RAIL_GAP_PX, kind: zone.kind },
      );
      continue;
    }
    for (const edge of zone.guideEdges) {
      const value = edge === "left" ? zone.rect.x
        : edge === "right" ? zone.rect.x + zone.rect.width
        : edge === "top" ? zone.rect.y
        : edge === "bottom" ? zone.rect.y + zone.rect.height
        : edge === "centerX" ? zone.rect.x + zone.rect.width / 2
        : zone.rect.y + zone.rect.height / 2;
      lines.push({
        id: `${zone.id}:${edge}`,
        axis: edge === "top" || edge === "bottom" || edge === "centerY" ? "y" : "x",
        value,
        kind: zone.kind,
      });
    }
  }
  return lines;
}

function detectHostRailZones(): OverlayProtectedZone[] {
  const viewport = getViewportRect();
  const candidates = new Set<HTMLElement>();
  for (const selector of [
    'header[role="banner"]',
    'aside[role="complementary"]',
    '[data-testid="sidebarColumn"]',
    '[data-testid="SideNav_AccountSwitcher_Button"]',
    '[data-testid="AppTabBar_Home_Link"]',
    '[data-testid="primaryColumn"]',
  ]) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      candidates.add(railCandidateRoot(element));
    }
  }
  let leftRail: OverlayRect | null = null;
  let rightRail: OverlayRect | null = null;
  for (const element of candidates) {
    const rect = clippedRectToViewport(rectFromElement(element), viewport);
    if (!rect || !looksLikeHostRail(rect, viewport)) continue;
    const centerX = rect.x + rect.width / 2;
    const nearLeft = rect.x <= viewport.x + 96 || centerX < viewport.x + viewport.width * 0.34;
    const nearRight = rect.x >= viewport.x + viewport.width * 0.56 || centerX > viewport.x + viewport.width * 0.66;
    if (nearLeft) leftRail = betterRailRect(leftRail, rect, "left", viewport);
    else if (nearRight) rightRail = betterRailRect(rightRail, rect, "right", viewport);
  }
  const zones: OverlayProtectedZone[] = [];
  if (leftRail) zones.push({ id: "hostLeftRail", kind: "hostLeftRail", rect: leftRail, hard: false, guideEdges: ["left", "right", "centerX"] });
  if (rightRail) zones.push({ id: "hostRightRail", kind: "hostRightRail", rect: rightRail, hard: false, guideEdges: ["left", "right", "centerX"] });
  zones.push(...detectHostBackgroundRailZones(viewport, zones));
  return zones;
}

function snapshotOpenAppGuideZones(excludeAppId?: string): OverlayProtectedZone[] {
  const viewport = getViewportRect();
  const zones: OverlayProtectedZone[] = [];
  for (const [appId, root] of Array.from(stackRoots.entries())) {
    if (appId === excludeAppId || !root.isConnected) continue;
    const rect = clippedRectToViewport(rectFromElement(root), viewport);
    if (!rect || rect.width < 48 || rect.height < 48) continue;
    zones.push({
      id: `app:${appId}`,
      kind: "app",
      rect,
      hard: false,
      guideEdges: ["left", "right", "top", "bottom"],
    });
  }
  return zones;
}

function detectHostBackgroundRailZones(viewport: OverlayViewportRect, existing: OverlayProtectedZone[]): OverlayProtectedZone[] {
  const primary = clippedRectToViewport(rectFromElement(document.querySelector('[data-testid="primaryColumn"]')), viewport);
  const sidebar = clippedRectToViewport(rectFromElement(document.querySelector('[data-testid="sidebarColumn"]')), viewport);
  if (!primary && !sidebar) return [];
  const zones: OverlayProtectedZone[] = [];
  const greenLayer = findHostGreenBackgroundLayer(viewport, primary, sidebar);
  if (greenLayer && sidebar) {
    const left = Math.max(primary ? primary.x + primary.width : sidebar.x, greenLayer.x);
    const right = greenLayer.x + greenLayer.width;
    if (right - left >= 64 && !hasSimilarZone(existing, left, right)) {
      zones.push({
        id: "hostRightRailBackground",
        kind: "hostRightRail",
        rect: { x: left, y: greenLayer.y, width: right - left, height: greenLayer.height },
        hard: false,
        guideEdges: ["left", "right", "centerX"],
      });
    }
  }
  if (greenLayer && primary) {
    const left = greenLayer.x;
    const right = primary.x;
    if (right - left >= 64 && !hasSimilarZone(existing, left, right)) {
      zones.push({
        id: "hostLeftRailBackground",
        kind: "hostLeftRail",
        rect: { x: left, y: greenLayer.y, width: right - left, height: greenLayer.height },
        hard: false,
        guideEdges: ["left", "right", "centerX"],
      });
    }
  }
  return zones;
}

function findHostGreenBackgroundLayer(
  viewport: OverlayViewportRect,
  primary: OverlayRect | null,
  sidebar: OverlayRect | null,
): OverlayRect | null {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('main, main *, [role="main"], [role="main"] *'));
  let best: OverlayRect | null = null;
  let bestScore = -Infinity;
  for (const element of roots) {
    const style = getComputedStyle(element);
    if (!hasGreenishBackground(style)) continue;
    const rect = clippedRectToViewport(rectFromElement(element), viewport);
    if (!rect || rect.height < viewport.height * 0.36 || rect.width < 160) continue;
    if (rect.width > viewport.width * 0.82) continue;
    if (primary && !rectContainsHorizontal(rect, primary, 12)) continue;
    if (sidebar && !rectContainsHorizontal(rect, sidebar, 12)) continue;
    const rightEdgeBonus = sidebar ? Math.max(0, rect.x + rect.width - (sidebar.x + sidebar.width)) : 0;
    const score = rect.height * 2 + rightEdgeBonus - rect.width * 0.08;
    if (score > bestScore) {
      best = rect;
      bestScore = score;
    }
  }
  return best;
}

function hasGreenishBackground(style: CSSStyleDeclaration): boolean {
  return isGreenishCssColor(style.backgroundColor) || isGreenishCssColor(style.backgroundImage);
}

function isGreenishCssColor(value: string): boolean {
  const text = String(value);
  for (const match of text.matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/g)) {
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    const alpha = match[4] == null ? 1 : Number(match[4]);
    if (alpha > 0.08 && green >= red + 8 && green >= blue + 8 && green > 120) return true;
  }
  for (const match of text.matchAll(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/g)) {
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    const alpha = match[4] == null ? 1 : Number(match[4]);
    if (alpha > 0.08 && green >= red + 0.03 && green >= blue + 0.03 && green > 0.47) return true;
  }
  return false;
}

function rectContainsHorizontal(container: OverlayRect, child: OverlayRect, tolerance: number): boolean {
  return container.x <= child.x + tolerance && container.x + container.width >= child.x + child.width - tolerance;
}

function hasSimilarZone(zones: OverlayProtectedZone[], left: number, right: number): boolean {
  return zones.some((zone) => Math.abs(zone.rect.x - left) <= 12 && Math.abs(zone.rect.x + zone.rect.width - right) <= 12);
}

function railCandidateRoot(element: HTMLElement): HTMLElement {
  const navRoot = element.closest<HTMLElement>('header[role="banner"], aside[role="complementary"], [data-testid="sidebarColumn"], [data-testid="primaryColumn"]');
  return navRoot || element;
}

function looksLikeHostRail(rect: OverlayRect, viewport: OverlayViewportRect): boolean {
  if (rect.height < viewport.height * 0.36) return false;
  if (rect.width < 64) return false;
  if (rect.width > Math.min(540, viewport.width * 0.48)) return false;
  return true;
}

function betterRailRect(current: OverlayRect | null, next: OverlayRect, side: "left" | "right", viewport: OverlayViewportRect): OverlayRect {
  if (!current) return next;
  const currentScore = railRectScore(current, side, viewport);
  const nextScore = railRectScore(next, side, viewport);
  return nextScore > currentScore ? next : current;
}

function railRectScore(rect: OverlayRect, side: "left" | "right", viewport: OverlayViewportRect): number {
  const edgeDistance = side === "left"
    ? Math.abs(rect.x - viewport.x)
    : Math.abs(viewport.x + viewport.width - (rect.x + rect.width));
  return rect.height * 3 + rect.width - edgeDistance * 2;
}

function clippedRectToViewport(rect: OverlayRect | null, viewport: OverlayViewportRect): OverlayRect | null {
  if (!rect) return null;
  const left = Math.max(rect.x, viewport.x);
  const top = Math.max(rect.y, viewport.y);
  const right = Math.min(rect.x + rect.width, viewport.x + viewport.width);
  const bottom = Math.min(rect.y + rect.height, viewport.y + viewport.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

function resolveHardZoneOverlap(rect: OverlayRect, zone: OverlayRect): OverlayRect {
  const candidates = [
    { ...rect, x: zone.x - rect.width - RAIL_GAP_PX },
    { ...rect, x: zone.x + zone.width + RAIL_GAP_PX },
    { ...rect, y: zone.y - rect.height - RAIL_GAP_PX },
    { ...rect, y: zone.y + zone.height + RAIL_GAP_PX },
  ];
  const viewport = getViewportRect();
  const viable = candidates
    .map((candidate) => clampRectToViewport(candidate, viewport))
    .filter((candidate) => !rectsOverlap(candidate, zone));
  const pool = viable.length ? viable : candidates.map((candidate) => clampRectToViewport(candidate, viewport));
  return pool.sort((a, b) => rectDistance(a, rect) - rectDistance(b, rect))[0] || rect;
}

function rectDistance(a: OverlayRect, b: OverlayRect): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function ensureGuideRoot(): HTMLElement {
  let root = document.getElementById(GUIDE_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = GUIDE_ROOT_ID;
    document.documentElement.append(root);
  }
  return root;
}

function injectGuideStyles(): void {
  if (document.getElementById(GUIDE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GUIDE_STYLE_ID;
  style.textContent = `
    #${GUIDE_ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      contain: strict;
    }
    .milxdy-overlay-app-guide-line {
      position: fixed;
      background: rgba(255, 255, 255, 0.62);
      pointer-events: none;
    }
    .milxdy-overlay-app-guide-line[data-axis="x"] {
      top: 0;
      bottom: 0;
      width: 1px;
    }
    .milxdy-overlay-app-guide-line[data-axis="y"] {
      left: 0;
      right: 0;
      height: 1px;
    }
    .milxdy-overlay-app-guide-line.is-active {
      background: #ff4b4b;
      box-shadow: 0 0 0 1px rgba(255, 75, 75, 0.28);
    }
    .milxdy-overlay-app-guide-forbidden {
      position: fixed;
      background: rgba(255, 75, 75, 0.16);
      outline: 1px solid rgba(255, 75, 75, 0.72);
    }
    html[data-milxdy-x-theme="light"] .milxdy-overlay-app-guide-line.is-passive,
    html[data-milxdy-settings-theme="light"] .milxdy-overlay-app-guide-line.is-passive {
      background: rgba(20, 24, 36, 0.45);
    }
  `;
  document.documentElement.append(style);
}

function rectFromElement(element: Element | null | undefined): OverlayRect | null {
  if (!element?.isConnected) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.right < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) return null;
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function rectsOverlap(a: OverlayRect, b: OverlayRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function snapKind(kind: OverlayGuideLine["kind"]): OverlayAppSnapRecord["kind"] {
  if (kind === "milxdyRail") return "milxdyRail";
  if (kind === "hostLeftRail" || kind === "hostRightRail") return "hostRail";
  if (kind === "viewport") return "viewport";
  return "app";
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function nextOverlayAppZ(): number {
  zCounter += 1;
  return zCounter;
}
