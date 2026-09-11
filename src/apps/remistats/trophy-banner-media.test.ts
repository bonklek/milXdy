import { afterEach, describe, expect, it, vi } from "vitest";
import { createTrophyBannerMedia } from "./trophy-banner-media";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function installCanvas(hasContext = true) {
  const context = { drawImage: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: () => hasContext ? context : null, toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["image"]))) };
  const sources: string[] = [];
  class ImageStub {
    width = 100;
    height = 100;
    onload: (() => void) | null = null;
    set src(value: string) {
      sources.push(value);
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", ImageStub);
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:trophy");
  return { canvas, context, sources };
}

describe("trophy banner rendering", () => {
  it("coalesces requests, retains the shelf shadow and skips empty shelf IDs", async () => {
    const { context, sources } = installCanvas();
    const send = vi.fn().mockResolvedValue({ ok: true, profile: {
      trophyShelves: [0, false, "trophy"],
      allTrophies: [{ id: 0, icon: "/ignored.png" }, { id: "trophy", icon: "/trophy.png" }],
    } });
    const media = createTrophyBannerMedia({ baseUrl: "https://www.remilia.net", cleanUsername: String, send });
    await expect(Promise.all([media.render("alice"), media.render("alice")])).resolves.toEqual(["blob:trophy", "blob:trophy"]);
    await expect(media.render("alice")).resolves.toBe("blob:trophy");
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ type: "reminetIdentity:getProfile", remiliaUsername: "alice", maxAgeMs: 86_400_000 }, "reminetIdentity:getProfile");
    expect(sources).toEqual(["https://www.remilia.net/api/beetle/trophy/~alice/shelf", "https://www.remilia.net/trophy.png"]);
    expect(context.fillRect).toHaveBeenCalledWith(0, 390, 1500, 5);
  });

  it("returns no banner when a drawing context is unavailable", async () => {
    const { canvas } = installCanvas(false);
    const send = vi.fn().mockResolvedValue({ ok: true, profile: { trophyShelves: [1], allTrophies: [{ id: 1, icon: "/icon.png" }] } });
    const media = createTrophyBannerMedia({ baseUrl: "https://www.remilia.net", cleanUsername: String, send });
    await expect(media.render("alice")).resolves.toBeNull();
    expect(canvas.toBlob).not.toHaveBeenCalled();
  });
});
