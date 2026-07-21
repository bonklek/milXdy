import { boot, onSurface } from "../../apps/post-reading/content";
import type { AppStorageArea, AppStorageAreaName, MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";
import type { Disposable } from "../../platform/runtime/disposables";
import { safeRuntimeMessage } from "../../platform/background/extension-runtime";
import { createFallbackRuntimeScheduler } from "../../platform/runtime/scheduler";
import { scheduleTwitterScan, subscribeTwitterSurfaces } from "../../platform/scanner/twitter-scanner";

const controller = new AbortController();
const disposables: Disposable[] = [];

void bootStandalonePostReading();

async function bootStandalonePostReading(): Promise<void> {
  document.documentElement.dataset.milxdyPerformanceMode ||= "balanced";

  const context: MilxdyContentAppContext = {
    manifest: {
      id: "post-reading",
      name: "Post-reading",
      version: "0.1.0",
      description: "Read-aloud controls for X/Twitter posts.",
      contentEntry: "content.js",
      defaultEnabled: true,
      storageKeys: {
        sync: [
          "enabled",
          "speed",
          "volume",
          "voiceURI",
          "autoVoice",
          "ttsEngine",
          "customTtsEndpoint",
          "customTtsTimingMode",
          "autoplayNext",
          "autoplayMode",
          "skipPromotedPosts",
          "endOfTweetDing",
          "includeQuotes",
          "fetchFullQuotes",
          "fullQuoteDisplay",
          "includeHyperlinks",
          "includeImageAltText",
          "includeImageOcr",
          "includeLinkPreviews",
          "expandShowMore",
          "activeTweetHighlight",
          "bodyHighlightMode",
          "playerPosition",
          "buttonPlacement",
          "useHandles",
          "keyNextTweet",
          "keyPreviousTweet",
          "keyNextChunk",
          "keyPreviousChunk",
          "keySkipOcr",
          "keyPlayPause",
        ],
        local: ["voiceBoundarySupportV2"],
      },
      surfaces: ["tweet"],
      cost: {
        startup: "moderate",
        perSurface: "moderate",
        network: "batched",
        worker: "optional",
        domWrite: "moderate",
      },
      loadTriggers: ["startup", "surface", "userAction"],
      package: {
        assets: ["post-reading"],
        webAccessibleAssets: ["post-reading/*", "ocr.html", "ocrHost.js", "ocr/*"],
      },
      isEnabled: async () => true,
    },
    signal: controller.signal,
    requestSurfaceRescan: scheduleTwitterScan,
    scheduleScan: scheduleTwitterScan,
    loadAppById: async () => null,
    scheduler: createFallbackRuntimeScheduler({ idleTimeoutMs: 16, timeoutFallbackMs: 250 }),
    storage: {
      local: chromeStorageArea("local"),
      sync: chromeStorageArea("sync"),
    },
    resolveAssetUrl: (path) => chrome.runtime.getURL(path),
    sendMessage: (message) => safeRuntimeMessage(message),
    recordDiagnostic: () => undefined,
    addDisposable(disposable) {
      disposables.push(disposable);
    },
  };

  await boot(context);
  disposables.push(subscribeTwitterSurfaces(onSurface));
}

window.addEventListener("pagehide", () => {
  controller.abort();
  for (const disposable of disposables.splice(0)) {
    if (typeof disposable === "function") disposable();
    else disposable.dispose();
  }
}, { once: true });

function chromeStorageArea(area: AppStorageAreaName): AppStorageArea {
  const storage = area === "local" ? chrome.storage.local : chrome.storage.sync;
  return {
    async get(defaults) {
      return await storage.get(defaults as never) as typeof defaults;
    },
    async set(values) {
      await storage.set(values);
    },
    async remove(keys) {
      await storage.remove(typeof keys === "string" ? keys : [...keys]);
    },
    onChanged(listener) {
      const chromeListener = (changes: Record<string, chrome.storage.StorageChange>, changedArea: string) => {
        if (changedArea === area) listener(changes);
      };
      chrome.storage.onChanged.addListener(chromeListener);
      return () => chrome.storage.onChanged.removeListener(chromeListener);
    },
  };
}
