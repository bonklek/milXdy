import type { AppStorageFacade } from "../../platform/app-sdk/app-platform";

export function createPortalStorage(storage: AppStorageFacade) {
  return {
    get(keys: string[] | Record<string, unknown>): Promise<Record<string, unknown>> {
      const defaults = Array.isArray(keys) ? Object.fromEntries(keys.map((key) => [key, undefined])) : keys;
      return storage.local.get(defaults);
    },
    set(values: Record<string, unknown>): Promise<void> {
      return storage.local.set(values);
    },
    remove(key: string): Promise<void> {
      return storage.local.remove(key);
    },
    onChanged(listener: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => void): () => void {
      return storage.local.onChanged(listener);
    },
  };
}

export async function loadPortalBootValues(options: {
  storage: ReturnType<typeof createPortalStorage>;
  active: () => boolean;
  theme: { key: string; fallback: unknown; apply: (value: unknown) => void };
  draft: { key: string; apply: (value: unknown) => void };
  watched: { key: string; apply: (value: unknown) => void };
}): Promise<void> {
  const { storage, active, theme, draft, watched } = options;
  const [themeValues, draftValues, watchedValues] = await Promise.all([
    storage.get({ [theme.key]: theme.fallback }),
    storage.get([draft.key]),
    storage.get([watched.key]),
  ]);
  if (!active()) return;
  theme.apply(themeValues[theme.key]);
  draft.apply(draftValues[draft.key]);
  watched.apply(watchedValues[watched.key]);
}
