export type BuildProfile = "lite" | "balanced" | "full";
export type BuildTarget = "chromium" | "firefox";

export function normalizeBuildProfile(value: unknown): BuildProfile {
  return value === "lite" || value === "balanced" || value === "full" ? value : "full";
}

export function normalizeBuildTarget(value: unknown): BuildTarget {
  return value === "firefox" ? "firefox" : "chromium";
}
