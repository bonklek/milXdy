import type { AppPageContextAction } from "../app-sdk/app-platform";

const MENU_PREFIX = "milxdy:page-context:";
const HOST_GLOBAL = "__MILXDY_PAGE_CONTEXT_ACTION__";

export type PageContextActionApp = {
  id: string;
  pageContextActions?: AppPageContextAction[];
  defaultEnabled?: boolean;
  storageKeys?: { sync?: string[] };
  background?: { messageTypes?: string[] };
  settings?: Array<{
    role?: string;
    defaultValue?: unknown;
    storage?: { area?: "local" | "sync"; key?: string };
  }>;
};

type ResolvedPageContextAction = {
  appId: string;
  action: AppPageContextAction;
  syncKeys: string[];
  messageTypes: string[];
  enablement: { area: "local" | "sync"; key: string; fallback: boolean } | null;
};

export function registerPageContextActions(apps: PageContextActionApp[]): void {
  const actions = resolvePageContextActions(apps);
  for (const [menuId, value] of actions) {
    void Promise.all([
      chrome.contextMenus.remove(menuId).catch(() => undefined),
      isPageContextActionEnabled(value),
    ]).then(([, enabled]) => {
      chrome.contextMenus.create({
        id: menuId,
        title: value.action.label,
        contexts: ["page"],
        documentUrlPatterns: value.action.documentUrlPatterns,
        visible: enabled,
      });
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    for (const [menuId, value] of actions) {
      if (value.enablement?.area !== area || !changes[value.enablement.key]) continue;
      void isPageContextActionEnabled(value).then((visible) => chrome.contextMenus.update(menuId, { visible })).catch(() => undefined);
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const value = actions.get(String(info.menuItemId));
    if (!value || typeof tab?.id !== "number" || !isAllowedPageActionUrl(info.pageUrl || tab.url)) return;
    void isPageContextActionEnabled(value).then((enabled) => {
      if (enabled) return invokePageContextAction(tab.id!, value);
      return undefined;
    });
  });
}

export function isAllowedPageActionUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function pageContextMenuId(appId: string, actionId: string): string {
  return `${MENU_PREFIX}${appId}:${actionId}`;
}

function resolvePageContextActions(apps: PageContextActionApp[]): Map<string, ResolvedPageContextAction> {
  const resolved = new Map<string, ResolvedPageContextAction>();
  for (const app of apps) {
    for (const action of app.pageContextActions || []) {
      resolved.set(pageContextMenuId(app.id, action.id), {
        appId: app.id,
        action,
        syncKeys: [...new Set(app.storageKeys?.sync || [])],
        messageTypes: [...new Set(app.background?.messageTypes || [])],
        enablement: enablementFor(app),
      });
    }
  }
  return resolved;
}

function enablementFor(app: PageContextActionApp): ResolvedPageContextAction["enablement"] {
  const setting = app.settings?.find((candidate) => candidate.role === "enablement" && candidate.storage?.key
    && (candidate.storage.area === "local" || candidate.storage.area === "sync"));
  if (!setting?.storage?.key || !setting.storage.area) return null;
  return {
    area: setting.storage.area,
    key: setting.storage.key,
    fallback: typeof setting.defaultValue === "boolean" ? setting.defaultValue : app.defaultEnabled !== false,
  };
}

async function isPageContextActionEnabled(value: ResolvedPageContextAction): Promise<boolean> {
  if (!value.enablement) return true;
  const stored = await chrome.storage[value.enablement.area].get({ [value.enablement.key]: value.enablement.fallback });
  return stored[value.enablement.key] !== false;
}

async function invokePageContextAction(tabId: number, value: ResolvedPageContextAction): Promise<void> {
  const stored = value.syncKeys.length > 0 ? await chrome.storage.sync.get(value.syncKeys) : {};
  await chrome.scripting.executeScript({
    target: { tabId },
    func: installPageContextActionHost,
    args: [HOST_GLOBAL, value.appId, value.action.id, value.syncKeys, stored, value.messageTypes],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [value.action.entry],
  });
}

function installPageContextActionHost(
  globalName: string,
  appId: string,
  actionId: string,
  allowedSyncKeys: string[],
  stored: Record<string, unknown>,
  allowedMessageTypes: string[],
): void {
  const allowed = new Set(allowedSyncKeys);
  const host = {
    appId,
    actionId,
    storage: {
      sync: {
        values: Object.fromEntries(Object.entries(stored).filter(([key]) => allowed.has(key))),
        async set(values: Record<string, unknown>) {
          const safe = Object.fromEntries(Object.entries(values || {}).filter(([key]) => allowed.has(key)));
          if (Object.keys(safe).length > 0) await chrome.storage.sync.set(safe);
        },
      },
    },
    async sendMessage<T = unknown>(message: unknown): Promise<T | null> {
      const type = message && typeof message === "object" && !Array.isArray(message)
        ? (message as Record<string, unknown>).type
        : null;
      const authorized = typeof type === "string" && allowedMessageTypes.some((pattern) =>
        pattern.endsWith(":*") ? type.startsWith(pattern.slice(0, -1)) : type === pattern);
      if (!authorized) return null;
      return await chrome.runtime.sendMessage(message).catch(() => null) as T | null;
    },
  };
  Object.defineProperty(globalThis, globalName, { configurable: true, value: host });
}
