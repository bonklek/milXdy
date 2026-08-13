import {
  LEGACY_MUTATION_ACK_TIMEOUT_MS,
  publicLegacyFailure,
  type LegacyAdapterFailure,
  type LegacySocketBridgeEvent,
  type LegacySocketMutation,
} from "./legacy-adapters";

export type LegacyMutationResult = Readonly<{ ok: true }> | LegacyAdapterFailure;

type PendingMutation = Readonly<{
  timer: ReturnType<typeof setTimeout>;
  resolve: (result: LegacyMutationResult) => void;
}>;

export class LegacyMutationDispatcher {
  private readonly pending = new Map<string, PendingMutation>();

  dispatch(port: chrome.runtime.Port | null, mutation: LegacySocketMutation): Promise<LegacyMutationResult> {
    if (!port) return Promise.resolve(publicLegacyFailure("LEGACY_MEDIA_SUBMIT_UNAVAILABLE", true));
    let requestId: string;
    try {
      requestId = crypto.randomUUID();
    } catch {
      return Promise.resolve(publicLegacyFailure("LEGACY_MEDIA_SUBMIT_UNAVAILABLE", true));
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve(publicLegacyFailure("LEGACY_MEDIA_SUBMIT_REJECTED", true));
      }, LEGACY_MUTATION_ACK_TIMEOUT_MS);
      this.pending.set(requestId, { timer, resolve });
      try {
        port.postMessage({ type: "mutate", requestId, mutation });
      } catch {
        clearTimeout(timer);
        this.pending.delete(requestId);
        resolve(publicLegacyFailure("LEGACY_MEDIA_SUBMIT_UNAVAILABLE", true));
      }
    });
  }

  accept(event: LegacySocketBridgeEvent): boolean {
    if (event.type !== "socket:mutation-sent") return false;
    const pending = this.pending.get(event.requestId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(event.requestId);
    pending.resolve({ ok: true });
    return true;
  }

  rejectAll(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve(publicLegacyFailure("LEGACY_MEDIA_SUBMIT_UNAVAILABLE", true));
    }
    this.pending.clear();
  }
}
