import { describe, expect, it, vi } from "vitest";
import { createMusicEnrichmentSession, musicEnrichmentChoices, MUSIC_ACOUSTID_KEY, MUSIC_ENRICHMENT_SERVICES_KEY } from "./enrichment-consent";
import { createMusicEnrichmentTransport } from "./enrichment-background";
const grant = { musicbrainz: true, acoustid: false, revision: "fresh-choice" };
function fixture(queued = false) {
  let values: Record<string, unknown> = { [MUSIC_ENRICHMENT_SERVICES_KEY]: { ...grant }, [MUSIC_ACOUSTID_KEY]: "local-key" };
  const listeners = new Set<(keys: string[]) => void>(); let dispatch: (() => void) | undefined;
  const gate = queued ? new Promise<void>(resolve => dispatch = resolve) : Promise.resolve();
  const fetch = vi.fn(async (_input: unknown, _init?: RequestInit) => new Response('{"ok":true}'));
  const request = createMusicEnrichmentTransport({ read: async () => values, observe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, queue: async task => { await gate; return task(new AbortController().signal); }, fetch: fetch as typeof globalThis.fetch });
  return { request, fetch, dispatch: () => dispatch?.(), change: (patch: Record<string, unknown>) => { values = { ...values, ...patch }; listeners.forEach(listener => listener(Object.keys(patch))); }, listeners };
}
describe("explicit per-service music enrichment", () => {
  it("does not migrate blanket consent or a saved client key into a grant", () => {
    expect(musicEnrichmentChoices({ remoteEnrichmentConsent: true, acoustIdClientKey: "saved" })).toEqual({ musicbrainz: false, acoustid: false, revision: "" });
    expect(musicEnrichmentChoices({ musicbrainz: true })).toEqual({ musicbrainz: false, acoustid: false, revision: "" });
  });
  it("requires explicit start despite saved choices and makes revoked generations stale", () => {
    const session = createMusicEnrichmentSession(); session.update(grant); expect(session.allowed()).toBe(false);
    const token = session.start(); expect(session.allowed("musicbrainz", token)).toBe(true); expect(session.allowed("acoustid", token)).toBe(false);
    session.update({ ...grant, musicbrainz: false }); session.update(grant); expect(session.allowed("musicbrainz", token)).toBe(false);
    session.start(); expect(session.allowed("musicbrainz", token)).toBe(false);
  });
  it("sends only the individually selected service and requires the exact saved AcoustID key", async () => {
    const f = fixture(); await f.request("musicbrainz", "https://musicbrainz.org/test", {}, undefined, grant.revision);
    await expect(f.request("acoustid", "https://api.acoustid.org/test", {}, "local-key", grant.revision)).rejects.toThrow();
    f.change({ [MUSIC_ENRICHMENT_SERVICES_KEY]: { ...grant, acoustid: true } });
    await expect(f.request("acoustid", "https://api.acoustid.org/test", {}, "wrong", grant.revision)).rejects.toThrow();
    await f.request("acoustid", "https://api.acoustid.org/test", {}, "local-key", grant.revision);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    for (const [, options] of f.fetch.mock.calls) expect(options).toMatchObject({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
    expect(f.listeners.size).toBe(0);
  });
  it("revocation while queued prevents dispatch even after regrant", async () => {
    const f = fixture(true); const pending = f.request("musicbrainz", "https://musicbrainz.org/test", {}, undefined, grant.revision);
    await Promise.resolve(); await Promise.resolve();
    f.change({ [MUSIC_ENRICHMENT_SERVICES_KEY]: { ...grant, musicbrainz: false, revision: "revoked" } });
    f.change({ [MUSIC_ENRICHMENT_SERVICES_KEY]: { ...grant, revision: "regranted" } }); f.dispatch();
    await expect(pending).rejects.toThrow(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("rejects a stale message delayed before the background receives it", async () => {
    const f = fixture(); f.change({ [MUSIC_ENRICHMENT_SERVICES_KEY]: { ...grant, revision: "later-grant" } });
    await expect(f.request("musicbrainz", "https://musicbrainz.org/test", {}, undefined, grant.revision)).rejects.toThrow(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("aborts in-flight work and does not release results after revocation", async () => {
    const f = fixture(); let started!: () => void; const ready = new Promise<void>(resolve => started = resolve);
    f.fetch.mockImplementationOnce(async (_url, init) => { started(); return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))); });
    const pending = f.request("musicbrainz", "https://musicbrainz.org/test", {}, undefined, grant.revision); await ready;
    f.change({ [MUSIC_ENRICHMENT_SERVICES_KEY]: { ...grant, musicbrainz: false, revision: "revoked" } });
    await expect(pending).rejects.toThrow("Aborted"); expect(f.listeners.size).toBe(0);
  });
});

it("does not publish responses that ignore abort after a revoke", async () => {
  const f = fixture(); let finish!: (value: Response) => void;
  f.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.request("musicbrainz", "https://musicbrainz.org/test", {}, undefined, grant.revision);
  while (!finish) await Promise.resolve();
  f.change({ [MUSIC_ENRICHMENT_SERVICES_KEY]: { ...grant, revision: "revoked", musicbrainz: false } });
  finish(new Response('{"late":true}'));
  await expect(pending).rejects.toThrow(); expect(f.listeners.size).toBe(0);
});
