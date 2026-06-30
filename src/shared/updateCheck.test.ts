import { describe, expect, it } from "vitest";

import {
  compareVersions,
  selectLatestNormalRelease,
  type GitHubRelease,
} from "./updateCheck";

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
