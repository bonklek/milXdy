import { hasExtensionRuntime, safeLocalGet, safeLocalSet } from "./extensionRuntime";
import {
  DEFAULT_RESKIN_PROFILE,
  RESKIN_PROFILE_KEY,
  normalizeReskinProfile,
  type ReskinProfile,
} from "./reskinProfile";

const DIAGNOSTICS_ENABLED_KEY = "milxdy.diagnostics.enabled";
const FEATURE_TIMINGS_KEY = "milxdy.diagnostics.featureTimings";
export const BENCHMARK_RESULT_PREFIX = "milxdy.diagnostics.benchmark.";
export const BENCHMARK_START_MESSAGE = "milxdy:benchmark:start";

export const DEFAULT_BENCHMARK_DURATION_MS = 30000;
// recordFeatureTiming flushes its snapshot to storage 1.5s after the last record, so wait a
// little longer than that before reading the end-of-window snapshot to capture the tail.
const FEATURE_TIMING_FLUSH_WAIT_MS = 1700;

/** Feature timing keys the benchmark surfaces in its report. Others are still captured. */
export const TRACKED_FEATURE_TIMINGS = [
  "miladymaxxer.idleSurface",
  "remistats.insertBadge",
  "wiki.processTweet",
  "post-reading.processTweet",
] as const;

type CumulativeTiming = {
  count: number;
  totalMs: number;
  maxMs: number;
};

type FeatureTimingSnapshot = {
  count: number;
  totalMs: number;
  maxMs: number;
  averageMs: number;
};

export type BenchmarkResult = {
  profile: ReskinProfile;
  durationMs: number;
  startedAt: number;
  finishedAt: number;
  frames: number;
  averageFps: number;
  worstFrameGapMs: number;
  framesOver50ms: number;
  framesOver100ms: number;
  longTasks: number;
  longTaskTotalMs: number;
  worstLongTaskMs: number;
  featureTimings: Record<string, FeatureTimingSnapshot>;
};

type BenchmarkStartMessage = {
  type: typeof BENCHMARK_START_MESSAGE;
  durationMs?: number;
};

let running = false;

function isBenchmarkStartMessage(value: unknown): value is BenchmarkStartMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === BENCHMARK_START_MESSAGE
  );
}

async function readProfile(): Promise<ReskinProfile> {
  const stored = await safeLocalGet({ [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE });
  // Normalize so the result is always stored under a known max/moderate/min key the report reads.
  return normalizeReskinProfile(stored?.[RESKIN_PROFILE_KEY]);
}

/** Read the cumulative (page-lifetime) feature-timing counters from storage. */
async function readCumulativeTimings(): Promise<Record<string, CumulativeTiming>> {
  const stored = await safeLocalGet({ [FEATURE_TIMINGS_KEY]: {} });
  const raw = stored?.[FEATURE_TIMINGS_KEY];
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, CumulativeTiming> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const metric = value as Record<string, unknown>;
    out[key] = {
      count: typeof metric.count === "number" ? metric.count : 0,
      totalMs: typeof metric.totalMs === "number" ? metric.totalMs : 0,
      maxMs: typeof metric.maxMs === "number" ? metric.maxMs : 0,
    };
  }
  return out;
}

/**
 * Compute per-feature timings for just the benchmark window by diffing the cumulative
 * counters captured at the start and end of the run. Only features that recorded activity
 * during the window are included.
 */
function diffTimings(
  start: Record<string, CumulativeTiming>,
  end: Record<string, CumulativeTiming>,
): Record<string, FeatureTimingSnapshot> {
  const out: Record<string, FeatureTimingSnapshot> = {};
  for (const [key, endMetric] of Object.entries(end)) {
    const startMetric = start[key] ?? { count: 0, totalMs: 0, maxMs: 0 };
    const count = endMetric.count - startMetric.count;
    if (count <= 0) continue;
    const totalMs = endMetric.totalMs - startMetric.totalMs;
    out[key] = {
      count,
      totalMs: round(totalMs),
      maxMs: endMetric.maxMs, // cumulative max; not derivable per-window
      averageMs: round(totalMs / count),
    };
  }
  return out;
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sample frame timing + long tasks for `durationMs`, then persist a result tagged with the
 * active reskin profile. The caller is expected to scroll/interact during the window.
 * Returns null if it can't sample (already running, no rAF support, or no frames were
 * rendered — e.g. the tab was hidden the whole time).
 */
export async function runBenchmark(durationMs = DEFAULT_BENCHMARK_DURATION_MS): Promise<BenchmarkResult | null> {
  if (running) return null;
  if (typeof requestAnimationFrame !== "function" || typeof performance === "undefined") return null;
  running = true;
  try {
    const baselineTimings = await readCumulativeTimings();

    let longTasks = 0;
    let longTaskTotalMs = 0;
    let worstLongTaskMs = 0;
    let observer: PerformanceObserver | null = null;
    if (typeof PerformanceObserver === "function") {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration < 50) continue;
            longTasks += 1;
            longTaskTotalMs += entry.duration;
            worstLongTaskMs = Math.max(worstLongTaskMs, entry.duration);
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        observer = null;
      }
    }

    const startedAt = performance.now();
    let frames = 0;
    let worstFrameGapMs = 0;
    let framesOver50ms = 0;
    let framesOver100ms = 0;
    let firstFrameAt = 0;
    let lastFrameAt = 0;
    let haveFirstFrame = false;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const tick = (now: number) => {
        if (settled) return;
        if (!haveFirstFrame) {
          // The first callback establishes the baseline; its interval from startedAt is
          // scheduling/startup latency, not a real inter-frame gap, so don't record it.
          haveFirstFrame = true;
          firstFrameAt = now;
          lastFrameAt = now;
        } else {
          const gap = now - lastFrameAt;
          lastFrameAt = now;
          frames += 1;
          if (gap > worstFrameGapMs) worstFrameGapMs = gap;
          if (gap > 50) framesOver50ms += 1;
          if (gap > 100) framesOver100ms += 1;
        }
        if (now - startedAt >= durationMs) {
          finish();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      // Wall-clock fallback: rAF is fully paused on a hidden/backgrounded tab and would never
      // resolve this promise. setTimeout still fires (throttled), so the run always terminates.
      setTimeout(finish, durationMs + 2000);
    });

    const finishedAt = performance.now();
    observer?.disconnect();

    // No real frames sampled (e.g. tab hidden the whole window) — nothing meaningful to report.
    if (frames === 0) return null;

    // Wait for the trailing featureTimings flush, then diff against the baseline to get
    // counters scoped to this window rather than the cumulative page lifetime.
    await delay(FEATURE_TIMING_FLUSH_WAIT_MS);
    const endTimings = await readCumulativeTimings();

    const elapsedSec = (lastFrameAt - firstFrameAt) / 1000;
    const result: BenchmarkResult = {
      profile: await readProfile(),
      durationMs: Math.round(finishedAt - startedAt),
      startedAt: Math.round(startedAt),
      finishedAt: Math.round(finishedAt),
      frames,
      averageFps: elapsedSec > 0 ? round(frames / elapsedSec) : 0,
      worstFrameGapMs: round(worstFrameGapMs),
      framesOver50ms,
      framesOver100ms,
      longTasks,
      longTaskTotalMs: round(longTaskTotalMs),
      worstLongTaskMs: round(worstLongTaskMs),
      featureTimings: diffTimings(baselineTimings, endTimings),
    };

    // Only persist when diagnostics are enabled, mirroring the other diagnostics writers.
    const enabled = await safeLocalGet({ [DIAGNOSTICS_ENABLED_KEY]: false });
    if (enabled?.[DIAGNOSTICS_ENABLED_KEY] === true) {
      await safeLocalSet({ [`${BENCHMARK_RESULT_PREFIX}${result.profile}`]: result });
    }
    return result;
  } finally {
    running = false;
  }
}

/**
 * Wire the content-script listener so the popup can start a run on the active tab.
 * Lives in the thin `src/content.ts` bootstrap (not contentRuntime.ts) to stay clear of
 * the in-flight runtime rewrite.
 */
export function setupMaxProfileBenchmark(): void {
  if (!hasExtensionRuntime() || typeof chrome?.runtime?.onMessage?.addListener !== "function") return;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isBenchmarkStartMessage(message)) return undefined;
    if (running) {
      sendResponse({ ok: false, busy: true });
      return false;
    }
    const duration =
      typeof message.durationMs === "number" && message.durationMs > 0
        ? message.durationMs
        : DEFAULT_BENCHMARK_DURATION_MS;
    void runBenchmark(duration).then((result) => {
      sendResponse({ ok: result !== null, busy: false, result });
    });
    return true; // keep the message channel open for the async response
  });
}
