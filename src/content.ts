type FeatureId = "wiki" | "postreader" | "remistats" | "miladymaxxer" | "beetol" | "reminetChat";
const LEGACY_BEETOL_PREFIX = "bex" + "tol";

type FeatureDefinition = {
  id: FeatureId;
  isEnabled: () => Promise<boolean>;
  script: string;
};

const loaded = new Set<FeatureId>();

const features: FeatureDefinition[] = [
  {
    id: "wiki",
    isEnabled: async () => {
      const stored = await chrome.storage.local.get("remiliaWikiHyperlink.settings");
      const settings = objectValue(stored["remiliaWikiHyperlink.settings"]);
      return settings.enabled !== false;
    },
    script: "features/wiki.js",
  },
  {
    id: "postreader",
    isEnabled: async () => {
      const stored = await chrome.storage.sync.get({ enabled: true });
      return stored.enabled !== false;
    },
    script: "features/postreader.js",
  },
  {
    id: "remistats",
    isEnabled: async () => {
      const stored = await chrome.storage.sync.get({ "milxdy.remistats.enabled": true });
      return stored["milxdy.remistats.enabled"] !== false;
    },
    script: "features/remistats.js",
  },
  {
    id: "miladymaxxer",
    isEnabled: async () => {
      const stored = await chrome.storage.sync.get({ mode: "milady" });
      return stored.mode !== "off";
    },
    script: "features/miladymaxxer.js",
  },
  {
    id: "beetol",
    isEnabled: async () => {
      const legacyKey = `milxdy.${LEGACY_BEETOL_PREFIX}.enabled`;
      const stored = await chrome.storage.local.get(["milxdy.remistats.beetol.enabled", legacyKey]);
      return (stored["milxdy.remistats.beetol.enabled"] ?? stored[legacyKey] ?? true) !== false;
    },
    script: "features/beetol.js",
  },
  {
    id: "reminetChat",
    isEnabled: async () => {
      const stored = await chrome.storage.local.get({ "milxdy.reminetChat.enabled": false });
      return stored["milxdy.reminetChat.enabled"] === true;
    },
    script: "features/reminetChat.js",
  },
];

void bootFeatures();

async function bootFeatures(): Promise<void> {
  for (const feature of features) {
    if (await feature.isEnabled()) {
      await loadFeature(feature);
    }
  }
  observeFeatureEnablement();
}

async function loadFeature(feature: FeatureDefinition): Promise<void> {
  if (loaded.has(feature.id)) return;
  loaded.add(feature.id);
  if (feature.id === "remistats") injectStylesheet("milxdy-remistats-styles", "remistats/remistats.css");
  if (feature.id === "beetol") injectStylesheet("milxdy-beetol-styles", "beetol/content.css");
  if (feature.id === "reminetChat") injectStylesheet("milxdy-reminet-chat-styles", "reminetChat/content.css");
  await import(chrome.runtime.getURL(feature.script));
  void writeLoadedFeatureDiagnostics();
}

function observeFeatureEnablement(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    for (const feature of features) {
      if (!featureChanged(feature.id, changes, area)) continue;
      void feature.isEnabled().then((enabled) => {
        if (enabled) void loadFeature(feature);
      });
    }
  });
}

function featureChanged(
  feature: FeatureId,
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
): boolean {
  if (feature === "wiki") return area === "local" && Boolean(changes["remiliaWikiHyperlink.settings"]);
  if (feature === "postreader") return area === "sync" && Boolean(changes.enabled);
  if (feature === "remistats") return area === "sync" && Boolean(changes["milxdy.remistats.enabled"]);
  if (feature === "miladymaxxer") return area === "sync" && Boolean(changes.mode);
  if (feature === "beetol") return area === "local" && Boolean(changes["milxdy.remistats.beetol.enabled"]);
  if (feature === "reminetChat") return area === "local" && Boolean(changes["milxdy.reminetChat.enabled"]);
  return false;
}

function injectStylesheet(id: string, path: string): void {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL(path);
  document.documentElement.appendChild(link);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function writeLoadedFeatureDiagnostics(): Promise<void> {
  const stored = await chrome.storage.local.get({ "milxdy.diagnostics.enabled": false });
  if (stored["milxdy.diagnostics.enabled"] !== true) return;
  await chrome.storage.local.set({
    "milxdy.diagnostics.loadedFeatures": {
      features: Array.from(loaded).sort(),
      updatedAt: Date.now(),
    },
  });
}

export {};
