import { beforeEach, describe, expect, it, vi } from "vitest";
import { boot, resolvePublicRemiliaProfile } from "../../examples/packages/local-dev/tweet-composer-kit/src/content.js";

describe("Post-Factory Remilia capability integration", () => {
  const invocations: Array<[string, Record<string, unknown>]> = [];
  const invokeRemiliaCapability = vi.fn(async (operation: string, params: Record<string, unknown>) => {
    invocations.push([operation, params]);
    return { ok: true, data: { username: "milady" }, status: 200 };
  });

  beforeEach(() => {
    invokeRemiliaCapability.mockClear();
    invocations.splice(0);
    boot({
      remiliaCapabilities: [{
        id: "remilia.profile.public",
        operations: ["getUserProfile"],
        scopes: [],
        consent: "enablement",
        reason: "Reviewed public profile lookup.",
      }],
      invokeRemiliaCapability,
      recordDiagnostic: vi.fn(),
    });
  });

  it("uses the typed host callback with closed params and no direct auth surface", async () => {
    expect(await resolvePublicRemiliaProfile("~milady")).toMatchObject({ ok: true, data: { username: "milady" } });
    expect(invokeRemiliaCapability).toHaveBeenCalledWith("getUserProfile", { username: "milady" });
    expect(invocations[0]?.[1]).not.toHaveProperty("url");
    expect(invocations[0]?.[1]).not.toHaveProperty("token");
    expect(invocations[0]?.[1]).not.toHaveProperty("credentials");
  });

  it("rejects invalid usernames before invoking the host", async () => {
    expect(await resolvePublicRemiliaProfile(" ")).toMatchObject({ ok: false, error: { code: "invalid_request" } });
    expect(invokeRemiliaCapability).not.toHaveBeenCalled();
  });
});
