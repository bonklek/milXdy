import { describe, expect, it, vi } from "vitest";
import { resolveBadgeProfiles } from "./badge-profile-lookup";

const profile = { username: "member", twitterHandle: "example_user", socialCreditScore: 648, beetles: 289, friendCount: 825 };

describe("public badge lookup fallback", () => {
  it.each([
    { ok: false, error: "missing_scope" },
    { ok: true, results: [{ status: "not_found" }] },
    { ok: true, results: [{ status: "resolved", profile: null }] },
  ])("renders public stats when directory resolution is unavailable: %j", async directory => {
    const send = vi.fn(async (message: Record<string, unknown>) => message.type === "reminetIdentity:resolve"
      ? directory : { ok: true, data: { user: profile } });
    const result = await resolveBadgeProfiles(["example_user"], send);
    expect(result).toEqual([{ status: "resolved", profile: expect.objectContaining({
      remiliaUsername: "member", xHandle: "example_user", remiStatsScore: 648, beetleCount: 289,
    }) }]);
    expect(send).toHaveBeenCalledWith({ type: "remistats:getUser", handle: "example_user" }, "remistats:getUser");
    expect(send.mock.calls.some(([message]) => String(message.type).includes("poke"))).toBe(false);
  });
  it("does not repeat public reads for directory profiles already resolved", async () => {
    const send = vi.fn(async () => ({ ok: true, results: [{ status: "resolved", profile: { remiliaUsername: "member" } }] }));
    expect((await resolveBadgeProfiles(["example_user"], send))[0].status).toBe("resolved");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("keeps transient failures retryable and only marks a confirmed public 404 absent", async () => {
    const send = vi.fn(async (message: Record<string, unknown>) => message.type === "reminetIdentity:resolve"
      ? { ok: true, results: [{ status: "not_found" }, { status: "not_found" }] }
      : message.handle === "absent" ? { ok: false, status: 404, notFound: true } : { ok: false, status: 503 });
    expect(await resolveBadgeProfiles(["absent", "retry"], send)).toEqual([{ status: "not_found" }, { status: "error" }]);
  });
  it("rejects mismatched public account responses", async () => {
    const send = vi.fn(async (message: Record<string, unknown>) => message.type === "reminetIdentity:resolve"
      ? { ok: false } : { ok: true, data: { user: { ...profile, twitterHandle: "someone_else" } } });
    expect(await resolveBadgeProfiles(["example_user"], send)).toEqual([{ status: "error" }]);
  });
});
