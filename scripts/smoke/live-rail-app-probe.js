(async () => {
  const criticalApps = [
    { id: "wikiSidebar", label: "Remilia Wiki", defaultPinned: true },
    { id: "beetol", label: "Beetol", defaultPinned: true },
    { id: "miladymaxxer", label: "Maxxer", defaultPinned: true },
  ];
  const localDefaults = {
    "milxdy.apps.railPinned": null,
    "milxdy.apps.railUnpinned": [],
    "milxdy.performance.mode": "balanced",
    "milxdy.remistats.beetol.enabled": true,
    "milxdy.settings.visualTheme": {},
    "remiliaWikiHyperlink.settings": {},
  };
  const [local, sync] = await Promise.all([
    chrome.storage.local.get(localDefaults).catch(() => localDefaults),
    chrome.storage.sync.get({ mode: "milady" }).catch(() => ({ mode: "milady" })),
  ]);
  const railPinned = Array.isArray(local["milxdy.apps.railPinned"])
    ? local["milxdy.apps.railPinned"].filter((id) => typeof id === "string")
    : null;
  const railUnpinned = new Set(
    Array.isArray(local["milxdy.apps.railUnpinned"])
      ? local["milxdy.apps.railUnpinned"].filter((id) => typeof id === "string")
      : [],
  );
  const wikiSettings = objectValue(local["remiliaWikiHyperlink.settings"]);
  const visualTheme = objectValue(local["milxdy.settings.visualTheme"]);
  const enabled = {
    wikiSidebar: booleanSetting(wikiSettings.sidebarEnabled ?? wikiSettings.enabled, true),
    beetol: booleanSetting(local["milxdy.remistats.beetol.enabled"], true),
    miladymaxxer: typeof sync.mode === "string" && sync.mode !== "off" && visualTheme.disableMaxxer !== true,
  };
  const dockRoot = document.querySelector("#milxdy-overlay-dock-root");
  const dockItems = Array.from(document.querySelectorAll("#milxdy-overlay-dock-root .milxdy-overlay-dock-item[data-item-id]"));
  const rendered = new Map(dockItems.map((item) => [item.getAttribute("data-item-id"), item]));
  const apps = criticalApps.map((app) => {
    const explicitPinned = railPinned === null ? null : railPinned.includes(app.id);
    const expectedPinned = enabled[app.id] === true
      && !railUnpinned.has(app.id)
      && (explicitPinned === null ? app.defaultPinned : explicitPinned);
    const item = rendered.get(app.id) || null;
    const visible = item ? Boolean(item.offsetWidth || item.offsetHeight || item.getClientRects().length) : false;
    return {
      id: app.id,
      label: app.label,
      enabled: enabled[app.id] === true,
      expectedPinned,
      rendered: item !== null,
      visible,
      active: item?.getAttribute("data-active") || null,
      title: item?.getAttribute("title") || null,
      problem: expectedPinned && !visible ? "expected pinned rail app is missing or hidden" : null,
    };
  });
  const problems = apps.filter((app) => app.problem);
  const result = {
    status: dockRoot && problems.length === 0 ? "passed" : "blocked",
    checkedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    runtime: {
      version: document.documentElement.dataset.milxdyVersion || null,
      buildProfile: document.documentElement.dataset.milxdyBuildProfile || null,
      buildTarget: document.documentElement.dataset.milxdyBuildTarget || null,
      performanceMode: document.documentElement.dataset.milxdyPerformanceMode || local["milxdy.performance.mode"] || null,
    },
    dockRootPresent: dockRoot !== null,
    renderedRailIds: Array.from(rendered.keys()),
    storage: {
      railPinned,
      railUnpinned: Array.from(railUnpinned),
      beetolEnabled: enabled.beetol,
      maxxerMode: typeof sync.mode === "string" ? sync.mode : null,
      maxxerVisualsDisabled: visualTheme.disableMaxxer === true,
      wikiSidebarEnabled: enabled.wikiSidebar,
    },
    apps,
    problems,
    remediation: "If expected pinned apps are missing, reload the unpacked extension card, refresh X/Twitter, and rerun this probe. If they remain missing, open Apps & Features and compare each app's Enable and Pin state against this report.",
  };
  console.group("milXdy live rail app probe");
  console.table(apps.map(({ id, enabled, expectedPinned, rendered, visible, active, problem }) => ({
    id,
    enabled,
    expectedPinned,
    rendered,
    visible,
    active,
    problem: problem || "",
  })));
  console.log(result);
  console.groupEnd();
  window.__milxdyLiveRailAppProbe = result;
  return result;

  function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function booleanSetting(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
})();
