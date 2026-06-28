import { boot, onSurface } from "../../features/post-reading/content";
import type { MilxdyContentAppContext } from "../../shared/appPlatform";
import type { Disposable } from "../../shared/disposables";
import { safeRuntimeMessage } from "../../shared/extensionRuntime";
import { createFallbackRuntimeScheduler } from "../../shared/runtimeScheduler";
import { scheduleTwitterScan, subscribeTwitterSurfaces } from "../../shared/twitterScanner";

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
    scheduleScan: scheduleTwitterScan,
    loadAppById: async () => null,
    scheduler: createFallbackRuntimeScheduler({ idleTimeoutMs: 16, timeoutFallbackMs: 250 }),
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
