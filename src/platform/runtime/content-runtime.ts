import {
  configureTwitterScanner,
  getTwitterScannerCounters,
  resetTwitterScannerCounters,
  scheduleTwitterScan,
  subscribeTwitterSurfaces,
  type TwitterSurface,
  type TwitterSurfaceKind,
} from "../scanner/twitter-scanner";
import { hasExtensionRuntime, markExtensionInvalidated, safeLocalGet, safeLocalRemove, safeLocalSet, safeRuntimeMessage, safeSyncRemove } from "../background/extension-runtime";
import { DisposableStore } from "./disposables";
import { createAppStorageFacade, type AppStorageAreaName, type AppStorageChanges } from "../app-sdk/app-storage";
import { createAppAssetResolver } from "../app-sdk/app-assets";
import { recordFeatureTiming } from "../diagnostics/performance-diagnostics";
import { getOverlayDock, type OverlayDockRegistration } from "../overlay/dock";
import { MILXDY_ADDONS_CATALOG_URL } from "../app-sdk/addons-catalog";
import { DEFAULT_INTERFACE_SOUNDS_VOLUME, INTERFACE_SOUNDS_ENABLED_KEY, INTERFACE_SOUNDS_VOLUME_KEY } from "../settings/interface-sounds";
import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../overlay/app-chrome";
import { resetOverlayAppLayouts } from "../overlay/app-layout";
import {
  PERFORMANCE_MODE_KEY,
  budgetForPerformanceMode,
  loadPerformanceMode,
  normalizePerformanceMode,
  type PerformanceMode,
  type PerformanceModeBudget,
} from "../settings/performance-mode";
import type {
  AppIconAsset,
  AppDiagnostics,
  AppLoadState,
  AppPreset,
  AppRuntimeScheduler,
  AppSettingDefinition,
  AppSiteId,
  AppSiteScope,
  MilxdyAppId,
  MilxdyAppManifest,
  MilxdyContentAppModule,
  MilxdyRouteChange,
} from "../app-sdk/app-platform";

declare const MILXDY_BUILD_PROFILE: "lite" | "balanced" | "full" | undefined;
declare const MILXDY_BUILD_TARGET: "chromium" | "firefox" | undefined;
declare const MILXDY_VERSION: string | undefined;
declare const MILXDY_LOCAL_ADDON_BUILD_ID: string | undefined;

const LOCAL_ADDON_MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const LOCAL_ADDON_MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const LOCAL_ADDON_MAX_ENTRIES = 2000;

type LocalAddonQueueItem = {
  file: File;
  state: "checking" | "accepted" | "rejected";
  id?: string;
  name?: string;
  version?: string;
  reason?: string;
};

type LocalAddonStatus = {
  schemaVersion: 1 | 2;
  mode: "standard" | "custom-composition" | "managed-local-addons";
  state: "prepared" | "built" | "validation-failed" | "build-failed";
  buildId?: string;
  compositionFingerprint?: string;
  outputDirectory?: string;
  addOnsDirectory?: string;
  workflowStage?: "select" | "place" | "rebuild" | "reload";
  packages?: Array<{ id: string; name?: string; version?: string; reviewStatus?: string }>;
  errors?: string[];
  warnings?: string[];
};

function normalizedStringSet(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : []);
}

type RuntimeState = {
  apps: readonly MilxdyAppManifest[];
  enabledApps: Set<MilxdyAppId>;
  loaded: Map<MilxdyAppId, MilxdyContentAppModule>;
  loading: Map<MilxdyAppId, Promise<MilxdyContentAppModule | null>>;
  unloadingApps: Set<MilxdyAppId>;
  appDisposables: Map<MilxdyAppId, DisposableStore>;
  appAbortControllers: Map<MilxdyAppId, AbortController>;
  diagnostics: Map<MilxdyAppId, AppDiagnostics>;
  route: MilxdyRouteChange;
  disposed: boolean;
  diagnosticsTimer: number | null;
  unsubscribeSurfaces: (() => void) | null;
  unpatchHistory: (() => void) | null;
  performanceMode: PerformanceMode;
  budget: PerformanceModeBudget;
  effectiveBudget: PerformanceModeBudget;
  startupBudgetTimer: number | null;
  startupBudgetActive: boolean;
  dockRegistrations: Map<MilxdyAppId, OverlayDockRegistration>;
  hideAllDockRegistration: OverlayDockRegistration | null;
  hubDockRegistration: OverlayDockRegistration | null;
  addOnsCatalogDockRegistration: OverlayDockRegistration | null;
  hubPanelRoot: HTMLElement | null;
  hubSearchQuery: string;
  hubExpandedApps: Set<MilxdyAppId>;
  hubDockSettingsOpen: boolean;
  interfaceSoundsEnabled: boolean;
  interfaceSoundsVolume: number;
  localAddonStatus: LocalAddonStatus | null;
  localAddonStatusLoading: boolean;
  localAddonQueue: LocalAddonQueueItem[];
  localAddonQueueMessage: string;
  localAddonPendingRemovals: Set<string>;
  hubAppDrag: {
    appId: MilxdyAppId;
    pointerId: number;
    moved: boolean;
  } | null;
  iconTheme: "light" | "dark";
  firstRunPending: boolean;
  railPinnedApps: Set<MilxdyAppId>;
  railUnpinnedApps: Set<MilxdyAppId>;
  railPinsExplicit: boolean;
  idlePreloadTimer: number | null;
  routeSurfaceImports: number;
  pendingSurfaceImports: Set<MilxdyAppId>;
  importAvoidance: Record<string, number>;
  surfaceCounts: Record<string, number>;
  surfaceAppIndex: Map<TwitterSurfaceKind, MilxdyAppManifest[]>;
  surfaceDeliveries: Record<string, number>;
  surfaceSkips: Record<string, number>;
  surfaceDeliveryCache: WeakMap<HTMLElement, Set<MilxdyAppId>>;
  surfaceDeliveryKeyCache: Map<string, number>;
  surfaceDeliveryQueues: Map<MilxdyAppId, AppSurfaceDeliveryQueue>;
  surfaceDeliveryStats: {
    queued: number;
    droppedQueueCap: number;
    dedupedByElement: number;
    dedupedByKey: number;
    keyCacheSize: number;
    drains: number;
    maxQueueDepth: number;
    lastDrainBatchSize: number;
    lastDrainMs: number;
    maxDrainMs: number;
  };
  tweetScaffoldSignatures: WeakMap<HTMLElement, string>;
  tweetScaffoldStats: TweetScaffoldStats;
  networkQueue: NetworkTask[];
  activeNetworkTasks: number;
  networkStats: NetworkSchedulerStats;
  idleQueueDepth: number;
  idleQueueMaxDepth: number;
  idleSchedulerStats: IdleSchedulerStats;
  longTasks: Array<{ startTime: number; duration: number; name: string }>;
  layoutShifts: Array<{ startTime: number; value: number; marker: string }>;
  tweetHeightChanges: Array<{ appId: MilxdyAppId; before: number; after: number; delta: number; cacheKey: string; recordedAt: number }>;
  longTaskObserver: PerformanceObserver | null;
  layoutShiftObserver: PerformanceObserver | null;
  runtimeDisposables: DisposableStore;
};

const DIAGNOSTIC_FLUSH_MS = 1200;
const CONTENT_NETWORK_DEADLINE_MS = 35_000;
const RUNTIME_IMPORT_FLAG = "__milxdyContentRuntimeLoading";
const TWEET_SCAFFOLD_STYLE_ID = "milxdy-tweet-scaffold-style";
const RAIL_PIN_KEY = "milxdy.apps.railPinned";
const RAIL_UNPIN_KEY = "milxdy.apps.railUnpinned";
const FIRST_RUN_STATUS_KEY = "milxdy.apps.firstRun.status";
const PENDING_LOCAL_ADDON_REMOVALS_KEY = "milxdy.localAddons.pendingRemovals";
const HUB_PANEL_ID = "milxdy-app-hub-panel";

type IdleTask = {
  id: number;
  callback: () => void;
  queuedAt: number;
  timeoutMs: number;
  canceled: boolean;
};

type IdleSchedulerStats = {
  queued: number;
  started: number;
  completed: number;
  canceled: number;
  flushes: number;
  maxDepth: number;
};

type NetworkTask = {
  id: number;
  appId: MilxdyAppId;
  label: string;
  queuedAt: number;
  message: unknown;
  resolve: (value: unknown | null) => void;
  reject: (error: unknown) => void;
  canceled: boolean;
};

type AppSurfaceDelivery = {
  app: MilxdyAppManifest;
  module: MilxdyContentAppModule;
  surface: TwitterSurface;
  startedAt: number;
  heightBefore: number | null;
};

type AppSurfaceDeliveryQueue = {
  deliveries: AppSurfaceDelivery[];
  cancelDrain: (() => void) | null;
};

type NetworkSchedulerStats = {
  queued: number;
  started: number;
  completed: number;
  failed: number;
  canceled: number;
  maxDepth: number;
  maxActive: number;
  lastLabel: string;
  lastLatencyMs: number;
};

type SurfaceImportDecision =
  | { mode: "immediate" }
  | { mode: "idle" }
  | { mode: "blocked"; reason: string };

type ScaffoldResult = "created" | "present" | "missing";
type ResetStorageArea = "local" | "sync";
type AppSettingUiValue = string | number | boolean | null;

type AppResetPlan = {
  localKeys: string[];
  syncKeys: string[];
  settingDefaults: Array<{ area: ResetStorageArea; key: string; value: unknown; settingId: string; behavior: string }>;
  propertyDefaults: Array<{ area: ResetStorageArea; key: string; property: string; value: unknown; settingId: string; behavior: string }>;
  propertyRemovals: Array<{ area: ResetStorageArea; key: string; property: string; settingId: string; behavior: string }>;
  skippedSharedKeys: Array<{ area: ResetStorageArea; key: string; owners: string[]; reason: string }>;
  skippedSettings: Array<{ settingId: string; area: ResetStorageArea; key: string; property?: string; behavior: string; reason: string }>;
};

type TweetScaffoldStats = {
  attempts: number;
  skipsBySignature: number;
  createdSlots: number;
  createdBySlot: Record<string, number>;
  durationMs: number;
  lastDurationMs: number;
  maxDurationMs: number;
};

export type ContentRuntime = {
  boot: () => Promise<void>;
  loadApp: (app: MilxdyAppManifest, reason?: string) => Promise<MilxdyContentAppModule | null>;
  notifyRoute: () => void;
  dispose: () => Promise<void>;
  diagnostics: () => AppDiagnostics[];
};

export function createContentRuntime(apps: readonly MilxdyAppManifest[]): ContentRuntime {
  const state: RuntimeState = {
    apps,
    enabledApps: new Set(),
    loaded: new Map(),
    loading: new Map(),
    unloadingApps: new Set(),
    appDisposables: new Map(),
    appAbortControllers: new Map(),
    diagnostics: new Map(apps.map((app) => [app.id, appDiagnosticsBase(app, "pending")])),
    route: currentRoute(null),
    disposed: false,
    diagnosticsTimer: null,
    unsubscribeSurfaces: null,
    unpatchHistory: null,
    performanceMode: "balanced",
    budget: budgetForPerformanceMode("balanced"),
    effectiveBudget: budgetForPerformanceMode("balanced"),
    startupBudgetTimer: null,
    startupBudgetActive: false,
    dockRegistrations: new Map(),
    hideAllDockRegistration: null,
    hubDockRegistration: null,
    addOnsCatalogDockRegistration: null,
    hubPanelRoot: null,
    hubSearchQuery: "",
    hubExpandedApps: new Set(),
    hubDockSettingsOpen: false,
    interfaceSoundsEnabled: true,
    interfaceSoundsVolume: DEFAULT_INTERFACE_SOUNDS_VOLUME,
    localAddonStatus: null,
    localAddonStatusLoading: false,
    localAddonQueue: [],
    localAddonQueueMessage: "",
    localAddonPendingRemovals: new Set(),
    hubAppDrag: null,
    iconTheme: currentAppIconTheme(),
    firstRunPending: false,
    railPinnedApps: new Set(),
    railUnpinnedApps: new Set(),
    railPinsExplicit: false,
    idlePreloadTimer: null,
    routeSurfaceImports: 0,
    pendingSurfaceImports: new Set(),
    importAvoidance: {},
    surfaceCounts: {},
    surfaceAppIndex: new Map(),
    surfaceDeliveries: {},
    surfaceSkips: {},
    surfaceDeliveryCache: new WeakMap(),
    surfaceDeliveryKeyCache: new Map(),
    surfaceDeliveryQueues: new Map(),
    surfaceDeliveryStats: {
      queued: 0,
      droppedQueueCap: 0,
      dedupedByElement: 0,
      dedupedByKey: 0,
      keyCacheSize: 0,
      drains: 0,
      maxQueueDepth: 0,
      lastDrainBatchSize: 0,
      lastDrainMs: 0,
      maxDrainMs: 0,
    },
    tweetScaffoldSignatures: new WeakMap(),
    tweetScaffoldStats: createTweetScaffoldStats(),
    networkQueue: [],
    activeNetworkTasks: 0,
    networkStats: {
      queued: 0,
      started: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
      maxDepth: 0,
      maxActive: 0,
      lastLabel: "",
      lastLatencyMs: 0,
    },
    idleQueueDepth: 0,
    idleQueueMaxDepth: 0,
    idleSchedulerStats: {
      queued: 0,
      started: 0,
      completed: 0,
      canceled: 0,
      flushes: 0,
      maxDepth: 0,
    },
    longTasks: [],
    layoutShifts: [],
    tweetHeightChanges: [],
    longTaskObserver: null,
    layoutShiftObserver: null,
    runtimeDisposables: new DisposableStore(),
  };
  const scheduler = createRuntimeScheduler(
    () => state.effectiveBudget,
    () => state.disposed,
    (depth) => {
      state.idleQueueDepth = depth;
      state.idleQueueMaxDepth = Math.max(state.idleQueueMaxDepth, depth);
    },
    state.idleSchedulerStats,
  );

  async function boot(): Promise<void> {
    const bootStartedAt = performance.now();
    resetRuntimeCounters();
    resetTwitterScannerCounters();
    state.performanceMode = await loadPerformanceMode();
    state.budget = budgetForPerformanceMode(state.performanceMode);
    activateStartupBudgetWindow();
    applyRuntimeDocumentMarkers(state.performanceMode);
    injectTweetScaffoldStyles();
    await loadFirstRunState();
    configureTwitterScannerFromEffectiveBudget();
    configurePerformanceObservers();
    startRouteService();
    await loadRailPins();
    await loadInterfaceSoundSettings();
    registerHubDockMetadata();
    const enablementStartedAt = performance.now();
    const enablement = await Promise.all(state.apps.map(async (app) => ({
      app,
      enabled: app.available !== false && await app.isEnabled(),
    })));
    const startupApps: MilxdyAppManifest[] = [];
    const metadataStartedAt = performance.now();
    for (const { app, enabled } of enablement) {
      if (enabled) {
        state.enabledApps.add(app.id);
        updateDockRegistration(app);
        if (shouldLoadAtStartup(app)) startupApps.push(app);
        else updateAppDiagnostics(app, "pending", { deferredReason: deferredReason(app) });
      }
      else updateAppDiagnostics(app, "disabled");
    }
    registerAddOnsCatalogDockItem();
    syncHiddenRailItems();
    updateScannerConfiguration();
    recordRuntimeDiagnostic("runtime.metadata", {
      appCount: state.apps.length,
      enabledApps: Array.from(state.enabledApps).sort(),
      enablementMs: Math.round((metadataStartedAt - enablementStartedAt) * 10) / 10,
      metadataMs: Math.round((performance.now() - metadataStartedAt) * 10) / 10,
      updatedAt: Date.now(),
    });
    for (const app of startupApps) await loadApp(app, "startup");
    loadRouteApps("routeInitial");
    state.unsubscribeSurfaces = subscribeTwitterSurfaces(handleSurface);
    observeEnablement();
    observeRailPins();
    observePerformanceMode();
    observeHubGeneratedSettings();
    observeInterfaceSoundSettings();
    observeAppIconTheme();
    scheduleIdlePreloads();
    maybeOpenFirstRunHub();
    recordRuntimeDiagnostic("runtime.bootstrap", {
      mode: state.performanceMode,
      bootMs: Math.round((performance.now() - bootStartedAt) * 10) / 10,
      updatedAt: Date.now(),
    });
    flushDiagnosticsSoon();
  }

  async function loadApp(app: MilxdyAppManifest, reason = "explicit"): Promise<MilxdyContentAppModule | null> {
    if (app.available === false) {
      recordImportAvoided(app, `unavailable:${reason}`);
      updateAppDiagnostics(app, "disabled", { deferredReason: app.unavailableReason || "unavailableInBuild" });
      return null;
    }
    if (state.disposed) return null;
    if (!state.enabledApps.has(app.id)) {
      recordImportAvoided(app, `disabled:${reason}`);
      return null;
    }
    const existing = state.loaded.get(app.id);
    if (existing && state.unloadingApps.has(app.id)) {
      recordImportAvoided(app, `unloading:${reason}`);
      return null;
    }
    if (existing) return existing;
    const pending = state.loading.get(app.id);
    if (pending) {
      recordImportAvoided(app, `importInFlight:${reason}`);
      return pending;
    }
    const startedAt = performance.now();
    const importPromise = (async () => {
      injectStylesheets(app);
      const importUrl = chrome.runtime.getURL(app.contentEntry);
      const host = window as unknown as Record<string, string | undefined>;
      host[RUNTIME_IMPORT_FLAG] = app.id;
      let module: MilxdyContentAppModule;
      try {
        module = await import(importUrl) as MilxdyContentAppModule;
      } finally {
        delete host[RUNTIME_IMPORT_FLAG];
      }
      if (!state.enabledApps.has(app.id) || state.disposed) {
        recordImportAvoided(app, `disabledAfterImport:${reason}`);
        return null;
      }
      state.loaded.set(app.id, module);
      const disposables = new DisposableStore();
      const abortController = new AbortController();
      state.appDisposables.set(app.id, disposables);
      state.appAbortControllers.set(app.id, abortController);
      await module.boot?.({
        manifest: app,
        signal: abortController.signal,
        requestSurfaceRescan: scheduleTwitterScan,
        scheduleScan: scheduleTwitterScan,
        loadAppById,
        scheduler,
        storage: createAppStorageFacade(app.id, app.storageKeys, {
          async get(area, defaults) {
            return await safeStorageGet(area, defaults) || { ...defaults };
          },
          async set(area, values) {
            if (area === "local") await safeLocalSet(values);
            else await safeSyncSet(values);
          },
          async remove(area, keys) {
            if (area === "local") await safeLocalRemove(keys);
            else await safeSyncRemove(keys);
          },
          onChanged(listener) {
            const chromeListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
              if (area !== "local" && area !== "sync") return;
              listener(area as AppStorageAreaName, changes as AppStorageChanges);
            };
            chrome.storage.onChanged.addListener(chromeListener);
            return () => chrome.storage.onChanged.removeListener(chromeListener);
          },
        }),
        resolveAssetUrl: createAppAssetResolver(app, (path) => chrome.runtime.getURL(path)),
        sendMessage: (message, label) => sendAppMessage(app, message, label),
        recordDiagnostic: (key, value) => recordRuntimeDiagnostic(`${app.id}.${key}`, value),
        addDisposable: (disposable) => disposables.add(disposable),
      });
      if (!state.enabledApps.has(app.id) || state.disposed) {
        recordImportAvoided(app, `disabledAfterBoot:${reason}`);
        if (!state.unloadingApps.has(app.id)) {
          state.unloadingApps.add(app.id);
          abortAppWork(app.id);
          try {
            await Promise.resolve(module.disable?.());
            await Promise.resolve(module.dispose?.());
          } finally {
            disposables.dispose();
            state.appDisposables.delete(app.id);
            state.appAbortControllers.delete(app.id);
            state.loaded.delete(app.id);
            state.unloadingApps.delete(app.id);
            updateScannerConfiguration();
            reconcileAppAfterUnload(app);
            flushDiagnosticsSoon();
          }
        }
        return null;
      }
      await module.enable?.();
      updateScannerConfiguration();
      const loadMs = Math.round((performance.now() - startedAt) * 10) / 10;
      updateAppDiagnostics(app, "loaded", { loadedAt: Date.now(), loadMs });
      recordFeatureTiming(app.id, "load", startedAt);
      recordRuntimeDiagnostic(`appImport.${app.id}`, { reason, loadMs, updatedAt: Date.now() });
      notifyLoadedAppOfRoute(app, module);
      flushDiagnosticsSoon();
      return module;
    })();
    state.loading.set(app.id, importPromise);
    try {
      return await importPromise;
    } catch (error) {
      delete (window as unknown as Record<string, string | undefined>)[RUNTIME_IMPORT_FLAG];
      state.appDisposables.get(app.id)?.dispose();
      state.appDisposables.delete(app.id);
      abortAppWork(app.id);
      state.appAbortControllers.delete(app.id);
      state.loaded.delete(app.id);
      state.unloadingApps.delete(app.id);
      state.pendingSurfaceImports.delete(app.id);
      updateAppDiagnostics(app, "failed", { error: errorMessage(error) });
      flushDiagnosticsSoon();
      throw error;
    } finally {
      state.loading.delete(app.id);
    }
  }

  function notifyRoute(): void {
    const next = currentRoute(state.route.href);
    if (next.href === state.route.href && next.visible === state.route.visible) return;
    state.route = next;
    state.routeSurfaceImports = 0;
    for (const app of state.apps) {
      const module = state.loaded.get(app.id);
      if (module?.onRouteChange) {
        const startedAt = performance.now();
        void Promise.resolve(module.onRouteChange(next))
          .finally(() => recordFeatureTiming(app.id, "route", startedAt));
        continue;
      }
      if (shouldLoadForRoute(app, next)) void loadApp(app, "route");
    }
    scheduleTwitterScan();
    scheduleIdlePreloads();
    flushDiagnosticsSoon();
  }

  function loadRouteApps(reason: string): void {
    for (const app of state.apps) {
      if (shouldLoadForRoute(app, state.route)) void loadApp(app, reason);
    }
  }

  async function dispose(): Promise<void> {
    state.disposed = true;
    state.unsubscribeSurfaces?.();
    state.unpatchHistory?.();
    state.runtimeDisposables.dispose();
    if (state.diagnosticsTimer !== null) window.clearTimeout(state.diagnosticsTimer);
    if (state.idlePreloadTimer !== null) window.clearTimeout(state.idlePreloadTimer);
    clearStartupBudgetTimer();
    state.longTaskObserver?.disconnect();
    state.layoutShiftObserver?.disconnect();
    for (const registration of state.dockRegistrations.values()) registration.remove();
    state.dockRegistrations.clear();
    state.hideAllDockRegistration?.remove();
    state.hideAllDockRegistration = null;
    state.hubDockRegistration?.remove();
    state.hubDockRegistration = null;
    state.addOnsCatalogDockRegistration?.remove();
    state.addOnsCatalogDockRegistration = null;
    state.hubPanelRoot?.remove();
    state.hubPanelRoot = null;
    clearSurfaceDeliveryQueues();
    for (const appId of Array.from(state.appAbortControllers.keys())) abortAppWork(appId);
    const teardownResults = await Promise.allSettled(Array.from(state.loaded.entries()).map(async ([appId, module]) => {
      try {
        await Promise.resolve(module.disable?.());
      } finally {
        await Promise.resolve(module.dispose?.());
      }
      return appId;
    }));
    for (const result of teardownResults) {
      if (result.status === "rejected") console.error("milXdy app teardown failed", result.reason);
    }
    for (const disposables of state.appDisposables.values()) disposables.dispose();
    state.appDisposables.clear();
    state.appAbortControllers.clear();
    state.loaded.clear();
    state.unloadingApps.clear();
    state.pendingSurfaceImports.clear();
    cancelNetworkQueue();
  }

  function diagnostics(): AppDiagnostics[] {
    return Array.from(state.diagnostics.values());
  }

  function loadAppById(id: MilxdyAppId, reason = "userAction"): Promise<MilxdyContentAppModule | null> {
    const app = state.apps.find((candidate) => candidate.id === id);
    if (!app) return Promise.resolve(null);
    return loadApp(app, reason);
  }

  function sendAppMessage<T = unknown>(app: MilxdyAppManifest, message: unknown, label = "runtimeMessage"): Promise<T | null> {
    if (state.disposed || !state.enabledApps.has(app.id)) {
      recordImportAvoided(app, `message:${label}:disabled`);
      return Promise.resolve(null);
    }
    const messageType = extractBackgroundMessageType(message);
    if (!messageType || !appCanSendBackgroundMessage(app, messageType)) {
      recordDeniedAppMessage(app, label, messageType);
      return Promise.resolve(null);
    }
    return new Promise<T | null>((resolve, reject) => {
      const task: NetworkTask = {
        id: state.networkStats.queued + 1,
        appId: app.id,
        label: `${app.id}.${label}`,
        queuedAt: performance.now(),
        message,
        resolve: resolve as (value: unknown | null) => void,
        reject,
        canceled: false,
      };
      state.networkQueue.push(task);
      state.networkStats.queued += 1;
      state.networkStats.maxDepth = Math.max(state.networkStats.maxDepth, state.networkQueue.length);
      flushDiagnosticsSoon();
      drainNetworkQueue();
    });
  }

  function startRouteService(): void {
    state.runtimeDisposables.addEvent(window, "popstate", notifyRoute, { passive: true });
    state.runtimeDisposables.addEvent(window, "hashchange", notifyRoute, { passive: true });
    state.runtimeDisposables.addEvent(document, "visibilitychange", notifyRoute, { passive: true });
    state.unpatchHistory = patchHistory(notifyRoute);
    notifyRoute();
  }

  function observeEnablement(): void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      for (const app of state.apps) {
        const keys = area === "local" ? app.storageKeys.local : area === "sync" ? app.storageKeys.sync : undefined;
        if (!keys?.some((key) => changes[key])) continue;
        void app.isEnabled().then((enabled) => {
          if (enabled) {
            state.enabledApps.add(app.id);
            updateScannerConfiguration();
            updateDockRegistration(app);
            if (shouldLoadForRoute(app, state.route)) void loadApp(app, "enablementRoute");
            else if (shouldLoadAtStartup(app)) void loadApp(app, "enablement");
            else updateAppDiagnostics(app, "pending", { deferredReason: deferredReason(app) });
          }
          else {
            state.enabledApps.delete(app.id);
            updateScannerConfiguration();
            void disableApp(app);
          }
          syncHiddenRailItems();
          renderHubPanel();
        });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    state.runtimeDisposables.add(() => chrome.storage.onChanged.removeListener(listener));
  }

  function observeRailPins(): void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || (!changes[RAIL_PIN_KEY] && !changes[RAIL_UNPIN_KEY])) return;
      if (changes[RAIL_PIN_KEY]) applyStoredRailPins(changes[RAIL_PIN_KEY].newValue);
      if (changes[RAIL_UNPIN_KEY]) applyStoredRailUnpins(changes[RAIL_UNPIN_KEY].newValue);
      for (const app of state.apps) updateDockRegistration(app);
      syncHiddenRailItems();
      renderHubPanel();
    };
    chrome.storage.onChanged.addListener(listener);
    state.runtimeDisposables.add(() => chrome.storage.onChanged.removeListener(listener));
  }

  function observePerformanceMode(): void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes[PERFORMANCE_MODE_KEY]) return;
      state.performanceMode = normalizePerformanceMode(changes[PERFORMANCE_MODE_KEY].newValue);
      state.budget = budgetForPerformanceMode(state.performanceMode);
      activateStartupBudgetWindow();
      applyRuntimeDocumentMarkers(state.performanceMode);
      updateScannerConfiguration();
      configurePerformanceObservers();
      recordRuntimeDiagnostic("runtime.performanceMode", {
        mode: state.performanceMode,
        budget: state.budget,
        effectiveBudget: state.effectiveBudget,
        startupBudgetActive: state.startupBudgetActive,
        updatedAt: Date.now(),
      });
      drainNetworkQueue();
      scheduleIdlePreloads();
    };
    chrome.storage.onChanged.addListener(listener);
    state.runtimeDisposables.add(() => chrome.storage.onChanged.removeListener(listener));
  }

  function observeHubGeneratedSettings(): void {
    const tracked = new Map<ResetStorageArea, Set<string>>([
      ["local", new Set()],
      ["sync", new Set()],
    ]);
    for (const app of state.apps) {
      for (const setting of hubGeneratedFeatureSettings(app)) {
        tracked.get(setting.storage.area)?.add(setting.storage.key);
      }
    }
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" && area !== "sync") return;
      const keys = tracked.get(area);
      if (!keys || !Object.keys(changes).some((key) => keys.has(key))) return;
      renderHubPanel();
    };
    chrome.storage.onChanged.addListener(listener);
    state.runtimeDisposables.add(() => chrome.storage.onChanged.removeListener(listener));
  }

  function observeAppIconTheme(): void {
    const update = () => {
      const nextTheme = currentAppIconTheme();
      if (state.iconTheme === nextTheme) return;
      state.iconTheme = nextTheme;
      updateThemedAppIcons();
      renderHubPanel();
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-milxdy-x-theme", "data-milxdy-settings-theme", "style", "class"],
    });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);
    state.runtimeDisposables.add(() => {
      observer.disconnect();
      media?.removeEventListener?.("change", update);
    });
  }

  function disableApp(app: MilxdyAppManifest): void {
    state.enabledApps.delete(app.id);
    updateScannerConfiguration();
    updateAppDiagnostics(app, "disabled");
    flushDiagnosticsSoon();
    state.dockRegistrations.get(app.id)?.remove();
    state.dockRegistrations.delete(app.id);
    state.pendingSurfaceImports.delete(app.id);
    clearSurfaceDeliveryQueueForApp(app.id);
    cancelNetworkQueueForApp(app.id);
    const module = state.loaded.get(app.id);
    if (state.unloadingApps.has(app.id)) return;
    if (!module) return;
    state.unloadingApps.add(app.id);
    abortAppWork(app.id);
    void Promise.resolve(module.disable?.())
      .then(() => Promise.resolve(module.dispose?.()))
      .finally(() => {
        state.appDisposables.get(app.id)?.dispose();
        state.appDisposables.delete(app.id);
        state.appAbortControllers.delete(app.id);
        state.loaded.delete(app.id);
        state.unloadingApps.delete(app.id);
        updateScannerConfiguration();
        reconcileAppAfterUnload(app);
        flushDiagnosticsSoon();
      });
  }

  function reconcileAppAfterUnload(app: MilxdyAppManifest): void {
    if (state.disposed || !state.enabledApps.has(app.id)) return;
    updateDockRegistration(app);
    if (shouldLoadAtStartup(app)) void loadApp(app, "reenableAfterUnload");
    else updateAppDiagnostics(app, "pending", { deferredReason: deferredReason(app) });
    syncHiddenRailItems();
    renderHubPanel();
  }

  function abortAppWork(appId: MilxdyAppId): void {
    const controller = state.appAbortControllers.get(appId);
    if (!controller || controller.signal.aborted) return;
    controller.abort();
  }

  function resetRuntimeCounters(): void {
    state.importAvoidance = {};
    state.surfaceCounts = {};
    state.surfaceDeliveries = {};
    state.surfaceSkips = {};
    state.surfaceDeliveryCache = new WeakMap();
    state.surfaceDeliveryKeyCache.clear();
    state.surfaceDeliveryStats = {
      queued: 0,
      droppedQueueCap: 0,
      dedupedByElement: 0,
      dedupedByKey: 0,
      keyCacheSize: 0,
      drains: 0,
      maxQueueDepth: 0,
      lastDrainBatchSize: 0,
      lastDrainMs: 0,
      maxDrainMs: 0,
    };
    state.tweetScaffoldSignatures = new WeakMap();
    state.tweetScaffoldStats = createTweetScaffoldStats();
    state.routeSurfaceImports = 0;
  }

  function activateStartupBudgetWindow(): void {
    clearStartupBudgetTimer();
    const startup = state.budget.startup;
    if (state.performanceMode === "developer" || !startup || startup.durationMs <= 0) {
      state.effectiveBudget = state.budget;
      state.startupBudgetActive = false;
      return;
    }
    const { durationMs, ...overrides } = startup;
    state.effectiveBudget = {
      ...state.budget,
      ...overrides,
      mode: state.budget.mode,
      startup: state.budget.startup,
    };
    state.startupBudgetActive = true;
    state.startupBudgetTimer = window.setTimeout(() => {
      state.startupBudgetTimer = null;
      state.effectiveBudget = state.budget;
      state.startupBudgetActive = false;
      updateScannerConfiguration();
      scheduleTwitterScan();
      drainNetworkQueue();
      scheduleIdlePreloads();
      flushDiagnosticsSoon();
      recordRuntimeDiagnostic("runtime.startupBudget", {
        mode: state.performanceMode,
        restored: true,
        durationMs,
        updatedAt: Date.now(),
      });
    }, durationMs);
  }

  function clearStartupBudgetTimer(): void {
    if (state.startupBudgetTimer === null) return;
    window.clearTimeout(state.startupBudgetTimer);
    state.startupBudgetTimer = null;
  }

  function updateScannerConfiguration(): void {
    state.surfaceAppIndex = buildSurfaceAppIndex();
    configureTwitterScannerFromEffectiveBudget(Array.from(state.surfaceAppIndex.keys()));
  }

  function configureTwitterScannerFromEffectiveBudget(surfaceKinds?: readonly TwitterSurfaceKind[]): void {
    const budget = state.effectiveBudget;
    configureTwitterScanner({
      safetyScanIntervalMs: budget.safetyScanIntervalMs,
      maxSurfacesPerFlush: budget.maxScannerSurfacesPerFlush,
      maxSurfacesPerScrollFlush: budget.maxScannerSurfacesPerScrollFlush,
      maxSurfacesPerFullScan: budget.maxScannerSurfacesPerFullScan,
      maxPendingSurfaces: budget.maxScannerPendingSurfaces,
      scrollSettleMs: budget.scrollSettleMs,
      surfaceKinds,
    });
  }

  function buildSurfaceAppIndex(): Map<TwitterSurfaceKind, MilxdyAppManifest[]> {
    const index = new Map<TwitterSurfaceKind, MilxdyAppManifest[]>();
    for (const app of state.apps) {
      if (!state.enabledApps.has(app.id)) continue;
      for (const surface of scannerSurfacesForApp(app)) {
        if (surface === "tweet" || surface === "xArticle" || surface === "userCell" || surface === "notification" || surface === "directMessage" || surface === "profile") {
          if (surfaceDeliveryBlockedByPerformance(app, surface)) continue;
          const appsForSurface = index.get(surface) || [];
          appsForSurface.push(app);
          index.set(surface, appsForSurface);
        }
      }
    }
    return index;
  }

  function interestedSurfaceKinds(): TwitterSurfaceKind[] {
    return Array.from(state.surfaceAppIndex.keys());
  }

  function scannerSurfacesForApp(app: MilxdyAppManifest): readonly (TwitterSurfaceKind | string)[] {
    if (state.loaded.has(app.id) && app.deliverySurfaces) return app.deliverySurfaces;
    return app.surfaces;
  }

  function handleSurface(surface: TwitterSurface): void {
    if (document.hidden) return;
    state.surfaceCounts[surface.kind] = (state.surfaceCounts[surface.kind] || 0) + 1;
    const surfaceIsWithinBudget = surfaceWithinBudget(surface);
    if (surface.kind === "tweet" && surfaceIsWithinBudget) prepareTweetScaffold(surface);
    for (const app of state.surfaceAppIndex.get(surface.kind) || []) {
      const blockedReason = surfaceDeliveryBlockedByPerformance(app, surface.kind);
      if (blockedReason) {
        recordImportAvoided(app, `surface:${surface.kind}:${blockedReason}`);
        recordSurfaceSkip(app, surface, blockedReason);
        continue;
      }
      const module = state.loaded.get(app.id);
      const shouldDeliverSurface = appDeliversSurface(app, surface.kind);
      // Reserve the RemiStats action-row slot before its lazy module finishes
      // loading so native actions and the poke control do not jump columns.
      if (app.id === "remistats" && surfaceIsWithinBudget && shouldDeliverSurface) {
        prepareTweetFeatureScaffold(app, surface);
      }
      if (!module?.onSurface) {
        const importDecision = app.loadTriggers.includes("surface")
          ? surfaceImportDecision(app, surface, surfaceIsWithinBudget)
          : { mode: "blocked" as const, reason: "noSurfaceTrigger" };
        if (importDecision.mode === "immediate") {
          reserveSurfaceImport(app);
          void loadApp(app, `surface:${surface.kind}`).then((loaded) => {
            if (loaded?.onSurface && shouldDeliverSurface) deliverSurface(app, loaded, surface, surfaceIsWithinBudget);
          });
        } else if (importDecision.mode === "idle") {
          scheduleIdleSurfaceImport(app, surface, surfaceIsWithinBudget, shouldDeliverSurface);
        } else {
          recordImportAvoided(app, `surface:${surface.kind}:${importDecision.reason}`);
          recordSurfaceSkip(app, surface, importDecision.reason);
        }
        continue;
      }
      if (!shouldDeliverSurface) {
        recordSurfaceSkip(app, surface, "deliverySurface");
        continue;
      }
      deliverSurface(app, module, surface, surfaceIsWithinBudget);
    }
  }

  function deliverSurface(app: MilxdyAppManifest, module: MilxdyContentAppModule, surface: TwitterSurface, surfaceIsWithinBudget: boolean): void {
    if (!surfaceIsWithinBudget) {
      recordImportAvoided(app, `offscreen:${surface.kind}`);
      recordSurfaceSkip(app, surface, "offscreen");
      return;
    }
    prepareTweetFeatureScaffold(app, surface);
    if (surfaceWasRecentlyDelivered(app, surface)) {
      recordSurfaceSkip(app, surface, "dedupe");
      return;
    }
    recordSurfaceDelivery(app, surface);
    queueSurfaceDelivery({
      app,
      module,
      surface,
      startedAt: performance.now(),
      heightBefore: measureSurfaceHeight(surface),
    });
  }

  function queueSurfaceDelivery(delivery: AppSurfaceDelivery): void {
    let queue = state.surfaceDeliveryQueues.get(delivery.app.id);
    if (!queue) {
      queue = { deliveries: [], cancelDrain: null };
      state.surfaceDeliveryQueues.set(delivery.app.id, queue);
    }
    while (queue.deliveries.length >= state.effectiveBudget.maxSurfaceDeliveryQueuePerApp) {
      const dropped = queue.deliveries.shift();
      if (!dropped) break;
      state.surfaceDeliveryStats.droppedQueueCap += 1;
      recordSurfaceSkip(dropped.app, dropped.surface, "queueCap");
    }
    queue.deliveries.push(delivery);
    state.surfaceDeliveryStats.queued += 1;
    state.surfaceDeliveryStats.maxQueueDepth = Math.max(state.surfaceDeliveryStats.maxQueueDepth, queue.deliveries.length);
    scheduleSurfaceDeliveryDrain(delivery.app.id, queue);
  }

  function scheduleSurfaceDeliveryDrain(appId: MilxdyAppId, queue: AppSurfaceDeliveryQueue): void {
    if (queue.cancelDrain) return;
    queue.cancelDrain = scheduler.idle(() => {
      queue.cancelDrain = null;
      void drainSurfaceDeliveryQueue(appId, queue);
    }, { timeout: state.effectiveBudget.idleSurfaceTimeoutMs });
  }

  async function drainSurfaceDeliveryQueue(appId: MilxdyAppId, queue: AppSurfaceDeliveryQueue): Promise<void> {
    if (state.disposed || !state.enabledApps.has(appId)) {
      clearSurfaceDeliveryQueueForApp(appId);
      return;
    }
    const startedAt = performance.now();
    const batchSize = Math.max(1, state.effectiveBudget.maxIdleTasksPerFrame);
    const batch = queue.deliveries.splice(0, batchSize);
    try {
      for (const delivery of batch) {
        if (state.disposed || !state.enabledApps.has(delivery.app.id)) break;
        if (state.loaded.get(delivery.app.id) !== delivery.module) continue;
        if (!delivery.surface.element.isConnected) {
          recordSurfaceSkip(delivery.app, delivery.surface, "disconnected");
          continue;
        }
        try {
          await Promise.resolve(delivery.module.onSurface?.(delivery.surface));
        } catch (error) {
          console.error(`milXdy ${delivery.app.id} surface handler failed`, error);
          updateAppDiagnostics(delivery.app, "failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          recordFeatureTiming(delivery.app.id, `surface.${delivery.surface.kind}`, delivery.startedAt);
          recordSurfaceHeightChange(delivery.app, delivery.surface, delivery.heightBefore);
        }
      }
    } finally {
      state.surfaceDeliveryStats.drains += 1;
      state.surfaceDeliveryStats.lastDrainBatchSize = batch.length;
      state.surfaceDeliveryStats.lastDrainMs = Math.round((performance.now() - startedAt) * 10) / 10;
      state.surfaceDeliveryStats.maxDrainMs = Math.max(state.surfaceDeliveryStats.maxDrainMs, state.surfaceDeliveryStats.lastDrainMs);
      flushDiagnosticsSoon();
    }
    if (queue.deliveries.length > 0) scheduleSurfaceDeliveryDrain(appId, queue);
    else state.surfaceDeliveryQueues.delete(appId);
  }

  function clearSurfaceDeliveryQueueForApp(appId: MilxdyAppId): void {
    const queue = state.surfaceDeliveryQueues.get(appId);
    if (!queue) return;
    queue.cancelDrain?.();
    queue.deliveries.length = 0;
    state.surfaceDeliveryQueues.delete(appId);
  }

  function clearSurfaceDeliveryQueues(): void {
    for (const appId of Array.from(state.surfaceDeliveryQueues.keys())) clearSurfaceDeliveryQueueForApp(appId);
  }

  function prepareTweetScaffold(surface: TwitterSurface): void {
    applyTweetScaffold(surface, {
      headerMarkers: state.enabledApps.has("rootVisuals"),
      postReadingSlot: false,
      remistatsSlots: false,
    });
  }

  function prepareTweetFeatureScaffold(app: MilxdyAppManifest, surface: TwitterSurface): void {
    if (surface.kind !== "tweet") return;
    const needsPostReadingSlot = app.id === "post-reading";
    const needsRemistatsSlots = app.id === "remistats";
    if (!needsPostReadingSlot && !needsRemistatsSlots) return;
    applyTweetScaffold(surface, {
      headerMarkers: state.enabledApps.has("rootVisuals"),
      postReadingSlot: needsPostReadingSlot,
      remistatsSlots: needsRemistatsSlots,
    });
  }

  function applyTweetScaffold(
    surface: TwitterSurface,
    options: { headerMarkers: boolean; postReadingSlot: boolean; remistatsSlots: boolean },
  ): void {
    if (tweetSurfaceIsInsideQuote(surface)) return;
    if (tweetSurfaceIsInsideComposerDialog(surface)) return;
    const placement = document.documentElement.dataset.milxdyPostReadingButtonPlacement === "actions" ? "actions" : "header";
    const pokePlacement = document.documentElement.dataset.milxdyVisualPokePlacement === "top" ? "top" : "actions";
    const requestedTokens = [
      options.headerMarkers ? "header" : "",
      options.postReadingSlot ? `post:${placement}` : "",
      options.remistatsSlots ? `remistats:${pokePlacement}` : "",
    ].filter(Boolean);
    if (requestedTokens.length === 0) return;
    state.tweetScaffoldStats.attempts += 1;
    const previousSignature = state.tweetScaffoldSignatures.get(surface.element) || "";
    const completedTokens = new Set(previousSignature.split("|").filter(Boolean));
    for (const token of requestedTokens) {
      if (completedTokens.has(token) && !tweetScaffoldTokenPresent(surface, token)) completedTokens.delete(token);
    }
    if (requestedTokens.every((token) => completedTokens.has(token))) {
      state.tweetScaffoldStats.skipsBySignature += 1;
      flushDiagnosticsSoon();
      return;
    }

    const startedAt = performance.now();
    injectTweetScaffoldStyles();
    if (surface.element.dataset.milxdyTweetScaffold !== "true") surface.element.dataset.milxdyTweetScaffold = "true";
    if (options.headerMarkers && !completedTokens.has("header") && markTweetHeaderScaffold(surface.element)) {
      completedTokens.add("header");
    }
    if (options.postReadingSlot && !completedTokens.has(`post:${placement}`)) {
      const result = ensurePostReadingButtonSlot(surface);
      if (result === "created") recordTweetScaffoldSlotCreated(`post-reading-${placement}`);
      if (result !== "missing") completedTokens.add(`post:${placement}`);
    }
    if (options.remistatsSlots && !completedTokens.has(`remistats:${pokePlacement}`)) {
      const badgeResult = ensureRemistatsBadgeSlot(surface);
      const actionResult = pokePlacement === "top" ? "present" : ensureRemistatsActionPokeSlot(surface);
      if (badgeResult === "created") recordTweetScaffoldSlotCreated("remistats-badge");
      if (actionResult === "created") recordTweetScaffoldSlotCreated("remistats-action-poke");
      if (badgeResult !== "missing" && actionResult !== "missing") completedTokens.add(`remistats:${pokePlacement}`);
    }
    state.tweetScaffoldSignatures.set(surface.element, Array.from(completedTokens).sort().join("|"));
    const duration = Math.round((performance.now() - startedAt) * 10) / 10;
    state.tweetScaffoldStats.lastDurationMs = duration;
    state.tweetScaffoldStats.durationMs = Math.round((state.tweetScaffoldStats.durationMs + duration) * 10) / 10;
    state.tweetScaffoldStats.maxDurationMs = Math.max(state.tweetScaffoldStats.maxDurationMs, duration);
    flushDiagnosticsSoon();
  }

  function tweetScaffoldTokenPresent(surface: TwitterSurface, token: string): boolean {
    if (token === "header") {
      return Boolean(findOwnedTweetNode(surface, '[data-milxdy-tweet-header="true"], [data-milxdy-display-name="true"], [data-milxdy-metadata-row="true"]'));
    }
    if (token === "post:header") {
      return Boolean(findOwnedTweetNode(surface, '[data-milxdy-tweet-slot="post-reading-header-action"]'));
    }
    if (token === "post:actions") {
      return Boolean(findOwnedTweetNode(surface, '[data-milxdy-tweet-slot="post-reading-action"]'));
    }
    if (token === "remistats:top") {
      return Boolean(findOwnedTweetNode(surface, '[data-milxdy-tweet-slot="remistats-badge"]'));
    }
    if (token === "remistats:actions") {
      const hasBadge = Boolean(findOwnedTweetNode(surface, '[data-milxdy-tweet-slot="remistats-badge"]'));
      const hasAction = Boolean(findOwnedTweetNode(
        surface,
        '[data-milxdy-tweet-slot="remistats-action-poke"], [data-reminet-action-poke-group="true"]',
      ));
      return hasBadge && hasAction;
    }
    return false;
  }

  function tweetNodeBelongsToSurface(surface: { element: HTMLElement }, node: HTMLElement | null | undefined): boolean {
    if (!node || !surface.element.contains(node)) return false;
    const ownerTweet = node.closest<HTMLElement>('[data-testid="tweet"]');
    if (ownerTweet && ownerTweet !== surface.element && surface.element.contains(ownerTweet)) return false;
    const quoteTweet = node.closest<HTMLElement>('[data-testid="quoteTweet"]');
    if (quoteTweet && quoteTweet !== surface.element && surface.element.contains(quoteTweet)) return false;
    return true;
  }

  function tweetSurfaceIsInsideQuote(surface: { element: HTMLElement }): boolean {
    const quoteTweet = surface.element.closest<HTMLElement>('[data-testid="quoteTweet"]');
    return Boolean(quoteTweet && quoteTweet !== surface.element);
  }

  function tweetSurfaceIsInsideComposerDialog(surface: { element: HTMLElement }): boolean {
    const dialog = surface.element.closest<HTMLElement>('[role="dialog"], [aria-modal="true"]');
    return Boolean(dialog?.querySelector('[data-testid^="tweetTextarea_"]'));
  }

  function findOwnedTweetNode<T extends HTMLElement = HTMLElement>(surface: TwitterSurface, selector: string): T | undefined {
    return Array.from(surface.element.querySelectorAll<T>(selector))
      .find((element) => tweetNodeBelongsToSurface(surface, element));
  }

  function recordTweetScaffoldSlotCreated(slot: string): void {
    state.tweetScaffoldStats.createdSlots += 1;
    state.tweetScaffoldStats.createdBySlot[slot] = (state.tweetScaffoldStats.createdBySlot[slot] || 0) + 1;
  }

  function ensurePostReadingButtonSlot(surface: TwitterSurface): ScaffoldResult {
    const placement = document.documentElement.dataset.milxdyPostReadingButtonPlacement || "auto";
    return placement === "actions" ? ensurePostReadingActionSlot(surface) : ensurePostReadingHeaderSlot(surface);
  }

  function ensurePostReadingHeaderSlot(surface: TwitterSurface): ScaffoldResult {
    if (surface.element.querySelector('[data-milxdy-tweet-slot="post-reading-header-action"]')) return "present";
    const actionRow = surface.actionRow;
    const anchor = Array.from(surface.element.querySelectorAll<HTMLElement>('button, [role="button"], a, [aria-label], [data-testid]'))
      .find((button) => {
        if (button.closest('[data-testid="quoteTweet"]')) return false;
        if (button.closest('[data-testid="Tweet-User-Avatar"]')) return false;
        if (actionRow?.contains(button)) return false;
        const text = [
          button.getAttribute("aria-label") || "",
          button.getAttribute("data-testid") || "",
          button.textContent || "",
          button instanceof HTMLAnchorElement ? button.href : "",
        ].join(" ").toLowerCase();
        return text.includes("grok");
      })
      || Array.from(surface.element.querySelectorAll<HTMLElement>('[data-testid="caret"], [aria-label*="More"], [aria-label*="more"], button, [role="button"], a'))
        .find((button) => {
          if (button.closest('[data-testid="quoteTweet"]')) return false;
          if (button.closest('[data-testid="Tweet-User-Avatar"]')) return false;
          if (actionRow?.contains(button)) return false;
          if (isShowMoreExpansionControl(button)) return false;
          const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""}`.toLowerCase();
          return label.includes("caret") || label.includes("more");
        });
    if (!anchor?.parentElement || anchor.parentElement.closest('[data-testid="Tweet-User-Avatar"]')) return "missing";
    const slot = document.createElement("span");
    slot.dataset.milxdyTweetSlot = "post-reading-header-action";
    slot.dataset.postReadingButtonSlot = "true";
    slot.className = "post-reading-button-slot post-reading-button-slot--header";
    slot.setAttribute("aria-hidden", "true");
    if (anchor.getAttribute("data-testid") === "caret") anchor.parentElement.insertBefore(slot, anchor);
    else anchor.parentElement.insertBefore(slot, anchor.nextSibling);
    markPostReadingHeaderControlHost(slot);
    return "created";
  }

  function markPostReadingHeaderControlHost(slot: HTMLElement): void {
    let host = slot.parentElement;
    for (let depth = 0; host && depth < 5; depth += 1, host = host.parentElement) {
      const buttons = Array.from(host.querySelectorAll<HTMLElement>('button, [role="button"]'));
      const hasTweetControl = buttons.some((button) => {
        if (isShowMoreExpansionControl(button)) return false;
        const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""}`.toLowerCase();
        return label.includes("grok") || label.includes("caret") || label.includes("more");
      });
      if (!hasTweetControl || !host.contains(slot)) continue;
      host.dataset.milxdyPostReadingHeaderControls = "true";
      return;
    }
  }

  function ensurePostReadingActionSlot(surface: TwitterSurface): ScaffoldResult {
    if (surface.element.querySelector('[data-milxdy-tweet-slot="post-reading-action"]')) return "present";
    const actionRow = surface.actionRow;
    if (!actionRow) return "missing";
    const slot = document.createElement("span");
    slot.dataset.milxdyTweetSlot = "post-reading-action";
    slot.className = "post-reading-button-slot";
    slot.setAttribute("aria-hidden", "true");
    const anchor = Array.from(actionRow.querySelectorAll<HTMLElement>('[data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [role="button"], button'))
      .filter((button) => !button.closest('[data-testid="quoteTweet"]'))
      .at(-1);
    if (anchor?.parentElement) anchor.parentElement.insertBefore(slot, anchor.nextSibling);
    else actionRow.append(slot);
    return "created";
  }

  function ensureRemistatsBadgeSlot(surface: TwitterSurface): ScaffoldResult {
    if (findOwnedTweetNode(surface, '[data-milxdy-tweet-slot="remistats-badge"]')) return "present";
    const anchor = findOwnedTweetNode(surface, "time")
      || findOwnedTweetNode(surface, '[data-testid="User-Name"] [dir="ltr"], [data-testid="User-Name"]');
    const parent = anchor?.parentElement;
    if (!anchor || !parent) return "missing";
    const slot = document.createElement("span");
    slot.dataset.milxdyTweetSlot = "remistats-badge";
    slot.dataset.reminetBadgeSlot = "true";
    slot.dataset.reminetState = "reserved";
    slot.className = "reminet-badge-slot";
    slot.setAttribute("aria-hidden", "true");
    parent.insertBefore(slot, anchor.nextSibling);
    return "created";
  }

  function ensureRemistatsActionPokeSlot(surface: TwitterSurface): ScaffoldResult {
    if (findOwnedTweetNode(surface, '[data-reminet-action-poke-group="true"], [data-milxdy-tweet-slot="remistats-action-poke"]')) return "present";
    const actionRow = surface.actionRow;
    if (!actionRow) return "missing";
    const slot = document.createElement("span");
    slot.dataset.milxdyTweetSlot = "remistats-action-poke";
    slot.dataset.reminetActionPokeGroup = "true";
    slot.dataset.reminetPokeState = "empty";
    slot.className = "reminet-action-poke-group";
    slot.setAttribute("aria-hidden", "true");
    const like = actionRow.querySelector<HTMLElement>('[data-testid="like"], [data-testid="unlike"]');
    const likeSlot = like?.closest<HTMLElement>('[role="group"] > div') || like?.parentElement?.parentElement;
    if (likeSlot) likeSlot.insertAdjacentElement("afterend", slot);
    else actionRow.append(slot);
    return "created";
  }

  function markTweetHeaderScaffold(tweet: HTMLElement): boolean {
    let marked = false;
    for (const userName of Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="User-Name"]'))) {
      if (!tweetNodeBelongsToSurface({ element: tweet }, userName)) continue;
      const displayNameLink = findDisplayNameLink(userName);
      if (!displayNameLink) continue;
      const displayRow = displayNameLink.parentElement;
      const metadataRow = findMetadataRow(userName, displayRow);
      userName.dataset.milxdyTweetHeader = "true";
      displayRow?.setAttribute("data-milxdy-display-name-row", "true");
      displayNameLink.setAttribute("data-milxdy-display-name", "true");
      metadataRow?.setAttribute("data-milxdy-metadata-row", "true");
      marked = true;
    }
    return marked;
  }

  function isShowMoreExpansionControl(button: HTMLElement): boolean {
    const text = (button.innerText || button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const label = (button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
    return text === "show more" || label === "show more";
  }

  function findDisplayNameLink(userName: HTMLElement): HTMLElement | null {
    const links = Array.from(userName.querySelectorAll<HTMLElement>('a[role="link"], a[href^="/"]'));
    return links.find((link) => {
      if (link.querySelector("time")) return false;
      const text = (link.textContent || "").trim();
      return Boolean(text) && !text.startsWith("@");
    }) || null;
  }

  function findMetadataRow(userName: HTMLElement, displayRow: HTMLElement | null): HTMLElement | null {
    const time = userName.querySelector("time");
    const handle = Array.from(userName.querySelectorAll<HTMLElement>("span")).find((span) => {
      return (span.textContent || "").trim().startsWith("@");
    });
    const candidates = [time, handle].flatMap((element): HTMLElement[] => {
      const rows: HTMLElement[] = [];
      let current = element?.parentElement;
      while (current && current !== userName) {
        if (current.tagName === "DIV") rows.push(current);
        current = current.parentElement;
      }
      return rows;
    });
    return candidates.find((row) => row !== displayRow && !row.contains(displayRow)) || (displayRow?.parentElement ?? null);
  }

  function registerDockMetadata(app: MilxdyAppManifest): void {
    if (!app.dock || app.available === false || state.dockRegistrations.has(app.id)) return;
    const registration = getOverlayDock().register({
      id: app.id,
      label: app.dock.label,
      icon: app.dock.icon ? runtimeAssetUrl(resolveAppIconAsset(app.dock.icon)) : dockIconForApp(app),
      title: app.name,
      active: false,
      onActivate: () => {
        void loadApp(app, "dockOpen").then((module) => {
          void Promise.resolve(module?.open?.());
        });
      },
      onDeactivate: () => {
        const module = state.loaded.get(app.id);
        void Promise.resolve(module?.close?.());
      },
    });
    state.dockRegistrations.set(app.id, registration);
  }

  function updateThemedAppIcons(): void {
    for (const app of state.apps) {
      const registration = state.dockRegistrations.get(app.id);
      if (!registration || !app.dock?.icon) continue;
      registration.update({ icon: runtimeAssetUrl(resolveAppIconAsset(app.dock.icon)) });
    }
  }

  function updateDockRegistration(app: MilxdyAppManifest): void {
    if (!app.dock) return;
    if (state.enabledApps.has(app.id) && isRailPinned(app)) {
      registerDockMetadata(app);
      return;
    }
    state.dockRegistrations.get(app.id)?.remove();
    state.dockRegistrations.delete(app.id);
  }

  async function loadRailPins(): Promise<void> {
    const stored = await safeLocalGet({ [RAIL_PIN_KEY]: null, [RAIL_UNPIN_KEY]: [] });
    applyStoredRailPins(stored?.[RAIL_PIN_KEY]);
    applyStoredRailUnpins(stored?.[RAIL_UNPIN_KEY]);
  }

  async function loadFirstRunState(): Promise<void> {
    const stored = await safeLocalGet({ [FIRST_RUN_STATUS_KEY]: "complete" });
    state.firstRunPending = stored?.[FIRST_RUN_STATUS_KEY] === "pending";
  }

  function applyStoredRailPins(value: unknown): void {
    if (!Array.isArray(value)) {
      state.railPinsExplicit = false;
      state.railPinnedApps.clear();
      return;
    }
    state.railPinsExplicit = true;
    state.railPinnedApps = new Set(value.filter((id): id is MilxdyAppId => typeof id === "string") as MilxdyAppId[]);
  }

  function applyStoredRailUnpins(value: unknown): void {
    state.railUnpinnedApps = new Set(
      Array.isArray(value)
        ? value.filter((id): id is MilxdyAppId => typeof id === "string") as MilxdyAppId[]
        : [],
    );
  }

  function isRailPinned(app: MilxdyAppManifest): boolean {
    if (!app.dock || app.available === false || app.hub?.rail.supported === false) return false;
    if (state.railUnpinnedApps.has(app.id)) return false;
    if (state.railPinnedApps.has(app.id)) return true;
    return state.enabledApps.has(app.id) && app.hub?.rail.defaultPinned === true;
  }

  function currentRailPins(): MilxdyAppId[] {
    const next = new Set(state.railPinnedApps);
    for (const app of state.apps
      .filter((app) => app.available !== false && app.dock && app.hub?.rail.supported !== false && app.hub?.rail.defaultPinned === true && state.enabledApps.has(app.id))
      .filter((app) => !state.railUnpinnedApps.has(app.id))) {
      next.add(app.id);
    }
    return Array.from(next);
  }

  function ensureDefaultRailPin(app: MilxdyAppManifest): void {
    if (!app.dock || app.available === false || app.hub?.rail.supported === false || app.hub?.rail.defaultPinned !== true) return;
    if (state.railUnpinnedApps.has(app.id) || state.railPinnedApps.has(app.id)) return;
    state.railPinnedApps.add(app.id);
    state.railPinsExplicit = true;
    void persistRailVisibility();
  }

  function setRailPinned(appId: MilxdyAppId, pinned: boolean): void {
    const next = new Set(currentRailPins());
    if (pinned) {
      next.add(appId);
      state.railUnpinnedApps.delete(appId);
    } else {
      next.delete(appId);
      state.railUnpinnedApps.add(appId);
    }
    state.railPinsExplicit = true;
    state.railPinnedApps = next;
    void persistRailVisibility();
    const app = state.apps.find((candidate) => candidate.id === appId);
    if (app) updateDockRegistration(app);
    syncHiddenRailItems();
    renderHubPanel();
  }

  function persistRailVisibility(): Promise<boolean> {
    return safeLocalSet({
      [RAIL_PIN_KEY]: Array.from(state.railPinnedApps),
      [RAIL_UNPIN_KEY]: Array.from(state.railUnpinnedApps),
    });
  }

  function setAppEnabled(app: MilxdyAppManifest, enabled: boolean): void {
    if (app.available === false) {
      recordRuntimeDiagnostic(`hub.enablement.${app.id}`, {
        enabled: false,
        error: app.unavailableReason || "unavailableInBuild",
        updatedAt: Date.now(),
      });
      renderHubPanel();
      return;
    }
    const performanceBlock = enabled ? appEnableBlockedByPerformance(app) : null;
    if (performanceBlock) {
      recordRuntimeDiagnostic(`hub.enablement.${app.id}`, {
        enabled: false,
        error: performanceBlock,
        mode: state.performanceMode,
        updatedAt: Date.now(),
      });
      window.alert(performanceBlock);
      renderHubPanel();
      return;
    }
    if (!app.setEnabled) return;
    const startedAt = performance.now();
    void app.setEnabled(enabled)
      .then(() => app.isEnabled())
      .then((isEnabled) => {
        if (isEnabled) {
          state.enabledApps.add(app.id);
          ensureDefaultRailPin(app);
          updateScannerConfiguration();
          updateDockRegistration(app);
          if (shouldLoadForRoute(app, state.route)) void loadApp(app, "hubEnableRoute");
          else if (shouldLoadAtStartup(app)) void loadApp(app, "hubEnable");
          else updateAppDiagnostics(app, "pending", { deferredReason: deferredReason(app) });
        } else {
          state.enabledApps.delete(app.id);
          updateScannerConfiguration();
          void disableApp(app);
        }
        syncHiddenRailItems();
        renderHubPanel();
        recordRuntimeDiagnostic(`hub.enablement.${app.id}`, {
          enabled: isEnabled,
          updateMs: Math.round((performance.now() - startedAt) * 10) / 10,
          updatedAt: Date.now(),
        });
      })
      .catch((error) => {
        recordRuntimeDiagnostic(`hub.enablement.${app.id}`, {
          error: errorMessage(error),
          updatedAt: Date.now(),
        });
        renderHubPanel();
      });
  }

  function resetAppSettings(app: MilxdyAppManifest): void {
    if (app.available === false) return;
    const plan = appResetPlan(app);
    if (!hasResetWork(plan)) return;
    const authoredDataWarning = app.id === "wikiLinks" || app.id === "miladymaxxer"
      ? " This also resets user-authored aliases, deny terms, and handle lists for this app."
      : "";
    if (!window.confirm(`Reset ${app.name} settings to their defaults?${authoredDataWarning}`)) return;
    const startedAt = performance.now();
    void executeAppResetPlan(plan)
      .then(async (result) => {
        const isEnabled = await app.isEnabled();
        if (isEnabled) {
          state.enabledApps.add(app.id);
          ensureDefaultRailPin(app);
          updateScannerConfiguration();
          updateDockRegistration(app);
          if (shouldLoadForRoute(app, state.route)) void loadApp(app, "hubResetRoute");
          else if (shouldLoadAtStartup(app)) void loadApp(app, "hubReset");
          else updateAppDiagnostics(app, "pending", { deferredReason: deferredReason(app) });
        } else {
          state.enabledApps.delete(app.id);
          updateScannerConfiguration();
          void disableApp(app);
        }
        syncHiddenRailItems();
        renderHubPanel();
        recordRuntimeDiagnostic(`hub.reset.${app.id}`, {
          enabled: isEnabled,
          localKeys: plan.localKeys,
          syncKeys: plan.syncKeys,
          settingDefaults: plan.settingDefaults.map((entry) => settingResetDiagnostic(entry)),
          propertyDefaults: plan.propertyDefaults.map((entry) => settingResetDiagnostic(entry)),
          propertyRemovals: plan.propertyRemovals.map((entry) => settingResetDiagnostic(entry)),
          skippedSharedKeys: plan.skippedSharedKeys,
          skippedSettings: plan.skippedSettings,
          localRemoved: result.localRemoved,
          syncRemoved: result.syncRemoved,
          localSet: result.localSet,
          syncSet: result.syncSet,
          updateMs: Math.round((performance.now() - startedAt) * 10) / 10,
          updatedAt: Date.now(),
        });
      })
      .catch((error) => {
        recordRuntimeDiagnostic(`hub.reset.${app.id}`, {
          localKeys: plan.localKeys,
          syncKeys: plan.syncKeys,
          skippedSharedKeys: plan.skippedSharedKeys,
          skippedSettings: plan.skippedSettings,
          error: errorMessage(error),
          updatedAt: Date.now(),
        });
        renderHubPanel();
      });
  }

  function maybeOpenFirstRunHub(): void {
    if (!state.firstRunPending || document.hidden) return;
    scheduler.timeout(() => {
      if (state.disposed || !state.firstRunPending) return;
      openHubPanel();
    }, 800);
  }

  function completeFirstRun(status: "complete" | "skipped"): void {
    state.firstRunPending = false;
    void safeLocalSet({ [FIRST_RUN_STATUS_KEY]: status });
    renderHubPanel();
  }

  function applyAppPreset(preset: AppPreset): void {
    const startedAt = performance.now();
    const performanceMode: PerformanceMode = preset === "lite" ? "fast" : preset === "full" ? "full" : "balanced";
    const performanceBudget = budgetForPerformanceMode(performanceMode);
    const toggleableApps = state.apps
      .filter((app) => app.available !== false && app.setEnabled);
    const presetApps = toggleableApps
      .filter((app) => app.hub?.presets.includes(preset) === true);
    const desiredEnabledAppIds = new Set<MilxdyAppId>(presetApps.map((app) => app.id));
    const blockedApps = presetApps
      .filter((app) => appEnableBlockedForPerformance(app, performanceMode, performanceBudget));
    const blockedAppIds = new Set<MilxdyAppId>(blockedApps.map((app) => app.id));
    const convergenceTasks = toggleableApps
      .map(async (app) => {
        const enabled = desiredEnabledAppIds.has(app.id) && !blockedAppIds.has(app.id);
        await app.setEnabled?.(enabled);
        if (enabled) state.enabledApps.add(app.id);
        else state.enabledApps.delete(app.id);
        updateDockRegistration(app);
      });
    const disabledTargetApps = toggleableApps
      .filter((app) => !desiredEnabledAppIds.has(app.id) || blockedAppIds.has(app.id));
    const pinned = state.apps
      .filter((app) => app.available !== false && app.setEnabled)
      .filter((app) => app.dock && app.hub?.rail.supported !== false && app.hub?.rail.defaultPinned && desiredEnabledAppIds.has(app.id) && !blockedAppIds.has(app.id))
      .map((app) => app.id);
    state.railPinsExplicit = true;
    state.railPinnedApps = new Set(pinned);
    for (const appId of pinned) state.railUnpinnedApps.delete(appId);
    void Promise.all(convergenceTasks)
      .then(() => safeLocalSet({
        [RAIL_PIN_KEY]: pinned,
        [RAIL_UNPIN_KEY]: Array.from(state.railUnpinnedApps),
        [FIRST_RUN_STATUS_KEY]: "complete",
        [PERFORMANCE_MODE_KEY]: performanceMode,
      }))
      .then(async () => {
        state.firstRunPending = false;
        state.performanceMode = performanceMode;
        state.budget = budgetForPerformanceMode(performanceMode);
        activateStartupBudgetWindow();
        applyRuntimeDocumentMarkers(performanceMode);
        configureTwitterScannerFromEffectiveBudget(interestedSurfaceKinds());
        for (const app of state.apps) {
          if (await app.isEnabled()) {
            state.enabledApps.add(app.id);
            updateDockRegistration(app);
          } else {
            state.enabledApps.delete(app.id);
            updateDockRegistration(app);
          }
        }
        updateScannerConfiguration();
        syncHiddenRailItems();
        scheduleIdlePreloads();
        renderHubPanel();
        recordRuntimeDiagnostic("hub.preset", {
          preset,
          performanceMode: state.performanceMode,
          enabledTargetCount: desiredEnabledAppIds.size - blockedAppIds.size,
          disabledTargetCount: disabledTargetApps.length,
          blockedTargetCount: blockedApps.length,
          blockedApps: blockedApps.map((app) => app.id),
          disabledTargetApps: disabledTargetApps.map((app) => app.id),
          enabledApps: Array.from(state.enabledApps),
          railPinnedApps: pinned,
          updateMs: Math.round((performance.now() - startedAt) * 10) / 10,
          updatedAt: Date.now(),
        });
      })
      .catch((error) => {
        recordRuntimeDiagnostic("hub.preset", {
          preset,
          error: errorMessage(error),
          updatedAt: Date.now(),
        });
        renderHubPanel();
      });
  }

  function syncHiddenRailItems(): void {
    const hidden = state.apps
      .filter((app) => app.dock && app.hub?.rail.supported !== false && !isRailPinned(app))
      .map((app) => app.id);
    getOverlayDock().setHiddenItems(hidden);
  }

  function registerHubDockMetadata(): void {
    registerHideAllDockMetadata();
    if (state.hubDockRegistration) return;
    state.hubDockRegistration = getOverlayDock().register({
      id: "milxdyHub",
      label: "Apps",
      icon: hubDockIcon(),
      stackable: false,
      title: "Open Apps & Features",
      active: false,
      onActivate: () => {
        openHubPanel();
      },
      onDeactivate: () => {
        closeHubPanel();
      },
    });
    getOverlayDock().setSettingsAction("milxdy.addApps", {
      label: "Apps & Features",
      title: "Open Apps & Features",
      onActivate: openHubPanel,
    });
    getOverlayDock().setSettingsAction("milxdy.resetAppPositions", {
      label: "Reset app positions",
      title: "Reset saved overlay app window placement",
      onActivate: () => void resetAppPositions(),
    });
    state.runtimeDisposables.add(() => getOverlayDock().setSettingsAction("milxdy.addApps", null));
    state.runtimeDisposables.add(() => getOverlayDock().setSettingsAction("milxdy.resetAppPositions", null));
  }

  function registerAddOnsCatalogDockItem(): void {
    if (state.addOnsCatalogDockRegistration) return;
    state.addOnsCatalogDockRegistration = getOverlayDock().register({
      id: "milxdyAddOnsCatalog",
      label: "Get more add-ons",
      icon: "+",
      stackable: false,
      title: "Get more add-ons",
      active: false,
      onActivate: () => {
        playAddOnsLaunchSound();
        // Give the user-gesture audio context one render quantum before the
        // newly focused tab can background this X page.
        window.setTimeout(() => {
          void chrome.runtime.sendMessage({ type: "milxdy:openAddonsCatalog" });
        }, 120);
      },
    });
  }

  async function loadInterfaceSoundSettings(): Promise<void> {
    const stored = await safeLocalGet({
      [INTERFACE_SOUNDS_ENABLED_KEY]: true,
      [INTERFACE_SOUNDS_VOLUME_KEY]: DEFAULT_INTERFACE_SOUNDS_VOLUME,
    });
    state.interfaceSoundsEnabled = stored?.[INTERFACE_SOUNDS_ENABLED_KEY] !== false;
    const volume = Number(stored?.[INTERFACE_SOUNDS_VOLUME_KEY]);
    state.interfaceSoundsVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_INTERFACE_SOUNDS_VOLUME;
  }

  function observeInterfaceSoundSettings(): void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area !== "local") return;
      if (changes[INTERFACE_SOUNDS_ENABLED_KEY]) state.interfaceSoundsEnabled = changes[INTERFACE_SOUNDS_ENABLED_KEY].newValue !== false;
      if (changes[INTERFACE_SOUNDS_VOLUME_KEY]) {
        const volume = Number(changes[INTERFACE_SOUNDS_VOLUME_KEY].newValue);
        state.interfaceSoundsVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_INTERFACE_SOUNDS_VOLUME;
      }
    };
    chrome.storage.onChanged.addListener(listener);
    state.runtimeDisposables.add(() => chrome.storage.onChanged.removeListener(listener));
  }

  function playAddOnsLaunchSound(): void {
    if (!state.interfaceSoundsEnabled || state.interfaceSoundsVolume <= 0) return;
    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = new AudioCtor();
      void context.resume();
      const duration = 0.28;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      let previous = 0;
      for (let index = 0; index < samples.length; index += 1) {
        // A tiny low-pass walk makes the noise read as air instead of static.
        previous = previous * 0.76 + (Math.random() * 2 - 1) * 0.24;
        samples[index] = previous;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.6;
      const shaper = context.createWaveShaper();
      const curve = new Float32Array(33);
      for (let index = 0; index < curve.length; index += 1) curve[index] = Math.round(((index / 32) * 2 - 1) * 7) / 7;
      shaper.curve = curve;
      shaper.oversample = "none";
      const gain = context.createGain();
      const now = context.currentTime;
      // Deliberately stepped frequency changes keep the wind distinctly 8-bit.
      filter.frequency.setValueAtTime(330, now);
      filter.frequency.setValueAtTime(520, now + 0.07);
      filter.frequency.setValueAtTime(810, now + 0.14);
      filter.frequency.setValueAtTime(1_240, now + 0.2);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, state.interfaceSoundsVolume * 0.48), now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(shaper).connect(gain).connect(context.destination);
      source.start();
      source.addEventListener("ended", () => void context.close());
    } catch {
      // Audio restrictions must never block the catalog tab.
    }
  }

  function registerHideAllDockMetadata(): void {
    if (state.hideAllDockRegistration) return;
    state.hideAllDockRegistration = getOverlayDock().register({
      id: "milxdyHideAll",
      label: "Hide all",
      icon: "hide all",
      stackable: false,
      beforeId: "milxdyHub",
      title: "Hide all open milXdy apps",
      active: false,
      onActivate: () => {
        void hideAllOverlayApps();
      },
    });
  }

  async function hideAllOverlayApps(): Promise<void> {
    closeHubPanel();
    const closers = state.apps
      .filter((app) => app.dock && app.available !== false)
      .map((app) => {
        const module = state.loaded.get(app.id);
        state.dockRegistrations.get(app.id)?.update({ active: false });
        return module?.close ? Promise.resolve(module.close()) : Promise.resolve();
      });
    await Promise.allSettled(closers);
    recordRuntimeDiagnostic("dock.hideAll", {
      appCount: closers.length,
      updatedAt: Date.now(),
    });
  }

  async function resetAppPositions(): Promise<void> {
    await resetOverlayAppLayouts();
    recordRuntimeDiagnostic("hub.resetAppPositions", {
      updatedAt: Date.now(),
    });
    renderHubPanel();
  }

  function openHubPanel(): void {
    ensureHubPanel();
    renderHubPanel();
    state.hubDockRegistration?.update({ active: true, title: "Apps & Features" });
  }

  function closeHubPanel(): void {
    const root = state.hubPanelRoot;
    state.hubPanelRoot = null;
    state.hubDockSettingsOpen = false;
    state.hubDockRegistration?.update({ active: false });
    animateOverlayAppClose(root, () => root?.remove());
  }

  function ensureHubPanel(): HTMLElement {
    ensureOverlayAppChromeStyles();
    let root = state.hubPanelRoot;
    if (root?.isConnected) return root;
    root = document.getElementById(HUB_PANEL_ID) as HTMLElement | null;
    if (!root) {
      root = document.createElement("aside");
      root.id = HUB_PANEL_ID;
      root.className = "milxdy-app-hub-panel milxdy-overlay-app-shell";
      prepareOverlayAppRoot(root);
      root.setAttribute("role", "region");
      root.setAttribute("aria-label", "Apps & Features");
    } else {
      root.classList.add("milxdy-overlay-app-shell");
    }
    state.hubPanelRoot = root;
    document.documentElement.append(root);
    return root;
  }

  function renderHubPanel(): void {
    const root = state.hubPanelRoot;
    if (!root?.isConnected) return;
    const dockSide = getOverlayDock().getSide();
    root.dataset.side = dockSide;
    root.style.setProperty("--milxdy-overlay-app-transform-origin", dockSide === "right" ? "top right" : "top left");
    root.innerHTML = "";

    const header = document.createElement("div");
    header.className = "milxdy-app-hub-header";
    const title = document.createElement("strong");
    title.textContent = "Apps & Features";
    const headerActions = document.createElement("div");
    headerActions.className = "milxdy-app-hub-header-actions";
    const settings = document.createElement("button");
    settings.type = "button";
    settings.className = "milxdy-app-hub-settings-button";
    settings.title = state.hubDockSettingsOpen ? "Back to apps and features" : "Rail settings";
    settings.setAttribute("aria-label", settings.title);
    settings.setAttribute("aria-expanded", String(state.hubDockSettingsOpen));
    settings.setAttribute("aria-pressed", String(state.hubDockSettingsOpen));
    settings.textContent = state.hubDockSettingsOpen ? "\u2190" : "\u2699";
    settings.addEventListener("click", () => {
      state.hubDockSettingsOpen = !state.hubDockSettingsOpen;
      renderHubPanel();
    });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Minimize";
    close.title = "Minimize Apps & Features";
    close.setAttribute("aria-label", "Minimize Apps & Features");
    close.addEventListener("click", closeHubPanel);
    headerActions.append(settings, close);
    header.append(title, headerActions);

    if (state.firstRunPending) {
      const firstRun = document.createElement("section");
      firstRun.className = "milxdy-app-hub-first-run";
      const heading = document.createElement("strong");
      heading.textContent = "Light Start";
      const copy = document.createElement("p");
      copy.textContent = "Choose an exact app set, default rail pins, and matching Performance mode.";
      const actions = presetActions();
      const skip = document.createElement("button");
      skip.type = "button";
      skip.textContent = "Keep defaults";
      skip.addEventListener("click", () => completeFirstRun("skipped"));
      actions.append(skip);
      firstRun.append(heading, copy, actions);
      root.append(header, firstRun);
    } else {
      root.append(header);
    }

    if (state.hubDockSettingsOpen) {
      const dockSettings = getOverlayDock().createSettingsPanel(renderHubPanel, {
        excludeActionIds: ["milxdy.addApps"],
      });
      dockSettings.classList.add("milxdy-app-hub-dock-settings");
      dockSettings.append(appHubSetupSettings());
      root.append(dockSettings);
      markOverlayAppLayoutReady(root, true);
      return;
    }

    root.append(appHubRuntimeSummary());

    const search = document.createElement("label");
    search.className = "milxdy-app-hub-search";
    const searchLabel = document.createElement("span");
    searchLabel.textContent = "Search apps and features";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Search by name, category, setting, data, or permissions";
    searchInput.value = state.hubSearchQuery;
    searchInput.addEventListener("input", () => {
      state.hubSearchQuery = searchInput.value;
      renderHubPanel();
      const nextInput = state.hubPanelRoot?.querySelector<HTMLInputElement>(".milxdy-app-hub-search input");
      nextInput?.focus();
      const position = nextInput?.value.length ?? 0;
      nextInput?.setSelectionRange(position, position);
    });
    search.append(searchLabel, searchInput);
    root.append(search);

    const list = document.createElement("div");
    list.className = "milxdy-app-hub-list";
    const hubApps = state.apps
      .filter((candidate) => candidate.hub)
      .filter((app) => appMatchesHubSearch(app, state.hubSearchQuery));
    const railApps = orderedHubRailApps(hubApps.filter((app) => hubPackageKind(app) === "app"));
    const featureApps = hubApps.filter((app) => hubPackageKind(app) === "feature");
    const packageApps = hubApps.filter((app) => hubPackageKind(app) === "theme");
    appendHubSection(list, "Apps", railApps);
    appendHubSection(list, "Features", featureApps);
    appendHubSection(list, "Themes", packageApps);
    if (hubApps.length === 0) {
      const empty = document.createElement("p");
      empty.className = "milxdy-app-hub-empty";
      empty.textContent = "No apps or features match that search.";
      list.append(empty);
    }
    root.append(list);
    markOverlayAppLayoutReady(root, true);
  }

  function orderedHubRailApps(apps: MilxdyAppManifest[]): MilxdyAppManifest[] {
    const byId = new Map(apps.filter(isHubRailApp).map((app) => [app.id, app]));
    const ordered: MilxdyAppManifest[] = [];
    for (const id of getOverlayDock().getAppOrder()) {
      const app = byId.get(id as MilxdyAppId);
      if (!app) continue;
      ordered.push(app);
      byId.delete(id as MilxdyAppId);
    }
    ordered.push(...Array.from(byId.values()));
    return ordered;
  }

  function appendHubSection(list: HTMLElement, label: string, apps: MilxdyAppManifest[]): void {
    if (!apps.length) return;
    const section = document.createElement("section");
    section.className = "milxdy-app-hub-section";
    section.dataset.section = label.toLowerCase();
    const heading = document.createElement("div");
    heading.className = "milxdy-app-hub-section-title";
    const headingLabel = document.createElement("strong");
    headingLabel.textContent = label;
    heading.append(headingLabel);
    if (label === "Apps") {
      const hint = document.createElement("span");
      hint.textContent = "reorder to change stacking priority";
      heading.append(hint);
    }
    section.append(heading);
    for (const app of apps) section.append(appHubCard(app));
    list.append(section);
  }

  function isHubRailApp(app: MilxdyAppManifest): boolean {
    return Boolean(app.dock && app.hub?.rail.supported !== false);
  }

  function hubPackageKind(app: MilxdyAppManifest): "app" | "feature" | "theme" {
    if (app.packageKind === "theme") return "theme";
    if (app.packageKind === "feature") return "feature";
    if (app.packageKind === "app") return "app";
    return isHubRailApp(app) ? "app" : "feature";
  }

  function presetButton(label: string, preset: AppPreset): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => applyAppPreset(preset));
    return button;
  }

  function presetActions(): HTMLElement {
    const actions = document.createElement("div");
    actions.className = "milxdy-app-hub-preset-actions";
    actions.append(
      presetButton("Lite apps", "lite"),
      presetButton("Balanced apps", "balanced"),
      presetButton("All apps", "full"),
    );
    return actions;
  }

  function appHubSetupSettings(): HTMLElement {
    const section = document.createElement("details");
    section.className = "milxdy-app-hub-setup-settings";
    const title = document.createElement("summary");
    title.textContent = "Change app preset";
    const detail = document.createElement("span");
    detail.textContent = "Reapply exact app enablement, default rail pins, and matching Performance mode.";
    section.append(title, detail, presetActions());
    return section;
  }

  function appHubRuntimeSummary(): HTMLElement {
    const summary = document.createElement("section");
    summary.className = "milxdy-app-hub-runtime";
    summary.dataset.performanceMode = state.performanceMode;

    const loadedCount = state.loaded.size;
    const loadingCount = state.loading.size;
    const enabledCount = state.enabledApps.size;
    const pinnedCount = currentRailPins().filter((id) => state.enabledApps.has(id)).length;
    const failedCount = diagnostics().filter((app) => app.state === "failed").length;

    const title = document.createElement("strong");
    title.textContent = `Runtime: ${state.performanceMode}`;
    const meta = document.createElement("span");
    meta.textContent = `${enabledCount} enabled | ${pinnedCount} pinned | ${loadedCount} loaded | ${loadingCount} loading${failedCount ? ` | ${failedCount} failed` : ""}`;
    summary.append(title, meta);
    return summary;
  }

  async function refreshLocalAddonStatus(): Promise<void> {
    if (state.localAddonStatusLoading) return;
    state.localAddonStatusLoading = true;
    renderHubPanel();
    try {
      const [response, stored] = await Promise.all([
        safeRuntimeMessage({ type: "milxdy:getLocalAddonStatus" }) as Promise<Record<string, unknown> | undefined>,
        safeLocalGet({ [PENDING_LOCAL_ADDON_REMOVALS_KEY]: [] }),
      ]);
      const candidate = response?.ok === true ? response.status : null;
      state.localAddonStatus = isLocalAddonStatus(candidate) ? candidate : null;
      state.localAddonPendingRemovals = normalizedStringSet(stored?.[PENDING_LOCAL_ADDON_REMOVALS_KEY]);
    } finally {
      state.localAddonStatusLoading = false;
      renderHubPanel();
    }
  }

  function isLocalAddonStatus(value: unknown): value is LocalAddonStatus {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return (record.schemaVersion === 1 || record.schemaVersion === 2)
      && ["standard", "custom-composition", "managed-local-addons"].includes(String(record.mode))
      && ["prepared", "built", "validation-failed", "build-failed"].includes(String(record.state));
  }

  async function stageQueuedAddonsForLocalBuilder(): Promise<void> {
    const accepted = state.localAddonQueue.filter((entry) => entry.state === "accepted");
    const pendingRemovals = Array.from(state.localAddonPendingRemovals).sort();
    if (!accepted.length && !pendingRemovals.length) return;
    if (!accepted.length) {
      try {
        await navigator.clipboard.writeText("npm run addons:rebuild");
      } catch {
        // The visible message retains the exact command.
      }
      state.localAddonQueueMessage = `Remove the package ZIP${pendingRemovals.length === 1 ? "" : "s"} for ${pendingRemovals.join(", ")} from local-addons/manual or local-addons/catalog, then run npm run addons:rebuild. The running extension cannot delete checkout files by itself.`;
      renderHubPanel();
      return;
    }
    const directoryPicker = (window as typeof window & {
      showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<{
        getFileHandle(name: string, options: { create: boolean }): Promise<{
          createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
        }>;
      }>;
    }).showDirectoryPicker;
    if (!directoryPicker) {
      state.localAddonQueueMessage = "This browser cannot hand files to the local builder. Copy the accepted ZIPs into local-addons/manual, then run npm run addons:rebuild.";
      renderHubPanel();
      return;
    }
    state.localAddonQueueMessage = "Choose the checkout's local-addons/manual folder. The extension will place the accepted ZIPs there; the separate local builder still performs the rebuild.";
    try {
      const directory = await directoryPicker.call(window, { mode: "readwrite" });
      for (const entry of accepted) {
        const handle = await directory.getFileHandle(entry.file.name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(entry.file);
        await writable.close();
      }
      try {
        await navigator.clipboard.writeText("npm run addons:rebuild");
      } catch {
        // The visible status retains the exact command when clipboard access is unavailable.
      }
      const removalNote = pendingRemovals.length
        ? ` Remove the package ZIP${pendingRemovals.length === 1 ? "" : "s"} for ${pendingRemovals.join(", ")} before running the command.`
        : "";
      state.localAddonQueueMessage = `${accepted.length} ZIP${accepted.length === 1 ? "" : "s"} placed.${removalNote} Run npm run addons:rebuild in the milXdy checkout. The local builder creates dist/chromium-local-apps; this running extension did not rebuild itself.`;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        state.localAddonQueueMessage = "Folder selection canceled. The queued ZIPs remain available in this panel.";
      } else {
        state.localAddonQueueMessage = `Could not place ZIPs for the local builder: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    renderHubPanel();
  }

  function localAddonManagerPanel(): HTMLElement {
    const panel = document.createElement("section");
    panel.id = "milxdy-local-addons";
    panel.className = "milxdy-app-hub-addons";
    panel.tabIndex = -1;
    const status = state.localAddonStatus;
    const loadedBuildId = typeof MILXDY_LOCAL_ADDON_BUILD_ID === "string" ? MILXDY_LOCAL_ADDON_BUILD_ID : "";
    const buildWaitingForReload = Boolean(status?.buildId && loadedBuildId && status.buildId !== loadedBuildId);
    const buildNeedsFirstLoad = Boolean(status?.state === "built" && status.buildId && !loadedBuildId);
    const hasFailure = status?.state === "validation-failed" || status?.state === "build-failed";
    const currentStep = !status || status.mode === "standard"
      ? 0
      : status.state === "prepared"
        ? 2
        : hasFailure
          ? status.workflowStage === "place" ? 1 : status.workflowStage === "select" ? 0 : 2
          : buildWaitingForReload || buildNeedsFirstLoad
            ? 3
            : 4;

    const header = document.createElement("div");
    header.className = "milxdy-app-hub-addon-header";
    const brand = document.createElement("img");
    brand.src = runtimeAssetUrl("assets/brand/milxdy-logo-square-bevel.png");
    brand.alt = "";
    brand.width = 40;
    brand.height = 40;
    const headingGroup = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "milxdy-app-hub-addon-eyebrow";
    eyebrow.textContent = "Custom build";
    const heading = document.createElement("strong");
    heading.id = "milxdy-local-addons-title";
    heading.textContent = "Local Add-ons";
    headingGroup.append(eyebrow, heading);
    const badge = document.createElement("span");
    badge.className = "milxdy-app-hub-addon-badge";
    badge.dataset.tone = hasFailure ? "warning" : buildWaitingForReload || buildNeedsFirstLoad || status?.state === "prepared" ? "active" : "neutral";
    badge.textContent = state.localAddonStatusLoading && !status
      ? "Checking"
      : hasFailure
        ? "Needs attention"
        : status?.state === "prepared"
          ? "Validated"
          : buildNeedsFirstLoad
            ? "Load unpacked"
            : buildWaitingForReload
              ? "Reload ready"
              : status?.state === "built"
                ? "Current"
                : "Local setup";
    header.append(brand, headingGroup, badge);
    const summary = document.createElement("p");
    summary.className = "milxdy-app-hub-addon-summary";
    summary.setAttribute("aria-live", "polite");
    if (state.localAddonStatusLoading && !status) {
      summary.textContent = "Checking this build…";
    } else if (!status || status.mode === "standard") {
      summary.textContent = "Add trusted ZIPs to the local package folder, validate them, then rebuild this stable Chromium edition.";
    } else if (status.state === "prepared") {
      summary.textContent = "The selected package set is prepared and validated. Apply it with the trust acknowledgements shown by the local helper.";
    } else if (status.state !== "built") {
      summary.textContent = `Last rebuild ${status.state === "validation-failed" ? "failed validation" : "failed"}. The previous working build remains in place.`;
    } else if (buildNeedsFirstLoad) {
      summary.textContent = `Custom build ready at ${status.outputDirectory || "dist/chromium-local-apps"}. Open chrome://extensions, choose Load unpacked, and select that exact folder.`;
    } else if (buildWaitingForReload) {
      summary.textContent = "A validated rebuild is ready. Reload the existing milXdy unpacked extension in Chrome, then refresh X.";
    } else {
      const count = status.packages?.length ?? 0;
      summary.textContent = `${count} validated local add-on${count === 1 ? " is" : "s are"} loaded from the stable custom build.`;
    }
    const workflow = document.createElement("ol");
    workflow.className = "milxdy-app-hub-addon-workflow";
    workflow.setAttribute("aria-label", "Local add-on build journey");
    const workflowSteps = [
      ["ZIP", "Select", "Trusted package"],
      ["DIR", "Place ZIPs", "Local folder"],
      [">_", "Rebuild", "Validate + build"],
      ["\u21bb", "Reload", "Chrome handoff"],
    ] as const;
    workflowSteps.forEach(([iconText, label, detail], index) => {
      const item = document.createElement("li");
      const stepState = index < currentStep ? "complete" : index === currentStep ? hasFailure ? "error" : "current" : "pending";
      item.dataset.state = currentStep === 4 ? "complete" : stepState;
      if (item.dataset.state === "current") item.setAttribute("aria-current", "step");
      const icon = document.createElement("span");
      icon.className = "milxdy-app-hub-addon-step-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = iconText;
      const number = document.createElement("span");
      number.className = "milxdy-app-hub-addon-step-number";
      number.textContent = `0${index + 1}`;
      const labelElement = document.createElement("strong");
      labelElement.textContent = label;
      const detailElement = document.createElement("small");
      detailElement.textContent = detail;
      item.append(icon, number, labelElement, detailElement);
      workflow.append(item);
    });

    const packageSection = document.createElement("div");
    packageSection.className = "milxdy-app-hub-addon-packages";
    const packageHeading = document.createElement("div");
    packageHeading.className = "milxdy-app-hub-addon-section-heading";
    const packageTitle = document.createElement("strong");
    packageTitle.textContent = status?.state === "prepared" ? "Selected add-ons" : "Installed add-ons";
    const packageCount = document.createElement("span");
    packageCount.textContent = String(status?.packages?.length ?? 0);
    packageHeading.append(packageTitle, packageCount);
    packageSection.append(packageHeading);
    if (status?.packages?.length) {
      const packages = document.createElement("ul");
      packages.className = "milxdy-app-hub-addon-package-list";
      for (const entry of status.packages) {
        const item = document.createElement("li");
        const mark = document.createElement("span");
        mark.className = "milxdy-app-hub-addon-package-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = (entry.name || entry.id).trim().slice(0, 1).toUpperCase() || "A";
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = entry.name || entry.id;
        const meta = document.createElement("small");
        meta.textContent = `${entry.id}${entry.version ? ` / ${entry.version}` : ""}${entry.reviewStatus ? ` / ${entry.reviewStatus}` : ""}`;
        copy.append(name, meta);
        item.append(mark, copy);
        packages.append(item);
      }
      packageSection.append(packages);
    } else {
      const empty = document.createElement("div");
      empty.className = "milxdy-app-hub-addon-empty";
      const emptyMark = document.createElement("span");
      emptyMark.setAttribute("aria-hidden", "true");
      emptyMark.textContent = "+";
      const emptyCopy = document.createElement("span");
      const emptyTitle = document.createElement("strong");
      emptyTitle.textContent = "No local ZIPs selected";
      const emptyDetail = document.createElement("small");
      emptyDetail.textContent = "Place or import trusted packages with File Explorer; milXdy never installs ZIP code at runtime.";
      emptyCopy.append(emptyTitle, emptyDetail);
      empty.append(emptyMark, emptyCopy);
      packageSection.append(empty);
    }

    const queueSection = document.createElement("div");
    queueSection.className = "milxdy-app-hub-addon-queue";
    const queueHeading = document.createElement("div");
    queueHeading.className = "milxdy-app-hub-addon-section-heading";
    const queueTitle = document.createElement("strong");
    queueTitle.textContent = "Queued add-ons";
    const queueCount = document.createElement("span");
    queueCount.textContent = String(state.localAddonQueue.length);
    queueHeading.append(queueTitle, queueCount);
    queueSection.append(queueHeading);
    if (state.localAddonQueue.length) {
      const queue = document.createElement("ul");
      queue.className = "milxdy-app-hub-addon-queue-list";
      for (const entry of state.localAddonQueue) {
        const item = document.createElement("li");
        item.dataset.state = entry.state;
        const mark = document.createElement("span");
        mark.className = "milxdy-app-hub-addon-queue-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = entry.state === "checking" ? "..." : entry.state === "accepted" ? "OK" : "!";
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = entry.name || entry.file.name;
        const detail = document.createElement("small");
        detail.textContent = entry.state === "checking"
          ? "Reading ZIP package metadata"
          : entry.state === "accepted"
            ? `${entry.id}${entry.version ? ` / ${entry.version}` : ""} / browser preflight accepted`
            : entry.reason || "Package rejected";
        copy.append(name, detail);
        item.append(mark, copy);
        queue.append(item);
      }
      queueSection.append(queue);
    } else {
      const queueEmpty = document.createElement("p");
      queueEmpty.className = "milxdy-app-hub-addon-queue-empty";
      queueEmpty.textContent = "Download ZIPs from the catalog, then select them here. Files remain local.";
      queueSection.append(queueEmpty);
    }
    if (state.localAddonQueueMessage) {
      const queueMessage = document.createElement("p");
      queueMessage.className = "milxdy-app-hub-addon-queue-message";
      queueMessage.setAttribute("aria-live", "polite");
      queueMessage.textContent = state.localAddonQueueMessage;
      queueSection.append(queueMessage);
    }

    const notices = [...(status?.errors || []).slice(0, 2), ...(status?.warnings || []).slice(0, 1)];
    let noticeList: HTMLUListElement | null = null;
    if (notices.length) {
      noticeList = document.createElement("ul");
      noticeList.className = "milxdy-app-hub-addon-notices";
      noticeList.dataset.tone = status?.errors?.length ? "warning" : "neutral";
      for (const notice of notices) {
        const item = document.createElement("li");
        item.textContent = notice;
        noticeList.append(item);
      }
    }

    const paths = document.createElement("span");
    paths.textContent = `ZIPs: ${status?.addOnsDirectory || "local-addons"} | Build: ${status?.outputDirectory || "dist/chromium-local-apps"}`;
    const actions = document.createElement("div");
    actions.className = "milxdy-app-hub-addon-actions";
    const getMore = document.createElement("button");
    getMore.type = "button";
    getMore.textContent = "Get more add-ons";
    getMore.addEventListener("click", () => {
      window.open(MILXDY_ADDONS_CATALOG_URL, "_blank", "noopener,noreferrer");
    });
    const picker = document.createElement("input");
    picker.id = "milxdy-local-addon-picker";
    picker.className = "milxdy-app-hub-addon-picker";
    picker.type = "file";
    picker.accept = ".zip,application/zip";
    picker.multiple = true;
    const pickerLabel = document.createElement("label");
    pickerLabel.className = "milxdy-app-hub-addon-picker-label";
    pickerLabel.htmlFor = picker.id;
    pickerLabel.textContent = "Load downloaded add-ons";
    pickerLabel.tabIndex = 0;
    pickerLabel.setAttribute("role", "button");
    pickerLabel.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      picker.click();
    });
    picker.addEventListener("change", () => {
      const files = Array.from(picker.files || []);
      if (!files.length) return;
      state.localAddonQueue = files.map((file) => ({ file, state: "checking" }));
      state.localAddonQueueMessage = `Checking ${files.length} selected ZIP${files.length === 1 ? "" : "s"}...`;
      renderHubPanel();
      void Promise.all(files.map(preflightLocalAddonZip)).then((queue) => {
        state.localAddonQueue = queue;
        const accepted = queue.filter((entry) => entry.state === "accepted").length;
        const rejected = queue.length - accepted;
        state.localAddonQueueMessage = `${accepted} accepted by browser preflight${rejected ? `; ${rejected} rejected` : ""}. The local composer performs the authoritative validation before building.`;
        renderHubPanel();
      });
    });
    const rebuild = document.createElement("button");
    rebuild.type = "button";
    rebuild.textContent = "Rebuild custom extension";
    rebuild.disabled = !state.localAddonQueue.some((entry) => entry.state === "accepted")
      && state.localAddonPendingRemovals.size === 0;
    rebuild.addEventListener("click", () => void stageQueuedAddonsForLocalBuilder());
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.textContent = "Refresh status";
    refresh.disabled = state.localAddonStatusLoading;
    refresh.addEventListener("click", () => void refreshLocalAddonStatus());
    actions.append(getMore, picker, pickerLabel, rebuild, refresh);
    const details = document.createElement("details");
    details.className = "milxdy-app-hub-addon-details";
    const detailsTitle = document.createElement("summary");
    detailsTitle.textContent = "Local paths and build identity";
    details.append(detailsTitle, paths);
    if (status?.compositionFingerprint) {
      const fingerprint = document.createElement("span");
      fingerprint.textContent = `Composition ${status.compositionFingerprint.slice(0, 16)}…`;
      details.append(fingerprint);
    }
    panel.setAttribute("aria-labelledby", heading.id);
    panel.append(header, summary, workflow, packageSection, queueSection);
    if (noticeList) panel.append(noticeList);
    panel.append(actions, details);
    return panel;
  }

  function appHubCard(app: MilxdyAppManifest): HTMLElement {
    const card = document.createElement("section");
    card.className = "milxdy-app-hub-card";
    card.dataset.hubAppId = app.id;
    card.dataset.tier = hubPackageKind(app);
    card.dataset.available = String(app.available !== false);
    card.dataset.enabled = String(state.enabledApps.has(app.id));
    card.dataset.pinned = String(isRailPinned(app));
    card.dataset.expanded = String(state.hubExpandedApps.has(app.id));

    const icon = document.createElement("span");
    icon.className = "milxdy-app-hub-icon";
    if (app.dock?.icon) {
      const image = document.createElement("img");
      image.className = "milxdy-app-hub-icon-img";
      image.src = runtimeAssetUrl(resolveAppIconAsset(app.dock.icon));
      image.alt = "";
      image.decoding = "async";
      icon.appendChild(image);
    } else {
      icon.textContent = (app.dock?.label || app.name).slice(0, 1).toUpperCase();
    }

    const summary = document.createElement("button");
    summary.className = "milxdy-app-hub-card-summary";
    summary.type = "button";
    summary.setAttribute("aria-expanded", String(state.hubExpandedApps.has(app.id)));
    summary.setAttribute("aria-label", `${state.hubExpandedApps.has(app.id) ? "Collapse" : "Expand"} ${app.name}`);
    if (isHubRailApp(app)) {
      const dragHandle = document.createElement("span");
      dragHandle.className = "milxdy-app-hub-drag-handle";
      dragHandle.title = "Drag to reorder app stacking";
      dragHandle.setAttribute("aria-hidden", "true");
      dragHandle.textContent = "⋮⋮";
      dragHandle.addEventListener("pointerdown", (event) => startHubAppDrag(event, app.id));
      summary.append(dragHandle);
    }
    const summaryTitle = document.createElement("strong");
    summaryTitle.textContent = app.name;
    const expandIcon = document.createElement("span");
    expandIcon.className = "milxdy-app-hub-expand-icon";
    summary.append(icon, summaryTitle, expandIcon);
    summary.addEventListener("click", () => {
      if (state.hubExpandedApps.has(app.id)) state.hubExpandedApps.delete(app.id);
      else state.hubExpandedApps.add(app.id);
      renderHubPanel();
    });

    const body = document.createElement("div");
    body.className = "milxdy-app-hub-body";
    const enableControl = appHubEnableControl(app);
    const description = document.createElement("p");
    description.textContent = app.hub?.shortDescription || app.description;
    const meta = document.createElement("span");
    meta.textContent = `${packageKindLabel(app)} | ${app.hub?.category || "app"} | ${app.available === false ? "Unavailable in this build" : state.enabledApps.has(app.id) ? "On" : "Off"}`;
    const notes = appHubMetadataNotes(app);
    const runtime = document.createElement("span");
    runtime.className = "milxdy-app-hub-runtime-state";
    runtime.textContent = appRuntimeSummary(app);
    if (enableControl) body.append(enableControl);
    body.append(description, meta, notes);
    if (app.available === false && app.unavailableReason) {
      const unavailable = document.createElement("span");
      unavailable.className = "milxdy-app-hub-unavailable";
      unavailable.textContent = app.unavailableReason;
      body.append(unavailable);
    }
    body.append(runtime);

    const controls = document.createElement("div");
    controls.className = "milxdy-app-hub-controls";
    if (app.available !== false && app.dock && app.hub?.rail.supported !== false) {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.textContent = isRailPinned(app) ? "Unpin" : "Pin";
      pin.disabled = !state.enabledApps.has(app.id);
      pin.addEventListener("click", () => setRailPinned(app.id, !isRailPinned(app)));
      controls.append(pin);
    }
    if (app.available !== false && app.dock && state.enabledApps.has(app.id)) {
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Open";
      open.addEventListener("click", () => {
        void loadApp(app, "hubOpen").then((module) => Promise.resolve(module?.open?.()));
      });
      controls.append(open);
    }
    if (isHubRailApp(app)) {
      const order = getOverlayDock().getAppOrder();
      const index = order.indexOf(app.id);
      for (const [label, delta] of [["Move up", -1], ["Move down", 1]] as const) {
        const move = document.createElement("button");
        move.type = "button";
        move.textContent = label;
        move.setAttribute("aria-label", `${label} ${app.name}`);
        move.disabled = index < 0 || index + delta < 0 || index + delta >= order.length;
        move.addEventListener("click", () => moveHubAppBy(app.id, delta, label));
        controls.append(move);
      }
    }
    if (app.available !== false && hasResettableStorage(app)) {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset";
      reset.title = "Reset app settings";
      reset.addEventListener("click", () => resetAppSettings(app));
      controls.append(reset);
    }
    body.append(appHubDetails(app));
    const generatedSettings = appHubGeneratedFeatureSettings(app);
    if (generatedSettings) body.append(generatedSettings);

    card.append(summary, body, controls);
    return card;
  }

  function appHubEnableControl(app: MilxdyAppManifest): HTMLElement {
    const row = document.createElement("div");
    row.className = "milxdy-app-hub-enable-row";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "milxdy-app-hub-switch";
    const switchKnob = document.createElement("span");
    switchKnob.className = "milxdy-app-hub-switch-knob";
    const switchText = document.createElement("span");
    switchText.className = "milxdy-app-hub-switch-text";
    const detail = document.createElement("span");
    detail.className = "milxdy-app-hub-enable-detail";

    if (app.available === false) {
      toggle.disabled = true;
      toggle.dataset.checked = "false";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", "false");
      toggle.setAttribute("aria-disabled", "true");
      toggle.setAttribute("aria-label", `${app.name} unavailable in this build`);
      switchText.textContent = "Unavailable";
      detail.textContent = app.unavailableReason || "This app cannot be enabled right now.";
    } else if (!app.setEnabled) {
      toggle.disabled = true;
      toggle.dataset.checked = "true";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", "true");
      toggle.setAttribute("aria-disabled", "true");
      toggle.setAttribute("aria-label", `${app.name} is always on`);
      switchText.textContent = "Always on";
      detail.textContent = "Core feature";
    } else {
      const enabled = state.enabledApps.has(app.id);
      const performanceBlock = enabled ? null : appEnableBlockedByPerformance(app);
      toggle.dataset.checked = String(enabled);
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", String(enabled));
      if (performanceBlock) {
        toggle.dataset.performanceBlocked = "true";
        toggle.setAttribute("aria-disabled", "true");
      }
      toggle.setAttribute("aria-label", performanceBlock || `${enabled ? "Disable" : "Enable"} ${app.name}`);
      toggle.title = performanceBlock || "";
      switchText.textContent = enabled ? "On" : "Off";
      detail.textContent = performanceBlock || (enabled ? "Click to disable this app." : "Click to enable this app.");
      toggle.addEventListener("click", () => setAppEnabled(app, !state.enabledApps.has(app.id)));
    }

    toggle.append(switchKnob, switchText);
    row.append(toggle, detail);
    return row;
  }

  function appHubGeneratedFeatureSettings(app: MilxdyAppManifest): HTMLElement | null {
    const settings = hubGeneratedFeatureSettings(app);
    if (!settings.length) return null;
    const section = document.createElement("section");
    section.className = "milxdy-app-hub-generated-settings";
    const title = document.createElement("strong");
    title.textContent = "Feature settings";
    section.append(title);
    for (const setting of settings) section.append(appHubGeneratedSettingRow(setting));
    return section;
  }

  function hubGeneratedFeatureSettings(app: MilxdyAppManifest): AppSettingDefinition[] {
    if (hubPackageKind(app) !== "feature" || app.packageKind !== "feature") return [];
    return (app.settings || []).filter((setting) => (
      setting.location === "appsAndFeatures"
      && setting.advanced !== true
      && setting.scope === "feature"
      && setting.control.type !== "action"
      && setting.control.type !== "status"
    ));
  }

  function appHubGeneratedSettingRow(setting: AppSettingDefinition): HTMLElement {
    const row = document.createElement("label");
    row.className = "milxdy-app-hub-generated-setting";
    row.dataset.settingId = setting.id;
    const text = document.createElement("span");
    text.className = "milxdy-app-hub-generated-setting-text";
    const label = document.createElement("strong");
    label.textContent = setting.label;
    text.append(label);
    if (setting.description) {
      const description = document.createElement("small");
      description.textContent = setting.description;
      text.append(description);
    }
    const control = appHubGeneratedSettingControl(setting);
    row.append(text, control);
    void readManifestSettingValue(setting).then((value) => {
      if (!row.isConnected) return;
      setGeneratedControlValue(control, value);
    });
    return row;
  }

  function appHubGeneratedSettingControl(setting: AppSettingDefinition): HTMLElement {
    switch (setting.control.type) {
      case "toggle":
        return appHubGeneratedToggle(setting);
      case "select":
      case "segmented":
        return appHubGeneratedSelect(setting);
      case "slider":
      case "number":
        return appHubGeneratedNumber(setting);
      case "text":
      case "textarea":
        return appHubGeneratedText(setting);
      default:
        return appHubUnsupportedSetting(setting);
    }
  }

  function appHubGeneratedToggle(setting: AppSettingDefinition): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "milxdy-app-hub-switch milxdy-app-hub-generated-toggle";
    button.dataset.checked = "false";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", "false");
    button.setAttribute("aria-label", setting.label);
    const knob = document.createElement("span");
    knob.className = "milxdy-app-hub-switch-knob";
    const text = document.createElement("span");
    text.className = "milxdy-app-hub-switch-text";
    text.textContent = "Off";
    button.append(knob, text);
    button.addEventListener("click", () => {
      const next = button.dataset.checked !== "true";
      setGeneratedControlValue(button, next);
      void writeManifestSettingValue(setting, next).catch(() => {
        setGeneratedControlValue(button, !next);
      });
    });
    return button;
  }

  function appHubGeneratedSelect(setting: AppSettingDefinition): HTMLElement {
    const select = document.createElement("select");
    select.className = setting.control.type === "segmented"
      ? "milxdy-app-hub-generated-segmented"
      : "milxdy-app-hub-generated-select";
    select.setAttribute("aria-label", setting.label);
    for (const option of setting.control.options || []) {
      const element = document.createElement("option");
      element.value = settingOptionValue(option.value);
      element.textContent = option.label;
      select.append(element);
    }
    select.addEventListener("change", () => {
      void persistGeneratedControl(setting, select);
    });
    return select;
  }

  function appHubGeneratedNumber(setting: AppSettingDefinition): HTMLElement {
    const input = document.createElement("input");
    input.className = "milxdy-app-hub-generated-number";
    input.type = setting.control.type === "slider" ? "range" : "number";
    input.setAttribute("aria-label", setting.label);
    if (typeof setting.control.min === "number") input.min = String(setting.control.min);
    if (typeof setting.control.max === "number") input.max = String(setting.control.max);
    if (typeof setting.control.step === "number") input.step = String(setting.control.step);
    input.addEventListener("change", () => {
      void persistGeneratedControl(setting, input);
    });
    return input;
  }

  function appHubGeneratedText(setting: AppSettingDefinition): HTMLElement {
    const input = setting.control.type === "textarea"
      ? document.createElement("textarea")
      : document.createElement("input");
    input.className = "milxdy-app-hub-generated-text";
    input.setAttribute("aria-label", setting.label);
    if (input instanceof HTMLInputElement) input.type = "text";
    if (setting.control.placeholder) input.placeholder = setting.control.placeholder;
    input.addEventListener("change", () => {
      void persistGeneratedControl(setting, input);
    });
    return input;
  }

  function appHubUnsupportedSetting(setting: AppSettingDefinition): HTMLElement {
    const value = document.createElement("span");
    value.className = "milxdy-app-hub-generated-unsupported";
    value.textContent = `${setting.control.type} unsupported`;
    return value;
  }

  async function readManifestSettingValue(setting: AppSettingDefinition): Promise<AppSettingUiValue> {
    const stored = await safeStorageGet(setting.storage.area, { [setting.storage.key]: setting.storage.property ? {} : setting.defaultValue });
    const raw = setting.storage.property
      ? plainObjectValue(stored?.[setting.storage.key])[setting.storage.property]
      : stored?.[setting.storage.key];
    return normalizeSettingUiValue(raw === undefined ? setting.defaultValue : raw);
  }

  async function writeManifestSettingValue(setting: AppSettingDefinition, value: AppSettingUiValue): Promise<void> {
    if (!setting.storage.property) {
      await safeStorageSet(setting.storage.area, { [setting.storage.key]: value });
      return;
    }
    const stored = await safeStorageGet(setting.storage.area, { [setting.storage.key]: {} });
    await safeStorageSet(setting.storage.area, {
      [setting.storage.key]: {
        ...plainObjectValue(stored?.[setting.storage.key]),
        [setting.storage.property]: value,
      },
    });
  }

  async function persistGeneratedControl(setting: AppSettingDefinition, control: HTMLElement): Promise<void> {
    control.removeAttribute("aria-invalid");
    control.removeAttribute("data-write-error");
    try {
      await writeManifestSettingValue(setting, readGeneratedControlValue(setting, control));
    } catch (error) {
      setGeneratedControlValue(control, await readManifestSettingValue(setting));
      control.setAttribute("aria-invalid", "true");
      control.dataset.writeError = "true";
      control.title = `Could not save ${setting.label}: ${errorMessage(error)}`;
    }
  }

  function extractBackgroundMessageType(message: unknown): string | null {
    if (!message || typeof message !== "object" || Array.isArray(message)) return null;
    const type = (message as Record<string, unknown>).type;
    return typeof type === "string" && type.length > 0 ? type : null;
  }

  function appCanSendBackgroundMessage(app: MilxdyAppManifest, messageType: string): boolean {
    return (app.background?.messageTypes || []).some((pattern) => backgroundMessagePatternMatches(pattern, messageType));
  }

  function backgroundMessagePatternMatches(pattern: string, messageType: string): boolean {
    if (typeof pattern !== "string" || pattern.length === 0) return false;
    if (pattern.endsWith(":*")) return messageType.startsWith(pattern.slice(0, -1));
    return pattern === messageType;
  }

  function recordDeniedAppMessage(app: MilxdyAppManifest, label: string, messageType: string | null): void {
    const reason = messageType ? "undeclaredBackgroundMessage" : "malformedBackgroundMessage";
    const diagnostic = {
      appId: app.id,
      label,
      messageType,
      declaredPatterns: app.background?.messageTypes || [],
      reason,
      updatedAt: Date.now(),
    };
    recordRuntimeDiagnostic(`backgroundMessage.denied.${app.id}`, diagnostic);
    console.warn("[milXdy] App SDK background message denied", diagnostic);
  }

  function safeStorageSet(area: ResetStorageArea, values: Record<string, unknown>): Promise<boolean> {
    return area === "local" ? safeLocalSet(values) : safeSyncSet(values);
  }

  function normalizeSettingUiValue(value: unknown): AppSettingUiValue {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) return value;
    return "";
  }

  function setGeneratedControlValue(control: HTMLElement, value: AppSettingUiValue): void {
    if (control instanceof HTMLButtonElement && control.classList.contains("milxdy-app-hub-generated-toggle")) {
      const checked = value === true;
      control.dataset.checked = String(checked);
      control.setAttribute("aria-checked", String(checked));
      const text = control.querySelector(".milxdy-app-hub-switch-text");
      if (text) text.textContent = checked ? "On" : "Off";
      return;
    }
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
      control.value = value == null ? "" : String(value);
    }
  }

  function readGeneratedControlValue(setting: AppSettingDefinition, control: HTMLElement): AppSettingUiValue {
    if (control instanceof HTMLInputElement && (setting.control.type === "number" || setting.control.type === "slider")) {
      const value = Number(control.value);
      return Number.isFinite(value) ? value : Number(setting.defaultValue || 0);
    }
    if (control instanceof HTMLSelectElement) {
      const option = (setting.control.options || []).find((entry) => settingOptionValue(entry.value) === control.value);
      return normalizeSettingUiValue(option?.value ?? control.value);
    }
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return control.value;
    return normalizeSettingUiValue(setting.defaultValue);
  }

  function settingOptionValue(value: string | number | boolean | null): string {
    return value == null ? "" : String(value);
  }

  function plainObjectValue(value: unknown): Record<string, unknown> {
    return isPlainObject(value) ? value : {};
  }

  function startHubAppDrag(event: PointerEvent, appId: MilxdyAppId): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    state.hubAppDrag = { appId, pointerId: event.pointerId, moved: false };
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    target?.setPointerCapture?.(event.pointerId);
    document.documentElement.dataset.milxdyHubReordering = "true";
    window.addEventListener("pointermove", moveHubAppDrag);
    window.addEventListener("pointerup", endHubAppDrag);
    window.addEventListener("pointercancel", endHubAppDrag);
  }

  function moveHubAppBy(appId: MilxdyAppId, delta: -1 | 1, label: string): void {
    const order = getOverlayDock().getAppOrder();
    const from = order.indexOf(appId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    getOverlayDock().setAppOrder(order);
    renderHubPanel();
    window.requestAnimationFrame(() => {
      const card = state.hubPanelRoot?.querySelector<HTMLElement>(`[data-hub-app-id="${appId}"]`);
      Array.from<HTMLButtonElement>(card?.querySelectorAll<HTMLButtonElement>(".milxdy-app-hub-controls button") || [])
        .find((button) => button.textContent === label)?.focus();
    });
  }

  function moveHubAppDrag(event: PointerEvent): void {
    const drag = state.hubAppDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.milxdy-app-hub-card[data-tier="app"][data-hub-app-id]');
    const targetId = target?.dataset.hubAppId as MilxdyAppId | undefined;
    if (!targetId || targetId === drag.appId) return;
    drag.moved = true;
    const order = getOverlayDock().getAppOrder();
    const from = order.indexOf(drag.appId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, drag.appId);
    getOverlayDock().setAppOrder(order);
    renderHubPanel();
  }

  function endHubAppDrag(event: PointerEvent): void {
    if (!state.hubAppDrag || state.hubAppDrag.pointerId !== event.pointerId) return;
    state.hubAppDrag = null;
    delete document.documentElement.dataset.milxdyHubReordering;
    window.removeEventListener("pointermove", moveHubAppDrag);
    window.removeEventListener("pointerup", endHubAppDrag);
    window.removeEventListener("pointercancel", endHubAppDrag);
  }

  function appMatchesHubSearch(app: MilxdyAppManifest, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    const searchable = [
      app.name,
      app.id,
      app.description,
      app.hub?.category,
      app.hub?.shortDescription,
      app.hub?.longDescription,
      app.available === false ? "unavailable off disabled" : state.enabledApps.has(app.id) ? "enabled on" : "disabled off",
      ...(app.hub?.privacyLabels || []),
      ...(app.hub?.permissionNotes || []),
      ...(app.hub?.dataNotes || []),
      ...(app.hub?.remoteServices || []),
      ...(app.hub?.localStorageNotes || []),
      ...(app.permissions?.hosts || []),
      app.chrome?.nativeStyle,
      ...(app.chrome?.supportedStyles || []),
      ...(app.chrome?.notes || []),
      ...(app.settings || []).flatMap((setting) => [
        setting.id,
        setting.label,
        setting.description,
        setting.scope,
        setting.location,
        setting.storage.key,
        setting.storage.property,
        setting.control.type,
        ...(setting.presets || []),
      ]),
      ...app.loadTriggers,
    ].filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(normalized);
  }

  function appHubDetails(app: MilxdyAppManifest): HTMLElement {
    const details = document.createElement("div");
    details.className = "milxdy-app-hub-details";
    details.append(
      appHubDetailRow("Does", app.hub?.longDescription || app.description),
      appHubDetailRow("Performance", `Startup ${app.cost.startup}; per-surface ${app.cost.perSurface}; network ${app.cost.network}; worker ${app.cost.worker}; DOM ${app.cost.domWrite}.`),
      appHubDetailRow("Loads", app.loadTriggers.join(", ")),
      appHubDetailRow("Chrome", appChromeSummary(app)),
      appHubDetailRow("Settings", appSettingsSummary(app)),
      appHubDetailRow("Settings home", appSettingsHome(app)),
      appHubDetailRow("Data", listText(app.hub?.dataNotes)),
      appHubDetailRow("Permissions", listText(app.hub?.permissionNotes) || listText(app.permissions?.hosts)),
      appHubDetailRow("Storage", listText(app.hub?.localStorageNotes) || storageKeySummary(app)),
      appHubDetailRow("Build", app.available === false ? app.unavailableReason || "Unavailable in this build." : "Included in this build."),
    );
    return details;
  }

  function appHubDetailRow(label: string, value: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "milxdy-app-hub-detail-row";
    const term = document.createElement("strong");
    term.textContent = label;
    const text = document.createElement("span");
    text.textContent = value || "Not declared.";
    row.append(term, text);
    return row;
  }

  function appHubMetadataNotes(app: MilxdyAppManifest): HTMLElement {
    const notes = document.createElement("div");
    notes.className = "milxdy-app-hub-notes";
    notes.append(
      appHubNote(`Cost ${app.cost.startup}/${app.cost.perSurface}`),
      appHubNote(packageKindLabel(app)),
      appHubNote(app.dock && app.hub?.rail.supported !== false ? "Rail app" : "No rail"),
    );
    if (app.chrome) notes.append(appHubNote(`Chrome ${chromeStyleLabel(app.chrome.nativeStyle)}`));
    if (app.settings?.length) notes.append(appHubNote(`${app.settings.length} settings`));
    for (const label of app.hub?.privacyLabels || []) {
      notes.append(appHubNote(label.replace(/-/g, " ")));
    }
    for (const service of app.hub?.remoteServices || []) {
      notes.append(appHubNote(service));
    }
    return notes;
  }

  function appChromeSummary(app: MilxdyAppManifest): string {
    if (!app.chrome) return "Not declared.";
    const supported = app.chrome.supportedStyles.map(chromeStyleLabel).join(", ");
    const notes = listText(app.chrome.notes);
    return [
      `Native ${chromeStyleLabel(app.chrome.nativeStyle)}.`,
      supported ? `Supports ${supported}.` : "",
      notes,
    ].filter(Boolean).join(" ");
  }

  function chromeStyleLabel(style: string): string {
    switch (style) {
      case "native":
        return "app defaults";
      case "reminet":
        return "RemiNet";
      case "classic":
        return "Classic bevel";
      case "maxxer":
        return "Maxxer";
      case "reader":
        return "Reader";
      case "miladychan":
        return "Miladychan";
      case "music":
        return "Music";
      case "wiki":
        return "Wiki";
      default:
        return style;
    }
  }

  function appSettingsSummary(app: MilxdyAppManifest): string {
    if (!app.settings?.length) return "No settings schema declared.";
    const byLocation = app.settings.reduce<Record<string, number>>((summary, setting) => {
      summary[setting.location] = (summary[setting.location] || 0) + 1;
      return summary;
    }, {});
    const locationText = Object.entries(byLocation)
      .map(([location, count]) => `${settingsLocationLabel(location)} ${count}`)
      .join("; ");
    const presetText = Array.from(new Set(app.settings.flatMap((setting) => setting.presets || [])))
      .map(settingsPresetLabel)
      .join(", ");
    return [
      locationText,
      presetText ? `Preset participation: ${presetText}.` : "",
    ].filter(Boolean).join(" ");
  }

  function appSettingsHome(app: MilxdyAppManifest): string {
    if (hubPackageKind(app) === "feature") {
      return "Feature settings should be exposed directly from Apps & Features when a generated settings renderer is available; global presets remain in the top-right settings menu.";
    }
    if (hubPackageKind(app) === "theme") {
      return "Theme and texture packs belong in Appearance/profile-pack flows; Apps & Features should show package status, reset, and review metadata.";
    }
    return "App-owned settings belong inside the app window or its settings surface. Apps & Features keeps enablement, launch, pinning, reset, privacy, storage, and diagnostics here.";
  }

  function packageKindLabel(app: MilxdyAppManifest): string {
    switch (hubPackageKind(app)) {
      case "app":
        return "App";
      case "feature":
        return "Feature";
      case "theme":
        return "Theme pack";
    }
  }

  function settingsLocationLabel(location: string): string {
    switch (location) {
      case "appearance":
        return "Appearance";
      case "appsAndFeatures":
        return "Apps & Features";
      case "appSurface":
        return "App surface";
      case "advanced":
        return "Advanced";
      default:
        return location;
    }
  }

  function settingsPresetLabel(preset: string): string {
    switch (preset) {
      case "firstRun":
        return "first run";
      case "profilePack":
        return "profile packs";
      default:
        return preset;
    }
  }

  function appHubNote(text: string): HTMLElement {
    const note = document.createElement("span");
    note.className = "milxdy-app-hub-note";
    note.textContent = text;
    return note;
  }

  function listText(values: readonly string[] | undefined): string {
    return values?.filter(Boolean).join("; ") || "";
  }

  function hasResettableStorage(app: MilxdyAppManifest): boolean {
    return hasResetWork(appResetPlan(app));
  }

  function appStorageKeys(app: MilxdyAppManifest): { local: readonly string[]; sync: readonly string[] } {
    return {
      local: app.storageKeys.local || [],
      sync: app.storageKeys.sync || [],
    };
  }

  function storageKeySummary(app: MilxdyAppManifest): string {
    const storageKeys = appStorageKeys(app);
    const keys = [
      ...storageKeys.local.map((key) => `local:${key}`),
      ...storageKeys.sync.map((key) => `sync:${key}`),
    ];
    return keys.join("; ");
  }

  function appResetPlan(app: MilxdyAppManifest): AppResetPlan {
    const storageKeys = appStorageKeys(app);
    const plan: AppResetPlan = {
      localKeys: [],
      syncKeys: [],
      settingDefaults: [],
      propertyDefaults: [],
      propertyRemovals: [],
      skippedSharedKeys: [],
      skippedSettings: [],
    };
    const representedKeys = new Set<string>();
    for (const setting of app.settings || []) {
      const area = setting.storage.area;
      const keyId = storageKeyId(area, setting.storage.key);
      representedKeys.add(keyId);
      appendSettingReset(plan, setting);
    }
    for (const key of storageKeys.local) appendWholeKeyReset(plan, app, "local", key, representedKeys);
    for (const key of storageKeys.sync) appendWholeKeyReset(plan, app, "sync", key, representedKeys);
    return plan;
  }

  function appendSettingReset(plan: AppResetPlan, setting: AppSettingDefinition): void {
    const area = setting.storage.area;
    const key = setting.storage.key;
    const property = setting.storage.property;
    const behavior = setting.reset.behavior;
    if (behavior === "custom") {
      plan.skippedSettings.push({ settingId: setting.id, area, key, property, behavior, reason: "customResetBehavior" });
      return;
    }
    if (property) {
      if (behavior === "removeKey") {
        plan.propertyRemovals.push({ area, key, property, settingId: setting.id, behavior });
        return;
      }
      if (setting.defaultValue !== undefined) {
        plan.propertyDefaults.push({ area, key, property, value: setting.defaultValue, settingId: setting.id, behavior });
        return;
      }
      plan.skippedSettings.push({ settingId: setting.id, area, key, property, behavior, reason: "missingDefaultValue" });
      return;
    }
    if (behavior === "removeKey") {
      appendWholeKey(plan, area, key);
      return;
    }
    if (setting.defaultValue !== undefined) {
      plan.settingDefaults.push({ area, key, value: setting.defaultValue, settingId: setting.id, behavior });
      return;
    }
    plan.skippedSettings.push({ settingId: setting.id, area, key, behavior, reason: "missingDefaultValue" });
  }

  function appendWholeKeyReset(
    plan: AppResetPlan,
    app: MilxdyAppManifest,
    area: ResetStorageArea,
    key: string,
    representedKeys: Set<string>,
  ): void {
    if (representedKeys.has(storageKeyId(area, key))) return;
    const owners = storageKeyOwners(area, key);
    if (owners.length > 1) {
      plan.skippedSharedKeys.push({ area, key, owners, reason: "sharedStorageKey" });
      return;
    }
    appendWholeKey(plan, area, key);
  }

  function appendWholeKey(plan: AppResetPlan, area: ResetStorageArea, key: string): void {
    const keys = area === "local" ? plan.localKeys : plan.syncKeys;
    if (!keys.includes(key)) keys.push(key);
  }

  function storageKeyOwners(area: ResetStorageArea, key: string): string[] {
    return state.apps
      .filter((app) => {
        const keys = appStorageKeys(app)[area];
        const hasStorageKey = keys.includes(key);
        const hasSettingStorage = app.settings?.some((setting) => setting.storage.area === area && setting.storage.key === key) === true;
        return hasStorageKey || hasSettingStorage;
      })
      .map((app) => app.id)
      .sort();
  }

  function storageKeyId(area: ResetStorageArea, key: string): string {
    return `${area}:${key}`;
  }

  function hasResetWork(plan: AppResetPlan): boolean {
    return plan.localKeys.length > 0
      || plan.syncKeys.length > 0
      || plan.settingDefaults.length > 0
      || plan.propertyDefaults.length > 0
      || plan.propertyRemovals.length > 0
      || plan.skippedSharedKeys.length > 0
      || plan.skippedSettings.length > 0;
  }

  async function executeAppResetPlan(plan: AppResetPlan): Promise<{
    localRemoved: boolean;
    syncRemoved: boolean;
    localSet: boolean;
    syncSet: boolean;
  }> {
    const localValues: Record<string, unknown> = {};
    const syncValues: Record<string, unknown> = {};
    for (const setting of plan.settingDefaults) {
      (setting.area === "local" ? localValues : syncValues)[setting.key] = setting.value;
    }
    const localObjectUpdates = await objectStorageUpdates("local", plan);
    const syncObjectUpdates = await objectStorageUpdates("sync", plan);
    Object.assign(localValues, localObjectUpdates);
    Object.assign(syncValues, syncObjectUpdates);
    const [localRemoved, syncRemoved, localSet, syncSet] = await Promise.all([
      plan.localKeys.length ? safeLocalRemove(plan.localKeys) : Promise.resolve(false),
      plan.syncKeys.length ? safeSyncRemove(plan.syncKeys) : Promise.resolve(false),
      Object.keys(localValues).length ? safeLocalSet(localValues) : Promise.resolve(false),
      Object.keys(syncValues).length ? safeSyncSet(syncValues) : Promise.resolve(false),
    ]);
    return { localRemoved, syncRemoved, localSet, syncSet };
  }

  async function objectStorageUpdates(area: ResetStorageArea, plan: AppResetPlan): Promise<Record<string, unknown>> {
    const propertyDefaults = plan.propertyDefaults.filter((entry) => entry.area === area);
    const propertyRemovals = plan.propertyRemovals.filter((entry) => entry.area === area);
    const keys = Array.from(new Set([...propertyDefaults, ...propertyRemovals].map((entry) => entry.key)));
    if (keys.length === 0) return {};
    const stored = await safeStorageGet(area, Object.fromEntries(keys.map((key) => [key, {}])));
    const updates: Record<string, unknown> = {};
    for (const key of keys) {
      const current = isPlainObject(stored?.[key]) ? stored?.[key] as Record<string, unknown> : {};
      const next = { ...current };
      for (const entry of propertyDefaults.filter((candidate) => candidate.key === key)) {
        next[entry.property] = entry.value;
      }
      for (const entry of propertyRemovals.filter((candidate) => candidate.key === key)) {
        delete next[entry.property];
      }
      updates[key] = next;
    }
    return updates;
  }

  async function safeStorageGet(area: ResetStorageArea, defaults: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (area === "local") return safeLocalGet(defaults);
    if (!hasExtensionRuntime()) return null;
    try {
      return await chrome.storage.sync.get(defaults as never);
    } catch (error) {
      if (!markExtensionInvalidated(error)) throw error;
      return null;
    }
  }

  async function safeSyncSet(values: Record<string, unknown>): Promise<boolean> {
    if (!hasExtensionRuntime()) return false;
    try {
      await chrome.storage.sync.set(values);
      return true;
    } catch (error) {
      if (!markExtensionInvalidated(error)) throw error;
      return false;
    }
  }

  function settingResetDiagnostic(entry: { area: ResetStorageArea; key: string; property?: string; settingId: string; behavior: string }): Record<string, unknown> {
    return {
      settingId: entry.settingId,
      area: entry.area,
      key: entry.key,
      property: entry.property,
      behavior: entry.behavior,
    };
  }

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function appRuntimeSummary(app: MilxdyAppManifest): string {
    const diagnostic = state.diagnostics.get(app.id);
    const parts = [
      app.available === false ? "app:unavailable" : "app:available",
      `state:${diagnostic?.state || "pending"}`,
      isRailPinned(app) ? "rail:pinned" : "rail:hidden",
      `load:${app.loadTriggers.join(",")}`,
      `cost:${app.cost.startup}/${app.cost.perSurface}`,
    ];
    if (diagnostic?.deferredReason) parts.push(`defer:${diagnostic.deferredReason}`);
    if (diagnostic?.loadMs !== undefined) parts.push(`loadMs:${diagnostic.loadMs}`);
    if (state.pendingSurfaceImports.has(app.id)) parts.push("surface:pending");
    if (state.loading.has(app.id)) parts.push("import:loading");
    if (state.loaded.has(app.id)) parts.push("import:loaded");
    return parts.join(" | ");
  }

  function appEnableBlockedByPerformance(app: MilxdyAppManifest): string | null {
    return appEnableBlockedForPerformance(app, state.performanceMode, state.effectiveBudget);
  }

  function appEnableBlockedForPerformance(app: MilxdyAppManifest, mode: PerformanceMode, budget: PerformanceModeBudget): string | null {
    if (app.available === false || !app.setEnabled) return null;
    if (app.id === "reminetChat" && mode !== "fast") return null;
    if (allowsFastModerateSurfaceImport(app)) return null;
    if (mode === "fast" && app.loadTriggers.includes("surface") && !isCheapSurfaceImport(app)) {
      return "Please change your performance settings to enable";
    }
    if (app.cost.startup === "heavy" && app.loadTriggers.includes("startup") && !budget.allowHeavyStartup) {
      return "Please change your performance settings to enable";
    }
    if (app.cost.perSurface === "heavy" && app.loadTriggers.includes("surface") && !budget.allowHeavySurfaceImports) {
      return "Please change your performance settings to enable";
    }
    if (app.cost.worker === "heavy" && mode !== "full" && mode !== "developer") {
      return "Please change your performance settings to enable";
    }
    if (app.cost.domWrite === "large" && app.loadTriggers.includes("surface") && !budget.allowHeavySurfaceImports) {
      return "Please change your performance settings to enable";
    }
    return null;
  }

  function shouldLoadAtStartup(app: MilxdyAppManifest): boolean {
    if (!app.loadTriggers.includes("startup")) return false;
    if (app.cost.startup === "heavy" && !state.effectiveBudget.allowHeavyStartup) return false;
    if (app.cost.worker === "heavy" && !state.effectiveBudget.allowWorkerPreload) return false;
    return true;
  }

  function surfaceImportDecision(app: MilxdyAppManifest, surface: TwitterSurface, surfaceIsWithinBudget: boolean): SurfaceImportDecision {
    if (state.loaded.has(app.id)) return { mode: "immediate" };
    if (state.loading.has(app.id)) return { mode: "blocked", reason: "importInFlight" };
    if (state.pendingSurfaceImports.has(app.id)) return { mode: "blocked", reason: "surfaceImportPending" };
    if (state.routeSurfaceImports >= state.effectiveBudget.maxSurfaceImportsPerRoute) return { mode: "blocked", reason: "routeImportCap" };
    if (!surfaceIsWithinBudget) return { mode: "blocked", reason: "offscreen" };
    const performanceBlock = surfaceDeliveryBlockedByPerformance(app, surface.kind);
    if (performanceBlock) return { mode: "blocked", reason: performanceBlock };
    if (state.performanceMode === "fast" && !isCheapSurfaceImport(app) && !allowsFastModerateSurfaceImport(app)) return { mode: "blocked", reason: "fastSurfaceCost" };
    if (state.performanceMode === "balanced" && shouldIdleSurfaceImport(app)) return { mode: "idle" };
    return { mode: "immediate" };
  }

  function reserveSurfaceImport(app: MilxdyAppManifest): void {
    state.routeSurfaceImports += 1;
    recordRuntimeDiagnostic(`surfaceImport.${app.id}`, {
      mode: state.performanceMode,
      startupBudgetActive: state.startupBudgetActive,
      routeImports: state.routeSurfaceImports,
      routeImportCap: state.effectiveBudget.maxSurfaceImportsPerRoute,
      updatedAt: Date.now(),
    });
  }

  function scheduleIdleSurfaceImport(
    app: MilxdyAppManifest,
    surface: TwitterSurface,
    surfaceIsWithinBudget: boolean,
    shouldDeliverSurface: boolean,
  ): void {
    state.pendingSurfaceImports.add(app.id);
    reserveSurfaceImport(app);
    recordImportAvoided(app, `surface:${surface.kind}:idleDeferred`);
    scheduler.idle(() => {
      if (!state.pendingSurfaceImports.has(app.id)) return;
      state.pendingSurfaceImports.delete(app.id);
      if (state.disposed || !state.enabledApps.has(app.id)) {
        recordImportAvoided(app, `surface:${surface.kind}:idleDisabled`);
        return;
      }
      if (!surface.element.isConnected) {
        recordSurfaceSkip(app, surface, "idleDisconnected");
        return;
      }
      const stillWithinBudget = surfaceWithinBudget(surface);
      if (!stillWithinBudget) {
        recordSurfaceSkip(app, surface, "idleOffscreen");
        return;
      }
      void loadApp(app, `surfaceIdle:${surface.kind}`).then((loaded) => {
        if (loaded?.onSurface && shouldDeliverSurface) deliverSurface(app, loaded, surface, surfaceIsWithinBudget || stillWithinBudget);
      });
    }, { timeout: Math.max(state.effectiveBudget.idleSurfaceTimeoutMs, 1000) });
  }

  function isCheapSurfaceImport(app: MilxdyAppManifest): boolean {
    return app.cost.perSurface === "cheap"
      && app.cost.network === "none"
      && app.cost.worker !== "heavy"
      && app.cost.domWrite === "small";
  }

  function allowsFastModerateSurfaceImport(app: MilxdyAppManifest): boolean {
    return app.id === "remistats";
  }

  function shouldIdleSurfaceImport(app: MilxdyAppManifest): boolean {
    return app.cost.perSurface !== "cheap"
      || app.cost.network !== "none"
      || app.cost.worker === "heavy"
      || app.cost.domWrite !== "small";
  }

  function surfaceDeliveryBlockedByPerformance(app: MilxdyAppManifest, surfaceKind: TwitterSurfaceKind): string | null {
    if (state.performanceMode === "fast" && !isCheapSurfaceImport(app) && !allowsFastModerateSurfaceImport(app)) return "fastSurfaceCost";
    if (app.cost.perSurface === "heavy" && !state.effectiveBudget.allowHeavySurfaceImports) return "heavySurface";
    if (app.cost.worker === "heavy" && !state.effectiveBudget.allowWorkerPreload) return "heavyWorker";
    if (surfaceKind === "tweet" && app.cost.domWrite === "large" && !state.effectiveBudget.allowHeavySurfaceImports) return "largeDomWrite";
    return null;
  }

  function appDeliversSurface(app: MilxdyAppManifest, surfaceKind: TwitterSurfaceKind): boolean {
    return app.deliverySurfaces ? app.deliverySurfaces.includes(surfaceKind) : app.surfaces.includes(surfaceKind);
  }

  function surfaceWithinBudget(surface: TwitterSurface): boolean {
    if (surface.kind === "profile") return true;
    const rect = surface.element.getBoundingClientRect();
    const margin = state.effectiveBudget.visibleSurfaceMarginPx;
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  }

  function scheduleIdlePreloads(): void {
    if (state.idlePreloadTimer !== null) {
      window.clearTimeout(state.idlePreloadTimer);
      state.idlePreloadTimer = null;
    }
    if (state.performanceMode !== "full" && state.performanceMode !== "developer") return;
    if (state.effectiveBudget.idlePreloadDelayMs === null || document.hidden) return;
    state.idlePreloadTimer = window.setTimeout(() => {
      state.idlePreloadTimer = null;
      for (const app of state.apps) {
        if (!app.loadTriggers.includes("idle") || state.loaded.has(app.id)) continue;
        if (app.cost.startup === "heavy" && !state.effectiveBudget.allowHeavyIdlePreload) {
          recordImportAvoided(app, "idle:heavy");
          continue;
        }
        void app.isEnabled().then((enabled) => {
          if (enabled) {
            void loadApp(app, "idle")
              .finally(() => scheduleProgressiveIdlePreload());
          } else {
            scheduleProgressiveIdlePreload();
          }
        });
        break;
      }
    }, state.effectiveBudget.idlePreloadDelayMs);
  }

  function scheduleProgressiveIdlePreload(): void {
    if (state.performanceMode !== "full" && state.performanceMode !== "developer") return;
    if (state.disposed || document.hidden) return;
    scheduleIdlePreloads();
  }

  function deferredReason(app: MilxdyAppManifest): string {
    if (app.dock && app.loadTriggers.includes("dockOpen")) return "metadataDock";
    if (app.loadTriggers.includes("userAction")) return "userAction";
    if (app.loadTriggers.includes("surface")) return "surface";
    if (app.loadTriggers.includes("idle")) return "idle";
    return "performanceMode";
  }

  function shouldLoadForRoute(app: MilxdyAppManifest, route: MilxdyRouteChange): boolean {
    if (!state.enabledApps.has(app.id) || state.loaded.has(app.id) || state.loading.has(app.id)) return false;
    if (!app.surfaces.includes("route") || !app.loadTriggers.includes("surface")) return false;
    return appRouteScopesMatchRoute(app, route);
  }

  function appRouteScopesMatchRoute(app: MilxdyAppManifest, route: MilxdyRouteChange): boolean {
    const currentSite = currentAppSiteId();
    if (!currentSite) return false;
    for (const scope of app.siteScopes || []) {
      if (!siteScopeMatchesCurrentHost(scope, currentSite)) continue;
      for (const routePattern of scope.routes || []) {
        if (routePattern.type === "exact" && routePattern.path === route.pathname) return true;
        if (routePattern.type === "prefix" && route.pathname.startsWith(routePattern.path)) return true;
      }
    }
    return false;
  }

  function currentAppSiteId(): AppSiteId | null {
    const host = window.location.hostname.toLowerCase();
    if (host === "x.com" || host === "twitter.com") return "x";
    if (host === "www.remilia.net" || host === "remilia.net") return "remiliaNet";
    if (host === "wiki.remilia.org" || host === "remilia.wiki") return "remiliaWiki";
    if (host === "boards.miladychan.org") return "miladychan";
    return null;
  }

  function siteScopeMatchesCurrentHost(scope: AppSiteScope, currentSite: AppSiteId): boolean {
    if (scope.site !== currentSite) return false;
    const hosts = scope.hosts || [];
    return hosts.length === 0 || hosts.some((host) => hostPatternMatchesCurrentLocation(host));
  }

  function hostPatternMatchesCurrentLocation(pattern: string): boolean {
    const match = pattern.match(/^(https?|wss):\/\/([^/]+)\/\*$/);
    if (!match) return false;
    const [, protocol, host] = match;
    if (`${protocol}:` !== window.location.protocol) return false;
    return host.toLowerCase() === window.location.hostname.toLowerCase();
  }

  function recordImportAvoided(app: MilxdyAppManifest, reason: string): void {
    const key = `${app.id}.${reason}`;
    state.importAvoidance[key] = (state.importAvoidance[key] || 0) + 1;
  }

  function recordSurfaceDelivery(app: MilxdyAppManifest, surface: TwitterSurface): void {
    const key = `${app.id}.${surface.kind}`;
    state.surfaceDeliveries[key] = (state.surfaceDeliveries[key] || 0) + 1;
  }

  function recordSurfaceSkip(app: MilxdyAppManifest, surface: TwitterSurface, reason: string): void {
    const key = `${app.id}.${surface.kind}.${reason}`;
    state.surfaceSkips[key] = (state.surfaceSkips[key] || 0) + 1;
  }

  function surfaceWasRecentlyDelivered(app: MilxdyAppManifest, surface: TwitterSurface): boolean {
    if (!state.effectiveBudget.dedupeSurfaceElements) return false;
    const deliveredApps = state.surfaceDeliveryCache.get(surface.element) || new Set<MilxdyAppId>();
    if (deliveredApps.has(app.id)) {
      state.surfaceDeliveryStats.dedupedByElement += 1;
      return true;
    }
    deliveredApps.add(app.id);
    state.surfaceDeliveryCache.set(surface.element, deliveredApps);
    if (state.effectiveBudget.surfaceDedupeTtlMs > 0) {
      const now = Date.now();
      purgeExpiredSurfaceDeliveryKeys(now);
      const key = `${app.id}:${surface.cacheKey}`;
      const deliveredAt = state.surfaceDeliveryKeyCache.get(key);
      if (deliveredAt !== undefined && now - deliveredAt < state.effectiveBudget.surfaceDedupeTtlMs) {
        state.surfaceDeliveryStats.dedupedByKey += 1;
        return true;
      }
      state.surfaceDeliveryKeyCache.set(key, now);
      state.surfaceDeliveryStats.keyCacheSize = state.surfaceDeliveryKeyCache.size;
    }
    return false;
  }

  function purgeExpiredSurfaceDeliveryKeys(now = Date.now()): void {
    const ttl = state.effectiveBudget.surfaceDedupeTtlMs;
    if (ttl <= 0) {
      state.surfaceDeliveryKeyCache.clear();
      state.surfaceDeliveryStats.keyCacheSize = 0;
      return;
    }
    if (state.surfaceDeliveryKeyCache.size < 800) return;
    for (const [key, deliveredAt] of state.surfaceDeliveryKeyCache) {
      if (now - deliveredAt >= ttl) state.surfaceDeliveryKeyCache.delete(key);
    }
    if (state.surfaceDeliveryKeyCache.size > 1200) {
      const overflow = state.surfaceDeliveryKeyCache.size - 1200;
      let deleted = 0;
      for (const key of state.surfaceDeliveryKeyCache.keys()) {
        state.surfaceDeliveryKeyCache.delete(key);
        deleted += 1;
        if (deleted >= overflow) break;
      }
    }
    state.surfaceDeliveryStats.keyCacheSize = state.surfaceDeliveryKeyCache.size;
  }

  function measureSurfaceHeight(surface: TwitterSurface): number | null {
    if (!state.effectiveBudget.diagnostics || surface.kind !== "tweet" || !surface.element.isConnected) return null;
    return Math.round(surface.element.getBoundingClientRect().height * 10) / 10;
  }

  function recordSurfaceHeightChange(app: MilxdyAppManifest, surface: TwitterSurface, before: number | null): void {
    if (before === null || surface.kind !== "tweet" || !surface.element.isConnected) return;
    const after = measureSurfaceHeight(surface);
    if (after === null) return;
    const delta = Math.round((after - before) * 10) / 10;
    if (Math.abs(delta) <= 1) return;
    state.tweetHeightChanges.push({
      appId: app.id,
      before,
      after,
      delta,
      cacheKey: surface.cacheKey,
      recordedAt: Date.now(),
    });
    if (state.tweetHeightChanges.length > 100) state.tweetHeightChanges.splice(0, state.tweetHeightChanges.length - 100);
    flushDiagnosticsSoon();
  }

  function drainNetworkQueue(): void {
    if (state.disposed) {
      cancelNetworkQueue();
      return;
    }
    while (state.activeNetworkTasks < Math.max(1, state.effectiveBudget.networkConcurrency) && state.networkQueue.length > 0) {
      const task = state.networkQueue.shift();
      if (!task) return;
      if (task.canceled) {
        state.networkStats.canceled += 1;
        continue;
      }
      state.activeNetworkTasks += 1;
      state.networkStats.started += 1;
      state.networkStats.maxActive = Math.max(state.networkStats.maxActive, state.activeNetworkTasks);
      withRuntimeMessageDeadline(safeRuntimeMessage(task.message), task.label)
        .then((response) => {
          finishNetworkTask(task, true);
          task.resolve(response);
        }, (error) => {
          finishNetworkTask(task, false);
          task.reject(error);
        })
        .finally(() => {
          state.activeNetworkTasks = Math.max(0, state.activeNetworkTasks - 1);
          drainNetworkQueue();
        });
    }
  }

  function withRuntimeMessageDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`${label} timed out after ${CONTENT_NETWORK_DEADLINE_MS}ms`));
      }, CONTENT_NETWORK_DEADLINE_MS);
      promise.then((value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }, (error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function finishNetworkTask(task: NetworkTask, ok: boolean): void {
    if (ok) state.networkStats.completed += 1;
    else state.networkStats.failed += 1;
    state.networkStats.lastLabel = task.label;
    state.networkStats.lastLatencyMs = Math.round((performance.now() - task.queuedAt) * 10) / 10;
    flushDiagnosticsSoon();
  }

  function cancelNetworkQueue(): void {
    for (const task of state.networkQueue.splice(0)) {
      task.canceled = true;
      state.networkStats.canceled += 1;
      task.resolve(null);
    }
  }

  function cancelNetworkQueueForApp(appId: MilxdyAppId): void {
    for (let index = state.networkQueue.length - 1; index >= 0; index -= 1) {
      const task = state.networkQueue[index];
      if (!task || task.appId !== appId) continue;
      state.networkQueue.splice(index, 1);
      task.canceled = true;
      state.networkStats.canceled += 1;
      task.resolve(null);
    }
  }

  function notifyLoadedAppOfRoute(app: MilxdyAppManifest, module: MilxdyContentAppModule): void {
    if (!module.onRouteChange) return;
    void Promise.resolve(module.onRouteChange(state.route))
      .finally(() => recordFeatureTiming(app.id, "route.initial", performance.now()));
  }

  function updateAppDiagnostics(
    app: MilxdyAppManifest,
    loadState: AppLoadState,
    values: Partial<AppDiagnostics> = {},
  ): void {
    state.diagnostics.set(app.id, {
      ...appDiagnosticsBase(app, loadState),
      ...values,
    });
  }

  function flushDiagnosticsSoon(): void {
    if (state.diagnosticsTimer !== null) return;
    state.diagnosticsTimer = window.setTimeout(async () => {
      state.diagnosticsTimer = null;
      const stored = await safeLocalGet({ "milxdy.diagnostics.enabled": false });
      if (stored?.["milxdy.diagnostics.enabled"] !== true) return;
      await safeLocalSet({
        "milxdy.diagnostics.apps": diagnostics(),
        "milxdy.diagnostics.runtime": {
          mode: state.performanceMode,
          budget: state.budget,
          effectiveBudget: state.effectiveBudget,
          startupBudgetActive: state.startupBudgetActive,
          route: state.route,
          loadedApps: Array.from(state.loaded.keys()).sort(),
          loadingApps: Array.from(state.loading.keys()).sort(),
          loadedHeavyApps: loadedAppsByCost((app) => app.cost.startup === "heavy" || app.cost.perSurface === "heavy" || app.cost.domWrite === "large"),
          loadedWorkerHeavyApps: loadedAppsByCost((app) => app.cost.worker === "heavy"),
          loadedNetworkApps: loadedAppsByCost((app) => app.cost.network !== "none"),
          pendingSurfaceImports: Array.from(state.pendingSurfaceImports).sort(),
          deferredApps: diagnostics().filter((app) => app.state === "pending").map((app) => ({ id: app.id, reason: app.deferredReason })),
          importAvoidance: state.importAvoidance,
          surfaceCounts: state.surfaceCounts,
          surfaceDeliveries: state.surfaceDeliveries,
          surfaceSkips: state.surfaceSkips,
          activeSurfaceKinds: interestedSurfaceKinds(),
          idleQueueDepth: state.idleQueueDepth,
          idleQueueMaxDepth: state.idleQueueMaxDepth,
          idleScheduler: state.idleSchedulerStats,
          scaffold: state.tweetScaffoldStats,
          surfaceDelivery: state.surfaceDeliveryStats,
          surfaceDeliveryQueueDepth: Array.from(state.surfaceDeliveryQueues.entries()).reduce<Record<string, number>>((depths, [appId, queue]) => {
            depths[appId] = queue.deliveries.length;
            return depths;
          }, {}),
          network: {
            ...state.networkStats,
            active: state.activeNetworkTasks,
            queuedDepth: state.networkQueue.length,
            concurrency: state.effectiveBudget.networkConcurrency,
          },
          longTasks: state.longTasks.slice(-25),
          layoutShifts: state.layoutShifts.slice(-25),
          performanceObserverCount: activePerformanceObserverCount(),
          tweetHeightChanges: state.tweetHeightChanges.slice(-25),
          routeSurfaceImports: state.routeSurfaceImports,
          scanner: getTwitterScannerCounters(),
          updatedAt: Date.now(),
        },
      });
    }, DIAGNOSTIC_FLUSH_MS);
  }

  function recordRuntimeDiagnostic(key: string, value: unknown): void {
    void safeLocalGet({ "milxdy.diagnostics.enabled": false }).then((stored) => {
      if (stored?.["milxdy.diagnostics.enabled"] !== true) return;
      void safeLocalSet({ [`milxdy.diagnostics.${key}`]: value });
    });
  }

  function loadedAppsByCost(matches: (app: MilxdyAppManifest) => boolean): MilxdyAppId[] {
    return state.apps
      .filter((app) => state.loaded.has(app.id) && matches(app))
      .map((app) => app.id)
      .sort();
  }

  function configurePerformanceObservers(): void {
    state.longTaskObserver?.disconnect();
    state.layoutShiftObserver?.disconnect();
    state.longTaskObserver = null;
    state.layoutShiftObserver = null;
    state.longTasks = [];
    state.layoutShifts = [];
    if (!state.effectiveBudget.diagnostics || typeof PerformanceObserver === "undefined") return;
    try {
      state.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTasks.push({
            startTime: Math.round(entry.startTime * 10) / 10,
            duration: Math.round(entry.duration * 10) / 10,
            name: entry.name,
          });
        }
        if (state.longTasks.length > 100) state.longTasks.splice(0, state.longTasks.length - 100);
        flushDiagnosticsSoon();
      });
      state.longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      state.longTaskObserver = null;
    }
    try {
      state.layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean; sources?: Array<{ node?: Node }> };
          if (layoutShift.hadRecentInput) continue;
          state.layoutShifts.push({
            startTime: Math.round(entry.startTime * 10) / 10,
            value: Math.round((layoutShift.value ?? 0) * 10000) / 10000,
            marker: layoutShiftMarker(layoutShift),
          });
        }
        if (state.layoutShifts.length > 100) state.layoutShifts.splice(0, state.layoutShifts.length - 100);
        flushDiagnosticsSoon();
      });
      state.layoutShiftObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      state.layoutShiftObserver = null;
    }
  }

  function activePerformanceObserverCount(): number {
    return (state.longTaskObserver ? 1 : 0) + (state.layoutShiftObserver ? 1 : 0);
  }

  return { boot, loadApp, notifyRoute, dispose, diagnostics };
}

type LocalAddonZipEntry = {
  fileName: string;
  flags: number;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export async function preflightLocalAddonZip(file: File): Promise<LocalAddonQueueItem> {
  try {
    if (!/\.zip$/iu.test(file.name)) throw new Error("Choose a .zip package.");
    if (file.size === 0) throw new Error("ZIP package is empty.");
    if (file.size > LOCAL_ADDON_MAX_ARCHIVE_BYTES) throw new Error("ZIP package exceeds the 100 MB archive limit.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = readLocalAddonZipDirectory(bytes);
    if (!entries.length) throw new Error("ZIP archive is empty.");
    if (entries.length > LOCAL_ADDON_MAX_ENTRIES) throw new Error(`ZIP archive has too many files: ${entries.length}.`);
    const manifests = entries.filter((entry) => entry.fileName === "milxdy.app.json" || entry.fileName.endsWith("/milxdy.app.json"));
    if (!manifests.some((entry) => entry.fileName === "milxdy.app.json")) throw new Error("milxdy.app.json must be at the ZIP root.");
    if (manifests.length !== 1) throw new Error("ZIP package must contain exactly one milxdy.app.json.");
    let totalUncompressed = 0;
    for (const entry of entries) {
      if (!safeLocalAddonArchivePath(entry.fileName)) throw new Error(`Unsafe ZIP path: ${entry.fileName}.`);
      if ((entry.flags & 1) !== 0) throw new Error(`Encrypted ZIP entry cannot be inspected: ${entry.fileName}.`);
      if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) throw new Error(`Unsupported ZIP compression method for ${entry.fileName}.`);
      if (entry.uncompressedSize > LOCAL_ADDON_MAX_ENTRY_BYTES) throw new Error(`ZIP entry is too large: ${entry.fileName}.`);
      totalUncompressed += entry.uncompressedSize;
      if (totalUncompressed > LOCAL_ADDON_MAX_ARCHIVE_BYTES) throw new Error("ZIP package exceeds the 100 MB extracted limit.");
    }
    const manifestBytes = await readLocalAddonZipEntry(bytes, manifests[0]!);
    const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)) as Record<string, unknown>;
    if (manifest.manifestVersion !== 1) throw new Error("Unsupported or missing manifestVersion; expected 1.");
    for (const field of ["id", "name", "version", "description", "contentEntry"] as const) {
      if (typeof manifest[field] !== "string" || !String(manifest[field]).trim()) throw new Error(`Manifest field ${field} is required.`);
    }
    if (!new Set(["app", "feature", "theme"]).has(String(manifest.packageKind))) throw new Error("packageKind must be app, feature, or theme.");
    const sdk = manifest.sdk as Record<string, unknown> | undefined;
    if (!sdk || typeof sdk.minVersion !== "string") throw new Error("sdk.minVersion is required.");
    return {
      file,
      state: "accepted",
      id: String(manifest.id),
      name: String(manifest.name),
      version: String(manifest.version),
    };
  } catch (error) {
    return {
      file,
      state: "rejected",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function readLocalAddonZipDirectory(bytes: Uint8Array): LocalAddonZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimum = Math.max(0, bytes.byteLength - 22 - 0xffff);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP end-of-directory record is missing.");
  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || directoryOffset === 0xffffffff) throw new Error("ZIP64 packages require local builder validation.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries: LocalAddonZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP central directory is malformed.");
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > bytes.byteLength) throw new Error("ZIP central directory entry is truncated.");
    entries.push({
      fileName: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
      flags: view.getUint16(offset + 8, true),
      compressionMethod: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset = nextOffset;
  }
  return entries;
}

function safeLocalAddonArchivePath(fileName: string): boolean {
  if (!fileName || fileName.includes("\0") || fileName.includes("\\") || fileName.startsWith("/") || /^[A-Za-z]:/u.test(fileName)) return false;
  return !fileName.split("/").some((segment) => segment === "..");
}

async function readLocalAddonZipEntry(bytes: Uint8Array, entry: LocalAddonZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > bytes.byteLength || view.getUint32(offset, true) !== 0x04034b50) throw new Error(`ZIP local header is malformed: ${entry.fileName}.`);
  const dataOffset = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > bytes.byteLength) throw new Error(`ZIP entry is truncated: ${entry.fileName}.`);
  const compressed = bytes.slice(dataOffset, dataEnd);
  if (entry.compressionMethod === 0) {
    if (compressed.byteLength !== entry.uncompressedSize) throw new Error(`ZIP entry size mismatch: ${entry.fileName}.`);
    return compressed;
  }
  if (typeof DecompressionStream !== "function") throw new Error("This Chromium version cannot preflight compressed ZIP packages.");
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > entry.uncompressedSize || total > LOCAL_ADDON_MAX_ENTRY_BYTES) {
      await reader.cancel("Inflated ZIP entry exceeded its declared size.");
      throw new Error(`ZIP entry exceeded its declared size: ${entry.fileName}.`);
    }
    chunks.push(value);
  }
  const inflated = new Uint8Array(total);
  let writeOffset = 0;
  for (const chunk of chunks) {
    inflated.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }
  if (inflated.byteLength !== entry.uncompressedSize) throw new Error(`ZIP entry size mismatch after extraction: ${entry.fileName}.`);
  return inflated;
}

function createTweetScaffoldStats(): TweetScaffoldStats {
  return {
    attempts: 0,
    skipsBySignature: 0,
    createdSlots: 0,
    createdBySlot: {},
    durationMs: 0,
    lastDurationMs: 0,
    maxDurationMs: 0,
  };
}

function appDiagnosticsBase(app: MilxdyAppManifest, state: AppLoadState): AppDiagnostics {
  return {
    id: app.id,
    state,
    contentEntry: app.contentEntry,
    available: app.available !== false,
    unavailableReason: app.unavailableReason,
    hub: app.hub ? {
      category: app.hub.category,
      railSupported: app.hub.rail.supported,
      railDefaultPinned: app.hub.rail.defaultPinned,
      presets: app.hub.presets,
    } : undefined,
  };
}

function applyRuntimeDocumentMarkers(mode: PerformanceMode): void {
  const root = document.documentElement;
  root.dataset.milxdyPerformanceMode = mode;
  root.dataset.milxdyVersion = typeof MILXDY_VERSION === "string" ? MILXDY_VERSION : "unknown";
  root.dataset.milxdyBuildProfile = typeof MILXDY_BUILD_PROFILE === "string" ? MILXDY_BUILD_PROFILE : "full";
  root.dataset.milxdyBuildTarget = typeof MILXDY_BUILD_TARGET === "string" ? MILXDY_BUILD_TARGET : "chromium";
}

function createRuntimeScheduler(
  getBudget: () => PerformanceModeBudget,
  isDisposed: () => boolean,
  updateDepth: (depth: number) => void,
  stats: IdleSchedulerStats,
): AppRuntimeScheduler {
  const queue: IdleTask[] = [];
  let nextTaskId = 1;
  let drainCancel: (() => void) | null = null;

  const compactQueue = () => {
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (queue[index]?.canceled) queue.splice(index, 1);
    }
    updateDepth(queue.length);
  };

  const scheduleDrain = () => {
    if (drainCancel || isDisposed() || queue.length === 0) return;
    const run = (deadline?: IdleDeadline) => drain(deadline);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: getBudget().idleSurfaceTimeoutMs });
      drainCancel = () => window.cancelIdleCallback?.(id);
    } else {
      const id = window.setTimeout(() => run(), 16);
      drainCancel = () => window.clearTimeout(id);
    }
  };

  const drain = (deadline?: IdleDeadline) => {
    drainCancel = null;
    if (isDisposed()) {
      queue.length = 0;
      updateDepth(0);
      return;
    }
    compactQueue();
    stats.flushes += 1;
    const budget = getBudget();
    let processed = 0;
    while (queue.length > 0 && processed < budget.maxIdleTasksPerFrame) {
      const now = performance.now();
      const task = queue[0];
      if (!task) break;
      const timedOut = now - task.queuedAt >= task.timeoutMs;
      if (deadline && processed > 0 && deadline.timeRemaining() < 4 && !timedOut) break;
      queue.shift();
      updateDepth(queue.length);
      if (task.canceled) {
        stats.canceled += 1;
        continue;
      }
      stats.started += 1;
      try {
        task.callback();
      } catch (error) {
        console.error("milXdy idle task failed", error);
      } finally {
        stats.completed += 1;
      }
      processed += 1;
    }
    if (queue.length > 0) scheduleDrain();
  };

  return {
    idle(callback, options) {
      if (isDisposed()) return () => undefined;
      const task: IdleTask = {
        id: nextTaskId,
        callback,
        queuedAt: performance.now(),
        timeoutMs: options?.timeout ?? getBudget().idleSurfaceTimeoutMs,
        canceled: false,
      };
      nextTaskId += 1;
      queue.push(task);
      stats.queued += 1;
      stats.maxDepth = Math.max(stats.maxDepth, queue.length);
      updateDepth(queue.length);
      scheduleDrain();
      return () => {
        if (task.canceled) return;
        task.canceled = true;
        stats.canceled += 1;
        compactQueue();
      };
    },
    timeout(callback, delayMs) {
      const id = window.setTimeout(callback, delayMs);
      return () => window.clearTimeout(id);
    },
  };
}

function injectStylesheets(app: MilxdyAppManifest): void {
  for (const sheet of app.css || []) {
    if (document.getElementById(sheet.id)) continue;
    const link = document.createElement("link");
    link.id = sheet.id;
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL(sheet.path);
    document.documentElement.appendChild(link);
  }
}

function injectTweetScaffoldStyles(): void {
  if (document.getElementById(TWEET_SCAFFOLD_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TWEET_SCAFFOLD_STYLE_ID;
  style.textContent = `
    [data-milxdy-tweet-slot] {
      box-sizing: border-box;
      contain: layout style paint;
    }
    [data-milxdy-tweet-slot="post-reading-action"]:empty,
    [data-milxdy-tweet-slot="remistats-badge"]:empty,
    [data-milxdy-tweet-slot="remistats-badge"][data-reminet-state="reserved"] {
      display: inline-flex;
      width: 0;
      min-width: 0;
      height: 0;
      margin: 0;
      padding: 0;
      overflow: visible;
      pointer-events: none;
      vertical-align: top;
    }
    [data-milxdy-tweet-slot="post-reading-header-action"] {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 22px;
      width: 22px;
      min-width: 22px;
      height: 20px;
      min-height: 20px;
      margin: 0;
      padding: 0;
      overflow: visible;
      pointer-events: none;
      vertical-align: middle;
    }
    [data-milxdy-post-reading-header-controls="true"] {
      align-items: center !important;
      min-height: 20px !important;
      height: 20px !important;
    }
    [data-milxdy-post-reading-header-controls="true"] [aria-label="Grok actions"],
    [data-milxdy-post-reading-header-controls="true"] [data-testid="caret"],
    [data-milxdy-post-reading-header-controls="true"] [data-milxdy-tweet-slot="post-reading-header-action"],
    [data-milxdy-post-reading-header-controls="true"] .post-reading-button {
      min-height: 20px !important;
      height: 20px !important;
    }
    [data-milxdy-tweet-slot="post-reading-header-action"] > .post-reading-button {
      pointer-events: auto;
    }
    [data-milxdy-tweet-slot="remistats-action-poke"] {
      display: flex;
      position: relative;
      align-items: center;
      justify-content: flex-start;
      flex: 1 1 0%;
      align-self: center;
      width: auto;
      min-width: 0;
      height: 0;
      margin: 0;
      overflow: visible;
      pointer-events: none;
      opacity: 0;
    }
    #${HUB_PANEL_ID} {
      --milxdy-hub-face: #1f222a;
      --milxdy-hub-panel: #101218;
      --milxdy-hub-list: #08090d;
      --milxdy-hub-input: #08090d;
      --milxdy-hub-border-light: #454953;
      --milxdy-hub-border-dark: #050608;
      --milxdy-hub-outline: #8f7932;
      --milxdy-hub-title: #081d68;
      --milxdy-hub-title-text: #fff2b8;
      --milxdy-hub-button: #20232b;
      --milxdy-hub-row: #101218;
      --milxdy-hub-row-hover: #1b1d1d;
      --milxdy-hub-row-line: rgba(191, 151, 38, 0.48);
      --milxdy-hub-text: #f2ecd5;
      --milxdy-hub-muted: rgba(242, 236, 213, 0.62);
      --milxdy-hub-soft: rgba(242, 236, 213, 0.76);
      --milxdy-hub-accent: #f0b72d;
      --milxdy-hub-button-border: rgba(191, 151, 38, 0.52);
      --milxdy-hub-switch-on: #0f6b52;
      --milxdy-hub-switch-on-border: #69e0af;
      --milxdy-hub-switch-on-text: #ffffff;
      position: fixed;
      top: 16px;
      bottom: 136px;
      width: min(360px, calc(100vw - 92px));
      z-index: 2147483002;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      color: var(--milxdy-hub-text, var(--milxdy-text, #eef0ff));
      background: var(--milxdy-hub-face);
      border: 2px solid var(--milxdy-hub-outline);
      border-radius: 0;
      box-shadow:
        inset 2px 2px 0 var(--milxdy-hub-border-light),
        inset -2px -2px 0 var(--milxdy-hub-border-dark),
        8px 8px 0 rgba(0, 0, 0, 0.34);
      font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${HUB_PANEL_ID}[data-side="left"] { left: 76px; }
    #${HUB_PANEL_ID}[data-side="right"] { right: 76px; }
    .milxdy-app-hub-header {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: space-between;
      min-height: 34px;
      margin: -4px -4px 4px;
      padding: 3px 4px 3px 9px;
      border: 2px solid var(--milxdy-hub-outline);
      background: var(--milxdy-hub-title);
      box-shadow:
        inset 2px 2px 0 var(--milxdy-hub-border-light),
        inset -2px -2px 0 rgba(0, 0, 0, 0.76);
    }
    .milxdy-app-hub-header strong {
      color: var(--milxdy-hub-title-text);
      font-size: 15px;
      line-height: 1.2;
      text-transform: none;
    }
    .milxdy-app-hub-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .milxdy-app-hub-settings-button {
      display: inline-grid;
      width: 34px;
      min-height: 34px;
      place-items: center;
      padding: 0;
      font-family: "Segoe UI Symbol", "Apple Symbols", var(--milxdy-font-ui, system-ui, sans-serif);
      font-size: 20px;
      line-height: 1;
    }
    #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings {
      position: static;
      display: grid;
      width: auto;
      min-height: 0;
      box-sizing: border-box;
      overflow: auto;
      padding: 10px;
      border: 2px solid var(--milxdy-hub-outline);
      border-radius: 0;
      background: var(--milxdy-hub-panel);
      color: inherit;
      box-shadow:
        inset 1px 1px 0 var(--milxdy-hub-border-dark),
        inset -1px -1px 0 var(--milxdy-hub-border-light);
    }
    #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings button {
      min-height: 30px;
      border: 1px solid var(--milxdy-hub-button-border);
      border-radius: 0;
      background: var(--milxdy-hub-button);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      line-height: 1;
    }
    #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings .milxdy-overlay-dock-settings-row {
      grid-template-columns: 24px minmax(0, 1fr) 30px 30px;
      min-height: 30px;
    }
    #${HUB_PANEL_ID} .milxdy-app-hub-setup-settings {
      display: grid;
      gap: 8px;
      padding-top: 7px;
      border-top: 1px solid var(--milxdy-hub-button-border);
    }
    #${HUB_PANEL_ID} .milxdy-app-hub-setup-settings summary {
      cursor: pointer;
      color: var(--milxdy-hub-accent);
      font-size: 12px;
      font-weight: 700;
    }
    #${HUB_PANEL_ID} .milxdy-app-hub-setup-settings:not([open]) > :not(summary) {
      display: none;
    }
    .milxdy-app-hub-list {
      display: flex;
      flex-direction: column;
      gap: 0;
      overflow: auto;
      padding: 3px;
      border: 2px solid var(--milxdy-hub-outline);
      background: var(--milxdy-hub-list);
      box-shadow:
        inset 2px 2px 0 var(--milxdy-hub-border-dark),
        inset -2px -2px 0 rgba(255, 244, 207, 0.12);
      scrollbar-width: auto;
      scrollbar-color: var(--milxdy-hub-outline) var(--milxdy-hub-panel);
    }
    .milxdy-app-hub-list::-webkit-scrollbar {
      width: 16px;
    }
    .milxdy-app-hub-list::-webkit-scrollbar-track {
      border-left: 1px solid var(--milxdy-hub-border-dark);
      background: var(--milxdy-hub-panel);
    }
    .milxdy-app-hub-list::-webkit-scrollbar-thumb {
      border: 2px solid var(--milxdy-hub-panel);
      background: var(--milxdy-hub-outline);
      box-shadow:
        inset 1px 1px 0 var(--milxdy-hub-border-light),
        inset -1px -1px 0 var(--milxdy-hub-border-dark);
    }
    .milxdy-app-hub-section {
      display: grid;
      gap: 0;
      border-bottom: 2px solid var(--milxdy-hub-outline);
    }
    .milxdy-app-hub-section:last-child {
      border-bottom: 0;
    }
    .milxdy-app-hub-section-title {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 6px;
      padding: 5px 7px;
      border-bottom: 1px solid var(--milxdy-hub-row-line);
      background: var(--milxdy-hub-panel);
      color: var(--milxdy-hub-accent);
      line-height: 1.2;
    }
    .milxdy-app-hub-section-title strong {
      font-size: 11px;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .milxdy-app-hub-section-title span {
      color: var(--milxdy-hub-muted);
      font-size: 10px;
      line-height: 1.2;
      text-transform: none;
      white-space: nowrap;
    }
    .milxdy-app-hub-search {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 8px 10px;
      border: 2px solid var(--milxdy-hub-outline);
      border-radius: 0;
      background: var(--milxdy-hub-panel);
      box-shadow:
        inset 1px 1px 0 var(--milxdy-hub-border-dark),
        inset -1px -1px 0 var(--milxdy-hub-border-light);
    }
    .milxdy-app-hub-search span {
      color: var(--milxdy-hub-muted);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
    }
    .milxdy-app-hub-search input {
      min-height: 32px;
      box-sizing: border-box;
      border: 2px solid var(--milxdy-hub-outline);
      border-radius: 0;
      background: var(--milxdy-hub-input);
      color: inherit;
      font: inherit;
      font-size: 12px;
      padding: 0 9px;
      outline: none;
    }
    .milxdy-app-hub-search input:focus {
      border-color: var(--milxdy-hub-accent);
      box-shadow: 0 0 0 2px rgba(248, 211, 93, 0.12);
    }
    .milxdy-app-hub-empty {
      margin: 0;
      padding: 10px;
      color: var(--milxdy-hub-muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .milxdy-app-hub-runtime {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 8px 10px;
      border: 2px solid var(--milxdy-hub-outline);
      border-radius: 0;
      background: var(--milxdy-hub-panel);
      box-shadow:
        inset 1px 1px 0 var(--milxdy-hub-border-dark),
        inset -1px -1px 0 var(--milxdy-hub-border-light);
    }
    .milxdy-app-hub-runtime strong {
      font-size: 12px;
      line-height: 1.2;
    }
    .milxdy-app-hub-addons {
      --milxdy-addon-surface: #171820;
      --milxdy-addon-surface-muted: #20222d;
      --milxdy-addon-line: #4c5064;
      --milxdy-addon-line-strong: #858cc9;
      --milxdy-addon-highlight: rgba(255, 255, 255, 0.12);
      --milxdy-addon-text: #f0f1f8;
      --milxdy-addon-muted: rgba(240, 241, 248, 0.62);
      --milxdy-addon-accent: #9ea7ff;
      --milxdy-addon-accent-strong: #cbd0ff;
      --milxdy-addon-accent-soft: color-mix(in srgb, #9ea7ff 12%, #171820);
      --milxdy-addon-warn: #ffd978;
      --milxdy-addon-warn-soft: color-mix(in srgb, #ffd978 12%, #171820);
      --milxdy-addon-focus: #ffc2d2;
      display: grid;
      gap: 8px;
      max-height: min(390px, 52vh);
      overflow: auto;
      padding: 9px;
      border: 1px solid var(--milxdy-addon-line);
      border-right: 3px solid color-mix(in srgb, var(--milxdy-addon-line-strong) 78%, var(--milxdy-addon-line));
      border-bottom: 4px solid color-mix(in srgb, var(--milxdy-addon-line-strong) 78%, var(--milxdy-addon-line));
      border-radius: 6px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--milxdy-addon-highlight) 72%, transparent) 0, transparent 42px),
        var(--milxdy-addon-surface);
      color: var(--milxdy-addon-text);
      box-shadow: inset 2px 2px 1px color-mix(in srgb, var(--milxdy-addon-highlight) 78%, transparent);
      font-size: 11px;
      line-height: 1.35;
      scrollbar-width: thin;
    }
    .milxdy-app-hub-addon-header {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
    }
    .milxdy-app-hub-addon-header img {
      width: 40px;
      height: 40px;
      border: 1px solid var(--milxdy-addon-line);
      border-radius: 6px;
      object-fit: cover;
      box-shadow: 0 4px 2px rgba(0, 0, 0, 0.2);
    }
    .milxdy-app-hub-addon-header > div { display: grid; gap: 1px; min-width: 0; }
    .milxdy-app-hub-addon-header strong { color: var(--milxdy-addon-text); font-size: 14px; line-height: 1.15; }
    .milxdy-app-hub-addon-eyebrow {
      color: var(--milxdy-addon-accent-strong);
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .milxdy-app-hub-addon-badge,
    .milxdy-app-hub-addon-section-heading > span {
      display: inline-grid;
      min-height: 20px;
      place-items: center;
      border: 1px solid var(--milxdy-addon-line);
      border-radius: 999px;
      background: var(--milxdy-addon-surface-muted);
      color: var(--milxdy-addon-muted);
      padding: 2px 6px;
      font-size: 9px;
      font-weight: 800;
      white-space: nowrap;
    }
    .milxdy-app-hub-addon-badge[data-tone="active"] { border-color: var(--milxdy-addon-accent); background: var(--milxdy-addon-accent-soft); color: var(--milxdy-addon-accent-strong); }
    .milxdy-app-hub-addon-badge[data-tone="warning"] { border-color: var(--milxdy-addon-warn); background: var(--milxdy-addon-warn-soft); color: var(--milxdy-addon-warn); }
    .milxdy-app-hub-addon-summary { margin: 0; color: var(--milxdy-addon-muted); }
    .milxdy-app-hub-addon-workflow {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin: 0;
      padding: 7px 0;
      border-top: 1px solid var(--milxdy-addon-line);
      border-bottom: 1px solid var(--milxdy-addon-line);
      list-style: none;
    }
    .milxdy-app-hub-addon-workflow li {
      position: relative;
      display: grid;
      min-width: 0;
      justify-items: center;
      gap: 1px;
      padding: 2px 4px;
      color: var(--milxdy-addon-muted);
      text-align: center;
    }
    .milxdy-app-hub-addon-workflow li:not(:last-child)::after {
      position: absolute;
      top: 15px;
      right: -3px;
      color: var(--milxdy-addon-line-strong);
      content: ">";
    }
    .milxdy-app-hub-addon-step-icon {
      display: grid;
      width: 30px;
      height: 30px;
      place-items: center;
      border: 1px solid var(--milxdy-addon-line-strong);
      border-radius: 6px;
      background: color-mix(in srgb, var(--milxdy-addon-surface-muted) 82%, var(--milxdy-addon-highlight));
      color: var(--milxdy-addon-accent-strong);
      box-shadow:
        inset 1px 1px 0 color-mix(in srgb, var(--milxdy-addon-highlight) 64%, transparent),
        inset -1px -1px 0 color-mix(in srgb, var(--milxdy-addon-line-strong) 44%, transparent);
      font: 800 9px ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .milxdy-app-hub-addon-workflow li[data-state="pending"] { opacity: 0.5; }
    .milxdy-app-hub-addon-workflow li[data-state="current"] .milxdy-app-hub-addon-step-icon,
    .milxdy-app-hub-addon-workflow li[data-state="complete"] .milxdy-app-hub-addon-step-icon { border-color: var(--milxdy-addon-accent); background: var(--milxdy-addon-accent-soft); }
    .milxdy-app-hub-addon-workflow li[data-state="error"] .milxdy-app-hub-addon-step-icon { border-color: var(--milxdy-addon-warn); background: var(--milxdy-addon-warn-soft); color: var(--milxdy-addon-warn); }
    .milxdy-app-hub-addon-step-number { font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; }
    .milxdy-app-hub-addon-workflow strong { color: inherit; font-size: 9px; line-height: 1.15; }
    .milxdy-app-hub-addon-workflow small { max-width: 100%; font-size: 8px; line-height: 1.15; overflow-wrap: anywhere; }
    .milxdy-app-hub-addon-packages { display: grid; }
    .milxdy-app-hub-addon-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 4px; }
    .milxdy-app-hub-addon-section-heading > strong { color: var(--milxdy-addon-accent-strong); font-size: 10px; text-transform: uppercase; }
    .milxdy-app-hub-addon-package-list { max-height: 94px; margin: 0; padding: 0; overflow: auto; border-top: 1px solid var(--milxdy-addon-line); list-style: none; }
    .milxdy-app-hub-addon-package-list li,
    .milxdy-app-hub-addon-empty {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 6px 2px;
      border-bottom: 1px solid var(--milxdy-addon-line);
    }
    .milxdy-app-hub-addon-package-list li > span:last-child,
    .milxdy-app-hub-addon-empty > span:last-child { display: grid; min-width: 0; gap: 1px; }
    .milxdy-app-hub-addon-package-list strong,
    .milxdy-app-hub-addon-empty strong { color: var(--milxdy-addon-text); font-size: 11px; }
    .milxdy-app-hub-addon-package-list small,
    .milxdy-app-hub-addon-empty small { color: var(--milxdy-addon-muted); font-size: 9px; overflow-wrap: anywhere; }
    .milxdy-app-hub-addon-package-mark,
    .milxdy-app-hub-addon-empty > span:first-child {
      display: grid;
      width: 30px;
      height: 30px;
      place-items: center;
      border: 1px solid var(--milxdy-addon-line);
      border-radius: 6px;
      background: var(--milxdy-addon-surface-muted);
      color: var(--milxdy-addon-accent-strong);
      font-weight: 800;
    }
    .milxdy-app-hub-addon-queue { display: grid; gap: 3px; }
    .milxdy-app-hub-addon-queue-list { max-height: 112px; margin: 0; padding: 0; overflow: auto; border-top: 1px solid var(--milxdy-addon-line); list-style: none; }
    .milxdy-app-hub-addon-queue-list li {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 6px 2px;
      border-bottom: 1px solid var(--milxdy-addon-line);
    }
    .milxdy-app-hub-addon-queue-list li > span:last-child { display: grid; min-width: 0; gap: 1px; }
    .milxdy-app-hub-addon-queue-list strong { color: var(--milxdy-addon-text); font-size: 11px; }
    .milxdy-app-hub-addon-queue-list small,
    .milxdy-app-hub-addon-queue-empty,
    .milxdy-app-hub-addon-queue-message { margin: 0; color: var(--milxdy-addon-muted); font-size: 9px; overflow-wrap: anywhere; }
    .milxdy-app-hub-addon-queue-empty { padding: 5px 2px; border-top: 1px solid var(--milxdy-addon-line); }
    .milxdy-app-hub-addon-queue-message { padding: 5px 7px; border-left: 2px solid var(--milxdy-addon-accent); background: var(--milxdy-addon-accent-soft); }
    .milxdy-app-hub-addon-queue-mark {
      display: grid;
      width: 30px;
      height: 30px;
      place-items: center;
      border: 1px solid var(--milxdy-addon-line);
      border-radius: 6px;
      background: var(--milxdy-addon-surface-muted);
      color: var(--milxdy-addon-muted);
      font: 800 9px ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .milxdy-app-hub-addon-queue-list li[data-state="accepted"] .milxdy-app-hub-addon-queue-mark { border-color: var(--milxdy-addon-accent); background: var(--milxdy-addon-accent-soft); color: var(--milxdy-addon-accent-strong); }
    .milxdy-app-hub-addon-queue-list li[data-state="rejected"] .milxdy-app-hub-addon-queue-mark { border-color: var(--milxdy-addon-warn); background: var(--milxdy-addon-warn-soft); color: var(--milxdy-addon-warn); }
    .milxdy-app-hub-addon-notices { margin: 0; padding: 6px 8px 6px 22px; border: 1px solid var(--milxdy-addon-line); border-radius: 6px; background: var(--milxdy-addon-surface-muted); color: var(--milxdy-addon-muted); }
    .milxdy-app-hub-addon-notices[data-tone="warning"] { border-color: var(--milxdy-addon-warn); background: var(--milxdy-addon-warn-soft); color: var(--milxdy-addon-warn); }
    .milxdy-app-hub-addon-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
    .milxdy-app-hub-addon-picker { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    #${HUB_PANEL_ID} .milxdy-app-hub-addon-actions button,
    .milxdy-app-hub-addon-picker-label {
      display: grid;
      min-height: 32px;
      place-items: center;
      box-sizing: border-box;
      border: 1px solid var(--milxdy-addon-line);
      border-radius: 6px;
      background: var(--milxdy-addon-surface-muted);
      color: var(--milxdy-addon-text);
      padding: 5px 6px;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.14);
      cursor: pointer;
      font-size: 9px;
      font-weight: 800;
      line-height: 1.2;
      text-align: center;
    }
    #${HUB_PANEL_ID} .milxdy-app-hub-addon-actions button:first-child { border-color: var(--milxdy-addon-accent); background: var(--milxdy-addon-accent-soft); color: var(--milxdy-addon-accent-strong); }
    #${HUB_PANEL_ID} .milxdy-app-hub-addon-actions button:disabled { cursor: not-allowed; opacity: 0.48; }
    #${HUB_PANEL_ID} .milxdy-app-hub-addon-actions button:focus-visible,
    .milxdy-app-hub-addon-picker-label:focus-visible,
    .milxdy-app-hub-addon-details summary:focus-visible { outline: 2px solid var(--milxdy-addon-focus); outline-offset: 2px; }
    .milxdy-app-hub-addon-details { display: grid; gap: 3px; padding-top: 2px; color: var(--milxdy-addon-muted); }
    .milxdy-app-hub-addon-details summary { cursor: pointer; color: var(--milxdy-addon-accent-strong); font-size: 10px; font-weight: 700; }
    .milxdy-app-hub-addon-details:not([open]) > :not(summary) { display: none; }
    .milxdy-app-hub-addon-details > span { overflow-wrap: anywhere; }
    @media (forced-colors: active) {
      .milxdy-app-hub-addons,
      .milxdy-app-hub-addon-step-icon,
      .milxdy-app-hub-addon-package-mark,
      .milxdy-app-hub-addon-queue-mark,
      .milxdy-app-hub-addon-badge,
      #${HUB_PANEL_ID} .milxdy-app-hub-addon-actions button,
      .milxdy-app-hub-addon-picker-label { border-color: CanvasText; forced-color-adjust: auto; }
      .milxdy-app-hub-addon-workflow li[data-state="current"] .milxdy-app-hub-addon-step-icon { outline: 2px solid Highlight; }
    }
    .milxdy-app-hub-runtime span,
    .milxdy-app-hub-runtime-state {
      color: var(--milxdy-hub-muted);
      font-size: 11px;
      line-height: 1.3;
      word-break: break-word;
    }
    .milxdy-app-hub-first-run {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 1px solid rgba(248, 211, 93, 0.28);
      border-radius: 0;
      background: rgba(248, 211, 93, 0.1);
    }
    .milxdy-app-hub-first-run strong {
      font-size: 13px;
      line-height: 1.2;
    }
    .milxdy-app-hub-first-run p {
      margin: 0;
      color: var(--milxdy-hub-soft);
      font-size: 12px;
      line-height: 1.35;
    }
    .milxdy-app-hub-preset-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .milxdy-app-hub-setup-settings {
      display: grid;
      gap: 6px;
      padding-top: 8px;
      margin-top: 8px;
      border-top: 1px solid var(--milxdy-hub-row-line);
    }
    .milxdy-app-hub-setup-settings span {
      color: var(--milxdy-hub-soft);
      font-size: 12px;
      line-height: 1.35;
    }
    .milxdy-app-hub-card {
      display: grid;
      gap: 5px;
      padding: 6px 7px;
      border: 0;
      border-bottom: 1px solid var(--milxdy-hub-row-line);
      border-radius: 0;
      background: var(--milxdy-hub-row);
      box-shadow: none;
    }
    .milxdy-app-hub-card:last-child {
      border-bottom: 0;
    }
    .milxdy-app-hub-card:hover {
      background: var(--milxdy-hub-row-hover);
    }
    .milxdy-app-hub-card[data-enabled="false"] {
      opacity: 0.62;
    }
    .milxdy-app-hub-card[data-available="false"] {
      opacity: 0.52;
    }
    .milxdy-app-hub-card-summary {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr) 18px;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
    .milxdy-app-hub-card[data-tier="app"] .milxdy-app-hub-card-summary {
      grid-template-columns: 14px 32px minmax(0, 1fr) 18px;
    }
    .milxdy-app-hub-drag-handle {
      display: inline-grid;
      width: 14px;
      height: 28px;
      place-items: center;
      color: var(--milxdy-hub-muted);
      cursor: grab;
      font-size: 12px;
      line-height: 1;
      touch-action: none;
    }
    html[data-milxdy-hub-reordering="true"] .milxdy-app-hub-drag-handle,
    .milxdy-app-hub-drag-handle:active {
      color: var(--milxdy-hub-accent);
      cursor: grabbing;
    }
    .milxdy-app-hub-card-summary strong {
      min-width: 0;
      overflow: hidden;
      color: inherit;
      font-size: 13px;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .milxdy-app-hub-expand-icon {
      position: relative;
      display: inline-grid;
      width: 16px;
      height: 16px;
      justify-self: center;
      place-items: center;
      border: 1px solid var(--milxdy-hub-button-border);
      background: var(--milxdy-hub-button);
      box-shadow:
        inset 1px 1px 0 var(--milxdy-hub-border-light),
        inset -1px -1px 0 rgba(0, 0, 0, 0.58);
      transform: rotate(0deg);
      transform-origin: 50% 35%;
      transition: transform 140ms ease;
    }
    .milxdy-app-hub-expand-icon::before {
      content: "";
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 6px solid var(--milxdy-hub-accent);
    }
    .milxdy-app-hub-card[data-expanded="true"] .milxdy-app-hub-expand-icon {
      transform: rotate(180deg);
    }
    .milxdy-app-hub-icon {
      flex: 0 0 30px;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 0;
      background: rgba(248, 211, 93, 0.16);
      color: var(--milxdy-hub-accent);
      font-size: 14px;
      font-weight: 800;
      box-shadow:
        inset 1px 1px 0 var(--milxdy-hub-border-light),
        inset -1px -1px 0 rgba(0, 0, 0, 0.5);
    }
    .milxdy-app-hub-icon-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .milxdy-app-hub-body {
      min-width: 0;
      display: none;
      flex-direction: column;
      gap: 3px;
    }
    .milxdy-app-hub-card[data-expanded="true"] .milxdy-app-hub-body {
      display: flex;
    }
    .milxdy-app-hub-body p {
      margin: 0;
      color: var(--milxdy-hub-soft);
      font-size: 12px;
      line-height: 1.35;
    }
    .milxdy-app-hub-unavailable {
      color: var(--milxdy-hub-accent);
      font-size: 11px;
      line-height: 1.3;
    }
    .milxdy-app-hub-notes {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .milxdy-app-hub-note {
      max-width: 100%;
      box-sizing: border-box;
      padding: 2px 5px;
      border: 1px solid var(--milxdy-hub-button-border);
      border-radius: 0;
      background: rgba(255, 255, 255, 0.035);
      overflow-wrap: anywhere;
      text-transform: none;
    }
    .milxdy-app-hub-details {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 3px;
      padding-top: 6px;
      border-top: 1px solid var(--milxdy-hub-row-line);
    }
    .milxdy-app-hub-detail-row {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 6px;
      align-items: start;
    }
    .milxdy-app-hub-detail-row strong,
    .milxdy-app-hub-detail-row span {
      font-size: 11px;
      line-height: 1.3;
    }
    .milxdy-app-hub-detail-row strong {
      color: var(--milxdy-hub-accent);
    }
    .milxdy-app-hub-detail-row span {
      color: var(--milxdy-hub-muted);
      overflow-wrap: anywhere;
      text-transform: none;
    }
    .milxdy-app-hub-generated-settings {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
      padding-top: 7px;
      border-top: 1px solid var(--milxdy-hub-row-line);
    }
    .milxdy-app-hub-generated-settings > strong {
      color: var(--milxdy-hub-accent);
      font-size: 11px;
      line-height: 1.2;
    }
    .milxdy-app-hub-generated-setting {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(96px, 36%);
      align-items: center;
      gap: 8px;
      min-height: 30px;
    }
    .milxdy-app-hub-generated-setting-text {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-transform: none;
    }
    .milxdy-app-hub-generated-setting-text strong {
      color: var(--milxdy-hub-text);
      font-size: 11px;
      line-height: 1.2;
      text-transform: none;
    }
    .milxdy-app-hub-generated-setting-text small {
      color: var(--milxdy-hub-muted);
      font-size: 10px;
      line-height: 1.2;
      overflow-wrap: anywhere;
      text-transform: none;
    }
    .milxdy-app-hub-generated-setting select,
    .milxdy-app-hub-generated-setting input,
    .milxdy-app-hub-generated-setting textarea {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1px solid var(--milxdy-hub-button-border);
      border-radius: 0;
      background: var(--milxdy-hub-input);
      color: var(--milxdy-hub-text);
      font: inherit;
      font-size: 11px;
      line-height: 1.2;
      padding: 5px 6px;
    }
    .milxdy-app-hub-generated-setting input[type="range"] {
      padding: 0;
      accent-color: var(--milxdy-hub-accent);
    }
    .milxdy-app-hub-generated-setting textarea {
      min-height: 54px;
      resize: vertical;
    }
    .milxdy-app-hub-generated-setting .milxdy-app-hub-generated-toggle {
      min-height: 30px;
      padding: 5px 7px;
    }
    .milxdy-app-hub-generated-unsupported {
      color: var(--milxdy-hub-muted);
      font-size: 11px;
      line-height: 1.2;
      text-transform: none;
    }
    .milxdy-app-hub-body span {
      color: var(--milxdy-hub-muted);
      font-size: 11px;
      line-height: 1.2;
      text-transform: capitalize;
    }
    .milxdy-app-hub-enable-row {
      display: grid;
      grid-template-columns: minmax(112px, auto) minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 3px 0 5px;
    }
    .milxdy-app-hub-enable-row .milxdy-app-hub-enable-detail {
      color: var(--milxdy-hub-soft);
      font-size: 11px;
      line-height: 1.25;
      text-transform: none;
    }
    .milxdy-app-hub-controls {
      display: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .milxdy-app-hub-card[data-expanded="true"] .milxdy-app-hub-controls {
      display: grid;
    }
    .milxdy-app-hub-header button,
    .milxdy-app-hub-preset-actions button,
    .milxdy-app-hub-enable-row button,
    .milxdy-app-hub-controls button {
      border: 2px solid var(--milxdy-hub-button-border);
      border-radius: 0;
      background: var(--milxdy-hub-button);
      color: inherit;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      padding: 7px 9px;
      cursor: pointer;
      box-shadow:
        inset 2px 2px 0 var(--milxdy-hub-border-light),
        inset -2px -2px 0 rgba(0, 0, 0, 0.58);
    }
    .milxdy-app-hub-header button:active,
    .milxdy-app-hub-preset-actions button:active,
    .milxdy-app-hub-enable-row button:active,
    .milxdy-app-hub-controls button:active {
      box-shadow:
        inset 2px 2px 0 rgba(0, 0, 0, 0.58),
        inset -2px -2px 0 rgba(255, 244, 207, 0.18);
      transform: translate(1px, 1px);
    }
    .milxdy-app-hub-enable-row button:disabled,
    .milxdy-app-hub-controls button:disabled {
      cursor: default;
      opacity: 0.52;
    }
    .milxdy-app-hub-enable-row button:disabled:active {
      transform: none;
    }
    .milxdy-app-hub-enable-row .milxdy-app-hub-switch,
    .milxdy-app-hub-controls .milxdy-app-hub-switch,
    .milxdy-app-hub-generated-setting .milxdy-app-hub-switch {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      align-items: center;
      gap: 7px;
      min-height: 32px;
      text-align: left;
    }
    .milxdy-app-hub-enable-row .milxdy-app-hub-switch {
      grid-column: auto;
    }
    .milxdy-app-hub-enable-row .milxdy-app-hub-switch[data-checked="true"],
    .milxdy-app-hub-controls .milxdy-app-hub-switch[data-checked="true"],
    .milxdy-app-hub-generated-setting .milxdy-app-hub-switch[data-checked="true"] {
      border-color: var(--milxdy-hub-switch-on-border);
      background: var(--milxdy-hub-switch-on);
      color: var(--milxdy-hub-switch-on-text);
      box-shadow:
        inset 2px 2px 0 rgba(255, 255, 255, 0.22),
        inset -2px -2px 0 rgba(0, 0, 0, 0.46);
    }
    .milxdy-app-hub-switch-knob {
      position: relative;
      width: 30px;
      height: 16px;
      border-radius: 999px;
      background: rgba(238, 240, 255, 0.2);
      box-shadow: inset 0 0 0 1px rgba(238, 240, 255, 0.18);
    }
    .milxdy-app-hub-switch-knob::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: rgba(238, 240, 255, 0.88);
      transition: transform 140ms ease;
    }
    .milxdy-app-hub-switch[data-checked="true"] .milxdy-app-hub-switch-knob {
      background: rgba(255, 255, 255, 0.24);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.52);
    }
    .milxdy-app-hub-switch[data-checked="true"] .milxdy-app-hub-switch-knob::after {
      transform: translateX(14px);
      background: #ffffff;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.28);
    }
    .milxdy-app-hub-switch[data-checked="true"] .milxdy-app-hub-switch-text {
      color: #ffffff;
    }
    .milxdy-app-hub-switch[data-performance-blocked="true"] {
      cursor: help;
      opacity: 0.54;
      filter: grayscale(0.75);
    }
    .milxdy-app-hub-switch[data-performance-blocked="true"] .milxdy-app-hub-switch-knob {
      border-color: rgba(128, 128, 128, 0.52);
      background: rgba(128, 128, 128, 0.22);
    }
    .milxdy-app-hub-switch-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    html[data-milxdy-x-theme="light"] #${HUB_PANEL_ID},
    html[data-milxdy-settings-theme="light"] #${HUB_PANEL_ID},
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) #${HUB_PANEL_ID} {
      --milxdy-hub-face: #d4d0c8;
      --milxdy-hub-panel: #ece9df;
      --milxdy-hub-list: #ffffff;
      --milxdy-hub-input: #ffffff;
      --milxdy-hub-border-light: #ffffff;
      --milxdy-hub-border-dark: #404040;
      --milxdy-hub-outline: #808080;
      --milxdy-hub-title: #000080;
      --milxdy-hub-title-text: #ffffff;
      --milxdy-hub-button: #d4d0c8;
      --milxdy-hub-row: #ece9df;
      --milxdy-hub-row-hover: #fff6cb;
      --milxdy-hub-row-line: rgba(64, 64, 64, 0.42);
      --milxdy-hub-text: #101014;
      --milxdy-hub-muted: rgba(16, 16, 20, 0.62);
      --milxdy-hub-soft: rgba(16, 16, 20, 0.74);
      --milxdy-hub-accent: #000080;
      --milxdy-hub-button-border: #808080;
      --milxdy-hub-switch-on: #005c3b;
      --milxdy-hub-switch-on-border: #003f29;
      --milxdy-hub-switch-on-text: #ffffff;
      color: var(--milxdy-hub-text);
      background: var(--milxdy-hub-face);
      border-color: var(--milxdy-hub-outline);
      box-shadow:
        inset 2px 2px 0 var(--milxdy-hub-border-light),
        inset -2px -2px 0 var(--milxdy-hub-border-dark),
        8px 8px 0 rgba(15, 23, 42, 0.18);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-addons,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-addons,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-addons {
      --milxdy-addon-surface: #fbfbfb;
      --milxdy-addon-surface-muted: #e5e5e5;
      --milxdy-addon-line: #b4b4b4;
      --milxdy-addon-line-strong: #464a6c;
      --milxdy-addon-highlight: #ffffff;
      --milxdy-addon-text: #19191d;
      --milxdy-addon-muted: rgba(0, 0, 0, 0.56);
      --milxdy-addon-accent: #626bb2;
      --milxdy-addon-accent-strong: #171f82;
      --milxdy-addon-accent-soft: color-mix(in srgb, #626bb2 10%, #fbfbfb);
      --milxdy-addon-warn: #8c6800;
      --milxdy-addon-warn-soft: color-mix(in srgb, #f2bc21 14%, #fbfbfb);
      --milxdy-addon-focus: #b35e7d;
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-card,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-card,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-card {
      border-color: var(--milxdy-hub-row-line);
      background: var(--milxdy-hub-row);
    }
    html[data-milxdy-x-theme="light"] #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings,
    html[data-milxdy-settings-theme="light"] #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings {
      border-color: var(--milxdy-hub-outline);
      background: var(--milxdy-hub-panel);
    }
    html[data-milxdy-x-theme="light"] #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings button,
    html[data-milxdy-settings-theme="light"] #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings button,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) #${HUB_PANEL_ID} .milxdy-app-hub-dock-settings button {
      border-color: var(--milxdy-hub-button-border);
      background: var(--milxdy-hub-button);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-runtime,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-runtime,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-runtime {
      border-color: var(--milxdy-hub-outline);
      background: var(--milxdy-hub-panel);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-search,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-search,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-search {
      border-color: var(--milxdy-hub-outline);
      background: var(--milxdy-hub-panel);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-search span,
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-empty,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-search span,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-empty,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-search span,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-empty {
      color: var(--milxdy-hub-muted);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-search input,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-search input,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-search input {
      border-color: var(--milxdy-hub-outline);
      background: var(--milxdy-hub-input);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-first-run,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-first-run,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-first-run {
      border-color: rgba(98, 107, 178, 0.28);
      background: rgba(98, 107, 178, 0.1);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-first-run p,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-first-run p,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-first-run p {
      color: var(--milxdy-hub-soft);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-body p,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-body p,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-body p {
      color: var(--milxdy-hub-soft);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-body span,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-body span,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-body span {
      color: var(--milxdy-hub-muted);
    }
    .milxdy-app-hub-body .milxdy-app-hub-switch[data-checked="true"] .milxdy-app-hub-switch-text {
      color: #ffffff !important;
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-unavailable,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-unavailable,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-unavailable {
      color: rgba(126, 86, 20, 0.78);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-note,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-note,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-note {
      border-color: var(--milxdy-hub-button-border);
      background: var(--milxdy-hub-input);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-details,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-details,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-details {
      border-color: var(--milxdy-hub-row-line);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-detail-row strong,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-detail-row strong,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-detail-row strong {
      color: rgba(126, 86, 20, 0.82);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-detail-row span,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-detail-row span,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-detail-row span {
      color: var(--milxdy-hub-muted);
    }
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-runtime span,
    html[data-milxdy-x-theme="light"] .milxdy-app-hub-runtime-state,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-runtime span,
    html[data-milxdy-settings-theme="light"] .milxdy-app-hub-runtime-state,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-runtime span,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .milxdy-app-hub-runtime-state {
      color: var(--milxdy-hub-muted);
    }
    html[data-milxdy-x-theme="dark"] #${HUB_PANEL_ID},
    html[data-milxdy-x-theme="dim"] #${HUB_PANEL_ID},
    html[data-milxdy-settings-theme="dark"] #${HUB_PANEL_ID} {
      --milxdy-hub-face: #1f222a;
      --milxdy-hub-panel: #101218;
      --milxdy-hub-list: #08090d;
      --milxdy-hub-input: #08090d;
      --milxdy-hub-border-light: #454953;
      --milxdy-hub-border-dark: #050608;
      --milxdy-hub-outline: #8f7932;
      --milxdy-hub-title: #081d68;
      --milxdy-hub-title-text: #fff2b8;
      --milxdy-hub-button: #20232b;
      --milxdy-hub-row: #101218;
      --milxdy-hub-row-hover: #1b1d1d;
      --milxdy-hub-row-line: rgba(191, 151, 38, 0.48);
      --milxdy-hub-text: #f2ecd5;
      --milxdy-hub-muted: rgba(242, 236, 213, 0.62);
      --milxdy-hub-soft: rgba(242, 236, 213, 0.76);
      --milxdy-hub-accent: #f0b72d;
      --milxdy-hub-button-border: rgba(191, 151, 38, 0.52);
      color: var(--milxdy-hub-text);
      background: var(--milxdy-hub-face);
      border-color: var(--milxdy-hub-outline);
      box-shadow:
        inset 2px 2px 0 var(--milxdy-hub-border-light),
        inset -2px -2px 0 var(--milxdy-hub-border-dark),
        8px 8px 0 rgba(0, 0, 0, 0.34);
    }
  `;
  document.documentElement.appendChild(style);
}

function dockIconForApp(app: MilxdyAppManifest): string {
  const letter = (app.dock?.label || app.name || app.id).trim().slice(0, 1).toUpperCase() || "?";
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">',
    '<rect width="48" height="48" rx="8" fill="transparent"/>',
    '<rect x="5" y="5" width="38" height="38" rx="7" fill="#f8d35d" opacity=".16"/>',
    `<text x="24" y="31" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="900" fill="#f8d35d">${letter}</text>`,
    '</svg>',
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function resolveAppIconAsset(icon: AppIconAsset): string {
  if (typeof icon === "string") return icon;
  return currentAppIconTheme() === "dark" ? icon.dark : icon.light;
}

function currentAppIconTheme(): "light" | "dark" {
  const root = document.documentElement;
  const xTheme = root.dataset.milxdyXTheme;
  const settingsTheme = root.dataset.milxdySettingsTheme;
  if (xTheme === "dark" || xTheme === "dim" || settingsTheme === "dark") return "dark";
  if (xTheme === "light" || settingsTheme === "light") return "light";
  if (root.style.colorScheme === "dark") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function hubDockIcon(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">',
    '<rect width="48" height="48" rx="8" fill="transparent"/>',
    '<circle cx="16" cy="16" r="5" fill="#f8d35d"/>',
    '<circle cx="32" cy="16" r="5" fill="#f8d35d" opacity=".82"/>',
    '<circle cx="16" cy="32" r="5" fill="#f8d35d" opacity=".82"/>',
    '<circle cx="32" cy="32" r="5" fill="#f8d35d"/>',
    '</svg>',
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function runtimeAssetUrl(value: string): string {
  return /^(https?:|chrome-extension:|moz-extension:|data:|\/)/.test(value)
    ? value
    : chrome.runtime.getURL(value);
}

function currentRoute(previousHref: string | null): MilxdyRouteChange {
  return {
    href: location.href,
    pathname: location.pathname,
    previousHref,
    visible: !document.hidden,
    changedAt: Date.now(),
  };
}

function patchHistory(callback: () => void): () => void {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  const schedule = () => queueMicrotask(callback);
  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    schedule();
    return result;
  };
  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    schedule();
    return result;
  };
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}

function layoutShiftMarker(entry: PerformanceEntry & { sources?: Array<{ node?: Node }> }): string {
  const selectors = [
    ["post-reading", "[data-post-reading-button='true'], .post-reading-button"],
    ["remistats", "[data-reminet-badge='true'], .reminet-score-badge, [data-reminet-action-poke-group='true']"],
    ["wiki", "[data-remilia-wiki-hyperlink], .remilia-wiki-link"],
    ["maxxer", "[data-miladymaxxer-effect], .miladymaxxer-level-inline, [data-miladymaxxer]"],
    ["rootVisuals", "[data-milxdy-display-name-row='true'], [data-milxdy-tweet-header='true']"],
    ["tweet", "article[data-testid='tweet']"],
  ] as const;
  for (const source of entry.sources || []) {
    const element = source.node instanceof Element ? source.node : source.node?.parentElement;
    if (!element) continue;
    for (const [label, selector] of selectors) {
      if (element.matches(selector) || element.closest(selector)) return label;
    }
  }
  return "unknown";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
