import {
  PERFORMANCE_MODE_KEY,
  budgetForPerformanceMode,
  normalizePerformanceMode,
} from "./performanceMode";

export type BackgroundResponse = Record<string, unknown> | boolean | number | string | null | undefined;

export type BackgroundMessageHandler<TMessage> = {
  type: string;
  matches: (message: unknown) => message is TMessage;
  handle: (message: TMessage, sender: chrome.runtime.MessageSender) => Promise<BackgroundResponse> | BackgroundResponse;
};

const backgroundHandlers: Array<BackgroundMessageHandler<any>> = [];

export function registerBackgroundMessageHandlers(handlers: readonly BackgroundMessageHandler<any>[]): void {
  backgroundHandlers.push(...handlers);
}

export function setupBackgroundMessageRouter(handlers: readonly BackgroundMessageHandler<any>[]): void {
  registerBackgroundMessageHandlers(handlers);
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const handler = backgroundHandlers.find((candidate) => candidate.matches(message));
    if (!handler) return false;
    void Promise.resolve(handler.handle(message, sender))
      .then((response) => sendResponse(response))
      .catch((error: unknown) => sendResponse({
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
  });
}

export function objectMessage<T extends string>(type: T): (message: unknown) => message is { type: T } {
  return (message: unknown): message is { type: T } => {
    return Boolean(message && typeof message === "object" && (message as Record<string, unknown>).type === type);
  };
}

type NetworkQueueEntry<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  queuedAt: number;
  label: string;
};

const networkQueue: Array<NetworkQueueEntry<unknown>> = [];
let activeNetworkTasks = 0;
let networkConcurrency = budgetForPerformanceMode("balanced").networkConcurrency;
let networkBudgetInitialized = false;
let diagnosticsTimer: ReturnType<typeof setTimeout> | null = null;
const networkDiagnostics = {
  queued: 0,
  started: 0,
  completed: 0,
  failed: 0,
  maxQueueDepth: 0,
  maxActive: 0,
  totalLatencyMs: 0,
  lastLatencyMs: 0,
  lastLabel: "",
  updatedAt: 0,
};

export async function initializeBackgroundNetworkBudget(): Promise<void> {
  if (networkBudgetInitialized) return;
  networkBudgetInitialized = true;
  const stored = await chrome.storage.local.get({ [PERFORMANCE_MODE_KEY]: "balanced" }).catch(() => ({})) as Record<string, unknown>;
  networkConcurrency = budgetForPerformanceMode(normalizePerformanceMode(stored[PERFORMANCE_MODE_KEY])).networkConcurrency;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[PERFORMANCE_MODE_KEY]) return;
    networkConcurrency = budgetForPerformanceMode(normalizePerformanceMode(changes[PERFORMANCE_MODE_KEY].newValue)).networkConcurrency;
    drainNetworkQueue();
  });
  drainNetworkQueue();
}

export function runNetworkTask<T>(task: () => Promise<T>, label = "network"): Promise<T> {
  void initializeBackgroundNetworkBudget();
  return new Promise<T>((resolve, reject) => {
    networkQueue.push({ task, resolve: resolve as (value: unknown) => void, reject, queuedAt: performance.now(), label });
    networkDiagnostics.queued += 1;
    networkDiagnostics.maxQueueDepth = Math.max(networkDiagnostics.maxQueueDepth, networkQueue.length);
    networkDiagnostics.updatedAt = Date.now();
    scheduleNetworkDiagnosticsWrite();
    drainNetworkQueue();
  });
}

function drainNetworkQueue(): void {
  while (activeNetworkTasks < Math.max(1, networkConcurrency) && networkQueue.length > 0) {
    const entry = networkQueue.shift();
    if (!entry) return;
    activeNetworkTasks += 1;
    networkDiagnostics.started += 1;
    networkDiagnostics.maxActive = Math.max(networkDiagnostics.maxActive, activeNetworkTasks);
    networkDiagnostics.updatedAt = Date.now();
    scheduleNetworkDiagnosticsWrite();
    entry.task()
      .then((value) => {
        recordNetworkTaskFinished(entry, true);
        entry.resolve(value);
      }, (error) => {
        recordNetworkTaskFinished(entry, false);
        entry.reject(error);
      })
      .finally(() => {
        activeNetworkTasks = Math.max(0, activeNetworkTasks - 1);
        drainNetworkQueue();
      });
  }
}

function recordNetworkTaskFinished(entry: NetworkQueueEntry<unknown>, ok: boolean): void {
  const latencyMs = Math.round((performance.now() - entry.queuedAt) * 10) / 10;
  if (ok) networkDiagnostics.completed += 1;
  else networkDiagnostics.failed += 1;
  networkDiagnostics.totalLatencyMs += latencyMs;
  networkDiagnostics.lastLatencyMs = latencyMs;
  networkDiagnostics.lastLabel = entry.label;
  networkDiagnostics.updatedAt = Date.now();
  scheduleNetworkDiagnosticsWrite();
}

function scheduleNetworkDiagnosticsWrite(): void {
  if (diagnosticsTimer !== null) return;
  diagnosticsTimer = setTimeout(async () => {
    diagnosticsTimer = null;
    const stored = await chrome.storage.local.get({ "milxdy.diagnostics.enabled": false }).catch(() => ({})) as Record<string, unknown>;
    if (stored["milxdy.diagnostics.enabled"] !== true) return;
    const finished = networkDiagnostics.completed + networkDiagnostics.failed;
    await chrome.storage.local.set({
      "milxdy.diagnostics.network": {
        ...networkDiagnostics,
        active: activeNetworkTasks,
        queuedDepth: networkQueue.length,
        concurrency: networkConcurrency,
        averageLatencyMs: finished > 0 ? Math.round((networkDiagnostics.totalLatencyMs / finished) * 10) / 10 : 0,
      },
    }).catch(() => undefined);
  }, 1000);
}
