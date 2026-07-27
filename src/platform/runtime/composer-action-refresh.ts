export type ComposerActionRefreshScheduler = {
  request: () => void;
  dispose: () => void;
};

type TimerHost = {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
};

/**
 * Collapses high-frequency X DOM mutations into one composer-action refresh.
 * The host page mutates continually, so refreshing synchronously from every
 * MutationObserver callback turns a cheap selector pass into a main-thread loop.
 */
export function createComposerActionRefreshScheduler(
  refresh: () => void,
  timers: TimerHost = window,
  delayMs = 80,
): ComposerActionRefreshScheduler {
  let timer: number | null = null;
  let disposed = false;

  return {
    request: () => {
      if (disposed || timer !== null) return;
      timer = timers.setTimeout(() => {
        timer = null;
        if (!disposed) refresh();
      }, delayMs);
    },
    dispose: () => {
      disposed = true;
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
    },
  };
}
