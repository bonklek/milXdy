import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("RemiNet Chat legacy adapter boundary", () => {
  it("keeps text posting on official REST and gates media upload on the optional socket", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const submit = source.slice(source.indexOf("async function submitMessage"), source.indexOf("async function submitOfficialTextMessage"));

    expect(submit).toContain("submitOfficialTextMessage(input, text)");
    expect(submit.indexOf("submitOfficialTextMessage(input, text)")).toBeLessThan(submit.indexOf("uploadPendingAttachments()"));
    expect(submit.indexOf('state.socketState !== "open"')).toBeLessThan(submit.indexOf("uploadPendingAttachments()"));
    expect(submit).toContain("await dispatchLegacyMutation");
    expect(submit).toContain("legacyMediaSubmitMutation");
    expect(submit).not.toContain("postGlobalChatMessage");
    const mediaSubmit = source.slice(source.indexOf("async function submitUploadedLegacyMedia"), source.indexOf("async function submitOfficialTextMessage"));
    expect(mediaSubmit.indexOf("await dispatchLegacyMutation")).toBeLessThan(mediaSubmit.indexOf("clearPendingAttachments()"));
    expect(mediaSubmit.indexOf("if (!sent.ok)")).toBeLessThan(mediaSubmit.indexOf("clearPendingAttachments()"));
  });

  it("preserves pending attachments and never sends local names or raw adapter errors", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const upload = source.slice(source.indexOf("async function uploadPendingAttachments"), source.indexOf("function clearPendingAttachments"));

    expect(upload).toContain('type: "reminetChat:legacy:uploadAttachment"');
    expect(upload).not.toContain("name: attachment.name");
    expect(upload).toContain("parseLegacyMediaUploadOutcome(response)");
    expect(upload).toContain("attachment.uploadedMedia = media");
    expect(upload.indexOf("if (attachment.uploadedMedia)")).toBeLessThan(upload.indexOf('attachment.status = "uploading"'));
    expect(upload).not.toContain("String(response.error");
  });

  it("ingests only body-free validated hints as reconciliation triggers", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");
    const handler = source.slice(source.indexOf("function handleSocketPortMessage"), source.indexOf("function dispatchLegacyMutation"));

    expect(handler).toContain("parseLegacySocketBridgeEvent(message)");
    expect(handler).toContain('requestOfficialChatReconciliation("realtime-hint")');
    expect(handler).toContain('requestOfficialChatReconciliation("realtime-invalid")');
    expect(handler).not.toContain("socket:frame");
    expect(handler).not.toContain("event.data");
  });

  it("uses explicit connection and authorization wording for recovery", async () => {
    const source = await readFile(new URL("./content.ts", import.meta.url), "utf8");

    expect(source).toContain("Checking Remilia Chat authorization...");
    expect(source).toContain("Remilia Chat authorization is required.");
    expect(source).toContain('data-chat-action="retry-connection"');
    expect(source).not.toMatch(/Retry session|browser session|retry-session/iu);
  });

  it("removes dormant legacy history authority from the background", async () => {
    const background = await readFile(new URL("./background.ts", import.meta.url), "utf8");

    expect(background).not.toContain("reminetChat:getHistory");
    expect(background).not.toContain("/api/chats/");
    expect(background).not.toContain("reminetChat:prepareSocket");
    expect(background).not.toContain("prepareSocketAuth");
    expect(background).not.toContain("refreshRemiliaAccess");
    expect(background).toContain('isAllowedLegacySender(sender, "runtime-content")');
    expect(background).toContain('isAllowedLegacySender(sender, "x-content")');
    expect(background).toContain("Object.keys(record)");
  });
});
