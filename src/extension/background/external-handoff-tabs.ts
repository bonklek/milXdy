import { externalHandoffUrl, type ExternalHandoffTarget } from "../../platform/app-sdk/external-handoff";

export const EXTERNAL_HANDOFF_TABS_KEY = "milxdy.externalHandoff.temporaryTabs";
const MARKER = "milxdy-temporary-maker=";
type OwnedTab = { tabId: number | null; href: string };

function isOwnedTab(value: unknown): value is OwnedTab {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<OwnedTab>;
  if ((record.tabId !== null && !Number.isInteger(record.tabId)) || typeof record.href !== "string") return false;
  try {
    const url = new URL(record.href);
    if (!/^#milxdy-temporary-maker=[\da-f-]{36}$/u.test(url.hash)) return false;
    url.hash = "";
    const targets: ExternalHandoffTarget[] = ["milady", "remilio", "bonkler", "kagami", "deepfry"];
    return targets.some(target =>
      externalHandoffUrl(target === "deepfry" ? "cheeseworld" : "remilia-maker", target)?.href === url.href);
  } catch { return false; }
}

function ownsLocation(tab: chrome.tabs.Tab, href: string): boolean {
  return tab.pendingUrl
    ? tab.pendingUrl === href && (!tab.url || tab.url === "about:blank" || tab.url === href)
    : tab.url === href;
}

/** Durable custody survives worker termination; URL nonce prevents stale tab-ID reuse. */
export function createExternalHandoffTabs() {
  const owned = new Map<string, OwnedTab>();
  let pendingBindings = 0;
  const relinquishedDuringBinding = new Set<number>();
  let startup: Promise<void> | null = null;
  let writes: Promise<void> = Promise.resolve();
  const persist = () => {
    const snapshot = Array.from(owned.values());
    const next = writes.catch(() => undefined).then(() => chrome.storage.local.set({ [EXTERNAL_HANDOFF_TABS_KEY]: snapshot }));
    writes = next;
    return next;
  };
  const forget = async (href: string) => { if (owned.delete(href)) await persist(); };
  const forgetId = async (id: number) => { for (const record of owned.values()) if (record.tabId === id) await forget(record.href); };
  const close = async (id: number) => {
    const record = Array.from(owned.values()).find(record => record.tabId === id);
    if (!record) return;
    let tab: chrome.tabs.Tab;
    try { tab = await chrome.tabs.get(id); } catch { return; }
    if (owned.get(record.href) !== record) return;
    if (tab.active || !ownsLocation(tab, record.href)) {
      await forget(record.href);
      return;
    }
    try {
      await chrome.tabs.remove(id);
      await forget(record.href);
    } catch { /* Retain custody for the next worker startup if removal was interrupted. */ }
  };
  const recover = () => startup ||= (async () => {
    pendingBindings++;
    try {
    const stored = await chrome.storage.local.get(EXTERNAL_HANDOFF_TABS_KEY);
    const records = stored[EXTERNAL_HANDOFF_TABS_KEY];
    if (Array.isArray(records)) for (const record of records) if (isOwnedTab(record)) owned.set(record.href, record);
    const tabs = owned.size ? await chrome.tabs.query({}) : [];
    for (const record of Array.from(owned.values())) {
      const tab = tabs.find(tab => ownsLocation(tab, record.href));
      if (typeof tab?.id === "number") {
        record.tabId = tab.id;
        if (relinquishedDuringBinding.has(tab.id)) await forget(record.href); else await close(tab.id);
      }
      else await forget(record.href);
    }
    await persist();
    } finally { if (--pendingBindings === 0) relinquishedDuringBinding.clear(); }
  })().catch(error => { startup = null; throw error; });
  chrome.tabs.onUpdated.addListener((id, change) => {
    const record = Array.from(owned.values()).find(record => record.tabId === id);
    if (record && change.url && change.url !== record.href) void forget(record.href).catch(() => undefined);
    if (pendingBindings && change.url && change.url !== "about:blank" && !Array.from(owned.values()).some(record => record.href === change.url)) relinquishedDuringBinding.add(id);
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    if (pendingBindings) relinquishedDuringBinding.add(tabId);
    void forgetId(tabId).catch(() => undefined);
  });
  chrome.tabs.onRemoved.addListener(id => { void forgetId(id).catch(() => undefined); });
  const create = async (targetHref: string) => {
    await recover();
    const url = new URL(targetHref); url.hash = MARKER + crypto.randomUUID();
    const record: OwnedTab = { tabId:null, href:url.href };
    if (!isOwnedTab(record)) throw new Error("Unsupported maker destination.");
    owned.set(record.href, record);
    await persist(); // Store intent before create: startup can recover even if its response is lost.
    pendingBindings++;
    try {
      let tab: chrome.tabs.Tab;
      try { tab = await chrome.tabs.create({ url:url.href, active:false }); }
      catch (error) { await forget(record.href); throw error; }
      if (typeof tab.id !== "number") throw new Error("The maker tab could not be created.");
      record.tabId = tab.id;
      if (relinquishedDuringBinding.has(tab.id)) await forget(record.href);
      else try { await persist(); } catch (error) { await close(tab.id); throw error; }
      return { tab, href: url.href };
    } finally { if (--pendingBindings === 0) relinquishedDuringBinding.clear(); }
  };
  return { recover, create, close };
}

export function isSafeMakerImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/u.test(value) && value.length <= 15_000_000;
}
