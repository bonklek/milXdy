import { describe, expect, it, vi } from "vitest";
import { enabledBannerModes, readBannerSettings, selectProfileBanner } from "./profile-banner-sources";

describe("profile banner sources", () => {
  it("keeps all sources enabled for existing users", () => {
    expect(readBannerSettings({})).toEqual({ nft:true, shelf:true, original:true });
  });
  for (let bits = 0; bits < 8; bits++) {
    const settings = { nft: Boolean(bits & 1), shelf: Boolean(bits & 2), original: Boolean(bits & 4) };
    it(`uses only enabled sources for combination ${bits}`, async () => {
      const shelf = vi.fn().mockResolvedValue("shelf.webp");
      const nft = vi.fn().mockResolvedValue({ displayUrl:"nft.png" });
      const selection = await selectProfileBanner(enabledBannerModes(settings), shelf, nft);
      expect(selection.mode).toBe(settings.shelf ? "shelf" : settings.original ? "original" : settings.nft ? "nft" : "blank");
      if (!settings.shelf) expect(shelf).not.toHaveBeenCalled();
      if (!settings.nft) expect(nft).not.toHaveBeenCalled();
      for (const current of ["original", "shelf", "nft", "blank"]) {
        const modes = enabledBannerModes(settings, current);
        expect(modes.length).toBe(Number(settings.nft) + Number(settings.shelf) + Number(settings.original));
        expect(modes.every(mode => settings[mode])).toBe(true);
        expect(new Set(modes).size).toBe(modes.length);
      }
    });
  }
  it("cycles from the current source without selecting disabled sources", () => {
    expect(enabledBannerModes({ original:true, shelf:false, nft:true }, "original")).toEqual(["nft", "original"]);
    expect(enabledBannerModes({ original:false, shelf:true, nft:true }, "nft")).toEqual(["shelf", "nft"]);
  });
  it("falls back to enabled sources after missing or failed shelf media", async () => {
    const nft = vi.fn().mockResolvedValue({ displayUrl:"nft.png" });
    expect(await selectProfileBanner(["shelf", "nft"], async () => null, nft)).toEqual({ mode:"nft", url:"nft.png", nft:{ displayUrl:"nft.png" } });
    expect(await selectProfileBanner(["shelf", "original"], async () => { throw new Error("image unavailable"); }, nft)).toEqual({ mode:"original" });
  });
  it("uses a blank banner when all enabled media fail without exposing a disabled X banner", async () => {
    expect(await selectProfileBanner(["shelf", "nft"], async () => null, async () => { throw new Error("image unavailable"); })).toEqual({ mode:"blank" });
  });
});
