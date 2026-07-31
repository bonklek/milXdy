import { describe, expect, it } from "vitest";
import { OpaqueMediaHandleStore, remibooruUploadSizeBucket, validateMediaContributionTags } from "./media-contribution";

describe("opaque media handles", () => {
  it("are one-use, app/action-bound, and expire", () => {
    const store = new OpaqueMediaHandleStore();
    const handle = store.create({ appId: "kit", actionId: "upload", mimeType: "image/png", bytes: new Uint8Array([1]), width: 1, height: 1, altAvailable: false }, 10);
    expect(store.take(handle, "other", "upload", 11)).toBeNull();
    expect(store.take(handle, "kit", "upload", 11)).toBeNull();
  });

  it("returns a valid handle exactly once", () => {
    const store = new OpaqueMediaHandleStore();
    const handle = store.create({ appId: "kit", actionId: "upload", mimeType: "image/png", bytes: new Uint8Array([1]), width: 1, height: 1, altAvailable: false }, 10);
    expect(store.take(handle, "kit", "upload", 11)?.bytes).toEqual(new Uint8Array([1]));
    expect(store.take(handle, "kit", "upload", 12)).toBeNull();
  });

  it("validates bounded unique tags and upload size telemetry", () => {
    expect(validateMediaContributionTags(["reaction", "milady"], 2, 16)).toEqual(["reaction", "milady"]);
    expect(validateMediaContributionTags(["same", "same"], 2, 16)).toBeNull();
    expect(validateMediaContributionTags(["bad/tag"], 2, 16)).toBeNull();
    expect(remibooruUploadSizeBucket(1024)).toBe("under_1_mb");
  });

  it("serializes claims and permits an explicit retry after failure", () => {
    const store = new OpaqueMediaHandleStore();
    const handle = store.create({ appId: "kit", actionId: "upload", mimeType: "image/png", bytes: new Uint8Array([1]), width: 1, height: 1, altAvailable: false }, 10);
    expect(store.claim(handle, "kit", "upload", 11)).not.toBeNull();
    expect(store.claim(handle, "kit", "upload", 11)).toBeNull();
    store.release(handle);
    expect(store.claim(handle, "kit", "upload", 12)).not.toBeNull();
    store.consume(handle);
    expect(store.claim(handle, "kit", "upload", 13)).toBeNull();
  });
});
