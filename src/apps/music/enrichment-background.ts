import { runNetworkTask } from "../../platform/background/router";
import { MUSIC_ACOUSTID_KEY, MUSIC_ENRICHMENT_SERVICES_KEY, musicEnrichmentChoices, type MusicEnrichmentService } from "./enrichment-consent";
export function createMusicEnrichmentTransport(deps: {
  read: () => Promise<Record<string, unknown>>;
  observe: (listener: (keys: string[]) => void) => () => void;
  queue: <T>(task: (signal: AbortSignal) => Promise<T>, label: string) => Promise<T>;
  fetch: typeof fetch;
}) {
  return async (service: MusicEnrichmentService, url: string, init: RequestInit = {}, client?: string, authorization?: string): Promise<Response> => {
    const abort = new AbortController();
    // Invalidate the whole request on any consent/key change, including revoke then re-enable.
    const unobserve = deps.observe(keys => { if (keys.includes(MUSIC_ENRICHMENT_SERVICES_KEY) || service === "acoustid" && keys.includes(MUSIC_ACOUSTID_KEY)) abort.abort(); });
    const check = async () => {
      const stored = await deps.read();
      if (!authorization || stored[MUSIC_ENRICHMENT_SERVICES_KEY] && musicEnrichmentChoices(stored[MUSIC_ENRICHMENT_SERVICES_KEY]).revision !== authorization
        || abort.signal.aborted || !musicEnrichmentChoices(stored[MUSIC_ENRICHMENT_SERVICES_KEY])[service]
        || service === "acoustid" && (!client || stored[MUSIC_ACOUSTID_KEY] !== client)) throw new DOMException("Music enrichment permission revoked", "AbortError");
    };
    try {
      await check();
      return await deps.queue(async signal => {
        await check();
        const combined = AbortSignal.any([signal, abort.signal]);
        combined.throwIfAborted();
        const response = await deps.fetch(url, { ...init, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: combined });
        // Keep abort observation through response consumption, not just response headers.
        const bytes = await response.arrayBuffer();
        await check();
        return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
      }, `music:${service}`);
    } finally { unobserve(); }
  };
}

/** Music-specific dispatch owner; consent is checked again inside the host queue. */
export function fetchMusicEnrichment(service: MusicEnrichmentService, url: string, init: RequestInit, client?: string, authorization?: string) {
  return createMusicEnrichmentTransport({
    read: () => chrome.storage.local.get([MUSIC_ENRICHMENT_SERVICES_KEY, MUSIC_ACOUSTID_KEY]),
    observe: listener => {
      const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => { if (area === "local") listener(Object.keys(changes)); };
      chrome.storage.onChanged.addListener(changed);
      return () => chrome.storage.onChanged.removeListener(changed);
    }, queue: runNetworkTask, fetch: (input, options) => fetch(input, options),
  })(service, url, init, client, authorization);
}
