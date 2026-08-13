import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPackageRemiliaCapabilityClient } from "./remilia-capability-client";
import type { MilxdyAppManifest } from "../app-sdk/app-platform";

describe("package Remilia capability client", () => {
  const subtle = globalThis.crypto.subtle;
  beforeEach(() => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(7), subtle });
  });

  it("injects package identity and grant metadata without exposing them to operation params", async () => {
    const messages: unknown[] = [];
    const client = createPackageRemiliaCapabilityClient(reviewedApp(), async (message) => {
      messages.push(message);
      return { ok: true, data: { username: "milady" }, status: 200 };
    });
    await client.invoke("getUserProfile", { username: "milady" });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ type: "milxdy:remiliaCapability:grant", packageId: "tweet-composer-kit", consentAcknowledged: true });
    expect(messages[1]).toMatchObject({ type: "milxdy:remiliaCapability:invoke", packageId: "tweet-composer-kit", operation: "getUserProfile", params: { username: "milady" } });
    expect(JSON.stringify(client.declarations)).not.toContain("token");
  });

  it("grants repo-owned first-party apps with a host-derived manifest fingerprint", async () => {
    const app = reviewedApp();
    delete app.localPackage;
    app.id = "reminetChat";
    const messages: unknown[] = [];
    const client = createPackageRemiliaCapabilityClient(app, async (message) => {
      messages.push(message);
      return { ok: true, data: {}, status: 200 };
    });
    await client.invoke("getUserProfile", { username: "milady" });
    expect(messages[0]).toMatchObject({
      type: "milxdy:remiliaCapability:grant",
      packageId: "reminetChat",
      packageSource: "firstParty",
      reviewStatus: "reviewed",
      consentAcknowledged: true,
    });
    expect((messages[0] as Record<string, unknown>).manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("fails closed before transport for unreviewed packages and undeclared operations", async () => {
    const transport = vi.fn(async () => ({ ok: true }));
    const unreviewed = reviewedApp();
    unreviewed.localPackage!.reviewStatus = "local";
    expect(await createPackageRemiliaCapabilityClient(unreviewed, transport).invoke("getUserProfile", { username: "milady" }))
      .toMatchObject({ ok: false, error: { code: "package_not_reviewed" } });
    expect(await createPackageRemiliaCapabilityClient(reviewedApp(), transport).invoke("getMyStats", {}))
      .toMatchObject({ ok: false, error: { code: "operation_not_declared" } });
    expect(transport).not.toHaveBeenCalled();
  });

  it("requires active user activation for every write invocation", async () => {
    const app = reviewedApp();
    app.remiliaCapabilities = [{
      id: "remilia.chat.write",
      operations: ["postGlobalChatMessage"],
      scopes: ["remilia:chat.write"],
      consent: "perInvocation",
      reason: "Explicit package chat submit control.",
    }];
    const transport = vi.fn(async () => ({ ok: true, data: {}, status: 200 }));
    expect(await createPackageRemiliaCapabilityClient(app, transport, () => false).invoke("postGlobalChatMessage", { text: "hello" }))
      .toMatchObject({ ok: false, error: { code: "consent_required" } });
    expect(transport).not.toHaveBeenCalled();
  });

  it("revokes the opaque grant and refuses later calls", async () => {
    const messages: unknown[] = [];
    const transport = vi.fn(async (message: unknown) => {
      messages.push(message);
      return { ok: true, data: {}, status: 200 };
    });
    const client = createPackageRemiliaCapabilityClient(reviewedApp(), transport);
    await client.invoke("getUserProfile", { username: "milady" });
    await client.revoke();
    expect(await client.invoke("getUserProfile", { username: "milady" }))
      .toMatchObject({ ok: false, error: { code: "grant_revoked" } });
    expect(messages.some((message) => (message as Record<string, unknown>).type === "milxdy:remiliaCapability:revoke")).toBe(true);
  });
});

function reviewedApp(): MilxdyAppManifest {
  return {
    id: "tweet-composer-kit",
    name: "Post-Factory",
    version: "0.2.0-pilot",
    description: "test",
    contentEntry: "content.js",
    defaultEnabled: false,
    storageKeys: {},
    surfaces: ["composerAction"],
    cost: { startup: "cheap", perSurface: "cheap", network: "batched", worker: "none", domWrite: "small" },
    loadTriggers: ["userAction"],
    package: {},
    remiliaCapabilities: [{
      id: "remilia.profile.public",
      operations: ["getUserProfile"],
      scopes: [],
      consent: "enablement",
      reason: "Explicit reviewed public profile lookup.",
    }],
    localPackage: {
      reviewStatus: "reviewed",
      manifestSha256: "a".repeat(64),
      packageConsentAcknowledged: true,
    },
    isEnabled: async () => true,
  };
}
