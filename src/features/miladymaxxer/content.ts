import { DEFAULT_SETTINGS, DEFAULT_STATS, DEFAULT_PLAYER_STATS } from "./shared/constants";
import { getLevel, getLevelProgress, getPlayerLevel, getPlayerLevelProgress } from "./shared/levels";
import { normalizeProfileImageUrl } from "./shared/image-core";
import {
  loadCollectedAvatars,
  loadMatchedAccounts,
  loadPlayerStats,
  loadSettings,
  loadStats,
  migrateLegacyStorageToScope,
  normalizeAccountScope,
  normalizeCollectedAvatars,
  normalizeHandle,
  normalizeMatchedAccounts,
  normalizeStats,
  normalizeWhitelistHandles,
  saveActiveAccountScope,
  saveCollectedAvatars,
  saveMatchedAccounts,
  savePlayerStats,
  saveStats,
  storageKeyForScope,
} from "./shared/storage";
import type {
  CollectedAvatarMap,
  DetectionResult,
  DetectionStats,
  ExtensionSettings,
  MatchedAccountMap,
  PlayerStats,
} from "./shared/types";
import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../shared/overlayAppChrome";

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
  initializeSurfaceSoundRuntime,
  observeIncomingMessages,
  handleIncomingMessageSurface,
  syncIncomingMessageRoute,
  initializeSoundRuntime,
  playCatchSound,
  playLevelUpSound,
} from "./sounds";
import { injectStyles } from "./styles";
import type { TwitterSurface } from "../../shared/twitterScanner";
import { safeRuntimeMessage } from "../../shared/extensionRuntime";
import { recordFeatureTiming } from "../../shared/performanceDiagnostics";
import {
  createOverlayAppFrame,
  OVERLAY_APP_RESERVED_WIDTH_PX,
  type OverlayAppFrame,
} from "../../shared/overlayAppFrame";
import { createFallbackRuntimeScheduler } from "../../shared/runtimeScheduler";
import {
  clampOverlayPanelBox,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
  startOverlayPanelResize,
} from "../../shared/overlayPanelBase";
import type { AppRuntimeScheduler, MilxdyContentAppContext, MilxdyRouteChange } from "../../shared/appPlatform";
import type { OverlayDockSide } from "../../shared/overlayDock";
import { registerOverlayAppRoot } from "../../shared/overlayAppLayout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VISIBILITY_ROOT_MARGIN = 900;
const IDLE_PROCESS_TIMEOUT_MS = 1500;
const MAX_SURFACES_PER_IDLE = 3;
const MAXXER_PANEL_ID = "milxdy-miladymaxxer-panel";
const RESKIN_PROFILE_KEY = "milxdy.settings.reskinProfile";
const VISUAL_THEME_KEY = "milxdy.settings.visualTheme";
const MAXXER_PANEL_MIN_WIDTH = 320;
const MAXXER_PANEL_MIN_HEIGHT = 260;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const processed = new WeakMap<HTMLElement, string>();
const processedNotifications = new WeakMap<HTMLElement, string>();
const remiStatsBeetleCache = new Map<string, Promise<boolean>>();

let settings: ExtensionSettings = DEFAULT_SETTINGS;
let scanScheduled = false;
let stats: DetectionStats | null = null;
let matchedAccounts: MatchedAccountMap | null = null;
let collectedAvatars: CollectedAvatarMap | null = null;
let playerStats: PlayerStats = DEFAULT_PLAYER_STATS;
let accountScope: string | null = null;
let maxxerAppFrame: OverlayAppFrame | null = null;
let maxxerPanelRoot: HTMLElement | null = null;
let maxxerPanelSide: OverlayDockSide = "left";
let maxxerPanelX = 104;
let maxxerPanelTop = 16;
let maxxerPanelWidth = 380;
let maxxerPanelHeight = 640;
let maxxerPanelLayoutReady = false;
let maxxerPanelSort: "level" | "recent" = "level";
let maxxerPanelSearch = "";
let localStateWriteScheduled = false;
let playerStatsWriteScheduled = false;
let selfHandle: string | null = null;
const creditedReplies = new WeakSet<HTMLElement>();
const maxxerMutatedElements = new Set<HTMLElement>();
const maxxerElementsByHandle = new Map<string, Set<HTMLElement>>();
let queuedElements = new WeakSet<HTMLElement>();
type SurfaceWork = () => Promise<void> | void;
let deferredVisibleWork = new WeakMap<HTMLElement, SurfaceWork>();
const idleWorkQueue: Array<{ element: HTMLElement; work: SurfaceWork }> = [];
let idleDrainScheduled = false;
let idleDrainPausedForVisibility = false;
let cancelIdleDrain: (() => void) | null = null;
let visibilityObserver: IntersectionObserver | null = null;
let booted = false;
let runtimeScheduleScan: () => void = () => undefined;
const recoveryTimers = new Set<() => void>();
let cancelScheduledScan: (() => void) | null = null;
let cancelVisualRefresh: (() => void) | null = null;
let visualRefreshScheduled = false;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;
let lifecycleSignal: AbortSignal | null = null;
let runtimeSendMessage: MilxdyContentAppContext["sendMessage"] = (message) => safeRuntimeMessage(message);
let runtimeScheduler: AppRuntimeScheduler = createFallbackRuntimeScheduler({
  idleTimeoutMs: IDLE_PROCESS_TIMEOUT_MS,
  timeoutFallbackMs: 120,
});

// ---------------------------------------------------------------------------
// Effects context â€” wires effects module to our shared state
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

export async function boot(context?: MilxdyContentAppContext): Promise<void> {
  if (booted) return;
  booted = true;
  runtimeScheduleScan = context?.scheduleScan || runtimeScheduleScan;
  runtimeScheduler = context?.scheduler || runtimeScheduler;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  lifecycleSignal = context?.signal || null;
  runtimeSendMessage = context?.sendMessage || ((message) => safeRuntimeMessage(message));
  const bootSignal = lifecycleSignal;
  bootSignal?.addEventListener("abort", disableMaxxerRuntime, { once: true });
  addRuntimeDisposable(() => bootSignal?.removeEventListener("abort", disableMaxxerRuntime));
  injectStyles();
  ensureOverlayAppChromeStyles();
  accountScope = resolveSelfHandle();
  if (accountScope) {
    await migrateLegacyStorageToScope(accountScope);
    void saveActiveAccountScope(accountScope);
  }
  settings = await loadSettings();
  await loadAccountState(accountScope);
  if (!lifecycleActive()) return;
  setSoundSettings(settings);
  prevPlayerLevel = getPlayerLevel(playerStats.totalLikesGiven);
  registerMaxxerDockApp();
  observeRemiNetPokeCredits();
  observeStorage();
  const resizeListener = () => {
    applyMaxxerPanelLayout();
    updatePlayerLevelBadge();
  };
  window.addEventListener("resize", resizeListener, { passive: true });
  addRuntimeDisposable(() => window.removeEventListener("resize", resizeListener));
  const visibilityListener = () => {
    if (!document.hidden && idleDrainPausedForVisibility) {
      idleDrainPausedForVisibility = false;
      scheduleIdleDrain();
    }
  };
  document.addEventListener("visibilitychange", visibilityListener, { passive: true });
  addRuntimeDisposable(() => document.removeEventListener("visibilitychange", visibilityListener));
  runtimeScheduleScan();
  initializeSurfaceSoundRuntime(addRuntimeDisposable);
  attachPostButtonSound(addRuntimeDisposable);
  initializeSoundRuntime(addRuntimeDisposable);
  attachDMSounds(addRuntimeDisposable);
  attachGlobalMediaHoverSounds(addRuntimeDisposable);
  updatePlayerLevelBadge();
  void processProfilePage();
  scheduleRouteRecoveryPasses();
  observeIncomingMessages(addRuntimeDisposable);
}

function scheduleRouteRecoveryPasses(): void {
  clearRecoveryTimers();
  for (const delayMs of routeRecoveryDelays()) {
    let cancelTimer: (() => void) | null = null;
    cancelTimer = runtimeScheduler.timeout(() => {
      if (cancelTimer) recoveryTimers.delete(cancelTimer);
      if (!maxxerSurfaceActive() || document.hidden) return;
      updatePlayerLevelBadge();
      void processProfilePage();
      runtimeScheduleScan();
    }, delayMs);
    recoveryTimers.add(cancelTimer);
  }
}

function performanceMode(): string {
  return document.documentElement.dataset.milxdyPerformanceMode || "balanced";
}

function routeRecoveryDelays(): number[] {
  const mode = performanceMode();
  if (mode === "fast") return [];
  if (mode === "balanced") return [700];
  if (mode === "full") return [300, 1200];
  return [250, 1000, 2500];
}

function maxSurfacesPerIdle(): number {
  const mode = performanceMode();
  if (mode === "fast") return 1;
  if (mode === "balanced") return 2;
  if (mode === "full") return 4;
  return MAX_SURFACES_PER_IDLE;
}

function visibilityRootMargin(): number {
  const mode = performanceMode();
  if (mode === "fast") return 180;
  if (mode === "balanced") return 520;
  if (mode === "full") return 900;
  return VISIBILITY_ROOT_MARGIN;
}

function clearRecoveryTimers(): void {
  for (const cancelTimer of recoveryTimers) cancelTimer();
  recoveryTimers.clear();
}

function clearScheduledScan(): void {
  cancelScheduledScan?.();
  cancelScheduledScan = null;
  scanScheduled = false;
}

function clearScheduledVisualRefresh(): void {
  cancelVisualRefresh?.();
  cancelVisualRefresh = null;
  visualRefreshScheduled = false;
}

function scheduleVisualRefresh(): void {
  if (visualRefreshScheduled) return;
  visualRefreshScheduled = true;
  cancelVisualRefresh = runtimeScheduler.timeout(() => {
    cancelVisualRefresh = null;
    visualRefreshScheduled = false;
    if (!lifecycleActive()) return;
    if (!maxxerSurfaceActive()) {
      disableMaxxerRuntime();
      return;
    }
    scheduleProcessVisibleTweets();
    updatePlayerLevelBadge();
  }, 250);
}

function trackMaxxerElement(element: HTMLElement | null | undefined): void {
  if (element) maxxerMutatedElements.add(element);
}

function forgetMaxxerElement(element: HTMLElement): void {
  maxxerMutatedElements.delete(element);
}

function setMaxxerElementHandle(element: HTMLElement, handle: string | null | undefined): void {
  const previousHandle = element.dataset.miladymaxxerHandle;
  if (previousHandle && previousHandle !== handle) {
    const previousElements = maxxerElementsByHandle.get(previousHandle);
    previousElements?.delete(element);
    if (previousElements?.size === 0) maxxerElementsByHandle.delete(previousHandle);
  }

  if (!handle) {
    delete element.dataset.miladymaxxerHandle;
    return;
  }

  element.dataset.miladymaxxerHandle = handle;
  let elements = maxxerElementsByHandle.get(handle);
  if (!elements) {
    elements = new Set();
    maxxerElementsByHandle.set(handle, elements);
  }
  elements.add(element);
}

function maxxerElementsForHandle(handle: string): HTMLElement[] {
  const elements = maxxerElementsByHandle.get(handle);
  if (!elements) return [];

  const connected: HTMLElement[] = [];
  for (const element of Array.from(elements)) {
    if (!element.isConnected || element.dataset.miladymaxxerHandle !== handle) {
      elements.delete(element);
      continue;
    }
    connected.push(element);
  }
  if (elements.size === 0) maxxerElementsByHandle.delete(handle);
  return connected;
}

export function onSurface(surface: TwitterSurface): void {
  if (!lifecycleActive()) return;
  if (isMaxxerDisabled()) {
    clearMaxxerSurface(surface.element);
    return;
  }
  if (surface.kind === "tweet") processWhenVisible(surface.element, () => processTweet(surface.element));
  if (surface.kind === "userCell") processWhenVisible(surface.element, () => processUserCell(surface.element));
  if (surface.kind === "notification") void processNotificationGroup(surface.element);
  if (surface.kind === "directMessage") {
    handleIncomingMessageSurface(surface.element);
    processWhenVisible(surface.element, () => processDirectMessage(surface.element));
  }
  if (surface.kind === "profile") scheduleIdleWork(surface.element, () => processProfilePage());
}

export function onRouteChange(_route: MilxdyRouteChange): void {
  if (!lifecycleActive()) return;
  void syncAccountScope();
  syncIncomingMessageRoute();
  runtimeScheduleScan();
  updatePlayerLevelBadge();
  void processProfilePage();
  scheduleRouteRecoveryPasses();
}

export function disable(): void {
  clearRecoveryTimers();
  clearScheduledScan();
  clearScheduledVisualRefresh();
  disableMaxxerRuntime();
  closeMaxxerPanel();
}

export function open(): void {
  if (!lifecycleActive()) return;
  ensureMaxxerPanel();
  renderMaxxerPanel();
  applyMaxxerPanelLayout();
  updateMaxxerDockState();
}

export function close(): void {
  closeMaxxerPanel();
}

export function dispose(): void {
  disable();
  clearRecoveryTimers();
  clearScheduledScan();
  clearScheduledVisualRefresh();
  maxxerAppFrame?.remove();
  maxxerAppFrame = null;
  addRuntimeDisposable = () => undefined;
  lifecycleSignal = null;
  runtimeSendMessage = (message) => safeRuntimeMessage(message);
  booted = false;
}

function registerMaxxerDockApp(): void {
  maxxerAppFrame = createOverlayAppFrame({
    id: "miladymaxxer",
    label: "Milady Maxxer",
    icon: chrome.runtime.getURL("milady-logo.png"),
    title: "Milady Maxxer stats",
    isOpen: () => Boolean(maxxerPanelRoot?.isConnected),
    onOpen: () => {
      ensureMaxxerPanel();
      renderMaxxerPanel();
      applyMaxxerPanelLayout();
      updateMaxxerDockState();
    },
    onClose: () => closeMaxxerPanel(),
    onSideChange: (side) => {
      maxxerPanelSide = side;
      applyMaxxerPanelLayout();
    },
  });
  updateMaxxerDockState();
}

function ensureMaxxerPanel(): HTMLElement {
  let root = maxxerPanelRoot;
  if (root?.isConnected) return root;
  root = document.getElementById(MAXXER_PANEL_ID) as HTMLElement | null;
  if (!root) {
    root = document.createElement("aside");
    root.id = MAXXER_PANEL_ID;
    root.className = "miladymaxxer-panel milxdy-overlay-app-shell milxdy-overlay-app-card";
    prepareOverlayAppRoot(root);
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "Milady Maxxer stats");
    root.addEventListener("click", handleMaxxerPanelClick);
    root.addEventListener("input", handleMaxxerPanelInput);
  } else {
    root.classList.add("milxdy-overlay-app-shell", "milxdy-overlay-app-card");
  }
  maxxerPanelRoot = root;
  document.documentElement.append(root);
  root.hidden = false;
  root.style.removeProperty("display");
  root.dataset.open = "true";
  void restoreMaxxerPanelLayout();
  applyMaxxerPanelLayout();
  return root;
}

function closeMaxxerPanel(): void {
  const root = maxxerPanelRoot;
  if (root) delete root.dataset.open;
  maxxerPanelRoot = null;
  updateMaxxerDockState();
  animateOverlayAppClose(root, () => root?.remove());
}

function applyMaxxerPanelLayout(): void {
  const root = maxxerPanelRoot;
  if (!root) return;
  registerOverlayAppRoot("miladymaxxer", root);
  root.dataset.side = maxxerPanelSide;
  root.style.maxWidth = `calc(100vw - ${OVERLAY_APP_RESERVED_WIDTH_PX}px)`;
  root.style.minWidth = `${MAXXER_PANEL_MIN_WIDTH}px`;
  const box = clampOverlayPanelBox(
    { x: maxxerPanelX, width: maxxerPanelWidth, height: maxxerPanelHeight, topOffset: maxxerPanelTop },
    { minWidth: MAXXER_PANEL_MIN_WIDTH, minHeight: MAXXER_PANEL_MIN_HEIGHT, dockSide: maxxerPanelSide },
  );
  maxxerPanelX = box.x ?? maxxerPanelX;
  maxxerPanelTop = box.topOffset;
  maxxerPanelWidth = box.width;
  maxxerPanelHeight = box.height;
  root.style.left = `${maxxerPanelX}px`;
  root.style.right = "auto";
  root.style.top = `${maxxerPanelTop}px`;
  root.style.width = `${maxxerPanelWidth}px`;
  root.style.height = `${maxxerPanelHeight}px`;
  root.style.maxHeight = `${maxxerPanelHeight}px`;
  markOverlayAppLayoutReady(root, maxxerPanelLayoutReady);
}

async function restoreMaxxerPanelLayout(): Promise<void> {
  const layout = await restoreOverlayPanelBox("miladymaxxer", {
    side: maxxerPanelSide,
    minWidth: MAXXER_PANEL_MIN_WIDTH,
    minHeight: MAXXER_PANEL_MIN_HEIGHT,
    defaultWidth: maxxerPanelWidth,
    defaultHeight: maxxerPanelHeight,
  });
  maxxerPanelX = layout.x ?? maxxerPanelX;
  maxxerPanelTop = layout.topOffset;
  maxxerPanelWidth = layout.width;
  maxxerPanelHeight = layout.height;
  maxxerPanelLayoutReady = true;
  applyMaxxerPanelLayout();
}

function updateMaxxerDockState(): void {
  if (!maxxerAppFrame) return;
  const progress = getPlayerLevelProgress(playerStats.totalLikesGiven);
  const caught = caughtAccounts().length;
  maxxerAppFrame.updateDock({
    active: Boolean(maxxerPanelRoot?.isConnected),
    badgeText: progress.level > 0 ? `Lv${progress.level}` : caught > 0 ? String(caught) : "",
    title: `Milady Maxxer: Lv.${progress.level} - ${formatNumber(caught)} caught`,
  });
}

function renderMaxxerPanel(): void {
  const root = maxxerPanelRoot;
  if (!root?.isConnected) return;
  const player = getPlayerLevelProgress(playerStats.totalLikesGiven);
  const caught = caughtAccounts();
  const seen = Object.keys(matchedAccounts ?? {}).length;
  const avatars = Object.values(collectedAvatars ?? {});
  const totalSightings = avatars.reduce((total, avatar) => total + avatar.seenCount, 0);
  const topFive = [...caught].sort(compareMaxxerAccountsByLevel).slice(0, 5);
  const recentFive = [...caught].sort(compareMaxxerAccountsByRecent).slice(0, 5);
  const listed = filteredPanelAccounts(caught).slice(0, 50);
  const progressPct = player.needed > 0 ? Math.round((player.current / player.needed) * 100) : 0;

  root.innerHTML = `
    <div class="miladymaxxer-panel-header milxdy-overlay-app-header">
      <div>
        <strong>Milady Maxxer</strong>
        <span>Collection stats</span>
      </div>
      <button type="button" data-maxxer-action="close" title="Minimize Milady Maxxer stats" aria-label="Minimize Milady Maxxer stats">_</button>
    </div>
    <section class="miladymaxxer-panel-hero">
      <div>
        <span>Player level</span>
        <strong>Lv.${player.level}</strong>
        <small>${formatNumber(player.current)} / ${formatNumber(player.needed)} XP to next</small>
      </div>
      <div class="miladymaxxer-panel-meter" aria-hidden="true"><span style="width: ${progressPct}%"></span></div>
    </section>
    <section class="miladymaxxer-panel-grid" aria-label="Milady Maxxer summary">
      ${statTile("Caught", formatNumber(caught.length))}
      ${statTile("Seen", formatNumber(seen))}
      ${statTile("Catch rate", catchRate(caught.length, seen))}
      ${statTile("Avatars", formatNumber(avatars.length))}
      ${statTile("Sightings", formatNumber(totalSightings))}
      ${statTile("Matches", formatNumber(stats?.postsMatched ?? 0))}
    </section>
    <section class="miladymaxxer-panel-section">
      <div class="miladymaxxer-panel-section-title">
        <strong>Top 5 leaderboard</strong>
        <span>Highest level profiles</span>
      </div>
      ${topFive.length ? topFive.map((account, index) => accountRow(account, index + 1)).join("") : emptyPanelState("No caught profiles yet.")}
    </section>
    <section class="miladymaxxer-panel-section">
      <div class="miladymaxxer-panel-section-title">
        <strong>Recent catches</strong>
        <span>Latest collected profiles</span>
      </div>
      ${recentFive.length ? recentFive.map((account, index) => accountRow(account, index + 1)).join("") : emptyPanelState("Catch a profile to populate this list.")}
    </section>
    <section class="miladymaxxer-panel-section">
      <div class="miladymaxxer-panel-section-title">
        <strong>Browse collection</strong>
        <span>${formatNumber(listed.length)} shown</span>
      </div>
      <div class="miladymaxxer-panel-tools">
        <input type="search" data-maxxer-search value="${escapeAttr(maxxerPanelSearch)}" placeholder="Search handle or display name">
        <button type="button" data-maxxer-sort="level" data-active="${String(maxxerPanelSort === "level")}">Level</button>
        <button type="button" data-maxxer-sort="recent" data-active="${String(maxxerPanelSort === "recent")}">Recent</button>
      </div>
      <div class="miladymaxxer-panel-list">
        ${listed.length ? listed.map((account, index) => accountRow(account, index + 1, true)).join("") : emptyPanelState("No matching profiles.")}
      </div>
    </section>
    <div class="miladymaxxer-panel-resize-grip" data-maxxer-resize="true" data-resize-axis="both" title="Drag to resize"></div>
    <div class="miladymaxxer-panel-resize-edge miladymaxxer-panel-resize-edge-side" data-maxxer-resize="true" data-resize-axis="x" title="Drag to resize width"></div>
    <div class="miladymaxxer-panel-resize-edge miladymaxxer-panel-resize-edge-bottom" data-maxxer-resize="true" data-resize-axis="y" title="Drag to resize height"></div>
  `;
  root.querySelector<HTMLElement>(".miladymaxxer-panel-header")?.addEventListener("pointerdown", startMaxxerPanelDrag);
  for (const handle of Array.from(root.querySelectorAll<HTMLElement>("[data-maxxer-resize='true']"))) {
    handle.addEventListener("pointerdown", startMaxxerPanelResize);
  }
}

function startMaxxerPanelDrag(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("button, input, textarea, select")) return;
  const root = maxxerPanelRoot;
  if (!root) return;
  root.dataset.dragging = "true";
  startOverlayPanelDrag(event, {
    appId: "miladymaxxer",
    root,
    minWidth: MAXXER_PANEL_MIN_WIDTH,
    minHeight: MAXXER_PANEL_MIN_HEIGHT,
    side: () => maxxerPanelSide,
    box: () => ({ x: maxxerPanelX, width: maxxerPanelWidth, height: maxxerPanelHeight, topOffset: maxxerPanelTop }),
    setBox: (box) => {
      if (typeof box.x === "number") maxxerPanelX = box.x;
      if (typeof box.width === "number") maxxerPanelWidth = box.width;
      if (typeof box.height === "number") maxxerPanelHeight = box.height;
      if (typeof box.topOffset === "number") maxxerPanelTop = box.topOffset;
    },
    apply: applyMaxxerPanelLayout,
    persist: () => {
      root.dataset.dragging = "false";
    },
  });
}

function startMaxxerPanelResize(event: PointerEvent): void {
  const root = maxxerPanelRoot;
  if (!root) return;
  startOverlayPanelResize(event, {
    appId: "miladymaxxer",
    root,
    minWidth: MAXXER_PANEL_MIN_WIDTH,
    minHeight: MAXXER_PANEL_MIN_HEIGHT,
    side: () => maxxerPanelSide,
    box: () => ({ x: maxxerPanelX, width: maxxerPanelWidth, height: maxxerPanelHeight, topOffset: maxxerPanelTop }),
    setBox: (box) => {
      if (typeof box.x === "number") maxxerPanelX = box.x;
      if (typeof box.width === "number") maxxerPanelWidth = box.width;
      if (typeof box.height === "number") maxxerPanelHeight = box.height;
      if (typeof box.topOffset === "number") maxxerPanelTop = box.topOffset;
    },
    apply: applyMaxxerPanelLayout,
    persist: () => undefined,
  }, maxxerResizeAxis(event.currentTarget));
}

function maxxerResizeAxis(target: EventTarget | null): "both" | "x" | "y" {
  if (!(target instanceof HTMLElement)) return "both";
  return target.dataset.resizeAxis === "x" || target.dataset.resizeAxis === "y" ? target.dataset.resizeAxis : "both";
}

function caughtAccounts(): Array<NonNullable<MatchedAccountMap[string]>> {
  return Object.values(matchedAccounts ?? {})
    .filter((account) => account.caught && !settings.whitelistHandles.includes(account.handle));
}

function filteredPanelAccounts(accounts: Array<NonNullable<MatchedAccountMap[string]>>): Array<NonNullable<MatchedAccountMap[string]>> {
  const query = maxxerPanelSearch.trim().toLowerCase();
  const filtered = query
    ? accounts.filter((account) =>
        account.handle.includes(query) || (account.displayName?.toLowerCase().includes(query) ?? false)
      )
    : accounts;
  return [...filtered].sort(maxxerPanelSort === "recent" ? compareMaxxerAccountsByRecent : compareMaxxerAccountsByLevel);
}

function compareMaxxerAccountsByLevel(left: NonNullable<MatchedAccountMap[string]>, right: NonNullable<MatchedAccountMap[string]>): number {
  return right.postsLiked - left.postsLiked || (right.caughtAt ?? "").localeCompare(left.caughtAt ?? "");
}

function compareMaxxerAccountsByRecent(left: NonNullable<MatchedAccountMap[string]>, right: NonNullable<MatchedAccountMap[string]>): number {
  return (right.caughtAt ?? "").localeCompare(left.caughtAt ?? "") || right.postsLiked - left.postsLiked;
}

function statTile(label: string, value: string): string {
  return `<div class="miladymaxxer-panel-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function accountRow(account: NonNullable<MatchedAccountMap[string]>, rank: number, compact = false): string {
  const progress = getLevelProgress(account.postsLiked);
  const avatar = avatarForHandle(account.handle);
  const caught = account.caughtAt ? formatShortDate(account.caughtAt) : "Unknown date";
  const profile = `https://x.com/${account.handle}`;
  return `
    <a class="miladymaxxer-panel-account" href="${escapeAttr(profile)}" target="_blank" rel="noreferrer" data-compact="${String(compact)}">
      <span class="miladymaxxer-panel-rank">${rank}</span>
      ${avatar ? `<img src="${escapeAttr(avatar)}" alt="">` : `<span class="miladymaxxer-panel-avatar-fallback">${escapeHtml(account.handle.slice(0, 1).toUpperCase() || "?")}</span>`}
      <span class="miladymaxxer-panel-account-main">
        <strong>${escapeHtml(account.displayName || `@${account.handle}`)}</strong>
        <small>@${escapeHtml(account.handle)} - ${escapeHtml(caught)}</small>
      </span>
      <span class="miladymaxxer-panel-level">
        <strong>Lv.${progress.level}</strong>
        <small>${formatNumber(account.postsLiked)} likes</small>
      </span>
    </a>
  `;
}

function avatarForHandle(handle: string): string | null {
  const normalized = normalizeHandle(handle);
  for (const avatar of Object.values(collectedAvatars ?? {})) {
    if (avatar.handles.includes(normalized)) return avatar.originalUrl;
  }
  return null;
}

function emptyPanelState(text: string): string {
  return `<div class="miladymaxxer-panel-empty">${escapeHtml(text)}</div>`;
}

function handleMaxxerPanelClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const close = target?.closest<HTMLElement>('[data-maxxer-action="close"]');
  if (close) {
    event.preventDefault();
    closeMaxxerPanel();
    return;
  }
  const sort = target?.closest<HTMLElement>("[data-maxxer-sort]")?.dataset.maxxerSort;
  if (sort === "level" || sort === "recent") {
    event.preventDefault();
    maxxerPanelSort = sort;
    renderMaxxerPanel();
  }
}

function handleMaxxerPanelInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches("[data-maxxer-search]")) return;
  const selectionStart = target.selectionStart ?? target.value.length;
  const selectionEnd = target.selectionEnd ?? selectionStart;
  maxxerPanelSearch = target.value;
  renderMaxxerPanel();
  const input = maxxerPanelRoot?.querySelector<HTMLInputElement>("[data-maxxer-search]");
  if (input) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
  }
}

function refreshMaxxerPanel(): void {
  updateMaxxerDockState();
  if (maxxerPanelRoot?.isConnected) renderMaxxerPanel();
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function catchRate(caught: number, seen: number): string {
  if (seen <= 0) return "0%";
  const rate = (caught / seen) * 100;
  return `${rate.toFixed(rate >= 10 ? 0 : 1)}%`;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

function scheduleProcessVisibleTweets(): void {
  if (!maxxerSurfaceActive()) {
    disableMaxxerRuntime();
    return;
  }
  if (scanScheduled) {
    return;
  }
  scanScheduled = true;
  cancelScheduledScan = runtimeScheduler.idle(() => {
    cancelScheduledScan = null;
    scanScheduled = false;
    if (!maxxerSurfaceActive()) return;
    runtimeScheduleScan();
    void processProfilePage();
  }, { timeout: IDLE_PROCESS_TIMEOUT_MS });
}

// ---------------------------------------------------------------------------
// Tweet processing
// ---------------------------------------------------------------------------

async function processTweet(tweet: HTMLElement): Promise<void> {
  trackMaxxerElement(tweet);
  if (!maxxerSurfaceActive()) {
    clearTweetMaxxerState(tweet);
    return;
  }
  try {
    const avatar = findAvatar(tweet);
    const author = findAuthor(tweet);
    if (!avatar) {
      tweet.dataset.miladymaxxerState = "miss";
      delete tweet.dataset.miladymaxxerDebug;
      applyMode(effectsCtx(), tweet);
      return;
    }

    if (!avatar.currentSrc && !avatar.src) {
      tweet.dataset.miladymaxxerState = "miss";
      delete tweet.dataset.miladymaxxerDebug;
      applyMode(effectsCtx(), tweet);
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
      setMaxxerElementHandle(tweet, author.handle);
      tweet.dataset.miladymaxxerSelf = String(author.handle === resolveSelfHandle());
    } else {
      setMaxxerElementHandle(tweet, null);
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

    // Manual milady list â€” skip detection, treat as match
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
      if (!maxxerSurfaceActive() || !tweet.isConnected) return;
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
    if (!maxxerSurfaceActive() || !tweet.isConnected) return;
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
  if (!maxxerSurfaceActive()) {
    clearQuoteTweetState(tweet);
    return;
  }
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
    if (!maxxerSurfaceActive() || !quoteTweet.isConnected) return;
    quoteTweet.dataset.miladymaxxerQuote = result.matched ? "milady" : "other";
  } catch {
    quoteTweet.dataset.miladymaxxerQuote = "other";
  }
}

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

async function processProfilePage(): Promise<void> {
  if (!maxxerSurfaceActive()) {
    clearProfileMaxxerState();
    return;
  }
  if (settings.mode === "off") return;

  const profileHeader = document.querySelector<HTMLElement>(PROFILE_USER_NAME);
  if (!profileHeader) return;

  const avatar = document.querySelector<HTMLImageElement>(PROFILE_AVATAR);
  if (!avatar?.src) return;

  const normalizedUrl = normalizeProfileImageUrl(avatar.src);

  const userProfileContainer = profileHeader.closest(PROFILE_HEADER_ITEMS)?.parentElement?.parentElement ||
                                profileHeader.closest(PROFILE_CONTAINER_FALLBACK);
  if (!userProfileContainer) return;
  trackMaxxerElement(userProfileContainer as HTMLElement);

  // Extract profile handle from URL
  const profileHandle = normalizeHandle(window.location.pathname.split("/")[1] ?? "");

  // Always refresh badges even if already processed (skip own profile)
  const self = resolveSelfHandle();
  if (profileHandle && profileHandle === self && isSelfTrackingDisabled()) {
    removeProfileLevelBadges();
  }
  if (profileHandle && profileHandle !== self) {
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    trackMaxxerElement(primaryColumn);
    if (primaryColumn?.dataset.miladymaxxerProfile === "milady") {
      injectProfileLevelBadge(profileHandle);
    }
  }

  if (processed.get(userProfileContainer as HTMLElement) === normalizedUrl) return;
  processed.set(userProfileContainer as HTMLElement, normalizedUrl);

  // Manual milady list â€” skip detection for profile page too
  if (profileHandle && settings.miladyListHandles.includes(profileHandle)) {
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    trackMaxxerElement(primaryColumn);
    if (primaryColumn) {
      primaryColumn.dataset.miladymaxxerProfile = "milady";
    }
    if (profileHandle !== self) {
      injectProfileLevelBadge(profileHandle);
    }
    return;
  }

  // Player level is shown next to the logo â€” don't duplicate on profile

  if (profileHandle && await hasRemiStatsBeetles(profileHandle)) {
    if (!maxxerSurfaceActive()) return;
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    trackMaxxerElement(primaryColumn);
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
    if (!maxxerSurfaceActive()) return;
    const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
    trackMaxxerElement(primaryColumn);
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
    trackMaxxerElement(primaryColumn);
    if (primaryColumn) {
      delete primaryColumn.dataset.miladymaxxerProfile;
    }
  }
}

// ---------------------------------------------------------------------------
// User cells
// ---------------------------------------------------------------------------

async function processUserCell(cell: HTMLElement): Promise<void> {
  trackMaxxerElement(cell);
  if (!maxxerSurfaceActive()) {
    clearUserCellMaxxerState(cell);
    return;
  }
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
    if (!maxxerSurfaceActive() || !cell.isConnected) return;
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
    if (!maxxerSurfaceActive() || !cell.isConnected) return;
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
  trackMaxxerElement(message);
  if (!maxxerSurfaceActive()) {
    clearDirectMessageHighlight(message);
    return;
  }
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
    setMaxxerElementHandle(message, null);
  } else {
    setMaxxerElementHandle(message, handle);
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
    if (!maxxerSurfaceActive() || !message.isConnected) return;
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
    if (!maxxerSurfaceActive() || !message.isConnected) return;

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
  setMaxxerElementHandle(message, null);
  delete message.dataset.miladymaxxerDebug;
}

function isMaxxerDisabled(): boolean {
  return document.documentElement.dataset.milxdyVisualDisableMaxxer === "true";
}

function lifecycleActive(): boolean {
  return booted && lifecycleSignal?.aborted !== true;
}

function maxxerSurfaceActive(): boolean {
  return lifecycleActive() && !isMaxxerDisabled();
}

function clearTweetMaxxerState(tweet: HTMLElement): void {
  processed.delete(tweet);
  clearEffects(tweet);
  clearElementMaxxerState(tweet);
  clearQuoteTweetState(tweet);
}

function clearQuoteTweetState(tweet: HTMLElement): void {
  for (const quote of Array.from(tweet.querySelectorAll<HTMLElement>("[data-miladymaxxer-quote]"))) {
    delete quote.dataset.miladymaxxerQuote;
    processedQuoteTweets.delete(quote);
    forgetMaxxerElement(quote);
  }
}

function clearUserCellMaxxerState(cell: HTMLElement): void {
  processed.delete(cell);
  clearElementMaxxerState(cell);
}

function clearProfileMaxxerState(): void {
  const primaryColumn = document.querySelector<HTMLElement>(PRIMARY_COLUMN);
  const hadProfileState = primaryColumn?.dataset.miladymaxxerProfile != null;
  for (const element of Array.from(maxxerMutatedElements)) {
    delete element.dataset.miladymaxxerProfile;
  }
  const hadProfileBadge = Boolean(document.querySelector(".miladymaxxer-player-profile-level, .miladymaxxer-profile-level"));
  const playerBadge = document.querySelector(".miladymaxxer-player-level");
  removeProfileLevelBadges();
  playerBadge?.remove();
  if (hadProfileState || hadProfileBadge || playerBadge) {
    void sendMaxxerMessage({ type: "milady:badge", count: 0 }, "clear badge");
  }
}

function clearMaxxerSurface(element: HTMLElement): void {
  if (element.matches(TWEET)) {
    clearTweetMaxxerState(element);
    return;
  }
  if (element.matches(USER_CELL)) {
    clearUserCellMaxxerState(element);
    return;
  }
  if (element.matches(DM_MESSAGE)) {
    clearDirectMessageHighlight(element);
    return;
  }
  if (element.matches(PRIMARY_COLUMN)) {
    clearProfileMaxxerState();
    return;
  }
  clearElementMaxxerState(element);
}

function disableMaxxerRuntime(): void {
  cancelIdleDrain?.();
  cancelIdleDrain = null;
  idleDrainScheduled = false;
  idleWorkQueue.length = 0;
  queuedElements = new WeakSet<HTMLElement>();
  deferredVisibleWork = new WeakMap<HTMLElement, SurfaceWork>();
  idleDrainPausedForVisibility = false;
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  clearProfileMaxxerState();
  for (const element of Array.from(maxxerMutatedElements)) {
    clearElementMaxxerState(element);
    delete element.dataset.miladymaxxerProfile;
    delete element.dataset.miladymaxxerQuote;
  }
  maxxerMutatedElements.clear();
  maxxerElementsByHandle.clear();
}

function clearElementMaxxerState(element: HTMLElement): void {
  delete element.dataset.miladymaxxer;
  delete element.dataset.miladymaxxerState;
  delete element.dataset.miladymaxxerEffect;
  setMaxxerElementHandle(element, null);
  delete element.dataset.miladymaxxerSelf;
  delete element.dataset.miladymaxxerDebug;
  delete element.dataset.miladymaxxerUncaught;
  delete element.dataset.miladymaxxerMint;
  delete element.dataset.miladymaxxerDiamond;
  delete element.dataset.miladymaxxerLiked;
  delete element.dataset.miladymaxxerNoLikes;
  delete element.dataset.miladymaxxerFade;
  delete element.dataset.miladymaxxerAdjacentAbove;
  delete element.dataset.miladymaxxerAdjacentBelow;
  delete element.dataset.miladymaxxerRetweeted;
  delete element.dataset.miladymaxxerCatchAnim;
  forgetMaxxerElement(element);
}

function applyDirectMessageMode(message: HTMLElement): void {
  delete message.dataset.miladymaxxerEffect;
  if (!maxxerSurfaceActive()) return;

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
  if (!maxxerSurfaceActive()) return;
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
  if (!maxxerSurfaceActive()) return;
  if (!settings.showLevelBadge) return;
  const account = matchedAccounts?.[handle];
  const postsLiked = account?.postsLiked ?? 0;
  const progress = getLevelProgress(postsLiked);

  // Check if we already have a badge with the same content â€” skip if unchanged
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

  // Detect if user follows this milady â€” grey pill if not following
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
  // Remove existing
  removeProfileLevelBadges();

  if (!maxxerSurfaceActive() || !settings.showLevelBadge || isSelfTrackingDisabled()) return;

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

function processWhenVisible(element: HTMLElement, work: SurfaceWork): void {
  if (!maxxerSurfaceActive() || !element.isConnected) return;
  if (!("IntersectionObserver" in window)) {
    scheduleIdleWork(element, work);
    return;
  }
  if (shouldUseEagerViewportRead() && isElementNearViewport(element)) {
    scheduleIdleWork(element, work);
    return;
  }
  deferredVisibleWork.set(element, work);
  getVisibilityObserver().observe(element);
}

function shouldUseEagerViewportRead(): boolean {
  const mode = performanceMode();
  return mode === "full" || mode === "developer";
}

function getVisibilityObserver(): IntersectionObserver {
  if (visibilityObserver) return visibilityObserver;
  visibilityObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!maxxerSurfaceActive()) return;
      if (!entry.isIntersecting) continue;
      const element = entry.target as HTMLElement;
      visibilityObserver?.unobserve(element);
      const work = deferredVisibleWork.get(element);
      if (!work) continue;
      deferredVisibleWork.delete(element);
      scheduleIdleWork(element, work);
    }
  }, {
    root: null,
    rootMargin: `${visibilityRootMargin()}px 0px`,
    threshold: 0,
  });
  return visibilityObserver;
}

function scheduleIdleWork(element: HTMLElement, work: SurfaceWork): void {
  if (!maxxerSurfaceActive() || !element.isConnected || queuedElements.has(element)) return;
  queuedElements.add(element);
  idleWorkQueue.push({ element, work });
  scheduleIdleDrain();
}

function scheduleIdleDrain(): void {
  if (!maxxerSurfaceActive()) {
    idleWorkQueue.length = 0;
    queuedElements = new WeakSet<HTMLElement>();
    idleDrainScheduled = false;
    idleDrainPausedForVisibility = false;
    return;
  }
  if (idleDrainScheduled) return;
  idleDrainScheduled = true;
  const drain = (deadline?: IdleDeadline) => {
    cancelIdleDrain = null;
    idleDrainScheduled = false;
    if (!maxxerSurfaceActive()) {
      idleWorkQueue.length = 0;
      queuedElements = new WeakSet<HTMLElement>();
      idleDrainPausedForVisibility = false;
      return;
    }
    let processedCount = 0;
    const maxThisDrain = maxSurfacesPerIdle();
    while (idleWorkQueue.length > 0 && processedCount < maxThisDrain) {
      if (deadline && processedCount > 0 && deadline.timeRemaining() < 5) break;
      const next = idleWorkQueue.shift();
      if (!next) break;
      queuedElements.delete(next.element);
      if (!maxxerSurfaceActive() || !next.element.isConnected) continue;
      if (document.hidden && next.element.getRootNode() === document) {
        idleWorkQueue.unshift(next);
        queuedElements.add(next.element);
        idleDrainPausedForVisibility = true;
        return;
      }
      const startedAt = performance.now();
      void Promise.resolve(next.work()).finally(() => {
        recordFeatureTiming("miladymaxxer", "idleSurface", startedAt);
      });
      processedCount += 1;
    }
    if (idleWorkQueue.length > 0) scheduleIdleDrain();
  };

  cancelIdleDrain = runtimeScheduler.idle(drain, { timeout: IDLE_PROCESS_TIMEOUT_MS });
}

function isElementNearViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const height = window.innerHeight || document.documentElement.clientHeight || 0;
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  if (rect.width <= 0 || rect.height <= 0) return false;
  const margin = visibilityRootMargin();
  return rect.bottom >= -margin
    && rect.top <= height + margin
    && rect.right >= -margin
    && rect.left <= width + margin;
}

function removeProfileLevelBadges(): void {
  document.querySelector(".miladymaxxer-player-profile-level")?.remove();
  document.querySelector(".miladymaxxer-profile-level")?.remove();
}

function isSelfTrackingDisabled(): boolean {
  return document.documentElement.dataset.milxdyVisualDisableSelfTracking === "true";
}

function resolveSelfHandle(): string | null {
  const link = document.querySelector<HTMLAnchorElement>(SELF_PROFILE_LINK);
  const href = link?.getAttribute("href");
  const resolved = normalizeAccountScope(href);
  if (resolved && resolved !== selfHandle) {
    selfHandle = resolved;
  }
  if (selfHandle) return selfHandle;
  if (href) {
    selfHandle = normalizeHandle(href);
  }
  return selfHandle;
}

async function loadAccountState(scope: string | null): Promise<void> {
  [stats, matchedAccounts, collectedAvatars, playerStats] = await Promise.all([
    loadStats(scope),
    loadMatchedAccounts(scope),
    loadCollectedAvatars(scope),
    loadPlayerStats(scope),
  ]);
}

async function syncAccountScope(): Promise<void> {
  const nextScope = resolveSelfHandle();
  if (nextScope === accountScope) return;
  accountScope = nextScope;
  if (accountScope) {
    await migrateLegacyStorageToScope(accountScope);
    await saveActiveAccountScope(accountScope);
  }
  await loadAccountState(accountScope);
  if (!lifecycleActive()) return;
  prevPlayerLevel = getPlayerLevel(playerStats.totalLikesGiven);
  updatePlayerLevelBadge();
  refreshMaxxerPanel();
  scheduleProcessVisibleTweets();
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
  // Disabled â€” XP should only come from like actions
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
  if (!lifecycleActive()) return;
  if (document.documentElement.dataset.milxdyVisualDisableSelfTracking === "true" && handle === resolveSelfHandle()) return;
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
  refreshMaxxerPanel();
  playCatchSound();
}

function handleLevelUp(handle: string, _newLevel: number): void {
  if (!lifecycleActive()) return;
  if (document.documentElement.dataset.milxdyVisualDisableSelfTracking === "true" && handle === resolveSelfHandle()) return;
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
  refreshMaxxerPanel();

  if (newLevel > prevLevel) {
    playLevelUpSound();
    const tweet = maxxerElementsForHandle(handle).find((element) => element.dataset.miladymaxxerState === "match");
    if (tweet) {
      triggerLevelUpAnimation(tweet);
    }
  }
}

function observeRemiNetPokeCredits(): void {
  const pokeCreditListener = (event: Event) => {
    const detail = (event as CustomEvent<{ handle?: unknown }>).detail;
    const handle = normalizeHandle(typeof detail?.handle === "string" ? detail.handle : null);
    if (!handle) return;
    creditMiladyInteraction(handle);
  };
  window.addEventListener("milxdy:remistats-poke-credit", pokeCreditListener);
  addRuntimeDisposable(() => window.removeEventListener("milxdy:remistats-poke-credit", pokeCreditListener));
}

function creditMiladyInteraction(handle: string): void {
  if (!lifecycleActive()) return;
  if (document.documentElement.dataset.milxdyVisualDisableSelfTracking === "true" && handle === resolveSelfHandle()) return;
  if (!matchedAccounts) return;

  let existing = matchedAccounts[handle];
  if (!existing && settings.miladyListHandles.includes(handle)) {
    existing = {
      handle,
      displayName: null,
      postsMatched: 1,
      postsLiked: 0,
      lastMatchedAt: new Date().toISOString(),
      lastDetectionScore: null,
      caught: false,
      caughtAt: null,
      verificationStatus: "unverified",
    };
    matchedAccounts[handle] = existing;
  }
  if (!existing) return;

  if (!existing.caught) {
    markAccountCaught(handle);
    return;
  }
  handleLevelUp(handle, 0);
}

function addToMiladyList(handle: string): void {
  if (!lifecycleActive()) return;
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
    refreshMaxxerPanel();
  } else if (matchedAccounts?.[handle] && !matchedAccounts[handle].caught) {
    matchedAccounts[handle].caught = true;
    matchedAccounts[handle].caughtAt = matchedAccounts[handle].caughtAt ?? new Date().toISOString();
    scheduleLocalStateWrite();
    refreshMaxxerPanel();
  }

  // Clear processed state and effects so tweets get re-evaluated as matches
  for (const tweet of maxxerElementsForHandle(handle)) {
    processed.delete(tweet);
    delete tweet.dataset.miladymaxxerState;
    delete tweet.dataset.miladymaxxer;
    clearEffects(tweet);
  }
  scheduleProcessVisibleTweets();
}

function removeFromMiladyList(handle: string): void {
  if (!lifecycleActive()) return;
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
    refreshMaxxerPanel();
  }

  // Clear processed state and effects so tweets get re-evaluated
  for (const tweet of maxxerElementsForHandle(handle)) {
    processed.delete(tweet);
    delete tweet.dataset.miladymaxxerState;
    delete tweet.dataset.miladymaxxer;
    clearEffects(tweet);
  }
  scheduleProcessVisibleTweets();
}

function handleUnlike(handle: string): void {
  if (!lifecycleActive()) return;
  if (!matchedAccounts) return;

  const existing = matchedAccounts[handle];
  if (!existing || !existing.caught || existing.postsLiked <= 0) return;

  existing.postsLiked = Math.max(0, existing.postsLiked - 1);
  const isOnList = settings.miladyListHandles.includes(handle);
  playerStats.totalLikesGiven = Math.max(0, playerStats.totalLikesGiven - (isOnList ? 0.25 : 1));
  schedulePlayerStatsWrite();
  scheduleLocalStateWrite();
  updatePlayerLevelBadge();
  refreshMaxxerPanel();
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
  refreshMaxxerPanel();
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
  refreshMaxxerPanel();
}

function scheduleLocalStateWrite(): void {
  if (localStateWriteScheduled || !stats || !matchedAccounts || !collectedAvatars) return;
  localStateWriteScheduled = true;
  runtimeScheduler.timeout(async () => {
    localStateWriteScheduled = false;
    if (!lifecycleActive()) return;
    if (!stats || !matchedAccounts || !collectedAvatars) return;
    await Promise.all([
      saveStats(stats, accountScope),
      saveMatchedAccounts(matchedAccounts, accountScope),
      saveCollectedAvatars(collectedAvatars, accountScope),
    ]);
  }, 250);
}

function schedulePlayerStatsWrite(): void {
  if (playerStatsWriteScheduled) return;
  playerStatsWriteScheduled = true;
  runtimeScheduler.timeout(async () => {
    playerStatsWriteScheduled = false;
    if (!lifecycleActive()) return;
    await savePlayerStats(playerStats, accountScope);
  }, 250);
}

let prevPlayerLevel = 0;

function updatePlayerLevelBadge(): void {
  if (!maxxerSurfaceActive()) {
    clearProfileMaxxerState();
    return;
  }
  const logoImg = document.querySelector(`[data-milxdy-home-logo-wrapper="true"] .${LOGO_REPLACEMENT_CLASS}`);
  if (!logoImg) return;
  const wrapper = logoImg.parentElement;
  if (!wrapper) return;

  const progress = getPlayerLevelProgress(playerStats.totalLikesGiven);
  const newLevel = progress.level;

  // Check for level up
  if (newLevel > prevPlayerLevel && prevPlayerLevel > 0) {
    playLevelUpSound();
    void sendMaxxerMessage({ type: "milady:levelup", level: newLevel }, "level up");
    const existing = wrapper.querySelector(".miladymaxxer-player-level") as HTMLElement | null;
    if (existing) {
      existing.style.transform = "scale(1.3)";
      existing.style.transition = "transform 0.3s ease";
      runtimeScheduler.timeout(() => {
        if (!lifecycleActive()) return;
        existing.style.transform = "";
      }, 400);
    }
  }
  prevPlayerLevel = newLevel;

  // Update extension badge with player level
  void sendMaxxerMessage({ type: "milady:badge", count: newLevel > 0 ? newLevel : 0 }, "badge");

  let badge = wrapper.querySelector(".miladymaxxer-player-level") as HTMLElement | null;
  if (newLevel <= 0) {
    badge?.remove();
    return;
  }

  const filled = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 4) : 0;
  const ascii = "\u2593".repeat(filled) + "\u2591".repeat(4 - filled);
  const pct = progress.needed > 0 ? Math.round((progress.current / progress.needed) * 100) : 0;

  // Responsive: detect sidebar width and adjust text
  const sidebar = logoImg.closest('[role="heading"]')?.parentElement?.parentElement ?? logoImg.closest("header, nav")?.parentElement ?? logoImg.closest('[data-testid="primaryColumn"]')?.previousElementSibling;
  const sidebarWidth = sidebar ? (sidebar as HTMLElement).offsetWidth : window.innerWidth;
  let text: string;
  if (sidebarWidth < 88) {
    // Ultra narrow (collapsed sidebar) â€” just level number
    text = `Lv.${progress.level}`;
  } else if (sidebarWidth < 200) {
    // Narrow (DMs open) â€” compact
    text = `Lv.${progress.level} ${pct}%`;
  } else {
    // Normal â€” full display
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
  if (!settings.includeRemiStatsBeetles && !settings.hideNonMiladyOrBeetlePosts) return false;
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
  if (!lifecycleActive()) return false;
  try {
    const response = await runtimeSendMessage<{
      ok: boolean;
      profile?: { beetleCount?: unknown };
    }>({ type: "reminetIdentity:getProfile", xHandle: handle }, "miladymaxxer identity lookup");
    if (!lifecycleActive()) return false;
    if (!response?.ok) return false;
    const beetles = Number(response.profile?.beetleCount);
    return Number.isFinite(beetles) && beetles > 0;
  } catch {
    return false;
  }
}

function sendMaxxerMessage(message: unknown, label: string): void {
  if (!lifecycleActive()) return;
  void runtimeSendMessage(message, `miladymaxxer ${label}`);
}

function observeStorage(): void {
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (!lifecycleActive()) return;
    const statsKey = storageKeyForScope("stats", accountScope);
    const matchedAccountsKey = storageKeyForScope("matchedAccounts", accountScope);
    const collectedAvatarsKey = storageKeyForScope("collectedAvatars", accountScope);
    const playerStatsKey = storageKeyForScope("playerStats", accountScope);
    if (area === "sync" && (changes.mode || changes.whitelistHandles || changes.miladyListHandles || changes.includeRemiStatsBeetles || changes.hideNonMiladyOrBeetlePosts || changes.soundEnabled || changes.showLevelBadge || changes.cardTheme)) {
      const nextMode = changes.mode?.newValue;
      const nextIncludeRemiStatsBeetles = changes.includeRemiStatsBeetles?.newValue;
      const nextHideNonMiladyOrBeetlePosts = changes.hideNonMiladyOrBeetlePosts?.newValue;
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
        hideNonMiladyOrBeetlePosts: typeof nextHideNonMiladyOrBeetlePosts === "boolean"
          ? nextHideNonMiladyOrBeetlePosts
          : settings.hideNonMiladyOrBeetlePosts,
        soundEnabled: typeof nextSoundEnabled === "boolean" ? nextSoundEnabled : settings.soundEnabled,
        showLevelBadge: typeof nextShowLevelBadge === "boolean" ? nextShowLevelBadge : settings.showLevelBadge,
        cardTheme: isCardTheme(nextCardTheme, validThemes) ? nextCardTheme : settings.cardTheme,
      };
      setSoundSettings(settings);
      scheduleProcessVisibleTweets();
    }

    if (area === "local" && (changes[RESKIN_PROFILE_KEY] || changes[VISUAL_THEME_KEY])) {
      scheduleVisualRefresh();
    }

    if (area === "local" && changes[statsKey]) {
      stats = normalizeStats(changes[statsKey].newValue);
      refreshMaxxerPanel();
    }

    if (area === "local" && changes[matchedAccountsKey]) {
      matchedAccounts = normalizeMatchedAccounts(changes[matchedAccountsKey].newValue);
      refreshMaxxerPanel();
    }

    if (area === "local" && changes[collectedAvatarsKey]) {
      collectedAvatars = normalizeCollectedAvatars(changes[collectedAvatarsKey].newValue);
      refreshMaxxerPanel();
    }

    if (area === "local" && changes[playerStatsKey]) {
      const raw = changes[playerStatsKey].newValue;
      const candidate = raw && typeof raw === "object" ? raw as { totalLikesGiven?: unknown } : null;
      playerStats = candidate ? { totalLikesGiven: typeof candidate.totalLikesGiven === "number" ? candidate.totalLikesGiven : 0 } : DEFAULT_PLAYER_STATS;
      updatePlayerLevelBadge();
      refreshMaxxerPanel();
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
  addRuntimeDisposable(() => chrome.storage.onChanged.removeListener(storageListener));
}

function isCardTheme(value: unknown, validThemes: ExtensionSettings["cardTheme"][]): value is ExtensionSettings["cardTheme"] {
  return typeof value === "string" && validThemes.includes(value as ExtensionSettings["cardTheme"]);
}
