import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("RemiNet Chat official REST wiring", () => {
  it("uses official REST for history and text posting without retaining legacy history calls", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const rest = await readFile(new URL("./chat-rest.ts", import.meta.url), "utf8");

    expect(rest).toContain('this.invokeCapability("listGlobalChatMessages"');
    expect(rest).toContain('this.invokeCapability("postGlobalChatMessage"');
    expect(rest).not.toContain('type: "remiliaApi:request"');
    expect(source).toContain("context?.invokeRemiliaCapability");
    expect(source).toContain('if (state.pendingAttachments.length === 0)');
    expect(source).not.toContain('type: "reminetChat:getHistory"');
    expect(source.indexOf('if (state.pendingAttachments.length === 0)'))
      .toBeLessThan(source.indexOf('if (state.socketState !== "open") connectSocket()'));
  });

  it("declares exact broker capabilities, scopes, and consent", async () => {
    const manifests = JSON.parse(await readFile(new URL("../../platform/app-sdk/first-party-apps.json", import.meta.url), "utf8"));
    const chat = manifests.find((candidate: { id?: string }) => candidate.id === "reminetChat");

    expect(chat.remiliaCapabilities).toEqual([
      {
        id: "remilia.chat.read",
        operations: ["listGlobalChatMessages"],
        scopes: ["remilia:chat.read"],
        consent: "enablement",
        reason: expect.any(String),
      },
      {
        id: "remilia.chat.write",
        operations: ["postGlobalChatMessage"],
        scopes: ["remilia:chat.write"],
        consent: "perInvocation",
        reason: expect.any(String),
      },
    ]);
  });

  it("exposes only a named bounded reconciliation hook to the optional realtime adapter", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");

    expect(source).toContain("export function requestOfficialChatReconciliation");
    expect(source).toContain('requestOfficialChatReconciliation("realtime-hint")');
    expect(source).toContain('requestOfficialChatReconciliation("realtime-invalid")');
    expect(source).not.toContain("ingestApiPayload(payload);");
  });

  it("does not surface raw realtime error payloads", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const handler = source.slice(source.indexOf("function handleSocketPortMessage"), source.indexOf("function dispatchLegacyMutation"));

    expect(handler).toContain("parseLegacySocketBridgeEvent(message)");
    expect(handler).toContain('renderStatus("Chat update unavailable.")');
    expect(handler).not.toContain("record.message");
    expect(handler).not.toContain("payload.message");
    expect(handler).not.toContain("socket:frame");
  });

  it("keeps an established session usable across bounded offline retries", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const refresh = source.slice(source.indexOf("async function refreshAuthAndHistory"), source.indexOf("async function loadOlderMessages"));

    expect(refresh).toContain("else if (!state.signedIn)");
    expect(source).toContain("document.hidden");
    expect(source).toContain("updateOfficialPolling()");
    expect(source).toContain("&& state.signedIn");
    expect(source).toContain('kind === "auth-expired" || kind === "missing-scope"');
  });

  it("redacts route, handle, warnings, and raw profile errors before diagnostic persistence", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const runtime = await readFile(new URL("../../platform/runtime/content-runtime.ts", import.meta.url), "utf8");
    const background = await readFile(new URL("../../extension/background/index.ts", import.meta.url), "utf8");
    const socketConnect = source.slice(source.indexOf("function connectSocket"), source.indexOf("function closeSocket"));
    const profileLookup = source.slice(source.indexOf("function queueProfileLookup"), source.indexOf("function profileUserFromResponse"));
    const diagnostic = source.slice(source.indexOf("function recordChatDiagnostic"), source.indexOf("function renderLoadOlderButton"));
    const persistence = runtime.slice(runtime.indexOf("function recordRuntimeDiagnostic"), runtime.indexOf("function loadedAppsByCost"));

    expect(socketConnect).toContain('recordChatDiagnostic("socket.connect", { attempt: state.reconnectAttempts })');
    expect(socketConnect).not.toContain("location.pathname");
    expect(profileLookup).toContain("warningCount:");
    expect(profileLookup).toContain('code: "PROFILE_LOOKUP_FAILED"');
    expect(profileLookup).not.toMatch(/recordChatDiagnostic\("profileLookup(?:Partial|Failed)"[\s\S]{0,160}(?:handle:|warnings:|error:)/u);
    expect(diagnostic).toContain("sanitizeReminetChatDiagnostic(key, value)");
    expect(diagnostic.indexOf("sanitizeReminetChatDiagnostic(key, value)")).toBeLessThan(diagnostic.indexOf("recordDiagnostic(key"));
    expect(persistence).toContain("safeLocalSet(diagnosticStorageEntry(key, value))");
    expect(background).toContain("removeLegacyReminetChatDiagnostics(chrome.storage.local)");
    expect(background.match(/removePersistedLegacyReminetChatDiagnostics\(\);/gu)).toHaveLength(3);
  });
});
