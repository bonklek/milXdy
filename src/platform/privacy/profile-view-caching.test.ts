import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyIdentityProfile,
  emptyReminetIdentityCache,
  identityCacheEntry,
  identityCacheKeyForRemiliaUsername,
  identityCacheKeyForXHandle,
  mergeIdentityProfile,
  normalizeReminetIdentityCache,
  rememberSharedIdentity,
} from "../auth/reminet-identity";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("profile-view caching", () => {
  it("routes chat through the shared identity cache", () => {
    const chat = source("src/apps/reminet-chat/content.ts");
    expect(chat).toContain('type: "reminetIdentity:getProfile"');
    expect(chat).not.toContain('const PROFILE_CACHE_KEY = "milxdy.reminetChat.profileCache.v3"');
    expect(chat).not.toContain('type: "reminetChat:getProfile"');
  });

  it("stores one canonical record behind X and Remilia aliases", () => {
    const cache = emptyReminetIdentityCache();
    const profile = mergeIdentityProfile(emptyIdentityProfile(), {
      xHandle: "MiladyExample",
      remiliaUsername: "example",
      displayName: "Example",
    });
    rememberSharedIdentity(cache, profile);

    expect(Object.keys(cache.records)).toHaveLength(1);
    expect(identityCacheEntry(cache, identityCacheKeyForXHandle("miladyexample"))?.profile.displayName).toBe("Example");
    expect(identityCacheEntry(cache, identityCacheKeyForRemiliaUsername("example"))?.profile.displayName).toBe("Example");
  });

  it("collapses duplicate legacy aliases during migration", () => {
    const profile = mergeIdentityProfile(emptyIdentityProfile(), { xHandle: "same", remiliaUsername: "same-rn" }, "remilia.net");
    const legacy = {
      "x:same": { profile, cachedAt: 100 },
      "rn:same-rn": { profile, cachedAt: 100 },
    };
    const migrated = normalizeReminetIdentityCache(legacy);
    expect(Object.keys(migrated.records)).toHaveLength(1);
    expect(migrated.aliases["x:same"]).toBe(migrated.aliases["rn:same-rn"]);
  });

  it("deduplicates trophy banner profile work in memory", () => {
    const remiStats = source("src/apps/remistats/content.js");
    expect(remiStats).toContain("trophyBannerCache.get(key)");
    expect(remiStats).toContain("trophyBannerPending.has(key)");
    expect(remiStats).toContain("type: 'reminetIdentity:getProfile'");
    expect(remiStats).not.toContain("fetch(`${REMILIA_BASE_URL}/api/profile/~");
  });

  it("keeps shared identity enrichment behind the persistent identity cache", () => {
    const background = source("src/extension/background/index.ts");
    expect(background).toContain("freshIdentityEntry(entry, maxAgeMs");
    expect(background).toContain("fetchRemiliaPublicProfile(resolvedUsername)");
  });
});
