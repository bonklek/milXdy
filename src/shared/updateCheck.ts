export type UpdateStatus = {
  checkedAt: number;
  currentVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  latestAssetUrl: string | null;
  latestAssetName: string | null;
  expectedAssetName: string | null;
  matchedExpectedAsset: boolean;
  updateAvailable: boolean;
  error?: string;
};

declare const MILXDY_BUILD_PROFILE: "lite" | "balanced" | "full" | undefined;
declare const MILXDY_BUILD_TARGET: "chromium" | "firefox" | undefined;

export const UPDATE_STATUS_KEY = "milxdy.updateStatus";
export const UPDATE_ALARM_NAME = "milxdy.updateCheck";
export const UPDATE_CHECK_INTERVAL_MINUTES = 360;

export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/bonklek/milXdy/releases?per_page=20";

type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
};

type GitHubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

export async function checkForUpdate(): Promise<UpdateStatus> {
  const currentVersion = chrome.runtime.getManifest().version;
  const checkedAt = Date.now();

  try {
    const response = await fetch(GITHUB_RELEASES_API_URL, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }

    const releases = await response.json() as GitHubRelease[];
    if (!Array.isArray(releases)) {
      throw new Error("GitHub returned an unexpected releases response");
    }

    const release = releases
      .filter((candidate) => candidate.prerelease === true && candidate.draft !== true)
      .sort((left, right) => dateValue(right.published_at) - dateValue(left.published_at))[0];
    if (!release) {
      throw new Error("GitHub did not return a published prerelease");
    }

    const latestVersion = normalizeVersion(release.tag_name);
    if (!latestVersion) {
      throw new Error("Latest prerelease did not include a version tag");
    }

    const expectedAssetName = expectedReleaseAssetName(latestVersion);
    const asset = chooseReleaseAsset(release, expectedAssetName);

    return {
      checkedAt,
      currentVersion,
      latestVersion,
      latestUrl: typeof release.html_url === "string" ? release.html_url : null,
      latestAssetUrl: typeof asset?.browser_download_url === "string" ? asset.browser_download_url : null,
      latestAssetName: typeof asset?.name === "string" ? asset.name : null,
      expectedAssetName,
      matchedExpectedAsset: Boolean(expectedAssetName && asset?.name === expectedAssetName),
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    };
  } catch (error) {
    return {
      checkedAt,
      currentVersion,
      latestVersion: null,
      latestUrl: null,
      latestAssetUrl: null,
      latestAssetName: null,
      expectedAssetName: expectedReleaseAssetName(null),
      matchedExpectedAsset: false,
      updateAvailable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function normalizeVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^v/i, "");
  return /^\d+(?:\.\d+){0,2}$/.test(normalized) ? normalized : null;
}

function parseVersion(value: string): number[] {
  return value.split(".").map((part) => Number.parseInt(part, 10)).filter(Number.isFinite);
}

function dateValue(value: unknown): number {
  if (typeof value !== "string") return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function chooseReleaseAsset(release: GitHubRelease, expectedAssetName: string | null): GitHubReleaseAsset | null {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (expectedAssetName) {
    const exact = assets.find((asset) => asset.name === expectedAssetName);
    if (exact) return exact;
  }
  return assets.find((asset) => /milxdy.*\.zip$/i.test(asset.name || ""))
    || assets.find((asset) => /\.zip$/i.test(asset.name || ""))
    || assets[0]
    || null;
}

function expectedReleaseAssetName(version: string | null): string | null {
  if (!version) return null;
  const target = typeof MILXDY_BUILD_TARGET === "string" ? MILXDY_BUILD_TARGET : "chromium";
  const profile = typeof MILXDY_BUILD_PROFILE === "string" ? MILXDY_BUILD_PROFILE : "full";
  return `milXdy-${version}-${target}-${profile}.zip`;
}
