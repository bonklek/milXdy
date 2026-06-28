import { safeLocalGet, safeLocalSet } from "./extensionRuntime";

export type PerformanceMode = "fast" | "balanced" | "full" | "developer";

export type PerformanceModeBudget = {
  mode: PerformanceMode;
  visibleSurfaceMarginPx: number;
  idleSurfaceTimeoutMs: number;
  maxIdleTasksPerFrame: number;
  maxScannerSurfacesPerFlush: number;
  maxScannerSurfacesPerScrollFlush: number;
  maxScannerSurfacesPerFullScan: number;
  maxScannerPendingSurfaces: number;
  scrollSettleMs: number;
  dedupeSurfaceElements: boolean;
  surfaceDedupeTtlMs: number;
  maxSurfaceDeliveryQueuePerApp: number;
  idlePreloadDelayMs: number | null;
  maxSurfaceImportsPerRoute: number;
  networkConcurrency: number;
  safetyScanIntervalMs: number | null;
  diagnostics: boolean;
  allowHeavyStartup: boolean;
  allowHeavyIdlePreload: boolean;
  allowHeavySurfaceImports: boolean;
  allowWorkerPreload: boolean;
};

export const PERFORMANCE_MODE_KEY = "milxdy.performance.mode";

const DEFAULT_MODE: PerformanceMode = "balanced";

export const PERFORMANCE_BUDGETS: Record<PerformanceMode, PerformanceModeBudget> = {
  fast: {
    mode: "fast",
    visibleSurfaceMarginPx: 240,
    idleSurfaceTimeoutMs: 300,
    maxIdleTasksPerFrame: 1,
    maxScannerSurfacesPerFlush: 12,
    maxScannerSurfacesPerScrollFlush: 3,
    maxScannerSurfacesPerFullScan: 24,
    maxScannerPendingSurfaces: 48,
    scrollSettleMs: 220,
    dedupeSurfaceElements: true,
    surfaceDedupeTtlMs: 0,
    maxSurfaceDeliveryQueuePerApp: 8,
    idlePreloadDelayMs: null,
    maxSurfaceImportsPerRoute: 2,
    networkConcurrency: 2,
    safetyScanIntervalMs: null,
    diagnostics: false,
    allowHeavyStartup: false,
    allowHeavyIdlePreload: false,
    allowHeavySurfaceImports: false,
    allowWorkerPreload: false,
  },
  balanced: {
    mode: "balanced",
    visibleSurfaceMarginPx: 900,
    idleSurfaceTimeoutMs: 800,
    maxIdleTasksPerFrame: 3,
    maxScannerSurfacesPerFlush: 24,
    maxScannerSurfacesPerScrollFlush: 6,
    maxScannerSurfacesPerFullScan: 72,
    maxScannerPendingSurfaces: 144,
    scrollSettleMs: 160,
    dedupeSurfaceElements: true,
    surfaceDedupeTtlMs: 6000,
    maxSurfaceDeliveryQueuePerApp: 18,
    idlePreloadDelayMs: null,
    maxSurfaceImportsPerRoute: 5,
    networkConcurrency: 4,
    safetyScanIntervalMs: null,
    diagnostics: false,
    allowHeavyStartup: false,
    allowHeavyIdlePreload: false,
    allowHeavySurfaceImports: false,
    allowWorkerPreload: false,
  },
  full: {
    mode: "full",
    visibleSurfaceMarginPx: 1800,
    idleSurfaceTimeoutMs: 1500,
    maxIdleTasksPerFrame: 6,
    maxScannerSurfacesPerFlush: 48,
    maxScannerSurfacesPerScrollFlush: 24,
    maxScannerSurfacesPerFullScan: 180,
    maxScannerPendingSurfaces: 360,
    scrollSettleMs: 80,
    dedupeSurfaceElements: true,
    surfaceDedupeTtlMs: 2500,
    maxSurfaceDeliveryQueuePerApp: 48,
    idlePreloadDelayMs: 6000,
    maxSurfaceImportsPerRoute: 12,
    networkConcurrency: 6,
    safetyScanIntervalMs: 10000,
    diagnostics: false,
    allowHeavyStartup: false,
    allowHeavyIdlePreload: true,
    allowHeavySurfaceImports: true,
    allowWorkerPreload: false,
  },
  developer: {
    mode: "developer",
    visibleSurfaceMarginPx: 2200,
    idleSurfaceTimeoutMs: 2000,
    maxIdleTasksPerFrame: 10,
    maxScannerSurfacesPerFlush: 80,
    maxScannerSurfacesPerScrollFlush: 80,
    maxScannerSurfacesPerFullScan: 300,
    maxScannerPendingSurfaces: 600,
    scrollSettleMs: 0,
    dedupeSurfaceElements: false,
    surfaceDedupeTtlMs: 0,
    maxSurfaceDeliveryQueuePerApp: 120,
    idlePreloadDelayMs: 2500,
    maxSurfaceImportsPerRoute: 24,
    networkConcurrency: 8,
    safetyScanIntervalMs: 10000,
    diagnostics: true,
    allowHeavyStartup: true,
    allowHeavyIdlePreload: true,
    allowHeavySurfaceImports: true,
    allowWorkerPreload: true,
  },
};

export async function loadPerformanceMode(): Promise<PerformanceMode> {
  const stored = await safeLocalGet({ [PERFORMANCE_MODE_KEY]: DEFAULT_MODE });
  return normalizePerformanceMode(stored?.[PERFORMANCE_MODE_KEY]);
}

export async function savePerformanceMode(mode: PerformanceMode): Promise<void> {
  await safeLocalSet({ [PERFORMANCE_MODE_KEY]: mode });
}

export function normalizePerformanceMode(value: unknown): PerformanceMode {
  return value === "fast" || value === "full" || value === "developer" || value === "balanced"
    ? value
    : DEFAULT_MODE;
}

export function budgetForPerformanceMode(mode: PerformanceMode): PerformanceModeBudget {
  return PERFORMANCE_BUDGETS[mode] || PERFORMANCE_BUDGETS[DEFAULT_MODE];
}
