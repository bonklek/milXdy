import { describe, expect, it } from "vitest";
import { isSupportedMediaContributionMime, mediaContributionFailureMessage, OpaqueMediaHandleStore, remibooruUploadSizeBucket, validateMediaContributionTags } from "./media-contribution";

describe("opaque media handles", () => {
  it("are one-use, app/action-bound, and expire", () => {
    const store = new OpaqueMediaHandleStore();
    const handle = store.create({ appId: "kit", actionId: "upload", mimeType: "image/png", bytes: new Uint8Array([1]), width: 1, height: 1, altAvailable: false }, 10);
    expect(store.claim(handle, "other", "upload", 11)).toBeNull();
    expect(store.claim(handle, "kit", "upload", 11)).not.toBeNull();
  });

  it("returns a valid handle exactly once", () => {
    const store = new OpaqueMediaHandleStore();
    const handle = store.create({ appId: "kit", actionId: "upload", mimeType: "image/png", bytes: new Uint8Array([1]), width: 1, height: 1, altAvailable: false }, 10);
    expect(store.claim(handle, "kit", "upload", 11)?.bytes).toEqual(new Uint8Array([1]));
    store.consume(handle);
    expect(store.claim(handle, "kit", "upload", 12)).toBeNull();
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

  it("restores a still-valid host record after a service-worker restart", () => {
    const store = new OpaqueMediaHandleStore();
    const handle = "media.1.00000000-0000-4000-8000-000000000000";
    expect(store.restore(handle, { appId: "kit", actionId: "upload", mimeType: "image/png", bytes: new Uint8Array([1]), width: 1, height: 1, altAvailable: false, expiresAt: 100 }, 20)).toBe(true);
    expect(store.claim(handle, "kit", "upload", 21)).not.toBeNull();
    expect(store.restore("bad", { appId: "kit", actionId: "upload", mimeType: "image/png", bytes: new Uint8Array(), width: 1, height: 1, altAvailable: false, expiresAt: 10 }, 20)).toBe(false);
  });

  it("accepts the image formats supported by the native Remibooru uploader", () => {
    expect(isSupportedMediaContributionMime("image/png")).toBe(true);
    expect(isSupportedMediaContributionMime("image/jpeg")).toBe(true);
    expect(isSupportedMediaContributionMime("image/webp")).toBe(true);
    expect(isSupportedMediaContributionMime("image/gif")).toBe(true);
    expect(isSupportedMediaContributionMime("application/pdf")).toBe(false);
  });

  it("keeps common contribution failures understandable and retryable", () => {
    expect(mediaContributionFailureMessage(401)).toContain("Sign in");
    expect(mediaContributionFailureMessage(403)).toContain("contributor access");
    expect(mediaContributionFailureMessage(409)).toContain("already exists");
    expect(mediaContributionFailureMessage(422)).toContain("media or tags");
    expect(mediaContributionFailureMessage(429)).toContain("rate limiting");
    expect(mediaContributionFailureMessage(503)).toContain("temporarily unavailable");
    expect(mediaContributionFailureMessage(422, "Tag is not allowed")).toBe("Tag is not allowed");
  });
});
