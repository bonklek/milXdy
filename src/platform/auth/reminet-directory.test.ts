import { describe, expect, it, vi } from "vitest";
import {
  REMINET_DIRECTORY_NEGATIVE_TTL_MS,
  REMINET_DIRECTORY_POSITIVE_TTL_MS,
  emptyReminetDirectoryCache,
  normalizeReminetDirectoryIdentifier,
  remiNetDirectoryAliasKey,
  remiNetDirectoryCacheKey,
  resolveReminetDirectoryIdentifiers,
  type ReminetDirectoryIdentifier,
  type ReminetDirectoryIdentity,
} from "./reminet-directory";

function identity(handle: string): ReminetDirectoryIdentity {
  return {
    handle,
    display_name: handle.toUpperCase(),
    avatar_url: `https://example.test/${handle}.png`,
  };
}

function successfulResolver(calls: ReminetDirectoryIdentifier[][]) {
  return async (identifiers: readonly ReminetDirectoryIdentifier[]) => {
    calls.push([...identifiers]);
    return {
      ok: true as const,
      status: 200,
      data: identifiers.map((query) => ({ query, identity: identity(`rn-${query.value}`) })),
    };
  };
}

describe("Remilia API v1 directory resolution", () => {
  it.each([
    [1, [1]],
    [50, [50]],
    [51, [50, 1]],
    [101, [50, 50, 1]],
  ])("chunks %i identifiers into API batches no larger than 50", async (count, expectedBatchSizes) => {
    const calls: ReminetDirectoryIdentifier[][] = [];
    const identifiers = Array.from({ length: count }, (_, index) => ({
      type: "discord" as const,
      value: `person-${index}`,
    }));

    const resolved = await resolveReminetDirectoryIdentifiers(
      identifiers,
      emptyReminetDirectoryCache(),
      successfulResolver(calls),
      { now: () => 1_000 },
    );

    expect(calls.map((batch) => batch.length)).toEqual(expectedBatchSizes);
    expect(resolved.batchSizes).toEqual(expectedBatchSizes);
    expect(resolved.results).toHaveLength(count);
    expect(resolved.results.every((result) => result.status === "resolved")).toBe(true);
  });

  it("deduplicates repeated input while preserving result order", async () => {
    const calls: ReminetDirectoryIdentifier[][] = [];
    const repeated = { type: "x_handle" as const, value: "@Milady" };
    const resolved = await resolveReminetDirectoryIdentifiers(
      [repeated, { type: "github", value: "Example" }, repeated],
      emptyReminetDirectoryCache(),
      successfulResolver(calls),
      { now: () => 2_000 },
    );

    expect(calls).toEqual([[
      { type: "x_handle", value: "milady" },
      { type: "github", value: "example" },
    ]]);
    expect(resolved.results.map((result) => result.query)).toEqual([
      { type: "x_handle", value: "milady" },
      { type: "github", value: "example" },
      { type: "x_handle", value: "milady" },
    ]);
    expect(resolved.results[0]).toEqual(resolved.results[2]);
  });

  it("authorizes an exact handle independently of optional presentation fields", async () => {
    const queries = [
      { type: "x_handle" as const, value: "FixtureMember" },
      { type: "x_handle" as const, value: "OtherMilady" },
    ];
    const resolved = await resolveReminetDirectoryIdentifiers(
      queries,
      emptyReminetDirectoryCache(),
      async ([first, second]) => ({
        ok: true as const,
        status: 200,
        data: [
          { query: first, identity: { handle: "Fixture.Remilia" } },
          {
            query: second,
            identity: {
              handle: "Other.Remilia",
              display_name: null,
              avatar_url: null,
              avatar_url_small: null,
            },
          },
        ],
      }),
      { now: () => 2_500 },
    );

    expect(resolved.results).toMatchObject([
      {
        query: { type: "x_handle", value: "fixturemember" },
        status: "resolved",
        identity: { handle: "fixture.remilia", display_name: "", avatar_url: "" },
      },
      {
        query: { type: "x_handle", value: "othermilady" },
        status: "resolved",
        identity: { handle: "other.remilia", display_name: "", avatar_url: "" },
      },
    ]);
  });

  it("rejects malformed presentation values instead of converting them into a miss", async () => {
    const query = { type: "x_handle" as const, value: "fixturemember" };
    const resolved = await resolveReminetDirectoryIdentifiers(
      [query],
      emptyReminetDirectoryCache(),
      async () => ({
        ok: true as const,
        status: 200,
        data: [{ query, identity: { handle: "fixture.remilia", avatar_url: 42 } as any }],
      }),
      { now: () => 2_600 },
    );

    expect(resolved.results[0]).toMatchObject({ status: "error", error: { code: "invalid_response" } });
    expect(resolved.cache.negative).toEqual({});
  });

  it("caches positive mappings until expiry and refreshes handle changes authoritatively", async () => {
    let now = 10_000;
    const fetchBatch = vi.fn(async (identifiers: readonly ReminetDirectoryIdentifier[]) => ({
      ok: true as const,
      status: 200,
      data: identifiers.map((query) => ({ query, identity: identity(now < 20_000 ? "old-handle" : "new-handle") })),
    }));
    const first = await resolveReminetDirectoryIdentifiers(
      [{ type: "x_handle", value: "same_x" }],
      emptyReminetDirectoryCache(),
      fetchBatch,
      { now: () => now, positiveTtlMs: 5_000 },
    );

    now = 14_999;
    const cached = await resolveReminetDirectoryIdentifiers(
      [{ type: "x_handle", value: "same_x" }],
      first.cache,
      fetchBatch,
      { now: () => now, positiveTtlMs: 5_000 },
    );
    expect(cached.results[0]).toMatchObject({ cached: true, identity: { handle: "old-handle" } });

    now = 20_000;
    const refreshed = await resolveReminetDirectoryIdentifiers(
      [{ type: "x_handle", value: "same_x" }],
      cached.cache,
      fetchBatch,
      { now: () => now, positiveTtlMs: 5_000 },
    );
    expect(refreshed.results[0]).toMatchObject({ cached: false, identity: { handle: "new-handle" } });
    expect(fetchBatch).toHaveBeenCalledTimes(2);
    expect(refreshed.cache.positive["x_handle:same_x"].identity.handle).toBe("new-handle");
  });

  it("negative-caches explicit misses but retries them after expiry", async () => {
    let now = 30_000;
    const fetchBatch = vi.fn(async (identifiers: readonly ReminetDirectoryIdentifier[]) => ({
      ok: true as const,
      status: 200,
      data: identifiers.map((query) => ({ query, identity: null })),
    }));
    const first = await resolveReminetDirectoryIdentifiers(
      [{ type: "github", value: "missing" }],
      emptyReminetDirectoryCache(),
      fetchBatch,
      { now: () => now, negativeTtlMs: 1_000 },
    );

    now = 30_999;
    const cached = await resolveReminetDirectoryIdentifiers(
      [{ type: "github", value: "missing" }],
      first.cache,
      fetchBatch,
      { now: () => now, negativeTtlMs: 1_000 },
    );
    expect(cached.results[0]).toMatchObject({ status: "not_found", cached: true, identity: null });

    now = 31_000;
    const expired = await resolveReminetDirectoryIdentifiers(
      [{ type: "github", value: "missing" }],
      cached.cache,
      fetchBatch,
      { now: () => now, negativeTtlMs: 1_000 },
    );
    expect(expired.results[0]).toMatchObject({ status: "not_found", cached: false });
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it("does not turn transport failures or omitted results into negative-cache misses", async () => {
    const query = { type: "discord" as const, value: "retry-me" };
    const failed = await resolveReminetDirectoryIdentifiers(
      [query],
      emptyReminetDirectoryCache(),
      async () => ({
        ok: false as const,
        error: { code: "rate_limited", category: "rate_limit", status: 429, retryAfterMs: 1_000 },
      }),
      { now: () => 40_000 },
    );
    expect(failed.results[0]).toMatchObject({ status: "error", error: { code: "rate_limited", status: 429 } });
    expect(failed.cache.negative).toEqual({});

    const omitted = await resolveReminetDirectoryIdentifiers(
      [query],
      emptyReminetDirectoryCache(),
      async () => ({ ok: true as const, status: 200, data: [] }),
      { now: () => 40_000 },
    );
    expect(omitted.results[0]).toMatchObject({ status: "error", error: { code: "invalid_response" } });
    expect(omitted.cache.negative).toEqual({});
  });

  it("accepts duplicate response rows only when they agree", async () => {
    const query = { type: "x_handle" as const, value: "same" };
    const agreed = await resolveReminetDirectoryIdentifiers(
      [query],
      emptyReminetDirectoryCache(),
      async () => ({
        ok: true as const,
        status: 200,
        data: [
          { query, identity: identity("one") },
          { query, identity: identity("one") },
        ],
      }),
      { now: () => 50_000 },
    );
    expect(agreed.results[0]).toMatchObject({ status: "resolved", identity: { handle: "one" } });

    const conflicting = await resolveReminetDirectoryIdentifiers(
      [query],
      emptyReminetDirectoryCache(),
      async () => ({
        ok: true as const,
        status: 200,
        data: [
          { query, identity: identity("one") },
          { query, identity: identity("two") },
        ],
      }),
      { now: () => 50_000 },
    );
    expect(conflicting.results[0]).toMatchObject({ status: "error", error: { code: "duplicate_mapping" } });
    expect(conflicting.cache.positive).toEqual({});
    expect(conflicting.cache.negative).toEqual({});
  });

  it("bounds and expires positive and negative cache entries independently", async () => {
    const queries = [
      { type: "handle" as const, value: "positive-a" },
      { type: "handle" as const, value: "missing" },
      { type: "handle" as const, value: "positive-b" },
    ];
    const resolved = await resolveReminetDirectoryIdentifiers(
      queries,
      emptyReminetDirectoryCache(),
      async (identifiers) => ({
        ok: true as const,
        status: 200,
        data: identifiers.map((query) => ({
          query,
          identity: query.value === "missing" ? null : identity(query.value),
        })),
      }),
      { now: () => 60_000, positiveMaxEntries: 1, negativeMaxEntries: 1 },
    );

    expect(Object.keys(resolved.cache.positive)).toHaveLength(1);
    expect(Object.keys(resolved.cache.negative)).toEqual(["handle:missing"]);

    const expired = await resolveReminetDirectoryIdentifiers(
      [],
      resolved.cache,
      async () => { throw new Error("no request expected"); },
      {
        now: () => 60_000 + Math.max(REMINET_DIRECTORY_POSITIVE_TTL_MS, REMINET_DIRECTORY_NEGATIVE_TTL_MS),
      },
    );
    expect(expired.cache).toEqual(emptyReminetDirectoryCache());
  });

  it("normalizes all four official identifier types and API-v1 aliases", () => {
    expect(normalizeReminetDirectoryIdentifier({ type: "handle", value: "~Remilia.User" })).toEqual({ type: "handle", value: "remilia.user" });
    expect(normalizeReminetDirectoryIdentifier({ type: "x_handle", value: "https://x.com/MiLaDy" })).toEqual({ type: "x_handle", value: "milady" });
    expect(normalizeReminetDirectoryIdentifier({ type: "github", value: "https://github.com/Open-AI" })).toEqual({ type: "github", value: "open-ai" });
    expect(normalizeReminetDirectoryIdentifier({ type: "discord", value: "@Example.User" })).toEqual({ type: "discord", value: "example.user" });
    expect(remiNetDirectoryCacheKey({ type: "x_handle", value: "@MiLaDy" })).toBe("x_handle:milady");
    expect(remiNetDirectoryAliasKey({ type: "handle", value: "~Remilia" })).toBe("rn:remilia");
    expect(remiNetDirectoryAliasKey({ type: "x_handle", value: "@MiLaDy" })).toBe("x:milady");
  });
});
