import { describe, expect, it } from "vitest";
import { exactDirectoryProfileIdentity, shouldForceExactDirectoryProfileRetry } from "./profile-identity";

function resolved(profile: unknown = null) {
  return {
    ok: true,
    results: [{
      query: { type: "x_handle", value: "MiladyBonkle" },
      identity: { handle: "Bonkle.Remilia", display_name: "Bonkle", avatar_url: "https://example.invalid/avatar.png" },
      status: "resolved",
      cached: false,
      provenance: "remilia-api-v1:directory",
      profile,
    }],
  };
}

describe("exact directory profile identity", () => {
  it("accepts an exact authoritative directory identity when optional public profile data is absent", () => {
    expect(exactDirectoryProfileIdentity(resolved(null), "@MiladyBonkle")).toEqual({
      xHandle: "miladybonkle",
      remiliaUsername: "bonkle.remilia",
    });
  });

  it.each([
    ["unresolved", { ok: true, results: [{ query: { type: "x_handle", value: "MiladyBonkle" }, identity: null, status: "not_found", provenance: "remilia-api-v1:directory" }] }],
    ["ambiguous", { ok: true, results: [resolved().results[0], resolved().results[0]] }],
    ["mismatched query", { ...resolved(), results: [{ ...resolved().results[0], query: { type: "x_handle", value: "Other" } }] }],
    ["untrusted provenance", { ...resolved(), results: [{ ...resolved().results[0], provenance: "page-text" }] }],
    ["mismatched profile X identity", resolved({ xHandle: "Other", remiliaUsername: "Bonkle.Remilia" })],
    ["mismatched profile Remilia identity", resolved({ xHandle: "MiladyBonkle", remiliaUsername: "Other.Remilia" })],
  ])("fails closed for %s", (_label, response) => {
    expect(exactDirectoryProfileIdentity(response, "MiladyBonkle")).toBeNull();
  });

  it("forces only a cached exact negative or error and never a fresh miss or resolved identity", () => {
    expect(shouldForceExactDirectoryProfileRetry({
      ok: true,
      results: [{ status: "not_found", cached: true }],
    })).toBe(true);
    expect(shouldForceExactDirectoryProfileRetry({
      ok: true,
      results: [{ status: "error", cached: true }],
    })).toBe(true);
    expect(shouldForceExactDirectoryProfileRetry({
      ok: true,
      results: [{ status: "not_found", cached: false }],
    })).toBe(false);
    expect(shouldForceExactDirectoryProfileRetry(resolved(null))).toBe(false);
  });
});
