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

  it("clears a stale reconnect warning after an authenticated chat read succeeds", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const controller = source.slice(source.indexOf("function createChatRestController"), source.indexOf("export function requestOfficialChatReconciliation"));
    const clearError = source.slice(source.indexOf("function clearSuccessfulChatReadError"), source.indexOf("function ingestApiPayload"));

    expect(controller).toContain("clearSuccessfulChatReadError()");
    expect(clearError).toContain("Reconnect Remilia from the milXdy popup, then recheck Chat.");
    expect(clearError).toContain("Reconnect Remilia with Chat access from the milXdy popup, then recheck Chat.");
    expect(clearError).toContain('state.composerError = ""');
    expect(clearError).not.toContain("Chat messages must be 8,192 UTF-8 bytes or fewer.");
  });

  it("does not render an edited marker for global chat messages", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const renderer = source.slice(source.indexOf("function renderStackedMessage"), source.indexOf("function messageAuthorId"));

    expect(renderer).not.toContain("editedAt");
    expect(renderer).not.toContain("edited_at");
    expect(renderer).not.toContain("Edited message");
  });

  it("closes a message reaction panel only after the pointer leaves the whole message", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const setup = source.slice(source.indexOf("function createRoot"), source.indexOf("async function refreshAuthAndHistory"));
    const handler = setup.slice(setup.indexOf("function handleChatMessagePointerOut"), setup.indexOf("function handleChatActionClick"));

    expect(setup).toContain('root.addEventListener("pointerout", handleChatMessagePointerOut)');
    expect(handler).toContain("message.contains(nextTarget)");
    expect(handler).toContain("state.activeMessageActionId = null");
    expect(handler).toContain('actions.dataset.open = "false"');
    expect(handler).toContain("focused.blur()");
  });

  it("recognizes the current X Chat container when mounting the messages popout", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const containerLookup = source.slice(source.indexOf("function findDmContainer"), source.indexOf("function findDmListMount"));
    const listLookup = source.slice(source.indexOf("function findDmListMount"), source.indexOf("function findFirstDmConversationRow"));

    expect(containerLookup).toContain('[data-testid="dm-main-container"]');
    expect(containerLookup.indexOf('[data-testid="dm-main-container"]'))
      .toBeLessThan(containerLookup.indexOf('[data-testid="dm-container"]'));
    expect(listLookup).toContain('[data-testid="x-chat-conversation-list"]');
    expect(listLookup).toContain('[role="list"]');
  });

  it("animates translucent controls for existing and new reaction clicks", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const styles = await readFile(new URL("./content.css", import.meta.url), "utf8");
    const reaction = source.slice(source.indexOf("function reactToMessage"), source.indexOf("function renderPokeButton"));

    expect(reaction).toContain("animateReactionInteraction(control)");
    expect(reaction).not.toContain('if (type === "react") animateReactionInteraction(control)');
    expect(reaction).toContain('control.classList.add("milxdy-chat-reaction-pulse")');
    expect(styles).toContain("backdrop-filter: blur(8px)");
    expect(styles).toContain("@keyframes milxdy-chat-reaction-pulse");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("remembers a successful reaction so clicking it again emits unreact", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const reaction = source.slice(source.indexOf("function currentUserReacted"), source.indexOf("function renderPokeButton"));

    expect(reaction).toContain("currentUserReactionStates.get(reactionStateKey(message.id, normalized))");
    expect(reaction).toContain("const nextReacted = !previouslyReacted");
    expect(reaction).toContain('const type = nextReacted ? "react" : "unreact"');
    expect(reaction).toContain("currentUserReactionStates.set(stateKey, nextReacted)");
    expect(reaction).toContain("syncReactionControls(messageId, normalizedEmoji, nextReacted)");
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
