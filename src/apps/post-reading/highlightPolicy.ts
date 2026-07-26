import type { BodyHighlightMode } from "./shared/types";

export function resolveContinuousHighlightMode(
  configuredMode: BodyHighlightMode,
  performanceMode: string,
  textLength: number,
  tokenEstimate: number,
): { mode: BodyHighlightMode; reason: string } {
  void performanceMode;
  void textLength;
  void tokenEstimate;
  return { mode: configuredMode, reason: "configured" };
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
