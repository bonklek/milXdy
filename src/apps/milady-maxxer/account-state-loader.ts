import type { PokeStatistics } from "./shared/poke-statistics";
/** Optional poke reads never delay or reject the existing account/XP state. */
export function createMaxxerAccountStateLoader<Base>(deps: {
  currentScope: () => string | null;
  readBase: (scope: string | null) => Promise<Base>;
  readPokes: (scope: string | null) => Promise<PokeStatistics>;
  applyBase: (value: Base) => void;
  applyPokes: (value: PokeStatistics | null) => void;
}) {
  let generation = 0;
  const current = (scope: string | null, token: number) => generation === token && deps.currentScope() === scope;
  const readPokes = (scope: string | null) => scope ? Promise.resolve().then(() => deps.readPokes(scope)).catch(() => null) : Promise.resolve(null);
  const applyPokes = async (scope: string | null, token: number, pending: Promise<PokeStatistics | null>) => {
    const value = await pending;
    if (current(scope, token)) deps.applyPokes(value);
  };
  return {
    async load(scope: string | null): Promise<void> {
      const token = ++generation, pending = readPokes(scope);
      const base = await deps.readBase(scope);
      if (!current(scope, token)) return;
      deps.applyBase(base);
      void applyPokes(scope, token, pending);
    },
    async retry(scope: string | null): Promise<void> {
      const token = ++generation;
      await applyPokes(scope, token, readPokes(scope));
    },
  };
}
