(() => {
  const BUILD = __MILXDY_QA_BUILD_JSON__;
  const REQUEST_KEY = "milxdy.qa.reloadRequest";
  const RESULT_KEY = "milxdy.qa.lastReloadResult";
  const RELOAD_GUARD_KEY = "milxdy.qa.reloadGuard";
  const LOADED_BUILD_KEY = "milxdy.qa.loadedBuildId";
  const REFRESH_TAB_PATTERNS = ["https://x.com/*", "https://twitter.com/*", "https://www.remilia.net/*", "https://remilia.net/*"];
  const POLL_BASE = `http://127.0.0.1:${BUILD.coordinatorPort}/milxdy-qa`;
  const RETRY_MS = 2_000;

  console.info(`[milXdy QA] running ${BUILD.buildId}`, BUILD);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "milxdy:qaBuildIdentity") return false;
    sendResponse({ build: BUILD });
    return false;
  });
  void bootQaRuntime();

  async function bootQaRuntime() {
    await finishQaBuildReload({ build: BUILD, requestKey: REQUEST_KEY, resultKey: RESULT_KEY,
      reloadGuardKey: RELOAD_GUARD_KEY, loadedBuildKey: LOADED_BUILD_KEY, tabPatterns: REFRESH_TAB_PATTERNS });
    void pollForBuilds();
  }

  async function pollForBuilds() {
    for (;;) {
      try {
        const url = `${POLL_BASE}/poll?buildId=${encodeURIComponent(BUILD.buildId)}`;
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`coordinator returned HTTP ${response.status}`);
        const message = await response.json();
        if (message.action === "reload" && typeof message.buildId === "string" && message.buildId !== BUILD.buildId) {
          if (message.output !== BUILD.output || message.extensionId !== BUILD.extensionId) {
            console.warn("[milXdy QA] ignored a reload request from a different or legacy QA publisher", message);
            await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
            continue;
          }
          const pair = `${BUILD.buildId}->${message.buildId}`;
          const stored = await chrome.storage.local.get(RELOAD_GUARD_KEY);
          if (stored[RELOAD_GUARD_KEY]?.pair === pair) {
            console.warn(`[milXdy QA] suppressed repeated automatic reload ${pair}; use the popup fallback if Chrome kept the old worker`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
            continue;
          }
          await chrome.storage.local.set({
            [REQUEST_KEY]: {
              desiredBuildId: message.buildId,
              requestedAt: new Date().toISOString(),
              mode: "watch",
            },
            [RELOAD_GUARD_KEY]: { pair, attemptedAt: new Date().toISOString() },
          });
          console.info(`[milXdy QA] reloading ${BUILD.buildId} -> ${message.buildId}`);
          chrome.runtime.reload();
          return;
        }
      } catch (error) {
        // The coordinator is optional: the popup's one-click reload remains available.
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }
})();

async function finishQaBuildReload({ build, requestKey, resultKey, reloadGuardKey, loadedBuildKey, tabPatterns }) {
  let stored;
  try { stored = await chrome.storage.local.get([requestKey, loadedBuildKey]); }
  catch { return; }
  const request = stored[requestKey];
  const requested = request?.desiredBuildId === build.buildId;
  if (!requested && stored[loadedBuildKey] === build.buildId) return;

  // Chrome's Extensions-page Reload does not refresh existing content scripts.
  // Refresh once for a newly loaded QA build, never on ordinary worker restarts.
  try { await chrome.storage.local.set({ [loadedBuildKey]: build.buildId }); }
  catch { return; }

  try { if (requested) await chrome.storage.local.remove([requestKey, reloadGuardKey]); }
  catch { return; }
  const tabs = await chrome.tabs.query({ url: tabPatterns }).catch(() => []);
  const outcomes = await Promise.allSettled(tabs.flatMap((tab) => typeof tab.id === "number" ? [chrome.tabs.reload(tab.id)] : []));
  const refreshedTabs = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
  const failedTabs = outcomes.length - refreshedTabs;
  const result = {
    buildId: build.buildId,
    completedAt: new Date().toISOString(),
    mode: requested ? request.mode || "manual" : "extensionReload",
    refreshedTabs,
    failedTabs,
  };
  await chrome.storage.local.set({ [resultKey]: result }).catch(() => undefined);
  console.info(`[milXdy QA] loaded ${build.buildId}; refreshed ${refreshedTabs} X/Twitter + RemiNet tab(s)`, result);
}
