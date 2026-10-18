export const REMILIA_CAPABILITY_IDS = [
  "remilia.profile.public",
  "remilia.profile.me",
  "remilia.directory.read",
  "remilia.stats.read",
  "remilia.notifications.read",
  "remilia.pokes.write",
  "remilia.beetle.read",
  "remilia.chat.read",
  "remilia.chat.write",
] as const;

export type RemiliaCapabilityId = typeof REMILIA_CAPABILITY_IDS[number];

export const REMILIA_CAPABILITY_OPERATIONS = [
  "getUserProfile",
  "getMe",
  "getMyStats",
  "listMyNotifications",
  "getMyBeetle",
  "getMyBeetleCards",
  "pokeUser",
  "listGlobalChatMessages",
  "postGlobalChatMessage",
  "resolveDirectory",
  "listDirectoryUsers",
] as const;

export type RemiliaCapabilityOperation = typeof REMILIA_CAPABILITY_OPERATIONS[number];

export const REMILIA_OFFICIAL_SCOPES = [
  "remilia:stats.read",
  "remilia:notifications.read",
  "remilia:pokes.write",
  "remilia:beetle.read",
  "remilia:chat.read",
  "remilia:chat.write",
  "remilia:directory.read",
] as const;

export type RemiliaOfficialScope = typeof REMILIA_OFFICIAL_SCOPES[number];
export type RemiliaCapabilityConsent = "enablement" | "perInvocation";

export type AppRemiliaCapabilityDeclaration = {
  id: RemiliaCapabilityId;
  operations: RemiliaCapabilityOperation[];
  /** Exact official delegated scopes. Public profile operations declare an empty array. */
  scopes: RemiliaOfficialScope[];
  consent: RemiliaCapabilityConsent;
  reason: string;
};

export type RemiliaDirectoryIdentifier = {
  type: "handle" | "x_handle" | "github" | "discord";
  value: string;
};

export type RemiliaCapabilityParams = {
  getUserProfile: { username: string };
  getMe: Record<string, never>;
  getMyStats: Record<string, never>;
  listMyNotifications: { limit?: number; page?: number };
  getMyBeetle: Record<string, never>;
  getMyBeetleCards: Record<string, never>;
  pokeUser: { handle: string };
  listGlobalChatMessages: { limit?: number; before?: string };
  postGlobalChatMessage: { text: string; replyToId?: string };
  resolveDirectory: { identifiers: RemiliaDirectoryIdentifier[] };
  listDirectoryUsers: { limit?: number; cursor?: string };
};

export type RemiliaCapabilityBrokerErrorCode =
  | "invalid_request"
  | "unauthorized_sender"
  | "package_not_reviewed"
  | "consent_required"
  | "package_not_granted"
  | "grant_revoked"
  | "capability_not_declared"
  | "operation_not_declared"
  | "scope_mismatch"
  | "credential_isolation"
  | "client_unavailable";

export type RemiliaCapabilityBrokerFailure = {
  ok: false;
  error: {
    category: "broker";
    code: RemiliaCapabilityBrokerErrorCode;
    message: string;
    status: 0 | 400 | 401 | 403;
  };
};

export type RemiliaCapabilityBrokerResult<T = unknown> =
  | { ok: true; data: T; status: number; rateLimit?: { limit?: number; remaining?: number; resetAt?: number } }
  | { ok: false; error: { category: string; code: string; message: string; status: number; retryAfterMs?: number; nextAllowedAt?: number } }
  | RemiliaCapabilityBrokerFailure;

export type RemiliaCapabilityDefinition = {
  id: RemiliaCapabilityId;
  operations: readonly RemiliaCapabilityOperation[];
  scopes: readonly RemiliaOfficialScope[];
  consent: RemiliaCapabilityConsent;
};

export const REMILIA_CAPABILITY_DEFINITIONS = {
  "remilia.profile.public": {
    id: "remilia.profile.public",
    operations: ["getUserProfile"],
    scopes: [],
    consent: "enablement",
  },
  "remilia.profile.me": {
    id: "remilia.profile.me",
    operations: ["getMe"],
    scopes: [],
    consent: "enablement",
  },
  "remilia.directory.read": {
    id: "remilia.directory.read",
    operations: ["resolveDirectory", "listDirectoryUsers"],
    scopes: ["remilia:directory.read"],
    consent: "enablement",
  },
  "remilia.stats.read": {
    id: "remilia.stats.read",
    operations: ["getMyStats"],
    scopes: ["remilia:stats.read"],
    consent: "enablement",
  },
  "remilia.notifications.read": {
    id: "remilia.notifications.read",
    operations: ["listMyNotifications"],
    scopes: ["remilia:notifications.read"],
    consent: "enablement",
  },
  "remilia.pokes.write": {
    id: "remilia.pokes.write",
    operations: ["pokeUser"],
    scopes: ["remilia:pokes.write"],
    consent: "perInvocation",
  },
  "remilia.beetle.read": {
    id: "remilia.beetle.read",
    operations: ["getMyBeetle", "getMyBeetleCards"],
    scopes: ["remilia:beetle.read"],
    consent: "enablement",
  },
  "remilia.chat.read": {
    id: "remilia.chat.read",
    operations: ["listGlobalChatMessages"],
    scopes: ["remilia:chat.read"],
    consent: "enablement",
  },
  "remilia.chat.write": {
    id: "remilia.chat.write",
    operations: ["postGlobalChatMessage"],
    scopes: ["remilia:chat.write"],
    consent: "perInvocation",
  },
} as const satisfies Readonly<Record<RemiliaCapabilityId, RemiliaCapabilityDefinition>>;

export function validateRemiliaCapabilityDeclarations(value: unknown): value is AppRemiliaCapabilityDeclaration[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > REMILIA_CAPABILITY_IDS.length) return false;
  const ids = new Set<string>();
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, ["id", "operations", "scopes", "consent", "reason"])) return false;
    const definition = REMILIA_CAPABILITY_DEFINITIONS[candidate.id as RemiliaCapabilityId];
    if (!definition || ids.has(definition.id)) return false;
    ids.add(definition.id);
    if (candidate.consent !== definition.consent) return false;
    if (typeof candidate.reason !== "string" || candidate.reason.trim().length < 8 || candidate.reason.length > 280) return false;
    if (!sameStringSet(candidate.scopes, definition.scopes)) return false;
    if (!Array.isArray(candidate.operations) || candidate.operations.length === 0 || new Set(candidate.operations).size !== candidate.operations.length) return false;
    if (!candidate.operations.every((operation) => (definition.operations as readonly RemiliaCapabilityOperation[]).includes(operation as RemiliaCapabilityOperation))) return false;
  }
  return true;
}

export function remiliaCapabilityForOperation(operation: RemiliaCapabilityOperation): RemiliaCapabilityDefinition | null {
  return Object.values(REMILIA_CAPABILITY_DEFINITIONS).find((definition) => (definition.operations as readonly RemiliaCapabilityOperation[]).includes(operation)) ?? null;
}

function sameStringSet(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && new Set(value).size === value.length
    && value.every((item) => typeof item === "string" && expected.includes(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}
