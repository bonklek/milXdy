/** The RemiStats host wire contract uses elapsed milliseconds and Unix-ms deadlines. */
export function normalizePokeDeadlineMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  // Compatibility repair for old builds that multiplied a Unix-ms deadline by 1,000.
  return value >= 100_000_000_000_000 ? value / 1000 : value;
}
export function readPokeCooldownMs(value: unknown, now = Date.now()): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const response = value as Record<string, unknown>;
  if (response.authRequired || response.scopeRequired) return 0;
  const deadline = normalizePokeDeadlineMs(response.cooldownUntil);
  // A deadline remains authoritative after latency or expiry; never restart its old duration.
  if (deadline !== null) return Math.max(0, deadline - now);
  for (const duration of [response.cooldownMs, response.retryAfterMs]) {
    if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) return duration;
  }
  return 0;
}
export function formatPokeCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600), minutes = Math.floor(totalSeconds % 3600 / 60);
  return hours > 0 ? `${hours}h` : minutes > 0 ? `${minutes}m` : `${totalSeconds % 60}s`;
}
