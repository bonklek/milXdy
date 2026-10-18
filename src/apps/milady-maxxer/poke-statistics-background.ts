import { REMILIA_SCOPE_POKES_WRITE } from "../../platform/auth/remilia-api-contract";
import { loadActiveAccountScope, normalizeHandle, storageKeyForScope } from "./shared/storage";
import { createPokeStatisticsStore } from "./shared/poke-statistics";
import type { RemiStatsPokeResult } from "../remistats/official-api-contract";
export const maxxerPokeStorage = {
  async get(key: string): Promise<unknown> { return (await chrome.storage.local.get(key))[key]; },
  set: (key: string, value: unknown) => chrome.storage.local.set({ [key]: value }),
};
export const maxxerPokeStatistics = createPokeStatisticsStore(maxxerPokeStorage);
/** Only the background's validated official success can advance the counters. */
export async function recordMaxxerPoke(action: () => Promise<RemiStatsPokeResult>, verifiedXHandle?: string, expectedTarget?: string): Promise<RemiStatsPokeResult> {
  let snapshot: Awaited<ReturnType<typeof maxxerPokeStatistics.capture>> = null, captureFailed = false;
  try { snapshot = await maxxerPokeStatistics.capture(await loadActiveAccountScope()); } catch { captureFailed = true; }
  const result = await action();
  if (!result.ok || result.source !== "official" || result.scope !== REMILIA_SCOPE_POKES_WRITE || result.status < 200 || result.status >= 300
    || expectedTarget && result.data.target_handle.toLowerCase() !== expectedTarget.toLowerCase()) return result;
  if (!snapshot) return captureFailed ? { ...result, localPokeStatsRecorded: false } : result;
  try {
    const handle = normalizeHandle(verifiedXHandle);
    const matched = await maxxerPokeStorage.get(storageKeyForScope("matchedAccounts", snapshot.scope));
    const tracked = !!handle && !!matched && typeof matched === "object" && Object.hasOwn(matched, handle);
    await maxxerPokeStatistics.record(snapshot, result.data, tracked);
    return { ...result, localPokeStatsRecorded: true };
  } catch { return { ...result, localPokeStatsRecorded: false }; }
}
