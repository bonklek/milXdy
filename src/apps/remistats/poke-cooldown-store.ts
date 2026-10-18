import { normalizePokeDeadlineMs } from "./poke-cooldown-time";
import type { RemiStatsStorage, StoredPokeCooldown, StoredPokeCooldownState } from "./official-api-contract";

type CooldownMutator = (state: StoredPokeCooldownState) => boolean;

export class PokeCooldownStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: RemiStatsStorage,
    private readonly now: () => number,
    private readonly account: () => Promise<string>,
    private readonly storageKey: string,
  ) {}

  async store(handle: string, until: number, account?: string): Promise<void> {
    const namespace = account ?? await this.currentAccount();
    await this.mutate((state) => {
      const targets = state.accounts[namespace] ||= {};
      targets[handle.toLowerCase()] = { until, observedAt: this.now(), source: "official" };
      return true;
    });
  }

  async remove(handle: string, account?: string): Promise<void> {
    const namespace = account ?? await this.currentAccount();
    const key = handle.toLowerCase();
    if (!key) return;
    await this.mutate((state) => {
      const targets = state.accounts[namespace];
      if (!targets || !Object.hasOwn(targets, key)) return false;
      delete targets[key];
      if (Object.keys(targets).length === 0) delete state.accounts[namespace];
      return true;
    });
  }

  async get(handle: string, account?: string): Promise<StoredPokeCooldown | null> {
    const namespace = account ?? await this.currentAccount();
    const state = await this.read();
    return state.accounts[namespace]?.[handle.toLowerCase()] ?? null;
  }

  async currentAccount(): Promise<string> {
    return (await this.account()) || "__anonymous__";
  }

  private async read(): Promise<StoredPokeCooldownState> {
    const value = await this.storage.get(this.storageKey);
    if (!isRecord(value)) return { schemaVersion: 3, accounts: {} };
    if (value.schemaVersion === 2 && isRecord(value.targets)) {
      const targets = parseTargets(value.targets);
      return { schemaVersion: 3, accounts: Object.keys(targets).length === 0 ? {} : { __anonymous__: targets } };
    }
    if (value.schemaVersion !== 3 || !isRecord(value.accounts)) return { schemaVersion: 3, accounts: {} };
    const accounts: Record<string, Record<string, StoredPokeCooldown>> = {};
    for (const [account, storedTargets] of Object.entries(value.accounts)) {
      if (!isRecord(storedTargets)) continue;
      const targets = parseTargets(storedTargets);
      if (Object.keys(targets).length > 0) accounts[account] = targets;
    }
    return { schemaVersion: 3, accounts };
  }

  private async mutate(mutator: CooldownMutator): Promise<void> {
    const write = this.writeQueue.then(async () => {
      const state = await this.read();
      if (mutator(state)) await this.storage.set(this.storageKey, state);
    });
    this.writeQueue = write.catch(() => undefined);
    await write;
  }
}

function parseTargets(value: Record<string, unknown>): Record<string, StoredPokeCooldown> {
  const targets: Record<string, StoredPokeCooldown> = {};
  for (const [target, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !isFiniteNumber(entry.until) || !isFiniteNumber(entry.observedAt) || entry.source !== "official") continue;
    const until = normalizePokeDeadlineMs(entry.until);
    if (until !== null) targets[target] = { until, observedAt: entry.observedAt, source: "official" };
  }
  return targets;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
