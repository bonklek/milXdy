import { describe, expect, it } from "vitest";
import {
  LEGACY_REMINET_CHAT_DIAGNOSTIC_KEYS,
  diagnosticStorageEntry,
  removeLegacyReminetChatDiagnostics,
  sanitizeReminetChatDiagnostic,
} from "./reminet-chat-diagnostics";

const hostilePath = "/@private/status/123456789/messages/987654321?token=secret";
const hostileProfile = "private-handle raw upstream warning bearer-secret";

describe("RemiNet Chat diagnostic persistence", () => {
  it("keeps only a bounded attempt and stable common state for socket connection", () => {
    expect(sanitizeReminetChatDiagnostic("socket.connect", {
      attempt: 9_999,
      route: hostilePath,
      handle: "private-handle",
      url: `https://x.com${hostilePath}`,
      messageId: "987654321",
      socketState: "connecting",
      signedIn: true,
      visibleState: "none",
      updatedAt: 123,
      error: hostileProfile,
    })).toEqual({
      attempt: 255,
      socketState: "connecting",
      signedIn: true,
      visibleState: "none",
      updatedAt: 123,
    });
  });

  it("reduces partial and failed profile lookups to bounded stable outcomes", () => {
    expect(sanitizeReminetChatDiagnostic("profileLookupPartial", {
      handle: "private-handle",
      warnings: [hostileProfile],
      warningCount: 9_999,
      response: { body: hostileProfile },
      signedIn: true,
    })).toEqual({ outcome: "partial", warningCount: 255, signedIn: true });

    expect(sanitizeReminetChatDiagnostic("profileLookupFailed", {
      handle: "private-handle",
      error: hostileProfile,
      code: hostileProfile,
      responseBody: hostileProfile,
      signedIn: false,
    })).toEqual({ outcome: "failed", code: "PROFILE_LOOKUP_FAILED", signedIn: false });
  });

  it("sanitizes hostile Chat values before constructing the local storage entry", () => {
    const entry = diagnosticStorageEntry("reminetChat.profileLookupFailed", {
      handle: "private-handle",
      warnings: [hostileProfile],
      error: hostileProfile,
      route: hostilePath,
      body: hostileProfile,
      socketState: "open",
      signedIn: true,
      visibleState: "failed",
      updatedAt: 456,
    });

    expect(entry).toEqual({
      "milxdy.diagnostics.reminetChat.profileLookupFailed": {
        outcome: "failed",
        code: "PROFILE_LOOKUP_FAILED",
        socketState: "open",
        signedIn: true,
        visibleState: "failed",
        updatedAt: 456,
      },
    });
    expect(JSON.stringify(entry)).not.toContain(hostilePath);
    expect(JSON.stringify(entry)).not.toContain(hostileProfile);
    expect(JSON.stringify(entry)).not.toContain("private-handle");
  });

  it("removes only hostile legacy Chat diagnostic values and is idempotent", async () => {
    const values: Record<string, unknown> = {
      [LEGACY_REMINET_CHAT_DIAGNOSTIC_KEYS[0]]: { route: hostilePath, messageId: "987654321" },
      [LEGACY_REMINET_CHAT_DIAGNOSTIC_KEYS[1]]: { handle: "private-handle", warnings: [hostileProfile] },
      [LEGACY_REMINET_CHAT_DIAGNOSTIC_KEYS[2]]: { handle: "private-handle", error: hostileProfile, body: hostileProfile },
      "milxdy.diagnostics.reminetChat.official-rest": { operation: "list", ok: true },
      "milxdy.reminetChat.enabled": false,
      "unrelated.setting": "keep-me",
    };
    const storage = {
      get: async (keys: string[]) => Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])),
      remove: async (keys: string[]) => {
        for (const key of keys) delete values[key];
      },
    };

    expect(await removeLegacyReminetChatDiagnostics(storage)).toEqual([...LEGACY_REMINET_CHAT_DIAGNOSTIC_KEYS]);
    expect(await removeLegacyReminetChatDiagnostics(storage)).toEqual([]);
    expect(values).toEqual({
      "milxdy.diagnostics.reminetChat.official-rest": { operation: "list", ok: true },
      "milxdy.reminetChat.enabled": false,
      "unrelated.setting": "keep-me",
    });
    expect(JSON.stringify(values)).not.toContain(hostilePath);
    expect(JSON.stringify(values)).not.toContain(hostileProfile);
  });
});
