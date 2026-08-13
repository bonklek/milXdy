import {
  type RemiliaApiClient,
  type RemiliaApiDirectoryIdentifier,
  type RemiliaApiFailure,
  type RemiliaApiOperation,
} from "../auth/remilia-api";
import type { BackgroundMessageHandler } from "./router";

export const REMILIA_API_ROUTER_MESSAGE_TYPE = "remiliaApi:request";

export type RemiliaApiRouterMessage = {
  type: typeof REMILIA_API_ROUTER_MESSAGE_TYPE;
  operation: RemiliaApiOperation;
  params?: Record<string, unknown>;
};

export function createRemiliaApiRouterHandlers(client: RemiliaApiClient): readonly BackgroundMessageHandler<RemiliaApiRouterMessage>[] {
  return [{
    type: REMILIA_API_ROUTER_MESSAGE_TYPE,
    matches: isRemiliaApiRouterMessage,
    handle: (message, sender) => routeRemiliaApiMessage(client, message, sender),
  }];
}

export function isRemiliaApiRouterMessage(value: unknown): value is RemiliaApiRouterMessage {
  if (!isRecord(value) || !hasOnlyKeys(value, ["type", "operation", "params"])) return false;
  if (value.type !== REMILIA_API_ROUTER_MESSAGE_TYPE || typeof value.operation !== "string") return false;
  const params = value.params === undefined ? {} : value.params;
  if (!isRecord(params)) return false;
  switch (value.operation) {
    case "getUserProfile":
      return hasOnlyKeys(params, ["username", "authenticated"])
        && typeof params.username === "string"
        && (params.authenticated === undefined || typeof params.authenticated === "boolean");
    case "getMe":
    case "getMyStats":
    case "getMyBeetle":
    case "getMyBeetleCards":
      return hasOnlyKeys(params, []);
    case "listMyNotifications":
      return hasOnlyKeys(params, ["limit", "page"])
        && optionalNumber(params.limit) && optionalNumber(params.page);
    case "pokeUser":
      return hasOnlyKeys(params, ["handle"]) && typeof params.handle === "string";
    case "listGlobalChatMessages":
      return hasOnlyKeys(params, ["limit", "before"])
        && optionalNumber(params.limit) && optionalString(params.before);
    case "postGlobalChatMessage":
      return hasOnlyKeys(params, ["text", "replyToId"])
        && typeof params.text === "string" && optionalString(params.replyToId);
    case "resolveDirectory":
      return hasOnlyKeys(params, ["identifiers"])
        && Array.isArray(params.identifiers) && params.identifiers.every(isDirectoryIdentifierShape);
    case "listDirectoryUsers":
      return hasOnlyKeys(params, ["limit", "cursor"])
        && optionalNumber(params.limit) && optionalString(params.cursor);
    default:
      return false;
  }
}

async function routeRemiliaApiMessage(
  client: RemiliaApiClient,
  message: RemiliaApiRouterMessage,
  sender: chrome.runtime.MessageSender,
): Promise<Record<string, unknown>> {
  if (!isTrustedExtensionSender(sender)) return invalidRouterRequest();
  const params = message.params ?? {};
  switch (message.operation) {
    case "getUserProfile":
      return client.getUserProfile(params.username as string, { authenticated: params.authenticated === true });
    case "getMe":
      return client.getMe();
    case "getMyStats":
      return client.getMyStats();
    case "listMyNotifications":
      return client.listMyNotifications({ limit: params.limit as number | undefined, page: params.page as number | undefined });
    case "getMyBeetle":
      return client.getMyBeetle();
    case "getMyBeetleCards":
      return client.getMyBeetleCards();
    case "pokeUser":
      return client.pokeUser(params.handle as string);
    case "listGlobalChatMessages":
      return client.listGlobalChatMessages({ limit: params.limit as number | undefined, before: params.before as string | undefined });
    case "postGlobalChatMessage":
      return client.postGlobalChatMessage(params.text as string, params.replyToId as string | undefined);
    case "resolveDirectory":
      return client.resolveDirectory(params.identifiers as RemiliaApiDirectoryIdentifier[]);
    case "listDirectoryUsers":
      return client.listDirectoryUsers({ limit: params.limit as number | undefined, cursor: params.cursor as string | undefined });
  }
}

function isTrustedExtensionSender(sender: chrome.runtime.MessageSender): boolean {
  return typeof chrome.runtime.id === "string" && sender.id === chrome.runtime.id;
}

function invalidRouterRequest(): RemiliaApiFailure {
  return {
    ok: false,
    error: {
      category: "request",
      code: "invalid_request",
      message: "The Remilia API request was invalid.",
      status: 400,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === "number";
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isDirectoryIdentifierShape(value: unknown): boolean {
  return isRecord(value) && hasOnlyKeys(value, ["type", "value"])
    && ["handle", "x_handle", "github", "discord"].includes(String(value.type))
    && typeof value.value === "string";
}
