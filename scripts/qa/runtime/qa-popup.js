(() => {
  const RUNNING_BUILD = __MILXDY_QA_BUILD_JSON__;
  const REQUEST_KEY = "milxdy.qa.reloadRequest";
  const RESULT_KEY = "milxdy.qa.lastReloadResult";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void renderQaPanel(), { once: true });
  } else {
    void renderQaPanel();
  }

  async function renderQaPanel() {
    const root = document.getElementById("milxdyQaBuild");
    const running = document.getElementById("milxdyQaRunning");
    const disk = document.getElementById("milxdyQaDisk");
    const status = document.getElementById("milxdyQaStatus");
    const reload = document.getElementById("milxdyQaReload");
    if (!root || !running || !disk || !status || !(reload instanceof HTMLButtonElement)) return;

    root.hidden = false;
    const [runningBuild, initialDiskBuild] = await Promise.all([readRunningBuild(), readDiskBuild()]);
    running.textContent = runningBuild ? `Running worker: ${runningBuild.buildId}` : "Running worker: identity unavailable";
    let diskBuild = initialDiskBuild;
    disk.textContent = diskBuild ? `On disk: ${diskBuild.buildId}` : "On disk: unreadable";
    const buildIsCurrent = Boolean(runningBuild && diskBuild?.buildId === runningBuild.buildId);
    root.dataset.current = buildIsCurrent ? "true" : "false";
    reload.textContent = buildIsCurrent ? "Reload QA build + refresh X tabs" : "Load latest QA build + refresh X tabs";

    const stored = await chrome.storage.local.get(RESULT_KEY).catch(() => ({}));
    const last = stored[RESULT_KEY];
    if (runningBuild && last?.buildId === runningBuild.buildId) {
      status.textContent = `Last reload refreshed ${last.refreshedTabs} X/Twitter tab(s)${last.failedTabs ? `; ${last.failedTabs} failed` : ""}.`;
    } else {
      status.textContent = buildIsCurrent
        ? "Watcher automation is connected when qa:watch is running."
        : "Chrome is not running the build currently on disk.";
    }

    reload.addEventListener("click", async () => {
      reload.disabled = true;
      status.textContent = "Reload requested; this popup will close and matching X/Twitter tabs will refresh.";
      diskBuild = await readDiskBuild() || diskBuild;
      await chrome.storage.local.set({
        [REQUEST_KEY]: {
          desiredBuildId: diskBuild?.buildId || RUNNING_BUILD.buildId,
          requestedAt: new Date().toISOString(),
          mode: "manual",
        },
      });
      window.setTimeout(() => chrome.runtime.reload(), 150);
    });
  }

  async function readDiskBuild() {
    try {
      const response = await fetch(`${chrome.runtime.getURL("qa-build.json")}?t=${Date.now()}`, { cache: "no-store" });
      return response.ok ? response.json() : null;
    } catch {
      return null;
    }
  }

  async function readRunningBuild() {
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: "milxdy:qaBuildIdentity" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("identity timeout")), 1_000)),
      ]);
      return response?.build || null;
    } catch {
      return null;
    }
  }
})();
