export type UpdateStatus = {
  checkedAt: number;
  currentVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  updateAvailable: boolean;
  error?: string;
};

export const UPDATE_STATUS_KEY = "milxdy.updateStatus";
export const UPDATE_ALARM_NAME = "milxdy.updateCheck";
export const UPDATE_CHECK_INTERVAL_MINUTES = 360;

// Set this to the public GitHub repository before publishing the beta.
export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/OWNER/REPO/releases/latest";

type GitHubRelease = {
  tag_name?: string;
  html_url?: string;
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

    const release = await response.json() as GitHubRelease;
    const latestVersion = normalizeVersion(release.tag_name);
    if (!latestVersion) {
      throw new Error("Latest release did not include a version tag");
    }

    return {
      checkedAt,
      currentVersion,
      latestVersion,
      latestUrl: typeof release.html_url === "string" ? release.html_url : null,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    };
  } catch (error) {
    return {
      checkedAt,
      currentVersion,
      latestVersion: null,
      latestUrl: null,
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
