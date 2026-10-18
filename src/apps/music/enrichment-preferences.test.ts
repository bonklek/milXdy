import { expect, it, vi } from "vitest";
import { createMusicEnrichmentPreferences } from "./enrichment-preferences";
import { MUSIC_ENRICHMENT_SERVICES_KEY } from "./enrichment-consent";
it("keeps saved choices/key after rejected storage and releases the pending gate", async () => {
  const current = { choices: { musicbrainz: false, acoustid: false, revision: "saved" }, key: "previous-key" };
  const changed = vi.fn(), failure = vi.fn(), pending = vi.fn();
  let reject!: (error: Error) => void;
  const controller = createMusicEnrichmentPreferences({ current: () => current, persist: () => new Promise((_resolve, deny) => reject = deny), changed, failure, pending, stop: vi.fn(), active: () => true });
  const saving = controller.save({ choices: { ...current.choices, musicbrainz: true } });
  expect(controller.pending()).toBe(true); expect(await controller.save({ key: "concurrent" })).toBe(false);
  reject(new Error("storage failed")); expect(await saving).toBe(false);
  expect(changed).not.toHaveBeenCalled(); expect(failure).toHaveBeenCalledOnce(); expect(controller.pending()).toBe(false); expect(pending.mock.calls).toEqual([[true], [false]]);
  expect(current.key).toBe("previous-key"); expect(current.choices.musicbrainz).toBe(false);
});
it("publishes only persisted choices with a fresh revision; saving a key grants nothing", async () => {
  const current = { choices: { musicbrainz: false, acoustid: false, revision: "saved" }, key: "" };
  const persist = vi.fn(async (_values: Record<string, unknown>) => undefined), changed = vi.fn();
  const controller = createMusicEnrichmentPreferences({ current: () => current, persist, changed, failure: vi.fn(), pending: vi.fn(), stop: vi.fn(), active: () => true });
  expect(await controller.save({ key: "new-key" })).toBe(true);
  expect(persist.mock.calls[0]?.[0]).toMatchObject({ [MUSIC_ENRICHMENT_SERVICES_KEY]: { musicbrainz: false, acoustid: false } });
  expect(changed.mock.calls[0]?.[0].choices.revision).not.toBe("saved");
});
