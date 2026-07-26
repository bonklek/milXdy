const CATALOG_ORIGIN = "https://bonklek.github.io";
const CATALOG_PATH_PREFIX = "/milXdy/";

function isCatalogPage(): boolean {
  return location.origin === CATALOG_ORIGIN && location.pathname.startsWith(CATALOG_PATH_PREFIX);
}

function postBridgeReady(): void {
  window.postMessage({ source: "milxdy-extension", type: "milxdy-addon-bridge-ready" }, CATALOG_ORIGIN);
}

if (isCatalogPage()) {
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== CATALOG_ORIGIN) return;
    const message = event.data as Record<string, unknown> | null;
    if (!message || message.source !== "milxdy-catalog") return;

    if (message.type === "milxdy-addon-bridge-ping") {
      postBridgeReady();
      return;
    }

    if (message.type !== "milxdy-open-addon-settings") return;
    const target = message.target === "folder" || message.target === "rebuild" ? message.target : "folder";
    void chrome.runtime.sendMessage({ type: "milxdy:openAddonsSettings", target }).then((response) => {
      window.postMessage({
        source: "milxdy-extension",
        type: "milxdy-addon-settings-opened",
        target,
        ok: response?.ok === true,
      }, CATALOG_ORIGIN);
    }).catch(() => {
      window.postMessage({
        source: "milxdy-extension",
        type: "milxdy-addon-settings-opened",
        target,
        ok: false,
      }, CATALOG_ORIGIN);
    });
  });
  postBridgeReady();
}
