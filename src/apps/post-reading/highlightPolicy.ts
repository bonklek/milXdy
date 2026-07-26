import type { BodyHighlightMode } from "./shared/types";

export function resolveContinuousHighlightMode(
  configuredMode: BodyHighlightMode,
  performanceMode: string,
  textLength: number,
  tokenEstimate: number,
): { mode: BodyHighlightMode; reason: string } {
  if (configuredMode !== "smooth") return { mode: configuredMode, reason: "configured" };
  if (performanceMode === "fast") return { mode: "word", reason: "fast-mode" };
  if (performanceMode === "balanced" && (textLength > 1500 || tokenEstimate > 240)) {
    return { mode: "word", reason: "balanced-cap" };
  }
  if (textLength > 2200 || tokenEstimate > 360) return { mode: "word", reason: "long-text-cap" };
  return { mode: "smooth", reason: "configured" };
}

export function isSmoothHighlightDiscontinuity(
  previousIndex: number | null,
  currentIndex: number,
  charsPerSecond: number,
  transportChunkChanged: boolean,
): boolean {
  if (previousIndex === null || currentIndex < previousIndex) return true;
  if (transportChunkChanged) return false;
  const expectedLead = Math.max(18, charsPerSecond * 1.25);
  return currentIndex - previousIndex > expectedLead;
}
