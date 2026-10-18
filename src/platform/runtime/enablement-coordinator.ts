/** Serial per-app reconciliation; stale reads cannot reverse a newer decision. */
export function createEnablementCoordinator<App extends { id: string; isEnabled(): Promise<boolean> }>(deps: {
  active: () => boolean;
  apply: (app: App, enabled: boolean, current: () => boolean, explicit: boolean) => Promise<void>;
  failure: (app: App, error: unknown) => void;
}) {
  const generations = new Map<string, number>();
  const pending = new Map<string, Promise<void>>();
  let paused = false;
  const observe = (app: App) => {
    const generation = (generations.get(app.id) || 0) + 1;
    generations.set(app.id, generation);
    if (paused) return;
    const current = () => deps.active() && !paused && generations.get(app.id) === generation;
    const run = (pending.get(app.id) || Promise.resolve()).catch(() => undefined).then(async () => {
      if (!current()) return;
      const enabled = await app.isEnabled();
      if (current()) await deps.apply(app, enabled, current, false);
    }).catch(error => deps.failure(app, error));
    pending.set(app.id, run);
  };
  return {
    observe,
    async pause(): Promise<void> {
      paused = true;
      for (const id of generations.keys()) generations.set(id, (generations.get(id) || 0) + 1);
      await Promise.all(pending.values());
    },
    async reconcile(apps: readonly App[]): Promise<void> {
      for (const app of apps) {
        if (!deps.active()) throw new Error("Runtime closed before app reconciliation.");
        await deps.apply(app, await app.isEnabled(), deps.active, true);
      }
    },
    resume(): void { paused = false; },
  };
}
