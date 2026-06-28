import type { AppRuntimeScheduler } from "./appPlatform";

export type FallbackRuntimeSchedulerOptions = {
  idleTimeoutMs?: number;
  timeoutFallbackMs?: number;
};

const DEFAULT_IDLE_TIMEOUT_MS = 1500;
const DEFAULT_TIMEOUT_FALLBACK_MS = 16;

export function createFallbackRuntimeScheduler(options: FallbackRuntimeSchedulerOptions = {}): AppRuntimeScheduler {
  const idleTimeoutMs = normalizedDelay(options.idleTimeoutMs, DEFAULT_IDLE_TIMEOUT_MS);
  const timeoutFallbackMs = normalizedDelay(options.timeoutFallbackMs, DEFAULT_TIMEOUT_FALLBACK_MS);

  return {
    idle(callback, idleOptions) {
      const timeout = normalizedDelay(idleOptions?.timeout, idleTimeoutMs);
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback?.(id);
      }
      const id = window.setTimeout(callback, Math.min(timeout, timeoutFallbackMs));
      return () => window.clearTimeout(id);
    },
    timeout(callback, delayMs) {
      const id = window.setTimeout(callback, delayMs);
      return () => window.clearTimeout(id);
    },
  };
}

function normalizedDelay(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}
