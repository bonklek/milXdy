(async () => {
  const selectors = {
    overlayDockRoot: "#milxdy-overlay-dock-root",
    appHubPanel: "#milxdy-app-hub-panel",
    appHubRuntime: ".milxdy-app-hub-runtime",
    appHubRuntimeState: ".milxdy-app-hub-runtime-state",
    wikiSidebarRoot: "#milxdy-wiki-sidebar-root",
  };
  const requiredRuntimeMarkers = [
    "overlayDockRoot",
    "performanceMode",
    "version",
    "buildProfile",
    "buildTarget",
  ];

  const present = Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [key, document.querySelector(selector) !== null]),
  );
  const counts = Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [key, document.querySelectorAll(selector).length]),
  );
  const styleNodes = Array.from(document.querySelectorAll("style[id^='milxdy-'], link[id^='milxdy-']"))
    .map((node) => ({
      id: node.id,
      tag: node.tagName.toLowerCase(),
      href: typeof node.getAttribute === "function" ? node.getAttribute("href") : null,
    }));
  const extensionResourceOrigins = Array.from(
    new Set(
      styleNodes
        .map((node) => node.href)
        .filter((href) => typeof href === "string" && /^(chrome|moz)-extension:\/\//.test(href))
        .map((href) => new URL(href, location.href).origin),
    ),
  ).sort();
  const storedLayouts = await chrome.storage.local.get({ "milxdy.overlayApps.layouts.v1": { version: 1, apps: {} } })
    .catch(() => ({ "milxdy.overlayApps.layouts.v1": { version: 1, apps: {} } }));
  const overlayAppLayoutStore = storedLayouts["milxdy.overlayApps.layouts.v1"];
  const overlayAppLayouts = overlayAppLayoutStore && typeof overlayAppLayoutStore === "object" && overlayAppLayoutStore.apps && typeof overlayAppLayoutStore.apps === "object"
    ? Object.keys(overlayAppLayoutStore.apps).length
    : 0;

  const result = {
    status: "blocked",
    url: location.href,
    title: document.title,
    checkedAt: new Date().toISOString(),
    performanceMode: document.documentElement.dataset.milxdyPerformanceMode || null,
    version: document.documentElement.dataset.milxdyVersion || null,
    buildProfile: document.documentElement.dataset.milxdyBuildProfile || null,
    buildTarget: document.documentElement.dataset.milxdyBuildTarget || null,
    present,
    counts,
    overlayAppLayouts,
    activeGuideOverlayAbsent: document.querySelector("#milxdy-overlay-app-guides") === null,
    styleNodes,
    extensionResourceOrigins,
    remediation: "Reload the unpacked 0.2.0 build, refresh X/Twitter, then rerun this probe.",
  };
  const missingRequired = requiredRuntimeMarkers.filter((key) => {
    if (key === "performanceMode") return result.performanceMode === null;
    if (key === "version") return result.version !== "0.2.0";
    if (key === "buildProfile") return result.buildProfile === null;
    if (key === "buildTarget") return result.buildTarget !== "chromium";
    return present[key] !== true;
  });
  result.missingRequired = missingRequired;
  result.status = missingRequired.length === 0 ? "passed" : "blocked";

  console.group("milXdy 0.2.0 live smoke probe");
  console.table({
    status: result.status,
    performanceMode: result.performanceMode || "missing",
    version: result.version || "missing",
    buildProfile: result.buildProfile || "missing",
    buildTarget: result.buildTarget || "missing",
    overlayDockRoot: present.overlayDockRoot,
    appHubPanel: present.appHubPanel,
    appHubRuntime: present.appHubRuntime,
    appHubRuntimeState: present.appHubRuntimeState,
    wikiSidebarRoot: present.wikiSidebarRoot,
    overlayAppLayouts: result.overlayAppLayouts,
    activeGuideOverlayAbsent: result.activeGuideOverlayAbsent,
  });
  console.log(result);
  console.groupEnd();

  window.__milxdy020LiveProbe = result;
  return result;
})();
