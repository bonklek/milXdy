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

  it("renews a lost background grant once for reads without replaying writes", async () => {
    const messages: Array<Record<string, unknown>> = [];
    let grantCount = 0;
    const transport = vi.fn(async (message: unknown) => {
      const record = message as Record<string, unknown>;
      messages.push(record);
      if (record.type === "milxdy:remiliaCapability:grant") {
        grantCount += 1;
        return { ok: true };
      }
      if (record.operation === "getUserProfile" && grantCount === 1) {
        return { ok: false, error: { category: "broker", code: "package_not_granted", message: "worker restarted", status: 403 } };
      }
      return { ok: true, data: {}, status: 200 };
    });
    const client = createPackageRemiliaCapabilityClient(reviewedApp(), transport);
    await expect(client.invoke("getUserProfile", { username: "milady" })).resolves.toMatchObject({ ok: true });
    expect(messages.filter((message) => message.type === "milxdy:remiliaCapability:grant")).toHaveLength(2);
    expect(messages.filter((message) => message.type === "milxdy:remiliaCapability:invoke")).toHaveLength(2);

    const writeApp = reviewedApp();
    writeApp.remiliaCapabilities = [{ id: "remilia.chat.write", operations: ["postGlobalChatMessage"], scopes: ["remilia:chat.write"], consent: "perInvocation", reason: "Explicit package chat submit control." }];
    let writeGrantCount = 0;
    const writeTransport = vi.fn(async (message: unknown) => {
      if ((message as Record<string, unknown>).type === "milxdy:remiliaCapability:grant") {
        writeGrantCount += 1;
        return { ok: true };
      }
      return writeGrantCount === 1
        ? { ok: false, error: { category: "broker", code: "package_not_granted", message: "worker restarted", status: 403 } }
        : { ok: true, data: {}, status: 200 };
    });
    const writeClient = createPackageRemiliaCapabilityClient(writeApp, writeTransport, () => true);
    await expect(writeClient.invoke("postGlobalChatMessage", { text: "hello" }))
      .resolves.toMatchObject({ ok: false, error: { code: "package_not_granted" } });
    expect(writeTransport).toHaveBeenCalledTimes(2); // initial grant plus the single write; no renewal/replay
    await expect(writeClient.invoke("postGlobalChatMessage", { text: "hello" })).resolves.toMatchObject({ ok: true });
    expect(writeTransport).toHaveBeenCalledTimes(4); // a later, explicit gesture may renew and invoke
  });

  it("shares a pending renewal without changing the grant identity underneath concurrent reads", async () => {
    let random = 0;
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(++random), subtle });
    let finishRenewal!: () => void;
    const renewal = new Promise<void>((resolve) => { finishRenewal = resolve; });
    let activeId: unknown;
    let grants = 0;
    const transport = vi.fn(async (value: unknown) => {
      const message = value as Record<string, unknown>;
      if (message.type === "milxdy:remiliaCapability:grant") {
        grants += 1;
        const id = message.grantId;
        if (grants > 1) await renewal;
        activeId = id;
        return { ok: true };
      }
      return message.grantId === activeId
        ? { ok: true, data: {}, status: 200 }
        : { ok: false, error: { category: "broker", code: "package_not_granted" } };
    });
    const client = createPackageRemiliaCapabilityClient(reviewedApp(), transport);
    await client.invoke("getUserProfile", { username: "first" });
    activeId = null;
    const pending = [client.invoke("getUserProfile", { username: "a" }), client.invoke("getUserProfile", { username: "b" })];
    await vi.waitFor(() => expect(grants).toBe(2));
    finishRenewal();
    expect(await Promise.all(pending)).toEqual([expect.objectContaining({ ok: true }), expect.objectContaining({ ok: true })]);
    expect(grants).toBe(2);
  });

  it("cleans up a grant that completes after revocation without invoking the operation", async () => {
    let finishGrant!: () => void;
    const pendingGrant = new Promise<void>((resolve) => { finishGrant = resolve; });
    const messages: string[] = [];
    const client = createPackageRemiliaCapabilityClient(reviewedApp(), async (value) => {
      const message = value as Record<string, unknown>;
      messages.push(String(message.type));
      if (message.type === "milxdy:remiliaCapability:grant") await pendingGrant;
      return { ok: true };
    });
    const call = client.invoke("getUserProfile", { username: "a" });
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    const revoke = client.revoke();
    finishGrant();
    await expect(call).resolves.toMatchObject({ ok: false, error: { code: "grant_revoked" } });
    await revoke;
    expect(messages).toEqual(["milxdy:remiliaCapability:grant", "milxdy:remiliaCapability:revoke"]);
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
