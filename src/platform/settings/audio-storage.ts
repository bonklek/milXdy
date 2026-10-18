import type { AppStorageArea } from "../app-sdk/app-platform";
/** Browser adapter for extension-page settings; app runtimes supply their scoped facade. */
export function chromeAudioStorage(area: "local" | "sync"): AppStorageArea {
  return {
    get: defaults => chrome.storage[area].get(defaults),
    set: values => chrome.storage[area].set(values),
    remove: keys => chrome.storage[area].remove(typeof keys === "string" ? keys : [...keys]),
    onChanged(listener) {
      const changed = (changes: Record<string, chrome.storage.StorageChange>, changedArea: string) => { if (changedArea === area) listener(changes); };
      chrome.storage.onChanged.addListener(changed);
      return () => chrome.storage.onChanged.removeListener(changed);
    },
  };
}
