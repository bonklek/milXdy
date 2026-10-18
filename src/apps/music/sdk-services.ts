import type { AppStorageChanges, AppStorageFacade } from "../../platform/app-sdk/app-storage";
import type { MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";

export type MusicSdkServices = {
  assetUrl(path: string): string;
  readLocal(defaults: Record<string, unknown>): Promise<Record<string, unknown>>;
  writeLocal(values: Record<string, unknown>): Promise<void>;
  observeLocal(listener: (changes: AppStorageChanges) => void): () => void;
};

/** Keeps Music's host capabilities behind the captured SDK context. */
export function createMusicSdkServices(
  context: MilxdyContentAppContext,
  isActive: () => boolean,
): MusicSdkServices {
  const storage: AppStorageFacade = context.storage;
  return {
    assetUrl: context.resolveAssetUrl,
    readLocal(defaults) {
      return storage.local.get(defaults);
    },
    writeLocal(values) {
      return isActive() ? storage.local.set(values) : Promise.resolve();
    },
    observeLocal(listener) {
      return storage.local.onChanged(listener);
    },
  };
}
