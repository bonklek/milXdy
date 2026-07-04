import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
} from "../visuals/reskin-profile";
import type { MilxdyAppId, MilxdyAppManifest } from "./app-platform";
import registryData from "./first-party-apps.json";

const LEGACY_BEETOL_PREFIX = "bex" + "tol";

type StaticFirstPartyAppManifest = Omit<MilxdyAppManifest, "isEnabled" | "package"> & {
  entryName?: string;
  entryPoint?: string;
  css?: Array<{ id: string; path: string; source?: string; targetDir?: string; target?: string }>;
  assets?: string[];
  requiredOutputs?: string[];
  package?: MilxdyAppManifest["package"];
  localPackage?: {
    root: string;
    reviewStatus: "local" | "reviewed" | "blocked";
    sourceVersion: string;
  };
};

const registry = registryData as StaticFirstPartyAppManifest[];
const defaultEnabledById = new Map(registry.map((app) => [app.id, app.defaultEnabled]));

const isEnabledById: Record<string, () => Promise<boolean>> = {
  rootVisuals: async () => defaultAppEnabled("rootVisuals"),
  tweetPng: async () => defaultAppEnabled("tweetPng"),
  composerTools: async () => {
    const stored = await chrome.storage.local.get("milxdy.composerTools.enabled");
    return enabledFromStoredValue(stored["milxdy.composerTools.enabled"], defaultAppEnabled("composerTools"));
  },
  wiki: async () => {
    const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
    const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
    return enabledFromStoredValue(settings.enabled, defaultAppEnabled("wiki"));
  },
  wikiSidebar: async () => {
    const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
    const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
    return enabledFromStoredValue(settings.sidebarEnabled ?? settings.enabled, defaultAppEnabled("wikiSidebar"));
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
  composerTools: async (enabled) => {
    await chrome.storage.local.set({ "milxdy.composerTools.enabled": enabled });
  },
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
        sidebarEnabled: enabled,
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
  const { entryName: _entryName, entryPoint: _entryPoint, requiredOutputs, css, assets, package: declaredPackage, ...manifest } = app;
  const genericEnablement = genericEnablementAdapter(app);
  const isEnabled = isEnabledById[app.id] ?? genericEnablement?.isEnabled ?? (async () => defaultAppEnabled(app.id));
  const setEnabled = setEnabledById[app.id] ?? genericEnablement?.setEnabled;
  return {
    ...manifest,
    available: true,
    unavailableReason: undefined,
    css: css?.map((sheet) => ({ id: sheet.id, path: sheet.path })),
    package: declaredPackage ?? {
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

function genericEnablementAdapter(app: StaticFirstPartyAppManifest): {
  isEnabled: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
} | null {
  const setting = app.settings?.find((candidate) => (
    candidate.role === "enablement"
    && candidate.control.type === "toggle"
    && candidate.storage
    && (candidate.storage.area === "local" || candidate.storage.area === "sync")
    && typeof candidate.storage.key === "string"
    && candidate.storage.key.length > 0
  ));
  if (!setting) return null;
  const fallback = defaultAppEnabled(app.id);
  return {
    isEnabled: async () => {
      const stored = await storageGet(setting.storage.area, setting.storage.property
        ? { [setting.storage.key]: {} }
        : setting.storage.key);
      const raw = setting.storage.property
        ? objectValue(stored[setting.storage.key])[setting.storage.property]
        : stored[setting.storage.key];
      return enabledFromStoredValue(raw, fallback);
    },
    setEnabled: async (enabled) => {
      if (!setting.storage.property) {
        await storageSet(setting.storage.area, { [setting.storage.key]: enabled });
        return;
      }
      const stored = await storageGet(setting.storage.area, { [setting.storage.key]: {} });
      await storageSet(setting.storage.area, {
        [setting.storage.key]: {
          ...objectValue(stored[setting.storage.key]),
          [setting.storage.property]: enabled,
        },
      });
    },
  };
}

function storageGet(
  area: "local" | "sync",
  keys: string | Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return area === "local"
    ? chrome.storage.local.get(keys)
    : chrome.storage.sync.get(keys);
}

function storageSet(area: "local" | "sync", values: Record<string, unknown>): Promise<void> {
  return area === "local"
    ? chrome.storage.local.set(values)
    : chrome.storage.sync.set(values);
}
