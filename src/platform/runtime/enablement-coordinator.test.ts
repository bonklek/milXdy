import { expect, it } from "vitest";
import { createEnablementCoordinator } from "./enablement-coordinator";
import { ContentAppLifecycleOwner } from "./content-app-lifecycle";

it("invalidates stale enablement reads and drains a delayed load before rollback reconciliation", async () => {
  let resolveRead!: (value: boolean) => void, finishBoot!: () => void;
  let enabled = false, active = false, booted = false, disposed = 0;
  const app = { id: "real-lifecycle", isEnabled: () => new Promise<boolean>(resolve => resolveRead = resolve) };
  let lifecycle: ContentAppLifecycleOwner | null = null;
  const coordinator = createEnablementCoordinator({ active: () => true, failure: () => undefined, apply: async (_app, desired, current) => {
    if (!current()) return;
    if (desired) {
      enabled = true;
      lifecycle = new ContentAppLifecycleOwner({ boot: async () => { await new Promise<void>(resolve => finishBoot = resolve); booted = true; }, enable: () => { active = true; }, dispose: () => { active = false; disposed++; } }, {} as never, () => enabled);
      await lifecycle.activate();
    } else { enabled = false; if (lifecycle) await lifecycle.deactivate(); }
  } });
  coordinator.observe(app); await Promise.resolve(); await Promise.resolve();
  coordinator.observe(app); resolveRead(true); await new Promise(resolve => setTimeout(resolve, 0));
  // Only the newer generation can start activation.
  expect(booted).toBe(false); expect(active).toBe(false);
  resolveRead(true); await new Promise(resolve => setTimeout(resolve, 0));
  const paused = coordinator.pause();
  finishBoot(); await paused; expect(active).toBe(true);
  app.isEnabled = async () => false;
  await coordinator.reconcile([app]); coordinator.resume();
  expect(active).toBe(false); expect(enabled).toBe(false); expect(disposed).toBe(1);
});

it("awaits cleanup completion before a subsequent enabled state can land", async () => {
  let enabled = false, rendered = false, release!: () => void;
  const app = { id: "one", isEnabled: async () => enabled };
  const operations: string[] = [];
  const coordinator = createEnablementCoordinator({ active: () => true, failure: () => undefined, apply: async (_app, next) => {
    operations.push(next ? "enable" : "disable");
    if (!next) await new Promise<void>(resolve => release = resolve);
    rendered = next;
  } });
  coordinator.observe(app); await new Promise(resolve => setTimeout(resolve, 0));
  enabled = true; coordinator.observe(app); release(); await new Promise(resolve => setTimeout(resolve, 0));
  expect(operations).toEqual(["disable", "enable"]); expect(rendered).toBe(true);
});

it("transaction failure waits for partial activation teardown and restores the original disabled runtime", async () => {
  const { createPresetQueue, planPreset, presetValue } = await import("../settings/preset-transaction");
  const stored: Record<string, unknown> = { enabled: false };
  const area = { get: async (keys: string[]) => Object.fromEntries(keys.filter(key => Object.hasOwn(stored, key)).map(key => [key, stored[key]])), set: async (values: Record<string, unknown>) => { Object.assign(stored, values); }, remove: async (keys: string[]) => keys.forEach(key => delete stored[key]) };
  const app = { id: "partial-boot", isEnabled: async () => stored.enabled === true };
  let owner: ContentAppLifecycleOwner | null = null, mounted = false, disposed = 0;
  const coordinator = createEnablementCoordinator({ active: () => true, failure: () => undefined, apply: async (_app, enabled) => {
    if (enabled) {
      owner = new ContentAppLifecycleOwner({ boot: () => { mounted = true; throw new Error("partial boot failure"); }, dispose: () => { mounted = false; disposed++; } }, {} as never, () => true);
      await owner.activate();
    } else if (owner) await owner.deactivate();
  } });
  const result = await createPresetQueue({ local: area, sync: area })({ kind: "App setup", build: () => planPreset({ local: area, sync: area }, [{ area: "local", key: "enabled", label: "App", value: presetValue(true) }]), review: async () => "apply",
    prepare: coordinator.pause, reconcile: () => coordinator.reconcile([app]), release: coordinator.resume });
  expect(result).toMatchObject({ status: "failed", restored: true });
  expect(stored.enabled).toBe(false); expect(mounted).toBe(false); expect(disposed).toBe(1);
});
