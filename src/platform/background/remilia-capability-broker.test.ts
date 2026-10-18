import { describe, expect, it, vi } from "vitest";
import {
  REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE,
  REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE,
  REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE,
  createRemiliaCapabilityBrokerHandlers,
  type RemiliaCapabilityClient,
} from "./remilia-capability-broker";
import { REMILIA_CAPABILITY_DEFINITIONS, type AppRemiliaCapabilityDeclaration } from "../app-sdk/remilia-capabilities";

const extensionId = "test-extension";
const manifestSha256 = "a".repeat(64);
const grantId = "b".repeat(32);

describe("Remilia capability broker", () => {
  it("grants a reviewed, consented package and dispatches only its declared operation", async () => {
    const client = fakeClient();
    const handlers = createRemiliaCapabilityBrokerHandlers(client, { extensionId, now: () => 10 });
    const sender = trustedSender();
    const granted = await handle(handlers, REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE, grantMessage([
      declaration("remilia.profile.public", ["getUserProfile"]),
    ]), sender);
    expect(granted).toMatchObject({ ok: true });

    const result = await handle(handlers, REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, invokeMessage("getUserProfile", { username: "milady" }), sender);
    expect(result).toEqual({ ok: true, data: { username: "milady" }, status: 200 });
    expect(client.getUserProfile).toHaveBeenCalledWith("milady", { authenticated: false });

    const denied = await handle(handlers, REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, invokeMessage("getMyStats", {}), sender);
    expect(denied).toMatchObject({ ok: false, error: { code: "capability_not_declared" } });
  });

  it("fails closed for untrusted senders, missing grants, and exact scope drift", async () => {
    const handlers = createRemiliaCapabilityBrokerHandlers(fakeClient(), { extensionId });
    const wrongSender = { ...trustedSender(), id: "another-extension" };
    expect(await handle(handlers, REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE, grantMessage([
      declaration("remilia.profile.public", ["getUserProfile"]),
    ]), wrongSender)).toMatchObject({ ok: false, error: { code: "unauthorized_sender" } });
    expect(await handle(handlers, REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, invokeMessage("getUserProfile", { username: "milady" }), trustedSender()))
      .toMatchObject({ ok: false, error: { code: "package_not_granted" } });

    const drifted = declaration("remilia.stats.read", ["getMyStats"]);
    drifted.scopes = [];
    const grantHandler = handlers.find((handler) => handler.type === REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE)!;
    expect(grantHandler.matches(grantMessage([drifted]))).toBe(false);
  });

  it("requires a user gesture for writes and revokes the exact package grant", async () => {
    const client = fakeClient();
    const handlers = createRemiliaCapabilityBrokerHandlers(client, { extensionId });
    const sender = trustedSender();
    await handle(handlers, REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE, grantMessage([
      declaration("remilia.pokes.write", ["pokeUser"]),
    ]), sender);

    expect(await handle(handlers, REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, invokeMessage("pokeUser", { handle: "milady" }), sender))
      .toMatchObject({ ok: false, error: { code: "consent_required" } });
    expect(await handle(handlers, REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, { ...invokeMessage("pokeUser", { handle: "milady" }), userGesture: true }, sender))
      .toMatchObject({ ok: true });

    await handle(handlers, REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE, {
      type: REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE,
      packageId: "tweet-composer-kit",
      grantId,
    }, sender);
    expect(await handle(handlers, REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, { ...invokeMessage("pokeUser", { handle: "milady" }), userGesture: true }, sender))
      .toMatchObject({ ok: false, error: { code: "package_not_granted" } });
  });

  it("never returns bearer, refresh-token, cookie, or authorization material", async () => {
    for (const privatePayload of [
      { accessToken: "secret" },
      { refresh_token: "secret" },
      { cookie: "session=secret" },
      { nested: { authorization: "Bearer secret" } },
    ]) {
      const client = fakeClient({ ok: true, data: privatePayload, status: 200 });
      const handlers = createRemiliaCapabilityBrokerHandlers(client, { extensionId });
      const sender = trustedSender();
      await handle(handlers, REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE, grantMessage([
        declaration("remilia.profile.public", ["getUserProfile"]),
      ]), sender);
      expect(await handle(handlers, REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, invokeMessage("getUserProfile", { username: "milady" }), sender))
        .toMatchObject({ ok: false, error: { code: "credential_isolation" } });
    }
  });

  it("rejects arbitrary routes, scopes, tokens, and extra params before dispatch", () => {
    const handlers = createRemiliaCapabilityBrokerHandlers(fakeClient(), { extensionId });
    const invokeHandler = handlers.find((handler) => handler.type === REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE)!;
    for (const extra of [
      { url: "https://evil.example" },
      { scope: "remilia:stats.read" },
      { token: "secret" },
      { credentials: "include" },
    ]) {
      expect(invokeHandler.matches({ ...invokeMessage("getUserProfile", { username: "milady" }), ...extra })).toBe(false);
    }
    expect(invokeHandler.matches(invokeMessage("getUserProfile", { username: "milady", url: "https://evil.example" }))).toBe(false);
  });
});

function declaration(id: AppRemiliaCapabilityDeclaration["id"], operations: AppRemiliaCapabilityDeclaration["operations"]): AppRemiliaCapabilityDeclaration {
  const definition = REMILIA_CAPABILITY_DEFINITIONS[id];
  return { id, operations, scopes: [...definition.scopes], consent: definition.consent, reason: "Required by reviewed package behavior." };
}

function grantMessage(declarations: AppRemiliaCapabilityDeclaration[]) {
  return {
    type: REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE,
    packageId: "tweet-composer-kit",
    grantId,
    manifestSha256,
    packageSource: "reviewedLocal",
    reviewStatus: "reviewed",
    consentAcknowledged: true,
    declarations,
  };
}

function invokeMessage(operation: string, params: Record<string, unknown>) {
  return { type: REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE, packageId: "tweet-composer-kit", grantId, operation, params };
}

function trustedSender(): chrome.runtime.MessageSender {
  return { id: extensionId, frameId: 0, documentId: "document-1", url: "https://x.com/home", tab: { id: 7, url: "https://x.com/home" } as chrome.tabs.Tab };
}

function fakeClient(profileResult: unknown = { ok: true, data: { username: "milady" }, status: 200 }): RemiliaCapabilityClient {
  return {
    getUserProfile: vi.fn(async () => profileResult),
    getMe: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    getMyStats: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    listMyNotifications: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    getMyBeetle: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    getMyBeetleCards: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    pokeUser: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    listGlobalChatMessages: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    postGlobalChatMessage: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    resolveDirectory: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
    listDirectoryUsers: vi.fn(async () => ({ ok: true, data: {}, status: 200 })),
  };
}

async function handle(
  handlers: ReturnType<typeof createRemiliaCapabilityBrokerHandlers>,
  type: string,
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  const handler = handlers.find((candidate) => candidate.type === type)!;
  expect(handler.matches(message)).toBe(true);
  return handler.handle(message as never, sender);
}
