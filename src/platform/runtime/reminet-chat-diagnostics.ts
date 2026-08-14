const CHAT_DIAGNOSTIC_MAX_COUNT = 255;
const CHAT_DIAGNOSTIC_STORAGE_PREFIX = "reminetChat.";
const SOCKET_STATES = new Set(["closed", "connecting", "open"]);
const VISIBLE_STATES = new Set(["none", "recovering", "auth-required", "failed"]);

export const LEGACY_REMINET_CHAT_DIAGNOSTIC_KEYS = [
  "milxdy.diagnostics.reminetChat.socket.connect",
  "milxdy.diagnostics.reminetChat.profileLookupPartial",
  "milxdy.diagnostics.reminetChat.profileLookupFailed",
] as const;

type DiagnosticRecord = Readonly<Record<string, unknown>>;
type DiagnosticMigrationStorage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  remove(keys: string[]): Promise<void>;
};

export function sanitizeReminetChatDiagnostic(key: string, value: unknown): Record<string, unknown> {
  const record = isRecord(value) ? value : {};
  const common = stableCommonMetadata(record);
  if (key === "socket.connect") {
    return { attempt: boundedCount(record.attempt), ...common };
  }
  if (key === "profileLookupPartial") {
    return { outcome: "partial", warningCount: boundedCount(record.warningCount), ...common };
  }
  if (key === "profileLookupFailed") {
    return { outcome: "failed", code: "PROFILE_LOOKUP_FAILED", ...common };
  }
  return { ...record };
}

export function diagnosticStorageEntry(key: string, value: unknown): Record<string, unknown> {
  const storedValue = key.startsWith(CHAT_DIAGNOSTIC_STORAGE_PREFIX)
    ? sanitizeReminetChatDiagnostic(key.slice(CHAT_DIAGNOSTIC_STORAGE_PREFIX.length), value)
    : value;
  return { [`milxdy.diagnostics.${key}`]: storedValue };
}

export async function removeLegacyReminetChatDiagnostics(storage: DiagnosticMigrationStorage): Promise<string[]> {
  const keys = [...LEGACY_REMINET_CHAT_DIAGNOSTIC_KEYS];
  const stored = await storage.get(keys);
  const present = keys.filter((key) => Object.prototype.hasOwnProperty.call(stored, key));
  if (present.length) await storage.remove(present);
  return present;
}

function stableCommonMetadata(record: DiagnosticRecord): Record<string, unknown> {
  const updatedAt = finiteNonNegativeInteger(record.updatedAt);
  return {
    ...(SOCKET_STATES.has(String(record.socketState)) ? { socketState: record.socketState } : {}),
    ...(typeof record.signedIn === "boolean" ? { signedIn: record.signedIn } : {}),
    ...(VISIBLE_STATES.has(String(record.visibleState)) ? { visibleState: record.visibleState } : {}),
    ...(updatedAt === undefined ? {} : { updatedAt }),
  };
}

function boundedCount(value: unknown): number {
  return Math.min(CHAT_DIAGNOSTIC_MAX_COUNT, finiteNonNegativeInteger(value) ?? 0);
}

function finiteNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}

function isRecord(value: unknown): value is DiagnosticRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
