import { MILXDY_ADDONS_CATALOG_FALLBACK_URL, MILXDY_ADDONS_CATALOG_URL, MILXDY_ADDONS_CATALOG_URL_RULES } from "../app-sdk/addons-catalog";
import { parseAllowedUrl } from "../browser/url-allowlist";

type CatalogTabs = {
  get(id: number): Promise<{ url?: string; windowId?: number }>;
  update(id: number, options: { active: boolean }): Promise<unknown>;
  create(options: { url: string; active: boolean }): Promise<{ id?: number }>;
};

/** Reuse only the tab we created while it still shows an approved discovery URL. */
export function createAddonsCatalogLauncher(tabs: CatalogTabs, focusWindow: (id: number) => Promise<unknown>, confirmCatalogTab: (id: number) => Promise<boolean>) {
  let tabId: number | null = null;
  let pending: Promise<Record<string, unknown>> | null = null;
  return function launch(): Promise<Record<string, unknown>> {
    if (pending) return pending;
    pending = (async () => {
      const target = parseAllowedUrl(MILXDY_ADDONS_CATALOG_URL, MILXDY_ADDONS_CATALOG_URL_RULES)
        ?? parseAllowedUrl(MILXDY_ADDONS_CATALOG_FALLBACK_URL, MILXDY_ADDONS_CATALOG_URL_RULES);
      if (!target) return { ok: false, error: "catalog_unavailable" };
      if (tabId !== null) {
        try {
          const tab = await tabs.get(tabId);
          // Without tabs/host permission the browser withholds URL. Our existing
          // catalog-only content script can confirm that exact page instead.
          const approved = tab.url
            ? Boolean(parseAllowedUrl(tab.url, MILXDY_ADDONS_CATALOG_URL_RULES))
            : await confirmCatalogTab(tabId);
          if (approved) {
            await tabs.update(tabId, { active: true });
            if (typeof tab.windowId === "number") await focusWindow(tab.windowId);
            return { ok: true, reused: true };
          }
        } catch { /* Closed, inaccessible, or moved tab: create a new discovery tab. */ }
        tabId = null;
      }
      try {
        const created = await tabs.create({ url: target.href, active: true });
        if (typeof created.id !== "number") return { ok: false, error: "catalog_unavailable" };
        tabId = created.id;
        return { ok: true, reused: false };
      } catch {
        return { ok: false, error: "catalog_unavailable" };
      }
    })().finally(() => { pending = null; });
    return pending;
  };
}
