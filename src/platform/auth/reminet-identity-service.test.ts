import { describe, expect, it, vi } from "vitest";
import { emptyReminetIdentityCache, identityCacheEntry } from "./reminet-identity";
import type { ReminetDirectoryIdentifier } from "./reminet-directory";
import { resolveReminetIdentities, type ReminetIdentityApi } from "./reminet-identity-service";

function publicProfile(username: string, xHandle?: string) {
  return {
    user: {
      username,
      displayName: username.toUpperCase(),
      pfp: { project: "milady", id: "123" },
      pfpUrl: `https://pfp.remilia.net/pfp/milady/123`,
      friendCount: 5,
      beetles: 7,
      socialCredit: 42,
      trophyShelves: [1],
      allTrophies: [{ id: 1 }],
      friendsDisplayed: [{ userHandle: "bestie" }],
      connections: xHandle ? [{ provider: "twitter", username: xHandle }] : [],
    },
    achievementContext: {},
    viewerContext: { areFriends: true },
    isAuthenticated: true,
    isOwnProfile: false,
  };
}

function successDirectoryResults(identifiers: readonly ReminetDirectoryIdentifier[], mapping: Record<string, string | null>) {
  return {
    ok: true as const,
    status: 200,
    data: identifiers.map((query) => ({
      query,
      identity: mapping[`${query.type}:${query.value}`] === null
        ? null
        : {
            handle: mapping[`${query.type}:${query.value}`] ?? query.value,
            display_name: "Resolved",
            avatar_url: "https://example.test/avatar.png",
          },
    })),
  };
}

function apiFor(mapping: Record<string, string | null>, profileXHandles: Record<string, string> = {}): ReminetIdentityApi {
  return {
    resolveDirectory: vi.fn(async (identifiers) => successDirectoryResults(identifiers, mapping)),
    getUserProfile: vi.fn(async (username) => ({
      ok: true as const,
      status: 200,
      data: publicProfile(username, profileXHandles[username]),
    })),
  };
}

describe("shared Remilia API v1 identity service", () => {
  it("feeds directory and public-profile data into one provenance-aware identity", async () => {
    const api = apiFor({ "x_handle:milady": "remilia" }, { remilia: "milady" });
    const resolved = await resolveReminetIdentities(
      [{ type: "x_handle", value: "@Milady" }],
      emptyReminetIdentityCache(),
      api,
      { now: () => 1_000 },
    );

    expect(resolved.results[0]).toMatchObject({
      status: "resolved",
      profile: {
        remiliaUsername: "remilia",
        xHandle: "milady",
        friendCount: 5,
        friendsDisplayed: [{ userHandle: "bestie" }],
        viewerContext: { areFriends: true },
        isAuthenticated: true,
      },
    });
    expect(resolved.results[0].profile?.sources).toEqual([
      "remilia-api-v1:directory",
      "remilia-api-v1:profile",
    ]);
    expect(resolved.results[0].profile?.provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ endpoint: "POST /api/v1/directory/resolve", source: "remilia-api-v1" }),
      expect.objectContaining({ endpoint: "GET /api/v1/users/remilia", source: "remilia-api-v1" }),
    ]));
    expect(identityCacheEntry(resolved.cache, "x:milady")?.profile.remiliaUsername).toBe("remilia");
    expect(identityCacheEntry(resolved.cache, "rn:remilia")?.profile.xHandle).toBe("milady");
    expect(api.resolveDirectory).toHaveBeenCalledWith([{ type: "x_handle", value: "milady" }]);
    expect(api.getUserProfile).toHaveBeenCalledWith("remilia");
  });

  it("deduplicates profile reads across different identifiers resolving to one identity", async () => {
    const api = apiFor({
      "x_handle:milady": "remilia",
      "github:remilia-corp": "remilia",
    });
    const resolved = await resolveReminetIdentities(
      [
        { type: "x_handle", value: "milady" },
        { type: "github", value: "remilia-corp" },
      ],
      emptyReminetIdentityCache(),
      api,
      { now: () => 2_000 },
    );

    expect(api.getUserProfile).toHaveBeenCalledTimes(1);
    expect(resolved.results.map((result) => result.profile?.remiliaUsername)).toEqual(["remilia", "remilia"]);
    expect(identityCacheEntry(resolved.cache, "x:milady")?.profile.remiliaUsername).toBe("remilia");
    expect(identityCacheEntry(resolved.cache, "github:remilia-corp")?.profile.remiliaUsername).toBe("remilia");
  });

  it("rebinds an external alias when the official directory mapping changes", async () => {
    const firstApi = apiFor({ "x_handle:changed": "old-handle" });
    const first = await resolveReminetIdentities(
      [{ type: "x_handle", value: "changed" }],
      emptyReminetIdentityCache(),
      firstApi,
      { now: () => 3_000 },
    );
    expect(identityCacheEntry(first.cache, "x:changed")?.profile.remiliaUsername).toBe("old-handle");

    const secondApi = apiFor({ "x_handle:changed": "new-handle" });
    const refreshed = await resolveReminetIdentities(
      [{ type: "x_handle", value: "changed" }],
      first.cache,
      secondApi,
      { now: () => 4_000, force: true },
    );
    expect(identityCacheEntry(refreshed.cache, "x:changed")?.profile.remiliaUsername).toBe("new-handle");
    expect(identityCacheEntry(refreshed.cache, "rn:old-handle")?.profile.remiliaUsername).toBe("old-handle");
    expect(identityCacheEntry(refreshed.cache, "rn:new-handle")?.profile.remiliaUsername).toBe("new-handle");
  });

  it("negative-caches missing public profiles separately from directory misses", async () => {
    const api: ReminetIdentityApi = {
      resolveDirectory: vi.fn(async (identifiers) => ({
        ok: true as const,
        status: 200,
        data: identifiers.map((query: ReminetDirectoryIdentifier) => ({
          query,
          identity: { handle: "Gone" },
        })),
      })),
      getUserProfile: vi.fn(async () => ({
        ok: false as const,
        error: { code: "not_found", category: "not_found", status: 404 },
      })),
    };
    const first = await resolveReminetIdentities(
      [{ type: "discord", value: "gone" }],
      emptyReminetIdentityCache(),
      api,
      { now: () => 5_000 },
    );
    const second = await resolveReminetIdentities(
      [{ type: "discord", value: "gone" }],
      first.cache,
      api,
      { now: () => 5_001 },
    );

    expect(first.results[0]).toMatchObject({
      status: "resolved",
      identity: { handle: "gone", display_name: "", avatar_url: "" },
      profile: null,
    });
    expect(first.cache.publicProfileMisses["rn:gone"]).toMatchObject({ source: "remilia-api-v1:profile" });
    expect(second.results[0]).toMatchObject({ status: "resolved", cached: true, profile: null });
    expect(api.getUserProfile).toHaveBeenCalledTimes(1);
  });
});
