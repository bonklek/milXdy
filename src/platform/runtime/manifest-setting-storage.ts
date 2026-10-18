import type { AppSettingDefinition } from "../app-sdk/app-platform";

type SettingStorage = {
  get: (area: "local" | "sync", defaults: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  set: (area: "local" | "sync", values: Record<string, unknown>) => Promise<boolean>;
};
const pendingWrites = new Map<string, Promise<void>>();

export function persistManifestSetting(
  setting: Pick<AppSettingDefinition, "storage">,
  value: unknown,
  storage: SettingStorage,
): Promise<void> {
  const key = `${setting.storage.area}:${setting.storage.key}`;
  const pending = (pendingWrites.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => writeSetting(setting, value, storage));
  pendingWrites.set(key, pending);
  const release = () => { if (pendingWrites.get(key) === pending) pendingWrites.delete(key); };
  void pending.then(release, release);
  return pending;
}

async function writeSetting(
  setting: Pick<AppSettingDefinition, "storage">,
  value: unknown,
  storage: SettingStorage,
): Promise<void> {
  const { area, key, property } = setting.storage;
  let storedValue = value;
  if (property) {
    const stored = await storage.get(area, { [key]: {} });
    if (!stored) throw new Error("Extension settings are unavailable. Reload this page and try again.");
    const previous = stored[key];
    storedValue = {
      ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}),
      [property]: value,
    };
  }
  if (!await storage.set(area, { [key]: storedValue })) {
    throw new Error("Extension settings are unavailable. Reload this page and try again.");
  }
}
