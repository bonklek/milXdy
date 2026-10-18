import { normalizeAccountScope, storageKeyForScope } from "./storage";
export const POKE_STATS_KEY = "pokeStats";
export const POKE_RECEIPT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export type PokeStatistics = { schemaVersion: 1; totalSuccessfulPokes: number; trackedSuccessfulPokes: number; lastSuccessfulPokeAt: number | null; resetAt: number | null };
type StoredPokes = PokeStatistics & { resetVersion: string; ignoreThrough: number; receipts: Array<{ id: string; at: number }> };
type Storage = { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> };
const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const timestamp = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
export function emptyPokeStatistics(): PokeStatistics { return { schemaVersion: 1, totalSuccessfulPokes: 0, trackedSuccessfulPokes: 0, lastSuccessfulPokeAt: null, resetAt: null }; }
function normalize(value: unknown, now: number): StoredPokes {
  const raw = value && typeof value === "object" ? value as Partial<StoredPokes> : {};
  const totalSuccessfulPokes = count(raw.totalSuccessfulPokes);
  return { ...emptyPokeStatistics(), totalSuccessfulPokes, trackedSuccessfulPokes: Math.min(totalSuccessfulPokes, count(raw.trackedSuccessfulPokes)),
    lastSuccessfulPokeAt: timestamp(raw.lastSuccessfulPokeAt) ? raw.lastSuccessfulPokeAt : null, resetAt: timestamp(raw.resetAt) ? raw.resetAt : null,
    resetVersion: typeof raw.resetVersion === "string" ? raw.resetVersion.slice(0, 100) : "", ignoreThrough: timestamp(raw.ignoreThrough) ? raw.ignoreThrough : 0,
    receipts: Array.isArray(raw.receipts) ? raw.receipts.filter(item => item && /^[a-f0-9]{64}$/.test(item.id) && timestamp(item.at) && item.at >= now - POKE_RECEIPT_RETENTION_MS).slice(-256) : [] };
}
/** Read-only summary for future local statistics consumers; no target/receipt detail. */
export async function readPokeStatistics(storage: Pick<Storage, "get">, scope: string | null): Promise<PokeStatistics> {
  if (!normalizeAccountScope(scope)) return emptyPokeStatistics();
  const { resetVersion: _version, receipts: _receipts, ignoreThrough: _floor, ...summary } = normalize(await storage.get(storageKeyForScope(POKE_STATS_KEY, scope)), Date.now());
  return summary;
}
export function createPokeStatisticsStore(storage: Storage, now = Date.now) {
  let pending: Promise<unknown> = Promise.resolve();
  const queue = <T>(work: () => Promise<T>): Promise<T> => { const result = pending.then(work); pending = result.catch(() => undefined); return result; };
  return {
    async capture(scope: string | null) {
      const normalized = normalizeAccountScope(scope);
      if (!normalized) return null;
      const stored = normalize(await storage.get(storageKeyForScope(POKE_STATS_KEY, normalized)), now());
      return { scope: normalized, resetVersion: stored.resetVersion };
    },
    record(snapshot: { scope: string; resetVersion: string } | null, receipt: { target_handle: string; poked_at: number }, tracked: boolean): Promise<boolean> {
      return queue(async () => {
        if (!snapshot || !receipt.target_handle || !timestamp(receipt.poked_at)) return false;
        const at = receipt.poked_at < 1e12 ? receipt.poked_at * 1000 : receipt.poked_at;
        if (at < now() - POKE_RECEIPT_RETENTION_MS || at > now() + 5 * 60 * 1000) return false;
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${receipt.target_handle.toLowerCase()}|${receipt.poked_at}`));
        const id = Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
        const key = storageKeyForScope(POKE_STATS_KEY, snapshot.scope), stored = normalize(await storage.get(key), now());
        if (snapshot.resetVersion !== stored.resetVersion || at <= stored.ignoreThrough || stored.receipts.some(item => item.id === id)) return false;
        stored.totalSuccessfulPokes = Math.min(Number.MAX_SAFE_INTEGER, stored.totalSuccessfulPokes + 1);
        if (tracked) stored.trackedSuccessfulPokes = Math.min(stored.totalSuccessfulPokes, stored.trackedSuccessfulPokes + 1);
        stored.lastSuccessfulPokeAt = Math.max(stored.lastSuccessfulPokeAt || 0, at);
        stored.receipts.push({ id, at }); stored.receipts.sort((a, b) => a.at - b.at);
        while (stored.receipts.length > 256) stored.ignoreThrough = Math.max(stored.ignoreThrough, stored.receipts.shift()!.at);
        await storage.set(key, stored); return true;
      });
    },
    reset(scope: string): Promise<void> {
      return queue(async () => {
        const normalized = normalizeAccountScope(scope); if (!normalized) throw new Error("Choose an X account before resetting poke statistics.");
        const key = storageKeyForScope(POKE_STATS_KEY, normalized), stored = normalize(await storage.get(key), now());
        await storage.set(key, { ...stored, ...emptyPokeStatistics(), resetAt: now(), resetVersion: crypto.randomUUID() });
      });
    },
  };
}
export function normalizePokeStatistics(value: unknown): PokeStatistics {
  const { resetVersion: _version, receipts: _receipts, ignoreThrough: _floor, ...summary } = normalize(value, Date.now()); return summary;
}
/** Content consumers receive only aggregates through their captured SDK message port. */
export async function readPokeStatisticsFromHost(send: ((message: unknown) => Promise<unknown>) | null, scope: string | null): Promise<PokeStatistics> {
  if (!scope || !send) return emptyPokeStatistics();
  const response = await send({ type: "milady:readPokeStats", scope });
  if (!response || typeof response !== "object" || (response as { ok?: unknown }).ok !== true) throw new Error("Poke statistics are unavailable for this account.");
  return normalizePokeStatistics((response as { summary?: unknown }).summary);
}
