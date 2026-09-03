import {
  REMILIA_CAPABILITY_DEFINITIONS,
  remiliaCapabilityForOperation,
  validateRemiliaCapabilityDeclarations,
  type AppRemiliaCapabilityDeclaration,
  type RemiliaCapabilityBrokerFailure,
  type RemiliaCapabilityOperation,
  type RemiliaDirectoryIdentifier,
} from "../app-sdk/remilia-capabilities";
import type { BackgroundMessageHandler } from "./router";

export const REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE = "milxdy:remiliaCapability:grant";
export const REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE = "milxdy:remiliaCapability:revoke";
export const REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE = "milxdy:remiliaCapability:invoke";
export const REMILIA_CAPABILITY_GRANT_TTL_MS = 12 * 60 * 60 * 1000;

export type RemiliaCapabilityClient = {
  getUserProfile(username: string, options?: { authenticated?: boolean }): Promise<unknown>;
  getMe(): Promise<unknown>;
  getMyStats(): Promise<unknown>;
  listMyNotifications(options?: { limit?: number; page?: number }): Promise<unknown>;
  getMyBeetle(): Promise<unknown>;
  getMyBeetleCards(): Promise<unknown>;
  pokeUser(handle: string): Promise<unknown>;
  listGlobalChatMessages(options?: { limit?: number; before?: string }): Promise<unknown>;
  postGlobalChatMessage(text: string, replyToId?: string): Promise<unknown>;
  resolveDirectory(identifiers: readonly RemiliaDirectoryIdentifier[]): Promise<unknown>;
  listDirectoryUsers(options?: { limit?: number; cursor?: string }): Promise<unknown>;
};

export type RemiliaCapabilityGrantMessage = {
  type: typeof REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE;
  packageId: string;
  grantId: string;
  manifestSha256: string;
  packageSource: "firstParty" | "reviewedLocal";
  reviewStatus: "reviewed";
  consentAcknowledged: true;
  declarations: AppRemiliaCapabilityDeclaration[];
};

export type RemiliaCapabilityRevokeMessage = {
  type: typeof REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE;
  packageId: string;
  grantId: string;
};

export type RemiliaCapabilityInvokeMessage = {
  type: typeof REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE;
  packageId: string;
  grantId: string;
  operation: RemiliaCapabilityOperation;
  params?: Record<string, unknown>;
  userGesture?: true;
};

type StoredGrant = {
  packageId: string;
  grantId: string;
  manifestSha256: string;
  declarations: AppRemiliaCapabilityDeclaration[];
  senderKey: string;
  expiresAt: number;
  revoked: boolean;
};

export type RemiliaCapabilityBrokerOptions = {
  now?: () => number;
  extensionId?: string;
};

export function createRemiliaCapabilityBrokerHandlers(
  client: RemiliaCapabilityClient,
  options: RemiliaCapabilityBrokerOptions = {},
): readonly BackgroundMessageHandler<RemiliaCapabilityGrantMessage | RemiliaCapabilityRevokeMessage | RemiliaCapabilityInvokeMessage>[] {
  const grants = new Map<string, StoredGrant>();
  const now = options.now ?? Date.now;
  const extensionId = options.extensionId ?? runtimeExtensionId();

  return [
    {
      type: REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE,
      matches: isRemiliaCapabilityGrantMessage,
      handle(message, sender) {
        const grantMessage = message as RemiliaCapabilityGrantMessage;
        const senderKey = trustedSenderKey(sender, extensionId);
        if (!senderKey) return brokerFailure("unauthorized_sender", 403);
        const key = grantKey(senderKey, grantMessage.packageId);
        const previous = grants.get(key);
        if (previous && previous.grantId !== grantMessage.grantId) previous.revoked = true;
        grants.set(key, {
          packageId: grantMessage.packageId,
          grantId: grantMessage.grantId,
          manifestSha256: grantMessage.manifestSha256,
          declarations: structuredClone(grantMessage.declarations),
          senderKey,
          expiresAt: now() + REMILIA_CAPABILITY_GRANT_TTL_MS,
          revoked: false,
        });
        return { ok: true, expiresAt: now() + REMILIA_CAPABILITY_GRANT_TTL_MS };
      },
    },
    {
      type: REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE,
      matches: isRemiliaCapabilityRevokeMessage,
      handle(message, sender) {
        const revokeMessage = message as RemiliaCapabilityRevokeMessage;
        const senderKey = trustedSenderKey(sender, extensionId);
        if (!senderKey) return brokerFailure("unauthorized_sender", 403);
        const grant = grants.get(grantKey(senderKey, revokeMessage.packageId));
        if (!grant || grant.grantId !== revokeMessage.grantId) return brokerFailure("package_not_granted", 403);
        grant.revoked = true;
        grants.delete(grantKey(senderKey, revokeMessage.packageId));
        return { ok: true };
      },
    },
    {
      type: REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE,
      matches: isRemiliaCapabilityInvokeMessage,
      async handle(message, sender) {
        const invokeMessage = message as RemiliaCapabilityInvokeMessage;
        const senderKey = trustedSenderKey(sender, extensionId);
        if (!senderKey) return brokerFailure("unauthorized_sender", 403);
        const grant = grants.get(grantKey(senderKey, invokeMessage.packageId));
        if (!grant || grant.grantId !== invokeMessage.grantId) return brokerFailure("package_not_granted", 403);
        if (grant.revoked || grant.expiresAt <= now()) {
          grants.delete(grantKey(senderKey, invokeMessage.packageId));
          return brokerFailure("grant_revoked", 403);
        }
        const definition = remiliaCapabilityForOperation(invokeMessage.operation);
        if (!definition) return brokerFailure("invalid_request", 400);
        const declaration = grant.declarations.find((candidate) => candidate.id === definition.id);
        if (!declaration) return brokerFailure("capability_not_declared", 403);
        if (!declaration.operations.includes(invokeMessage.operation)) return brokerFailure("operation_not_declared", 403);
        if (!sameStringSet(declaration.scopes, definition.scopes)) return brokerFailure("scope_mismatch", 403);
        if (definition.consent === "perInvocation" && invokeMessage.userGesture !== true) return brokerFailure("consent_required", 403);
        try {
          const result = await dispatchCapabilityOperation(client, invokeMessage.operation, invokeMessage.params ?? {});
          return containsCredentialMaterial(result) ? brokerFailure("credential_isolation", 403) : result as Record<string, unknown>;
        } catch {
          return brokerFailure("client_unavailable", 0);
        }
      },
    },
  ];
}

export function isRemiliaCapabilityGrantMessage(value: unknown): value is RemiliaCapabilityGrantMessage {
  if (!isRecord(value) || !hasOnlyKeys(value, ["type", "packageId", "grantId", "manifestSha256", "packageSource", "reviewStatus", "consentAcknowledged", "declarations"])) return false;
  return value.type === REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE
    && isSafePackageId(value.packageId)
    && isGrantId(value.grantId)
    && typeof value.manifestSha256 === "string" && /^[a-f0-9]{64}$/u.test(value.manifestSha256)
    && (value.packageSource === "firstParty" || value.packageSource === "reviewedLocal")
    && value.reviewStatus === "reviewed"
    && value.consentAcknowledged === true
    && validateRemiliaCapabilityDeclarations(value.declarations);
}

export function isRemiliaCapabilityRevokeMessage(value: unknown): value is RemiliaCapabilityRevokeMessage {
  return isRecord(value)
    && hasOnlyKeys(value, ["type", "packageId", "grantId"])
    && value.type === REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE
    && isSafePackageId(value.packageId)
    && isGrantId(value.grantId);
}

export function isRemiliaCapabilityInvokeMessage(value: unknown): value is RemiliaCapabilityInvokeMessage {
  if (!isRecord(value) || !hasOnlyKeys(value, ["type", "packageId", "grantId", "operation", "params", "userGesture"])) return false;
  if (value.type !== REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE || !isSafePackageId(value.packageId) || !isGrantId(value.grantId)) return false;
  if (typeof value.operation !== "string" || !remiliaCapabilityForOperation(value.operation as RemiliaCapabilityOperation)) return false;
  if (value.userGesture !== undefined && value.userGesture !== true) return false;
  return validOperationParams(value.operation as RemiliaCapabilityOperation, value.params === undefined ? {} : value.params);
}

async function dispatchCapabilityOperation(
  client: RemiliaCapabilityClient,
  operation: RemiliaCapabilityOperation,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (operation) {
    case "getUserProfile": return client.getUserProfile(params.username as string, { authenticated: false });
    case "getMe": return client.getMe();
    case "getMyStats": return client.getMyStats();
    case "listMyNotifications": return client.listMyNotifications({ limit: params.limit as number | undefined, page: params.page as number | undefined });
    case "getMyBeetle": return client.getMyBeetle();
    case "getMyBeetleCards": return client.getMyBeetleCards();
    case "pokeUser": return client.pokeUser(params.handle as string);
    case "listGlobalChatMessages": return client.listGlobalChatMessages({ limit: params.limit as number | undefined, before: params.before as string | undefined });
    case "postGlobalChatMessage": return client.postGlobalChatMessage(params.text as string, params.replyToId as string | undefined);
    case "resolveDirectory": return client.resolveDirectory(params.identifiers as RemiliaDirectoryIdentifier[]);
    case "listDirectoryUsers": return client.listDirectoryUsers({ limit: params.limit as number | undefined, cursor: params.cursor as string | undefined });
  }
}

function validOperationParams(operation: RemiliaCapabilityOperation, value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  switch (operation) {
    case "getUserProfile": return hasOnlyKeys(value, ["username"]) && boundedString(value.username, 1, 128);
    case "getMe":
    case "getMyStats":
    case "getMyBeetle":
    case "getMyBeetleCards": return hasOnlyKeys(value, []);
    case "listMyNotifications": return hasOnlyKeys(value, ["limit", "page"]) && optionalInteger(value.limit, 1, 100) && optionalInteger(value.page, 1, 10_000);
    case "pokeUser": return hasOnlyKeys(value, ["handle"]) && boundedString(value.handle, 1, 128);
    case "listGlobalChatMessages": return hasOnlyKeys(value, ["limit", "before"]) && optionalInteger(value.limit, 1, 100) && optionalBoundedString(value.before, 256);
    case "postGlobalChatMessage": return hasOnlyKeys(value, ["text", "replyToId"]) && boundedUtf8(value.text, 1, 8192) && optionalBoundedString(value.replyToId, 256);
    case "resolveDirectory": return hasOnlyKeys(value, ["identifiers"])
      && Array.isArray(value.identifiers) && value.identifiers.length >= 1 && value.identifiers.length <= 50
      && value.identifiers.every(isDirectoryIdentifier);
    case "listDirectoryUsers": return hasOnlyKeys(value, ["limit", "cursor"]) && optionalInteger(value.limit, 1, 100) && optionalBoundedString(value.cursor, 256);
  }
}

function isDirectoryIdentifier(value: unknown): value is RemiliaDirectoryIdentifier {
  return isRecord(value)
    && hasOnlyKeys(value, ["type", "value"])
    && ["handle", "x_handle", "github", "discord"].includes(String(value.type))
    && boundedString(value.value, 1, 256);
}

function trustedSenderKey(sender: chrome.runtime.MessageSender, extensionId: string): string | null {
  if (!extensionId || sender.id !== extensionId || sender.frameId !== 0 || typeof sender.tab?.id !== "number") return null;
  const senderUrl = sender.url ?? sender.tab.url;
  if (!senderUrl) return null;
  let origin: string;
  try { origin = new URL(senderUrl).origin; } catch { return null; }
  if (origin !== "https://x.com" && origin !== "https://twitter.com") return null;
  const documentId = "documentId" in sender && typeof sender.documentId === "string" ? sender.documentId : "legacy-document";
  return `${sender.tab.id}:${sender.frameId}:${origin}:${documentId}`;
}

function grantKey(senderKey: string, packageId: string): string {
  return `${senderKey}:${packageId}`;
}

function runtimeExtensionId(): string {
  const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: { id?: string } } }).chrome?.runtime;
  return typeof runtime?.id === "string" ? runtime.id : "";
}

function brokerFailure(code: RemiliaCapabilityBrokerFailure["error"]["code"], status: RemiliaCapabilityBrokerFailure["error"]["status"]): RemiliaCapabilityBrokerFailure {
  const messages: Record<typeof code, string> = {
    invalid_request: "The capability request was invalid.",
    unauthorized_sender: "The capability sender was not authorized.",
    package_not_reviewed: "The package is not reviewed for Remilia capabilities.",
    consent_required: "Explicit consent is required for this capability.",
    package_not_granted: "The package has no active capability grant.",
    grant_revoked: "The capability grant is no longer active.",
    capability_not_declared: "The package did not declare this capability.",
    operation_not_declared: "The package did not declare this operation.",
    scope_mismatch: "The package scope declaration does not match the host contract.",
    credential_isolation: "The capability response was rejected by credential isolation.",
    client_unavailable: "The Remilia capability service is unavailable.",
  };
  return { ok: false, error: { category: "broker", code, message: messages[code], status } };
}

function containsCredentialMaterial(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (depth > 12) return true;
  if (typeof value === "string") return /\bBearer\s+[A-Za-z0-9._~+/-]+/iu.test(value);
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsCredentialMaterial(item, seen, depth + 1));
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/gu, "");
    if (["accesstoken", "refreshtoken", "authorization", "cookie", "setcookie", "credentials", "clientsecret"].includes(normalized)) return true;
    if (containsCredentialMaterial(item, seen, depth + 1)) return true;
  }
  return false;
}

function isSafePackageId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
}

function isGrantId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/u.test(value);
}

function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function optionalBoundedString(value: unknown, max: number): boolean {
  return value === undefined || boundedString(value, 1, max);
}

function optionalInteger(value: unknown, min: number, max: number): boolean {
  return value === undefined || (Number.isInteger(value) && Number(value) >= min && Number(value) <= max);
}

function boundedUtf8(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && new TextEncoder().encode(value).byteLength <= max;
}

function sameStringSet(value: readonly string[], expected: readonly string[]): boolean {
  return value.length === expected.length && new Set(value).size === value.length && value.every((item) => expected.includes(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}
