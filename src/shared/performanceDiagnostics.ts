import { safeLocalGet, safeLocalSet } from "./extensionRuntime";

type Metric = {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
  updatedAt: number;
};

const FLUSH_DELAY_MS = 1500;
const metrics = new Map<string, Metric>();
let flushTimer: number | null = null;

export function recordFeatureTiming(featureId: string, operation: string, startedAt: number): void {
  const elapsed = Math.round((performance.now() - startedAt) * 10) / 10;
  const key = `${featureId}.${operation}`;
  const current = metrics.get(key) || { count: 0, totalMs: 0, maxMs: 0, lastMs: 0, updatedAt: 0 };
  current.count += 1;
  current.totalMs = Math.round((current.totalMs + elapsed) * 10) / 10;
  current.maxMs = Math.max(current.maxMs, elapsed);
  current.lastMs = elapsed;
  current.updatedAt = Date.now();
  metrics.set(key, current);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(async () => {
    flushTimer = null;
    const stored = await safeLocalGet({ "milxdy.diagnostics.enabled": false });
    if (stored?.["milxdy.diagnostics.enabled"] !== true) return;
    const snapshot: Record<string, Metric & { averageMs: number }> = {};
    for (const [key, metric] of metrics.entries()) {
      snapshot[key] = {
        ...metric,
        averageMs: metric.count > 0 ? Math.round((metric.totalMs / metric.count) * 10) / 10 : 0,
      };
    }
    await safeLocalSet({ "milxdy.diagnostics.featureTimings": snapshot });
  }, FLUSH_DELAY_MS);
}
