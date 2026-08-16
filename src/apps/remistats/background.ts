import { remiliaApiClient } from "../../platform/background/remilia-api-registration";
import { registerBackgroundMessageHandlers } from "../../platform/background/router";
import { getRemiliaAuthStatus } from "../../platform/auth/remilia-auth";
import { RemiStatsOfficialService, type RemiStatsStorage } from "./official-api";

const REMISTATS_MESSAGE_TYPES = new Set([
  "remistats:getMyStats",
  "remistats:getMyStatsForXProfile",
  "remistats:resolveProfileIdentity",
  "remistats:resolvePokeTargets",
  "remistats:pokeXAuthor",
  "remistats:markNotificationsRead",
  "beetol:poke",
  "beetol:pokeEligibility",
  "beetol:incomingPokes",
]);

const storage: RemiStatsStorage = {
  async get(key) {
    const value = await chrome.storage.local.get(key);
    return value[key];
  },
  set(key, value) {
    return chrome.storage.local.set({ [key]: value });
  },
  remove(key) {
    return chrome.storage.local.remove(key);
  },
};

export const remiStatsOfficialService = new RemiStatsOfficialService(
  remiliaApiClient,
  storage,
  Date.now,
  getRemiliaAuthStatus,
);

registerBackgroundMessageHandlers([
  {
    type: "remistats:getMyStats",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "remistats:getMyStatsForXProfile",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "remistats:resolveProfileIdentity",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "remistats:resolvePokeTargets",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "remistats:pokeXAuthor",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "remistats:markNotificationsRead",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "beetol:poke",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "beetol:pokeEligibility",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
  {
    type: "beetol:incomingPokes",
    matches: isRemiStatsOfficialMessage,
    handle: handleRemiStatsOfficialMessage,
  },
]);

export type RemiStatsOfficialMessage =
  | { type: "remistats:getMyStats" }
  | { type: "remistats:getMyStatsForXProfile"; xHandle: string }
  | { type: "remistats:resolveProfileIdentity"; xHandle: string }
  | { type: "remistats:resolvePokeTargets"; xHandles: string[] }
  | { type: "remistats:pokeXAuthor"; xHandle: string; expectedRemiliaUsername: string }
  | { type: "remistats:markNotificationsRead"; keys: string[] }
  | { type: "beetol:poke"; username: string }
  | { type: "beetol:pokeEligibility"; username: string }
  | { type: "beetol:incomingPokes" };

export function isRemiStatsOfficialMessage(value: unknown): value is RemiStatsOfficialMessage {
  if (!isRecord(value) || typeof value.type !== "string" || !REMISTATS_MESSAGE_TYPES.has(value.type)) return false;
  if (value.type === "beetol:poke" || value.type === "beetol:pokeEligibility") {
    return hasOnlyKeys(value, ["type", "username"]) && typeof value.username === "string";
  }
  if (value.type === "remistats:getMyStatsForXProfile" || value.type === "remistats:resolveProfileIdentity") {
    return hasOnlyKeys(value, ["type", "xHandle"]) && typeof value.xHandle === "string";
  }
  if (value.type === "remistats:resolvePokeTargets") {
    return hasOnlyKeys(value, ["type", "xHandles"])
      && Array.isArray(value.xHandles)
      && value.xHandles.length <= 50
      && value.xHandles.every((xHandle) => typeof xHandle === "string");
  }
  if (value.type === "remistats:pokeXAuthor") {
    return hasOnlyKeys(value, ["type", "xHandle", "expectedRemiliaUsername"])
      && typeof value.xHandle === "string"
      && typeof value.expectedRemiliaUsername === "string";
  }
  if (value.type === "remistats:markNotificationsRead") {
    return hasOnlyKeys(value, ["type", "keys"])
      && Array.isArray(value.keys)
      && value.keys.length <= 100
      && value.keys.every((key) => typeof key === "string");
  }
  return hasOnlyKeys(value, ["type"]);
}

async function handleRemiStatsOfficialMessage(
  message: RemiStatsOfficialMessage,
  sender: chrome.runtime.MessageSender,
): Promise<Record<string, unknown>> {
  if (!isTrustedRemiStatsSender(sender)) return invalidRequest();
  switch (message.type) {
    case "remistats:getMyStats":
      return remiStatsOfficialService.getMyStats();
    case "remistats:getMyStatsForXProfile":
      return remiStatsOfficialService.getMyStatsForXProfile(message.xHandle);
    case "remistats:resolveProfileIdentity":
      return remiStatsOfficialService.resolveProfileIdentity(message.xHandle);
    case "remistats:resolvePokeTargets":
      return remiStatsOfficialService.resolvePokeTargets(message.xHandles);
    case "remistats:pokeXAuthor":
      return remiStatsOfficialService.pokeXAuthor(message.xHandle, message.expectedRemiliaUsername);
    case "remistats:markNotificationsRead":
      return remiStatsOfficialService.markNotificationsRead(message.keys);
    case "beetol:poke":
      return remiStatsOfficialService.pokeUser(message.username);
    case "beetol:pokeEligibility":
      return remiStatsOfficialService.getPokeEligibility(message.username);
    case "beetol:incomingPokes":
      return remiStatsOfficialService.getIncomingPokes();
  }
}

function isTrustedRemiStatsSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (!sender.tab) {
    const source = sender.url || sender.origin || "";
    try {
      return new URL(source).origin === new URL(chrome.runtime.getURL("")).origin;
    } catch {
      return false;
    }
  }
  if (typeof sender.tab.id !== "number" || (sender.frameId !== undefined && sender.frameId !== 0)) return false;
  const source = sender.url || sender.origin || sender.tab.url || "";
  try {
    const url = new URL(source);
    return url.protocol === "https:" && (url.hostname === "x.com" || url.hostname === "twitter.com");
  } catch {
    return false;
  }
}

function invalidRequest(): Record<string, unknown> {
  return {
    ok: false,
    source: "official",
    error: "invalid_request",
    message: "The Remilia API request was invalid.",
    status: 400,
    category: "request",
    code: "invalid_request",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}
