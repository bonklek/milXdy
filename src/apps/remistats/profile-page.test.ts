import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { exactXProfileHandle, findExactProfileBannerRoot, headerPhotoXHandle } from "./profile-page";

const fixtureHtml = readFileSync(new URL("./fixtures/x-profile-live-equivalent.html", import.meta.url), "utf8");

function fixtureRoot() {
  const $ = load(fixtureHtml);
  const anchors = $('[data-testid="primaryColumn"] a[href]').toArray().map((anchor) => ({
    id: $(anchor).attr("id"),
    getAttribute(name: string) {
      return name === "href" ? $(anchor).attr("href") || null : null;
    },
  }));
  const primaryColumn = {
    querySelectorAll(selector: string) {
      expect(selector).toBe("a[href]");
      return anchors;
    },
  };
  return {
    querySelector(selector: string) {
      expect(selector).toBe('[data-testid="primaryColumn"]');
      return primaryColumn;
    },
  } as unknown as ParentNode;
}

describe("live-equivalent X profile targeting", () => {
  it("selects only the current exact profile banner when stale SPA DOM coexists", () => {
    const banner = findExactProfileBannerRoot(fixtureRoot(), "@MiladyBonkle") as unknown as { id: string };
    expect(banner.id).toBe("current-banner");
  });

  it("does not select a stale, partial, mismatched, or off-origin header photo", () => {
    const root = fixtureRoot();
    expect(findExactProfileBannerRoot(root, "Previous")).toBeNull();
    expect(findExactProfileBannerRoot(root, "Mallory")).toBeNull();
    expect(headerPhotoXHandle("https://evil.example/MiladyBonkle/header_photo")).toBe("");
    expect(headerPhotoXHandle("/MiladyBonkle/header_photo/extra")).toBe("");
    expect(headerPhotoXHandle("/bad%ZZ/header_photo")).toBe("");
    expect(exactXProfileHandle("MiladyBonkle/status/1")).toBe("");
  });

  it("matches relative and canonical X header-photo links case-insensitively", () => {
    expect(headerPhotoXHandle("/MiladyBonkle/header_photo")).toBe("miladybonkle");
    expect(headerPhotoXHandle("https://twitter.com/MILADYBONKLE/header_photo")).toBe("miladybonkle");
  });
});
