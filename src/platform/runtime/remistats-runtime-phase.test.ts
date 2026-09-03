import { describe, expect, it } from "vitest";
import {
  applyRemiStatsRuntimePhaseUpdate,
  emptyRemiStatsRuntimePhaseState,
  formatRemiStatsRuntimePhaseState,
  sanitizeRemiStatsRuntimePhaseUpdate,
} from "./remistats-runtime-phase";

describe("RemiStats runtime phase diagnostics", () => {
  it("retains only bounded phase enums and no identity or auth details", () => {
    const initial = emptyRemiStatsRuntimePhaseState();
    const next = applyRemiStatsRuntimePhaseUpdate(initial, {
      channel: "profile",
      phase: "directory-sender-rejected",
    });
    expect(next).toEqual({ activation: "not-started", profile: "directory-sender-rejected", poke: "not-observed" });
    expect(formatRemiStatsRuntimePhaseState(next)).toBe(
      "Runtime check — activation: not-started; profile: directory-sender-rejected; Poke: not-observed",
    );
  });

  it.each([
    [{ channel: "profile", phase: "directory-confirmed", handle: "private" }],
    [{ channel: "auth", phase: "feature-enabled" }],
    [{ channel: "profile", phase: "token-present" }],
    ["directory-confirmed"],
  ])("rejects unbounded or sensitive-looking input", (value) => {
    expect(sanitizeRemiStatsRuntimePhaseUpdate(value)).toBeNull();
  });
});
