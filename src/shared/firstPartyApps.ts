import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
} from "./reskinProfile";
import type { MilxdyAppId, MilxdyAppManifest } from "./appPlatform";
import registryData from "./firstPartyApps.json";

const LEGACY_BEETOL_PREFIX = "bex" + "tol";

type StaticFirstPartyAppManifest = Omit<MilxdyAppManifest, "isEnabled" | "package"> & {
  entryName: string;
  entryPoint: string;
  css?: Array<{ id: string; path: string; source?: string; targetDir?: string; target?: string }>;
  assets?: string[];
  requiredOutputs?: string[];
};

const registry = registryData as StaticFirstPartyAppManifest[];
const defaultEnabledById = new Map(registry.map((app) => [app.id, app.defaultEnabled]));

const isEnabledById: Record<string, () => Promise<boolean>> = {
  rootVisuals: async () => defaultAppEnabled("rootVisuals"),
  tweetPng: async () => defaultAppEnabled("tweetPng"),
  wiki: async () => {
    const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
    const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
    return enabledFromStoredValue(settings.enabled, defaultAppEnabled("wiki"));
  },
  wikiSidebar: async () => {
    const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
    const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
    return enabledFromStoredValue(settings.enabled, defaultAppEnabled("wikiSidebar"));
  },
  "post-reading": async () => {
    const stored = await chrome.storage.sync.get("enabled");
    return enabledFromStoredValue(stored.enabled, defaultAppEnabled("post-reading"));
  },
  remistats: async () => {
    const stored = await chrome.storage.sync.get("milxdy.remistats.enabled");
    return enabledFromStoredValue(stored["milxdy.remistats.enabled"], defaultAppEnabled("remistats"));
  },
  miladymaxxer: async () => {
    const [syncStored, localStored] = await Promise.all([
      chrome.storage.sync.get("mode"),
      chrome.storage.local.get({
        [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE,
        [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME,
      }),
    ]);
    const profile = normalizeReskinProfile(localStored[RESKIN_PROFILE_KEY]);
    const theme = normalizeVisualTheme(localStored[VISUAL_THEME_KEY], profile);
    const mode = typeof syncStored.mode === "string"
      ? syncStored.mode
      : defaultAppEnabled("miladymaxxer") ? "milady" : "off";
    return mode !== "off" && !theme.disableMaxxer;
  },
  beetol: async () => {
    const legacyKey = `milxdy.${LEGACY_BEETOL_PREFIX}.enabled`;
    const stored = await chrome.storage.local.get(["milxdy.remistats.beetol.enabled", legacyKey]);
    return enabledFromStoredValue(
      stored["milxdy.remistats.beetol.enabled"] ?? stored[legacyKey],
      defaultAppEnabled("beetol"),
    );
  },
  reminetChat: async () => {
    const stored = await chrome.storage.local.get("milxdy.reminetChat.enabled");
    return enabledFromStoredValue(stored["milxdy.reminetChat.enabled"], defaultAppEnabled("reminetChat"));
  },
  miladychanSpotlight: async () => {
    const stored = await chrome.storage.local.get("milxdy.miladychan.enabled");
    return enabledFromStoredValue(stored["milxdy.miladychan.enabled"], defaultAppEnabled("miladychanSpotlight"));
  },
  music: async () => {
    const stored = await chrome.storage.local.get("milxdy.music.enabled");
    return enabledFromStoredValue(stored["milxdy.music.enabled"], defaultAppEnabled("music"));
  },
};

const setEnabledById: Record<string, ((enabled: boolean) => Promise<void>) | undefined> = {
  wiki: async (enabled) => {
    const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
    const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
    await chrome.storage.local.set({
      "remiliaWikiHyperlink.settings": {
        ...settings,
        enabled,
      },
    });
  },
  wikiSidebar: async (enabled) => {
    const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
    const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
    await chrome.storage.local.set({
      "remiliaWikiHyperlink.settings": {
        ...settings,
        enabled,
      },
    });
  },
  "post-reading": async (enabled) => {
    await chrome.storage.sync.set({ enabled });
  },
  remistats: async (enabled) => {
    await chrome.storage.sync.set({ "milxdy.remistats.enabled": enabled });
  },
  miladymaxxer: async (enabled) => {
    await chrome.storage.sync.set({ mode: enabled ? "milady" : "off" });
  },
  beetol: async (enabled) => {
    await chrome.storage.local.set({ "milxdy.remistats.beetol.enabled": enabled });
  },
  reminetChat: async (enabled) => {
    await chrome.storage.local.set({ "milxdy.reminetChat.enabled": enabled });
  },
  miladychanSpotlight: async (enabled) => {
    await chrome.storage.local.set({ "milxdy.miladychan.enabled": enabled });
  },
  music: async (enabled) => {
    await chrome.storage.local.set({ "milxdy.music.enabled": enabled });
  },
};

export const FIRST_PARTY_APPS: readonly MilxdyAppManifest[] = registry.map((app) => {
  const { entryName: _entryName, entryPoint: _entryPoint, requiredOutputs, css, assets, ...manifest } = app;
  const isEnabled = isEnabledById[app.id];
  if (!isEnabled) throw new Error(`Missing first-party app enablement adapter for ${app.id}`);
  const setEnabled = setEnabledById[app.id];
  return {
    ...manifest,
    available: true,
    unavailableReason: undefined,
    css: css?.map((sheet) => ({ id: sheet.id, path: sheet.path })),
    package: {
      assets,
      webAccessibleAssets: requiredOutputs,
    },
    isEnabled,
    setEnabled,
  };
});

export const FIRST_PARTY_APP_IDS = FIRST_PARTY_APPS.map((app) => app.id);

export function firstPartyAppById(id: MilxdyAppId): MilxdyAppManifest | undefined {
  return FIRST_PARTY_APPS.find((app) => app.id === id);
}

export function appChanged(
  app: Pick<MilxdyAppManifest, "storageKeys">,
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
): boolean {
  const keys = area === "local" ? app.storageKeys.local : area === "sync" ? app.storageKeys.sync : undefined;
  return Boolean(keys?.some((key) => changes[key]));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function defaultAppEnabled(id: string): boolean {
  return defaultEnabledById.get(id) === true;
}

function enabledFromStoredValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
