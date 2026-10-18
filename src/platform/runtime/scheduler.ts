import type { AppRuntimeScheduler } from "../app-sdk/app-platform";
import type { Disposable } from "./disposables";

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

/**
 * Binds a shared scheduler to one app activation.  The queue remains shared so
 * runtime budgeting and ordering stay central, while aborting an app cancels
 * only that app's pending callbacks.
 */
export function createActivationScheduler(
  scheduler: AppRuntimeScheduler,
  signal: AbortSignal,
  addDisposable: (disposable: Disposable) => void,
): AppRuntimeScheduler {
  const cancellations = new Set<() => void>();

  const cancelAll = () => {
    for (const cancel of Array.from(cancellations)) cancel();
    cancellations.clear();
  };
  signal.addEventListener("abort", cancelAll, { once: true });
  addDisposable(() => {
    signal.removeEventListener("abort", cancelAll);
    cancelAll();
  });

  const schedule = (scheduleTask: (callback: () => void) => () => void, callback: () => void): (() => void) => {
    if (signal.aborted) throw new DOMException("App activation has ended", "AbortError");
    let cancel: (() => void) | null = null;
    const run = () => {
      cancellations.delete(cancelTask);
      if (!signal.aborted) callback();
    };
    cancel = scheduleTask(run);
    const cancelTask = () => {
      if (!cancel) return;
      const pending = cancel;
      cancel = null;
      cancellations.delete(cancelTask);
      pending();
    };
    cancellations.add(cancelTask);
    return cancelTask;
  };

  return {
    idle(callback, options) {
      return schedule((run) => scheduler.idle(run, options), callback);
    },
    timeout(callback, delayMs) {
      return schedule((run) => scheduler.timeout(run, delayMs), callback);
    },
  };
}

function normalizedDelay(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}
