export type AppStorageAreaName = "local" | "sync";

export type AppStorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

export type AppStorageChanges = Record<string, AppStorageChange>;

export type AppStorageArea = {
  get<T extends Record<string, unknown>>(defaults: T): Promise<T>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | readonly string[]): Promise<void>;
  onChanged(listener: (changes: AppStorageChanges) => void): () => void;
};

export type AppStorageFacade = {
  local: AppStorageArea;
  sync: AppStorageArea;
};

export type AppStorageBackend = {
  get(area: AppStorageAreaName, defaults: Record<string, unknown>): Promise<Record<string, unknown>>;
  set(area: AppStorageAreaName, values: Record<string, unknown>): Promise<void>;
  remove(area: AppStorageAreaName, keys: readonly string[]): Promise<void>;
  onChanged(listener: (area: AppStorageAreaName, changes: AppStorageChanges) => void): () => void;
};

export function createAppStorageFacade(
  appId: string,
  storageKeys: { local?: readonly string[]; sync?: readonly string[] },
  backend: AppStorageBackend,
): AppStorageFacade {
  return {
    local: createArea("local"),
    sync: createArea("sync"),
  };

  function createArea(area: AppStorageAreaName): AppStorageArea {
    const allowedKeys = new Set(storageKeys[area] || []);
    const assertKeys = (keys: readonly string[]) => {
      const undeclared = keys.filter((key) => !allowedKeys.has(key));
      if (undeclared.length > 0) {
        throw new Error(`${appId}: ${area} storage access requires declared keys: ${undeclared.join(", ")}`);
      }
    };
    return {
      async get<T extends Record<string, unknown>>(defaults: T): Promise<T> {
        assertKeys(Object.keys(defaults));
        return await backend.get(area, defaults) as T;
      },
      async set(values): Promise<void> {
        assertKeys(Object.keys(values));
        await backend.set(area, values);
      },
      async remove(keys): Promise<void> {
        const normalized = typeof keys === "string" ? [keys] : [...keys];
        assertKeys(normalized);
        await backend.remove(area, normalized);
      },
      onChanged(listener) {
        return backend.onChanged((changedArea, changes) => {
          if (changedArea !== area) return;
          const declaredChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => allowedKeys.has(key)));
          if (Object.keys(declaredChanges).length > 0) listener(declaredChanges);
        });
      },
    };
  }
}
