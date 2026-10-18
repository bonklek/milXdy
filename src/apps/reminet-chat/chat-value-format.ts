import type { MediaAttachment } from "./chat-model";
type RuntimeRecord = Record<string, unknown>;
export function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function mediaId(media: MediaAttachment | null): number | null {
  return media?.mediaId || media?.media_id || null;
}

export function formatBody(value: string): string {
  return escapeHtml(value)
    .replace(/\bhttps?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
    .replace(/\n/g, "<br>");
}

export function numberOrUndefined(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function objectValue(value: unknown): RuntimeRecord {
  return value && typeof value === "object" ? value as RuntimeRecord : {};
}

export function asRecord(value: unknown): RuntimeRecord {
  return objectValue(value);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

export function compactText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 1))}...` : compact;
}


export function clampVolume(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.55;
  return Math.max(0, Math.min(2, numeric));
}

export function normalizeThemeMode(value: unknown): "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function normalizePokePlacement(value: unknown): "name" | "both" | "reactions" {
  return value === "name" || value === "both" ? value : "reactions";
}
