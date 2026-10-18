import { validRestoredPresetTarget } from "./preset-value-validation";
export type PresetArea = "local" | "sync";
export type PresetValue = { present: boolean; value?: unknown };
export type PresetTarget = { area: PresetArea; key: string; label: string; value: PresetValue };
export type PresetChange = PresetTarget & { before: PresetValue };
export type PresetStorage = Record<PresetArea, {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}>;
export type PresetRequest = {
  kind: string;
  build: () => Promise<PresetChange[]>;
  review: (changes: PresetChange[]) => Promise<PresetDecision>;
  verify?: () => Promise<void>;
  prepare?: () => Promise<void>;
  reconcile?: () => Promise<void>;
  release?: () => void;
  status?: (message: string) => void;
};
export type PresetDecision = "apply" | "save" | "cancel";
export type SavedPreset = { id: string; name: string; kind: string; createdAt: string; targets: PresetTarget[] };
export type PresetResult = { status: "applied" | "cancelled" | "failed"; restored?: boolean; message: string; recovery?: PresetTarget[] };
export const SAVED_PRESETS_KEY = "milxdy.settings.savedPresets";
class PresetCapacityError extends Error {}
const own = (record: Record<string, unknown>, key: string): PresetValue => Object.hasOwn(record, key) ? { present: true, value: structuredClone(record[key]) } : { present: false };
export const presetValue = (value: unknown): PresetValue => ({ present: true, value });
export function samePresetValue(a: PresetValue, b: PresetValue): boolean {
  return a.present === b.present && (!a.present || canonical(a.value) === canonical(b.value));
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(canonical(item))])));
  return JSON.stringify(value) ?? "null";
}
export async function readPresetTargets(storage: PresetStorage, targets: Pick<PresetTarget, "area" | "key" | "label">[]): Promise<PresetTarget[]> {
  const [local, sync] = await Promise.all([storage.local.get(targets.filter(t => t.area === "local").map(t => t.key)), storage.sync.get(targets.filter(t => t.area === "sync").map(t => t.key))]);
  return targets.map(target => ({ ...target, value: own(target.area === "local" ? local : sync, target.key) }));
}
export async function planPreset(storage: PresetStorage, targets: PresetTarget[]): Promise<PresetChange[]> {
  const before = await readPresetTargets(storage, targets);
  return targets.map((target, index) => ({ ...target, before: before[index].value }));
}
async function writeTargets(storage: PresetStorage, targets: PresetTarget[]): Promise<void> {
  for (const area of ["local", "sync"] as const) {
    const entries = targets.filter(target => target.area === area);
    const values = Object.fromEntries(entries.filter(t => t.value.present).map(t => [t.key, t.value.value]));
    const removed = entries.filter(t => !t.value.present).map(t => t.key);
    if (Object.keys(values).length) await storage[area].set(values);
    if (removed.length) await storage[area].remove(removed);
  }
}
async function restoreTargets(storage: PresetStorage, targets: PresetTarget[]): Promise<void> {
  const results = await Promise.allSettled((["local", "sync"] as const).map(area => writeTargets(storage, targets.filter(target => target.area === area))));
  if (results.some(result => result.status === "rejected")) throw new Error("Some settings could not be restored.");
}
async function verifyTargets(storage: PresetStorage, targets: PresetTarget[]): Promise<void> {
  const actual = await readPresetTargets(storage, targets);
  if (targets.some((target, index) => !samePresetValue(target.value, actual[index].value))) throw new Error("Settings did not match the reviewed changes.");
}
function validSavedTarget(value: unknown): value is PresetTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const target = value as Partial<PresetTarget>;
  return (target.area === "local" || target.area === "sync") && typeof target.key === "string" && target.key.trim().length > 0 && target.key.length <= 200
    && typeof target.label === "string" && target.label.trim().length > 0 && target.label.length <= 300 && !!target.value && typeof target.value === "object"
    && typeof target.value.present === "boolean" && (!target.value.present || Object.hasOwn(target.value, "value"));
}
function validSavedPreset(entry: unknown): entry is SavedPreset {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const value = entry as Partial<SavedPreset>;
  return typeof value.id === "string" && value.id.trim().length > 0 && value.id.length <= 100
    && typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 200
    && typeof value.kind === "string" && value.kind.trim().length > 0 && value.kind.length <= 80
    && typeof value.createdAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value.createdAt) && Number.isFinite(Date.parse(value.createdAt))
    && Array.isArray(value.targets) && value.targets.length > 0 && value.targets.length <= 200 && value.targets.every(validSavedTarget);
}
export async function loadSavedPresets(storage: PresetStorage): Promise<SavedPreset[]> {
  const stored = (await storage.local.get([SAVED_PRESETS_KEY]))[SAVED_PRESETS_KEY];
  return Array.isArray(stored) ? stored.filter(validSavedPreset) : [];
}

async function saveSnapshot(storage: PresetStorage, kind: string, targets: PresetTarget[]): Promise<void> {
  const saved = await loadSavedPresets(storage);
  if (saved.length >= 20) throw new PresetCapacityError();
  const now = new Date().toISOString();
  saved.push({ id: crypto.randomUUID(), name: `${kind} ${new Date().toLocaleString()}`, kind, createdAt: now, targets });
  await storage.local.set({ [SAVED_PRESETS_KEY]: saved });
  if (!(await loadSavedPresets(storage)).some(entry => entry.id === saved.at(-1)?.id)) throw new Error("The custom configuration could not be saved.");
}
/** Queues the review as well as the mutation. A later click reads fresh state. */
export function createPresetQueue(storage: PresetStorage) {
  let pending: Promise<unknown> = Promise.resolve();
  return (request: PresetRequest): Promise<PresetResult> => {
    const run = pending.then(() => executePreset(storage, request));
    pending = run.catch(() => undefined);
    return run;
  };
}
async function executePreset(storage: PresetStorage, request: PresetRequest): Promise<PresetResult> {
  let snapshot: PresetTarget[] | undefined;
  let mutated = false;
  try {
    const changes = await request.build();
    snapshot = changes.map(({ before, ...target }) => ({ ...target, value: before }));
    const choice = await request.review(changes);
    if (choice === "cancel") return { status: "cancelled", message: "Canceled. Settings were not changed." };
    await verifyTargets(storage, snapshot);
    if (choice === "save") await saveSnapshot(storage, request.kind, snapshot);
    request.status?.("Applying reviewed changes…");
    await request.prepare?.();
    await verifyTargets(storage, snapshot);
    mutated = true;
    await writeTargets(storage, changes);
    await verifyTargets(storage, changes);
    await request.reconcile?.();
    await verifyTargets(storage, changes);
    await request.verify?.();
    return { status: "applied", message: choice === "save" ? "Custom configuration saved. Reviewed changes applied." : "Reviewed changes applied." };
  } catch (error) {
    if (error instanceof PresetCapacityError) return { status: "failed", restored: true, message: "Your 20 saved configurations are full. Nothing was overwritten or applied. Cancel to keep your settings, or review again and choose Discard current choices and apply without saving." };
    if (!mutated || !snapshot) return { status: "failed", restored: true, message: "Could not apply this preset. No preset settings were changed; review again if settings changed elsewhere." };
    request.status?.("Applying failed. Restoring your previous settings…");
    try {
      await restoreTargets(storage, snapshot);
      await verifyTargets(storage, snapshot);
      await request.reconcile?.();
      await verifyTargets(storage, snapshot);
      return { status: "failed", restored: true, message: "Preset failed. Your previous settings were restored." };
    } catch {
      return { status: "failed", restored: false, message: "Preset failed and some settings or apps could not be restored. Reload this page before continuing. Download the recovery settings, then restore the listed choices in Settings.", recovery: snapshot };
    }
  } finally { request.release?.(); }
}
/** Saved configurations can restore only the declared keys of the invoking surface. */
export async function planSavedPreset(storage: PresetStorage, saved: SavedPreset, allowed: PresetTarget[]): Promise<PresetChange[]> {
  if (!validSavedPreset(saved)) throw new Error("This saved configuration is invalid.");
  const targets = allowed.flatMap(target => {
    const entry = saved.targets.find(t => validSavedTarget(t) && t.area === target.area && t.key === target.key);
    if (!entry) return [];
    if (!validRestoredPresetTarget(entry, target)) throw new Error("A saved setting is incompatible with this surface.");
    return [{ ...target, value: entry.value }];
  });
  if (!targets.length) throw new Error("This saved configuration has no supported settings.");
  return planPreset(storage, targets);
}
