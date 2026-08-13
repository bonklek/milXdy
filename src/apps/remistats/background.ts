import { remiliaApiClient } from "../../platform/background/remilia-api-registration";
import { registerBackgroundMessageHandlers } from "../../platform/background/router";
import { RemiStatsOfficialService, type RemiStatsStorage } from "./official-api";

const REMISTATS_MESSAGE_TYPES = new Set([
  "remistats:getMyStats",
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

export const remiStatsOfficialService = new RemiStatsOfficialService(remiliaApiClient, storage);

registerBackgroundMessageHandlers([
  {
    type: "remistats:getMyStats",
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
  | { type: "remistats:markNotificationsRead"; keys: string[] }
  | { type: "beetol:poke"; username: string }
  | { type: "beetol:pokeEligibility"; username: string }
  | { type: "beetol:incomingPokes" };

export function isRemiStatsOfficialMessage(value: unknown): value is RemiStatsOfficialMessage {
  if (!isRecord(value) || typeof value.type !== "string" || !REMISTATS_MESSAGE_TYPES.has(value.type)) return false;
  if (value.type === "beetol:poke" || value.type === "beetol:pokeEligibility") {
    return hasOnlyKeys(value, ["type", "username"]) && typeof value.username === "string";
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
