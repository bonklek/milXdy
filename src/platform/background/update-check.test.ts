import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkForUpdate,
  compareVersions,
  selectLatestNormalRelease,
  type GitHubRelease,
} from "./update-check";

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: {
      getManifest: () => ({ version: "0.2.1" }),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("selectLatestNormalRelease", () => {
  it("ignores drafts and prereleases for the normal update channel", () => {
    const releases: GitHubRelease[] = [
      { tag_name: "v0.3.0-beta.1", prerelease: true, draft: false, published_at: "2026-07-01T00:00:00Z" },
      { tag_name: "v0.4.0", prerelease: false, draft: true, published_at: "2026-07-02T00:00:00Z" },
      { tag_name: "v0.2.0", prerelease: false, draft: false, published_at: "2026-06-29T00:00:00Z" },
    ];

    expect(selectLatestNormalRelease(releases)?.tag_name).toBe("v0.2.0");
  });

  it("chooses the highest normal release tag before publish-time tie-breaking", () => {
    const releases: GitHubRelease[] = [
      { tag_name: "v0.1.9", prerelease: false, draft: false, published_at: "2026-07-03T00:00:00Z" },
      { tag_name: "v0.2.0", prerelease: false, draft: false, published_at: "2026-06-29T00:00:00Z" },
      { tag_name: "release-candidate", prerelease: false, draft: false, published_at: "2026-07-04T00:00:00Z" },
    ];

    expect(selectLatestNormalRelease(releases)?.tag_name).toBe("v0.2.0");
  });
});

describe("compareVersions", () => {
  it("compares manifest versions against normalized release tags", () => {
    expect(compareVersions("0.2.0", "0.1.5")).toBe(1);
    expect(compareVersions("0.2.0", "0.2.0")).toBe(0);
    expect(compareVersions("0.1.5", "0.2.0")).toBe(-1);
  });
});

describe("checkForUpdate", () => {
  it("does not expose a Firefox zip as the Chromium direct download when the Chromium asset is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => [
        releaseWithAssets("v0.2.2", [
          asset("milXdy-0.2.2-firefox.zip", "https://example.test/milXdy-0.2.2-firefox.zip"),
        ]),
      ],
    })));

    const status = await checkForUpdate();

    expect(status.expectedAssetName).toBe("milXdy-0.2.2-chromium.zip");
    expect(status.matchedExpectedAsset).toBe(false);
    expect(status.latestAssetName).toBeNull();
    expect(status.latestAssetUrl).toBeNull();
    expect(status.latestUrl).toBe("https://example.test/releases/v0.2.2");
    expect(status.updateAvailable).toBe(true);
  });

  it("does not expose a Chromium zip as the Firefox direct download when the Firefox asset is missing", async () => {
    vi.stubGlobal("MILXDY_BUILD_TARGET", "firefox");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => [
        releaseWithAssets("v0.2.2", [
          asset("milXdy-0.2.2-chromium.zip", "https://example.test/milXdy-0.2.2-chromium.zip"),
        ]),
      ],
    })));

    const status = await checkForUpdate();

    expect(status.expectedAssetName).toBe("milXdy-0.2.2-firefox.zip");
    expect(status.matchedExpectedAsset).toBe(false);
    expect(status.latestAssetName).toBeNull();
    expect(status.latestAssetUrl).toBeNull();
    expect(status.latestUrl).toBe("https://example.test/releases/v0.2.2");
    expect(status.updateAvailable).toBe(true);
  });
});

function releaseWithAssets(tagName: string, assets: GitHubRelease["assets"]): GitHubRelease {
  return {
    tag_name: tagName,
    prerelease: false,
    draft: false,
    published_at: "2026-07-03T00:00:00Z",
    html_url: `https://example.test/releases/${tagName}`,
    assets,
  };
}

function asset(name: string, browserDownloadUrl: string): NonNullable<GitHubRelease["assets"]>[number] {
  return { name, browser_download_url: browserDownloadUrl };
}
