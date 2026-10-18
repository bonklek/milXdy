import type { RemiliaApiNotification } from "../../platform/auth/remilia-api";
import type { RemiStatsStorage, StoredNotificationReadState } from "./official-api-contract";

export async function readNotificationReadState(
  storage: RemiStatsStorage,
  storageKey: string,
  maximumEntries: number,
): Promise<StoredNotificationReadState> {
  const value = await storage.get(storageKey);
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
    return { schemaVersion: 1, entries: [] };
  }
  const entries = value.entries
    .filter((entry): entry is { key: string; readAt: number } => isRecord(entry) && isNotificationKey(entry.key) && isFiniteNumber(entry.readAt))
    .sort((left, right) => right.readAt - left.readAt || left.key.localeCompare(right.key))
    .slice(0, maximumEntries);
  return { schemaVersion: 1, entries };
}

export async function notificationKey(notification: RemiliaApiNotification): Promise<string> {
  const canonical = JSON.stringify([
    notification.type, notification.created_at, notification.from?.handle ?? "", notification.from?.display_name ?? "",
    notification.count ?? null, notification.guild_name ?? "", notification.message ?? "",
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return `notification:v1:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function isNotificationKey(value: unknown): value is string {
  return typeof value === "string" && /^notification:v1:[a-f0-9]{64}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
