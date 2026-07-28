import "../../apps/wiki-links/background";
import "../../apps/post-reading/background";
import "../../apps/milady-maxxer/background";
import "../../apps/beetol/background.js";
import "../../apps/reminet-chat/background";
import { createBackgroundNetworkDeadlineSignal, initializeBackgroundNetworkBudget, runNetworkTask, setupBackgroundMessageRouter } from "../../platform/background/router";
import { browserAction } from "../../platform/background/browser-action";
import { PERFORMANCE_MODE_KEY, normalizePerformanceMode, type PerformanceMode } from "../../platform/settings/performance-mode";
import {
  ETHEREUM_RPC_URL,
  ENS_REGISTRY_ADDRESS,
  GWEI_NAME_SERVICE_ADDRESS,
  REMINET_IDENTITY_CACHE_KEY,
  REMINET_IDENTITY_CACHE_TTL_MS,
  addressFromEthCallResult,
  concatHex,
  contractForPfpProject,
  decodeAbiStringResult,
  emptyIdentityProfile,
  emptyReminetIdentityCache,
  ensNameCallData,
  ensResolverCallData,
  extractGweiNameCandidates,
  gweiGatewayUrl,
  gweiResolveCallData,
  gweiReverseResolveCallData,
  hexFromUtf8,
  identityCacheKeyForRemiliaUsername,
  identityCacheKeyForXHandle,
  identityCacheEntry,
  isEthereumAddress,
  mergeIdentityProfile,
  normalizeRemiliaUsername,
  normalizeGweiName,
  normalizeReminetIdentityCache,
  normalizeXHandle,
  ownerOfCallData,
  pruneSharedIdentityCache,
  rememberSharedIdentity,
  reverseEnsNameForAddress,
  type ReminetIdentityCache,
  type ReminetIdentityCacheEntry,
  type ReminetIdentityProfile,
} from "../../platform/auth/reminet-identity";
import {
  UPDATE_ALARM_NAME,
  UPDATE_CHECK_INTERVAL_MINUTES,
  UPDATE_STATUS_KEY,
  checkForUpdate,
  type UpdateStatus,
} from "../../platform/background/update-check";
import { parseAllowedUrl, type UrlAllowRule } from "../../platform/browser/url-allowlist";
import { MILXDY_ADDONS_CATALOG_FALLBACK_URL, MILXDY_ADDONS_CATALOG_URL, MILXDY_ADDONS_CATALOG_URL_RULES } from "../../platform/app-sdk/addons-catalog";
import appRegistry from "../../platform/app-sdk/first-party-apps.json";
import { externalHandoffUrl, isExternalHandoffAdapter, isExternalHandoffTarget, type ExternalHandoffRequest } from "../../platform/app-sdk/external-handoff";

// `attributeDisplay` is the reviewed maker's own top-level renderer. This
// declaration is used only by `world: "MAIN"` injected code; the extension
// never reads or writes the maker page outside the explicit reviewed handoff.
declare const attributeDisplay: {
  currentlyDisplaying?: boolean;
  canvas?: HTMLCanvasElement;
  drawSelectedLayers?: (full?: boolean, canvas?: boolean) => Promise<void>;
} | undefined;

type RemiStatsMessage = {
  type: "remistats:getUser";
  handle: string;
  force?: boolean;
};

type ReminetIdentityMessage = {
  type: "reminetIdentity:getProfile";
  xHandle?: string;
  remiliaUsername?: string;
  force?: boolean;
  maxAgeMs?: number;
};

type UpdateMessage = {
  type: "milxdy:checkUpdate";
};

type LocalAddonStatusMessage = {
  type: "milxdy:getLocalAddonStatus";
};

type OpenAddonsSettingsMessage = {
  type: "milxdy:openAddonsSettings";
  target: "folder" | "rebuild";
};

type OpenAddonsCatalogMessage = { type: "milxdy:openAddonsCatalog" };

type FetchImageDataUrlMessage = {
  type: "milxdy:fetchImageDataUrl";
  url: string;
};

type ExternalHandoffMessage = ExternalHandoffRequest & { type: "milxdy:externalHandoff" };

const LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY = "milxdy.reminetChat.profileCache.v3";
let sharedIdentityCacheWriteQueue: Promise<void> = Promise.resolve();
let addOnsCatalogTabId: number | null = null;
let addOnsCatalogLaunch: Promise<Record<string, unknown>> | null = null;

type MiladychanFetchJsonMessage = {
  type: "miladychan:fetchJson";
  url: string;
};

type MusicFetchJsonMessage = {
  type: "music:fetchJson";
  url: string;
};

type MusicPostFormMessage = {
  type: "music:postForm";
  url: string;
  form: Record<string, string>;
};

type MusicFetchImageDataUrlMessage = {
  type: "music:fetchImageDataUrl";
  url: string;
};

type WikiFetchImageDataUrlMessage = {
  type: "wiki:fetchImageDataUrl";
  url: string;
};

type WikiSidebarOpenTabMessage = {
  type: "wikiSidebar:openTab";
  url: string;
};

type WikiSidebarNavigationMessage = {
  type: "wikiSidebar:navigation";
  url: string;
};

type WikiSidebarNavigateInFrameMessage = {
  type: "wikiSidebar:navigateInFrame";
  url: string;
};

type WikiSidebarHistoryMessage = {
  type: "wikiSidebar:history";
  direction: "back" | "forward";
};

type WikiSidebarReadAloudRequestMessage = {
  type: "wikiSidebar:readAloudRequest";
  articleId: string;
  title: string;
  text: string;
};

const MUSICBRAINZ_JSON_RULES: readonly UrlAllowRule[] = [
  { origin: "https://musicbrainz.org", pathPrefix: "/ws/2/" },
];
const ACOUSTID_FORM_RULES: readonly UrlAllowRule[] = [
  { origin: "https://api.acoustid.org", pathPattern: /^\/v2\/lookup$/ },
];
const MILADYCHAN_JSON_RULES: readonly UrlAllowRule[] = [
  { origin: "https://boards.miladychan.org", pathPrefix: "/json/" },
];
const MUSIC_IMAGE_RULES: readonly UrlAllowRule[] = [
  { origin: "https://pbs.twimg.com" },
  { origin: "https://boards.miladychan.org" },
];
const MILADY_MAKER_BANNER_RULES: readonly UrlAllowRule[] = [
  { origin: "https://miladymaker.net", pathPattern: /^\/banners\/nft\/\d+\.png$/ },
];
const WIKI_IMAGE_RULES: readonly UrlAllowRule[] = [
  { origin: "https://wiki.remilia.org", pathPrefix: "/images/" },
  { origin: "https://remilia.wiki", pathPrefix: "/images/" },
];
const MAX_IMAGE_RESPONSE_BYTES = 5 * 1024 * 1024;
const IMAGE_TOO_LARGE_ERROR = "IMAGE_TOO_LARGE";
const WIKI_SIDEBAR_OPEN_TAB_RULES: readonly UrlAllowRule[] = [
  { origin: "https://wiki.remilia.org" },
  { origin: "https://remilia.wiki" },
  { origin: "https://sso.remilia.org" },
];
const WIKI_SIDEBAR_NAVIGATION_RULES: readonly UrlAllowRule[] = [
  { origin: "https://wiki.remilia.org" },
  { origin: "https://remilia.wiki" },
];
const EXTERNAL_HANDOFF_TAB_TIMEOUT_MS = 15_000;

setupBackgroundMessageRouter([
  {
    type: "milxdy:getLocalAddonStatus",
    matches: isLocalAddonStatusMessage,
    handle: readLocalAddonStatus,
  },
  {
    type: "milxdy:openAddonsSettings",
    matches: isOpenAddonsSettingsMessage,
    handle: (message, sender) => openAddonsSettings(message.target, sender),
  },
  {
    type: "milxdy:openAddonsCatalog",
    matches: isOpenAddonsCatalogMessage,
    handle: openAddonsCatalogWindow,
  },
  {
    type: "milxdy:checkUpdate",
    matches: isUpdateMessage,
    handle: runUpdateCheck,
  },
  {
    type: "milxdy:fetchImageDataUrl",
    matches: isFetchImageDataUrlMessage,
    handle: (message, sender) => fetchImageDataUrlForSender(message.url, sender),
  },
  {
    type: "milxdy:externalHandoff",
    matches: isExternalHandoffMessage,
    handle: (message, sender) => launchExternalHandoff(message, sender),
  },
  {
    type: "miladychan:fetchJson",
    matches: isMiladychanFetchJsonMessage,
    handle: (message, sender) => fetchMiladychanJsonForSender(message.url, sender),
  },
  {
    type: "music:fetchJson",
    matches: isMusicFetchJsonMessage,
    handle: (message, sender) => fetchMusicJsonForSender(message.url, sender),
  },
  {
    type: "music:postForm",
    matches: isMusicPostFormMessage,
    handle: (message, sender) => postMusicFormForSender(message.url, message.form, sender),
  },
  {
    type: "music:fetchImageDataUrl",
    matches: isMusicFetchImageDataUrlMessage,
    handle: (message, sender) => fetchMusicImageDataUrlForSender(message.url, sender),
  },
  {
    type: "wiki:fetchImageDataUrl",
    matches: isWikiFetchImageDataUrlMessage,
    handle: (message, sender) => fetchWikiImageDataUrlForSender(message.url, sender),
  },
  {
    type: "wikiSidebar:openTab",
    matches: isWikiSidebarOpenTabMessage,
    handle: (message, sender) => openWikiSidebarTab(message.url, sender),
  },
  {
    type: "wikiSidebar:navigation",
    matches: isWikiSidebarNavigationMessage,
    handle: (message, sender) => forwardWikiSidebarNavigation(message.url, sender),
  },
  {
    type: "wikiSidebar:navigateInFrame",
    matches: isWikiSidebarNavigateInFrameMessage,
    handle: (message, sender) => forwardWikiSidebarNavigateInFrame(message.url, sender),
  },
  {
    type: "wikiSidebar:history",
    matches: isWikiSidebarHistoryMessage,
    handle: (message, sender) => forwardWikiSidebarHistory(message.direction, sender),
  },
  {
    type: "wikiSidebar:readAloudRequest",
    matches: isWikiSidebarReadAloudRequestMessage,
    handle: (message, sender) => forwardWikiSidebarReadAloudRequest(message, sender),
  },
  {
    type: "remistats:getUser",
    matches: isRemiStatsMessage,
    handle: (message, sender) => fetchRemiStatsUserForSender(message.handle, message.force === true, sender),
  },
  {
    type: "reminetIdentity:getProfile",
    matches: isReminetIdentityMessage,
    handle: (message, sender) => resolveReminetIdentityForSender(message, sender),
  },
]);
void initializeBackgroundNetworkBudget();

function isRemiStatsMessage(message: unknown): message is RemiStatsMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "remistats:getUser" && typeof record.handle === "string";
}

function isReminetIdentityMessage(message: unknown): message is ReminetIdentityMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "reminetIdentity:getProfile"
    && (typeof record.xHandle === "string" || typeof record.remiliaUsername === "string");
}

function isUpdateMessage(message: unknown): message is UpdateMessage {
  return Boolean(message && typeof message === "object" && (message as Record<string, unknown>).type === "milxdy:checkUpdate");
}

function isLocalAddonStatusMessage(message: unknown): message is LocalAddonStatusMessage {
  return Boolean(message && typeof message === "object" && (message as Record<string, unknown>).type === "milxdy:getLocalAddonStatus");
}

function isOpenAddonsCatalogMessage(message: unknown): message is OpenAddonsCatalogMessage {
  return Boolean(message && typeof message === "object" && (message as Record<string, unknown>).type === "milxdy:openAddonsCatalog");
}

async function openAddonsCatalogWindow(): Promise<Record<string, unknown>> {
  if (addOnsCatalogLaunch) return addOnsCatalogLaunch;
  addOnsCatalogLaunch = (async () => {
    const target = parseAllowedUrl(MILXDY_ADDONS_CATALOG_URL, MILXDY_ADDONS_CATALOG_URL_RULES)
      ?? parseAllowedUrl(MILXDY_ADDONS_CATALOG_FALLBACK_URL, MILXDY_ADDONS_CATALOG_URL_RULES);
    if (!target) return { ok: false, error: "The configured App Store URL is invalid." };
    if (addOnsCatalogTabId !== null) {
      try {
        await chrome.tabs.update(addOnsCatalogTabId, { active: true });
        return { ok: true, reused: true };
      } catch {
        addOnsCatalogTabId = null;
      }
    }
    try {
      const created = await chrome.tabs.create({ url: target.href, active: true });
      addOnsCatalogTabId = typeof created.id === "number" ? created.id : null;
      return { ok: true, reused: false };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not open the App Store window." };
    }
  })();
  try {
    return await addOnsCatalogLaunch;
  } finally {
    addOnsCatalogLaunch = null;
  }
}

async function readLocalAddonStatus(): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${chrome.runtime.getURL("local-addon-status.json")}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return { ok: false, error: `Status file returned HTTP ${response.status}.` };
    const status = await response.json() as Record<string, unknown>;
    if ((status.schemaVersion !== 1 && status.schemaVersion !== 2) || typeof status.mode !== "string" || typeof status.state !== "string") {
      return { ok: false, error: "Status file is invalid." };
    }
    return { ok: true, status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function isOpenAddonsSettingsMessage(message: unknown): message is OpenAddonsSettingsMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:openAddonsSettings" && (record.target === "folder" || record.target === "rebuild");
}

async function openAddonsSettings(target: "folder" | "rebuild", sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  const senderUrl = sender.tab?.url;
  if (!senderUrl) return { ok: false, error: "Unsupported catalog sender." };
  try {
    const parsed = new URL(senderUrl);
    if (parsed.origin !== "https://bonklek.github.io" || !parsed.pathname.startsWith("/milXdy/")) {
      return { ok: false, error: "Unsupported catalog sender." };
    }
  } catch {
    return { ok: false, error: "Unsupported catalog sender." };
  }
  const optionsUrl = new URL(chrome.runtime.getURL("popup.html"));
  optionsUrl.searchParams.set("focus", target);
  optionsUrl.hash = "addons";
  await chrome.tabs.create({ url: optionsUrl.toString() });
  return { ok: true };
}

function isFetchImageDataUrlMessage(message: unknown): message is FetchImageDataUrlMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:fetchImageDataUrl" && typeof record.url === "string";
}

function isExternalHandoffMessage(message: unknown): message is ExternalHandoffMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:externalHandoff"
    && typeof record.appId === "string"
    && typeof record.handoffId === "string"
    && isExternalHandoffAdapter(record.adapter)
    && isExternalHandoffTarget(record.target)
    && typeof record.topText === "string"
    && typeof record.bottomText === "string"
    && (record.mode === "captioned" || record.mode === "randomMeme");
}

async function launchExternalHandoff(message: ExternalHandoffMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  const app = (appRegistry as Array<{ id?: string; externalHandoffs?: Array<{ id?: string; adapter?: string; target?: string; modes?: string[] }> }>)
    .find((candidate) => candidate.id === message.appId);
  const declaration = app?.externalHandoffs?.find((candidate) => candidate.id === message.handoffId);
  if (!declaration || declaration.adapter !== message.adapter || declaration.target !== message.target) {
    return { ok: false, error: "The requested handoff is not declared by this package." };
  }
  if (!(declaration.modes || ["captioned"]).includes(message.mode)) return { ok: false, error: "The requested handoff mode is not declared by this package." };
  const targetUrl = externalHandoffUrl(message.adapter, message.target);
  if (!targetUrl) return { ok: false, error: "Unsupported maker destination." };
  try {
    const tab = await chrome.tabs.create({ url: targetUrl.href, active: false });
    if (typeof tab.id !== "number") return { ok: false, error: "The maker tab could not be created." };
    await waitForExternalHandoffTab(tab.id, targetUrl.href);
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: renderRemiliaMakerImage,
      args: [message.topText, message.bottomText, message.mode],
    });
    const result = results[0]?.result as { ok?: boolean; error?: string; imageDataUrl?: string } | undefined;
    if (result?.ok !== true) return { ok: false, error: result?.error || "The maker controls were unavailable." };
    if (!isSafeMakerImageDataUrl(result.imageDataUrl)) return { ok: false, error: "The maker did not return a usable image." };
    return { ok: true, imageDataUrl: result.imageDataUrl };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function waitForExternalHandoffTab(tabId: number, expectedHref: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("The maker did not finish loading in time.")), EXTERNAL_HANDOFF_TAB_TIMEOUT_MS);
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (error) reject(error);
      else resolve();
    };
    const onUpdated = (updatedTabId: number, change: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (updatedTabId !== tabId || change.status !== "complete") return;
      if (tab.url !== expectedHref) {
        finish(new Error("The maker tab navigated away from its reviewed destination."));
        return;
      }
      finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    void chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") onUpdated(tabId, { status: "complete" }, tab);
    }).catch(() => finish(new Error("The maker tab closed before it loaded.")));
  });
}

function isSafeMakerImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/u.test(value) && value.length <= 15_000_000;
}

/** Runs only in the reviewed maker tab after an explicit package gesture. */
async function renderRemiliaMakerImage(topText: string, bottomText: string, mode: "captioned" | "randomMeme"): Promise<{ ok: boolean; error?: string; imageDataUrl?: string }> {
  // `chrome.scripting.executeScript` serializes only this function, so the
  // wait helper must remain inside it rather than closing over extension code.
  const waitForRender = async (): Promise<void> => {
    const deadline = Date.now() + 15_000;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
    while (Date.now() < deadline) {
      const display = typeof attributeDisplay === "undefined" ? undefined : attributeDisplay;
      if (display && display.currentlyDisplaying === false && display.canvas?.width && display.canvas.height) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    throw new Error("The maker did not finish rendering in time.");
  };
  const top = document.querySelector<HTMLInputElement>("#topText");
  const bottom = document.querySelector<HTMLInputElement>("#bottomText");
  const random = document.querySelector<HTMLElement>("#randomButton");
  if (!top || !bottom || !random) return { ok: false, error: "This maker no longer exposes its reviewed caption controls." };
  random.click();
  await waitForRender();
  const setInput = (input: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  if (mode === "captioned") {
    setInput(top, topText);
    setInput(bottom, bottomText);
  }
  // The reviewed maker exposes its complete renderer only from its own main
  // world. Rendering there preserves its selected layers, text treatment, and
  // pixel-art settings instead of trying to recreate its DOM in the extension.
  const display = typeof attributeDisplay === "undefined" ? undefined : attributeDisplay;
  if (!display?.drawSelectedLayers) return { ok: false, error: "This maker no longer exposes its reviewed renderer." };
  await display.drawSelectedLayers(false, true);
  const image = document.querySelector<HTMLImageElement>("#downloadable");
  if (!image?.src.startsWith("data:image/png;base64,")) return { ok: false, error: "The maker did not render a PNG." };
  return { ok: true, imageDataUrl: image.src };
}

function isMiladychanFetchJsonMessage(message: unknown): message is MiladychanFetchJsonMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "miladychan:fetchJson" && typeof record.url === "string";
}

function isMusicFetchJsonMessage(message: unknown): message is MusicFetchJsonMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "music:fetchJson" && typeof record.url === "string";
}

function isMusicPostFormMessage(message: unknown): message is MusicPostFormMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  if (record.type !== "music:postForm" || typeof record.url !== "string") return false;
  if (!record.form || typeof record.form !== "object" || Array.isArray(record.form)) return false;
  return Object.values(record.form).every((value) => typeof value === "string");
}

function isMusicFetchImageDataUrlMessage(message: unknown): message is MusicFetchImageDataUrlMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "music:fetchImageDataUrl" && typeof record.url === "string";
}

function isWikiFetchImageDataUrlMessage(message: unknown): message is WikiFetchImageDataUrlMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wiki:fetchImageDataUrl" && typeof record.url === "string";
}

function isWikiSidebarOpenTabMessage(message: unknown): message is WikiSidebarOpenTabMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:openTab" && typeof record.url === "string";
}

function isWikiSidebarNavigationMessage(message: unknown): message is WikiSidebarNavigationMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:navigation" && typeof record.url === "string";
}

function isWikiSidebarNavigateInFrameMessage(message: unknown): message is WikiSidebarNavigateInFrameMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:navigateInFrame" && typeof record.url === "string";
}

function isWikiSidebarHistoryMessage(message: unknown): message is WikiSidebarHistoryMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:history" && (record.direction === "back" || record.direction === "forward");
}

function isWikiSidebarReadAloudRequestMessage(message: unknown): message is WikiSidebarReadAloudRequestMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:readAloudRequest"
    && typeof record.articleId === "string"
    && typeof record.title === "string"
    && typeof record.text === "string";
}

async function fetchRemiStatsUser(handleValue: string, force = false): Promise<Record<string, unknown>> {
  const handle = normalizeXHandle(handleValue);
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    return { ok: false, status: 0, notFound: true };
  }

  const [mode, cache] = await Promise.all([loadCurrentPerformanceMode(), loadIdentityCache()]);
  const cached = force ? null : cachedRemiStatsResponse(cache, handle, remiStatsCacheTtlForMode(mode));
  if (cached) return cached;

  try {
    const response = await budgetedFetch(`https://api.remistats.net/user/${encodeURIComponent(handle)}`, { credentials: "omit" }, "remistats:user");
    if (response.status === 404) return { ok: false, status: 404, notFound: true };
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const data = await response.json();
    const profile = mergeIdentityProfile(
      emptyIdentityProfile(),
      profileFromRemiStatsResponse(data, handle),
      "remistats",
    );
    await rememberIdentityProfile(profile, { xHandles: [handle] });
    return { ok: true, cached: false, data };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchRemiStatsUserForSender(handleValue: string, force: boolean, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchRemiStatsUser(handleValue, force);
}

async function resolveReminetIdentityForSender(message: ReminetIdentityMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return resolveReminetIdentity(message);
}

async function loadCurrentPerformanceMode(): Promise<PerformanceMode> {
  const stored = await chrome.storage.local.get({ [PERFORMANCE_MODE_KEY]: "balanced" }).catch(() => ({})) as Record<string, unknown>;
  return normalizePerformanceMode(stored[PERFORMANCE_MODE_KEY]);
}

function remiStatsCacheTtlForMode(mode: PerformanceMode): number {
  if (mode === "fast") return REMINET_IDENTITY_CACHE_TTL_MS;
  if (mode === "balanced") return 30 * 60 * 1000;
  if (mode === "full") return 5 * 60 * 1000;
  return 0;
}

function cachedRemiStatsResponse(cache: ReminetIdentityCache, handle: string, ttlMs: number): Record<string, unknown> | null {
  if (ttlMs <= 0) return null;
  const entry = identityCacheEntry(cache, identityCacheKeyForXHandle(handle));
  if (!entry?.profile || typeof entry.cachedAt !== "number" || Date.now() - entry.cachedAt >= ttlMs) return null;
  if (entry.profile.remiStatsScore === null && entry.profile.beetleCount === null) return null;
  return {
    ok: true,
    cached: true,
    data: {
      user: remiStatsUserFromIdentityProfile(entry.profile, handle),
    },
  };
}

async function resolveReminetIdentity(message: ReminetIdentityMessage): Promise<Record<string, unknown>> {
  const xHandle = normalizeXHandle(message.xHandle);
  const remiliaUsername = normalizeRemiliaUsername(message.remiliaUsername);
  if (!xHandle && !remiliaUsername) return { ok: false, error: "INVALID_PROFILE_LOOKUP" };

  const cache = await loadIdentityCache();
  const lookupKeys = [
    xHandle ? identityCacheKeyForXHandle(xHandle) : "",
    remiliaUsername ? identityCacheKeyForRemiliaUsername(remiliaUsername) : "",
  ].filter(Boolean);
  const maxAgeMs = normalizeIdentityMaxAge(message.maxAgeMs);
  const cached = lookupKeys
    .map((key) => identityCacheEntry(cache, key))
    .find((entry) => freshIdentityEntry(entry, maxAgeMs, Boolean(remiliaUsername)));
  if (cached && message.force !== true && hasCurrentIdentitySchema(cached.profile)) {
    return { ok: true, cached: true, profile: cached.profile };
  }

  let profile = cached?.profile || emptyIdentityProfile();
  const warnings: string[] = [];
  if (xHandle) profile = mergeIdentityProfile(profile, { xHandle }, "input");
  if (remiliaUsername) profile = mergeIdentityProfile(profile, { remiliaUsername }, "input");

  if (xHandle) {
    const remiStatsResponse = await fetchRemiStatsUser(xHandle, message.force === true);
    if (remiStatsResponse.ok) {
      profile = mergeIdentityProfile(profile, profileFromRemiStatsResponse(remiStatsResponse.data, xHandle), "remistats");
    } else if (remiStatsResponse.notFound || remiStatsResponse.status === 404) {
      profile = mergeIdentityProfile(profile, { xHandle }, "remistats:notFound");
    }
  }

  const resolvedUsername = normalizeRemiliaUsername(profile.remiliaUsername || remiliaUsername);
  let publicProfileCachedAt: number | undefined;
  if (resolvedUsername) {
    const remiliaProfile = await fetchRemiliaPublicProfile(resolvedUsername);
    if (remiliaProfile) {
      profile = mergeIdentityProfile(profile, profileFromRemiliaResponse(remiliaProfile, resolvedUsername), "remilia.net");
      publicProfileCachedAt = Date.now();
    } else {
      warnings.push("REMILIA_PROFILE_UNAVAILABLE");
    }
  }

  const resolvedXHandle = normalizeXHandle(profile.xHandle);
  if (!xHandle && resolvedXHandle) {
    const remiStatsResponse = await fetchRemiStatsUser(resolvedXHandle, message.force === true);
    if (remiStatsResponse.ok) {
      profile = mergeIdentityProfile(profile, profileFromRemiStatsResponse(remiStatsResponse.data, resolvedXHandle), "remistats");
    }
  }

  profile = await attachNftOwner(profile);
  profile = await attachEnsName(profile);
  profile = await attachGweiName(profile);
  await rememberIdentityProfile(profile, { publicProfileCachedAt });
  return { ok: true, cached: false, partial: warnings.length > 0, warnings, profile };
}

function normalizeIdentityMaxAge(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return REMINET_IDENTITY_CACHE_TTL_MS;
  return Math.max(0, Math.min(7 * 24 * 60 * 60 * 1000, numeric));
}

async function fetchRemiliaPublicProfile(username: string): Promise<unknown | null> {
  const clean = normalizeRemiliaUsername(username);
  if (!clean) return null;
  try {
    const response = await budgetedFetch(`https://www.remilia.net/api/profile/~${encodeURIComponent(clean)}`, {
      credentials: "omit",
      headers: { Accept: "application/json" },
    }, "reminetIdentity:profile");
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function attachNftOwner(profile: ReminetIdentityProfile): Promise<ReminetIdentityProfile> {
  if (profile.nftOwnerAddress || !profile.pfpProject || !profile.pfpId) return profile;
  const contract = contractForPfpProject(profile.pfpProject);
  if (!contract) return profile;
  const owner = await fetchNftOwner(contract, profile.pfpId);
  return mergeIdentityProfile(profile, {
    nftContractAddress: contract,
    nftOwnerAddress: owner,
  }, owner ? "ethereum:ownerOf" : "ethereum:unsupported");
}

async function fetchNftOwner(contract: string, tokenId: string): Promise<string | null> {
  const data = safeOwnerOfCallData(tokenId);
  if (!data) return null;
  try {
    const result = await ethereumRpc("eth_call", [{ to: contract, data }, "latest"], "reminetIdentity:ownerOf");
    const owner = addressFromEthCallResult(result);
    return owner && isEthereumAddress(owner) ? owner : null;
  } catch {
    return null;
  }
}

async function attachEnsName(profile: ReminetIdentityProfile): Promise<ReminetIdentityProfile> {
  if (profile.ensName || !profile.nftOwnerAddress) return profile;
  const ensName = await fetchReverseEnsName(profile.nftOwnerAddress);
  return mergeIdentityProfile(profile, { ensName }, ensName ? "ens:reverse" : "ens:none");
}

async function attachGweiName(profile: ReminetIdentityProfile): Promise<ReminetIdentityProfile> {
  if (profile.gweiName || !profile.nftOwnerAddress) return profile;
  const reverseName = await fetchReverseGweiName(profile.nftOwnerAddress);
  if (reverseName) {
    return mergeIdentityProfile(profile, {
      gweiName: reverseName,
      gweiGatewayUrl: gweiGatewayUrl(reverseName),
    }, "gwei:reverse");
  }

  for (const candidate of profile.gweiNameCandidates || []) {
    const resolved = await resolveGweiName(candidate);
    if (resolved?.toLowerCase() !== profile.nftOwnerAddress.toLowerCase()) continue;
    return mergeIdentityProfile(profile, {
      gweiName: candidate,
      gweiGatewayUrl: gweiGatewayUrl(candidate),
    }, "gwei:verified-forward");
  }

  return mergeIdentityProfile(profile, {}, "gwei:none");
}

async function fetchReverseGweiName(address: string): Promise<string | null> {
  const data = gweiReverseResolveCallData(address);
  if (!data) return null;
  const result = await ethereumRpc("eth_call", [{ to: GWEI_NAME_SERVICE_ADDRESS, data }, "latest"], "reminetIdentity:gweiReverse");
  return normalizeGweiName(decodeAbiStringResult(result));
}

async function resolveGweiName(name: string): Promise<string | null> {
  const normalized = normalizeGweiName(name);
  if (!normalized) return null;
  const node = await ensNamehash(normalized);
  if (!node) return null;
  const data = gweiResolveCallData(node);
  if (!data) return null;
  const result = await ethereumRpc("eth_call", [{ to: GWEI_NAME_SERVICE_ADDRESS, data }, "latest"], "reminetIdentity:gweiResolve");
  const address = addressFromEthCallResult(result);
  return address && isEthereumAddress(address) ? address : null;
}

async function fetchReverseEnsName(address: string): Promise<string | null> {
  if (!isEthereumAddress(address)) return null;
  const reverseName = reverseEnsNameForAddress(address);
  if (!reverseName) return null;
  const node = await ensNamehash(reverseName);
  if (!node) return null;
  const resolverData = ensResolverCallData(node);
  if (!resolverData) return null;
  const resolverResult = await ethereumRpc("eth_call", [{ to: ENS_REGISTRY_ADDRESS, data: resolverData }, "latest"], "reminetIdentity:ensResolver");
  const resolver = addressFromEthCallResult(resolverResult);
  if (!resolver || !isEthereumAddress(resolver)) return null;
  const nameData = ensNameCallData(node);
  if (!nameData) return null;
  const nameResult = await ethereumRpc("eth_call", [{ to: resolver, data: nameData }, "latest"], "reminetIdentity:ensName");
  return decodeAbiStringResult(nameResult);
}

async function ensNamehash(name: string): Promise<string | null> {
  let node = `0x${"0".repeat(64)}`;
  const labels = name.split(".").filter(Boolean);
  for (let index = labels.length - 1; index >= 0; index -= 1) {
    const labelHash = await ethereumSha3(hexFromUtf8(labels[index] || ""));
    if (!labelHash) return null;
    const packed = concatHex(node, labelHash);
    if (!packed) return null;
    const nextNode = await ethereumSha3(packed);
    if (!nextNode) return null;
    node = nextNode;
  }
  return node;
}

async function ethereumSha3(data: string): Promise<string | null> {
  const result = await ethereumRpc("web3_sha3", [data], "reminetIdentity:sha3");
  return typeof result === "string" && /^0x[0-9a-fA-F]{64}$/.test(result) ? result : null;
}

async function ethereumRpc(method: string, params: unknown[], label: string): Promise<unknown> {
  const response = await budgetedFetch(ETHEREUM_RPC_URL, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, label);
  const json = await response.json().catch(() => null) as Record<string, unknown> | null;
  return json?.result;
}

function safeOwnerOfCallData(tokenId: string): string | null {
  try {
    return ownerOfCallData(tokenId);
  } catch {
    return null;
  }
}

function profileFromRemiStatsResponse(value: unknown, fallbackHandle: string): Partial<ReminetIdentityProfile> {
  const data = objectValue(value);
  const user = objectValue(data.user);
  if (!Object.keys(user).length) return { xHandle: fallbackHandle };
  const remiliaUsername = normalizeRemiliaUsername(
    stringValue(user.username)
    || stringValue(user.userHandle)
    || stringValue(user.user_handle)
    || stringValue(user.handle)
    || stringValue(user.remiliaUsername)
    || stringValue(objectValue(user.profile).username),
  );
  return {
    xHandle: normalizeXHandle(stringValue(user.twitterHandle) || stringValue(user.twitter_handle) || fallbackHandle) || fallbackHandle,
    remiliaUsername: remiliaUsername || null,
    displayName: stringValue(user.displayName) || stringValue(user.display_name) || null,
    pfpProject: stringValue(user.pfpProject) || stringValue(user.pfp_project) || null,
    pfpId: stringValue(user.pfpId) || stringValue(user.pfp_id) || null,
    pfpUrl: stringValue(user.pfpUrl) || stringValue(user.pfp_url) || null,
    beetleCount: numberValue(user.beetles),
    remiStatsScore: numberValue(user.socialCreditScore) ?? numberValue(user.social_credit_score) ?? numberValue(user.socialCredit),
    friendCount: numberValue(user.friendCount) ?? numberValue(user.friend_count),
  };
}

function remiStatsUserFromIdentityProfile(profile: ReminetIdentityProfile, fallbackHandle: string): Record<string, unknown> {
  return {
    username: profile.remiliaUsername || fallbackHandle,
    userHandle: profile.remiliaUsername || fallbackHandle,
    handle: profile.remiliaUsername || fallbackHandle,
    remiliaUsername: profile.remiliaUsername || null,
    twitterHandle: normalizeXHandle(profile.xHandle) || fallbackHandle,
    displayName: profile.displayName,
    pfpProject: profile.pfpProject,
    pfpId: profile.pfpId,
    pfpUrl: profile.pfpUrl,
    beetles: profile.beetleCount,
    socialCreditScore: profile.remiStatsScore,
    friendCount: profile.friendCount,
  };
}

function profileFromRemiliaResponse(value: unknown, fallbackUsername: string): Partial<ReminetIdentityProfile> {
  const data = objectValue(value);
  const user = objectValue(data.user);
  if (!Object.keys(user).length) return { remiliaUsername: fallbackUsername };
  const pfp = objectValue(user.pfp);
  const xHandle = connectedXHandle(user);
  return {
    xHandle: xHandle || null,
    remiliaUsername: normalizeRemiliaUsername(stringValue(user.username) || stringValue(user.userHandle) || fallbackUsername) || fallbackUsername,
    displayName: stringValue(user.displayName) || stringValue(user.display_name) || stringValue(user.name) || null,
    pfpProject: stringValue(pfp.project) || stringValue(user.pfpProject) || null,
    pfpId: stringValue(pfp.id) || stringValue(user.pfpId) || null,
    pfpUrl: stringValue(user.pfpUrl) || stringValue(user.pfp_url) || null,
    beetleCount: numberValue(user.beetles),
    remiStatsScore: numberValue(user.socialCredit) ?? numberValue(user.socialCreditScore),
    friendCount: numberValue(user.friendCount),
    trophyShelves: Array.isArray(user.trophyShelves) ? user.trophyShelves : null,
    allTrophies: Array.isArray(user.allTrophies) ? user.allTrophies : null,
    connections: Array.isArray(user.connections) ? user.connections : null,
    gweiNameCandidates: extractGweiNameCandidates(user),
  };
}

function connectedXHandle(user: Record<string, unknown>): string | null {
  const direct = normalizeXHandle(
    stringValue(user.twitterHandle)
    || stringValue(user.twitter_handle)
    || stringValue(user.twitterUsername)
    || stringValue(user.twitter_username)
    || stringValue(user.xHandle)
    || stringValue(user.x_handle)
    || stringValue(user.xUsername)
    || stringValue(user.x_username)
    || handleFromUrl(stringValue(user.twitterUrl) || stringValue(user.twitter_url) || stringValue(user.xUrl) || stringValue(user.x_url)),
  );
  if (direct) return direct;
  if (!Array.isArray(user.connections)) return null;
  for (const item of user.connections) {
    const record = objectValue(item);
    const provider = String(record.provider || record.type || record.platform || record.service || record.kind || "").toLowerCase();
    if (!/twitter|^x$/.test(provider)) continue;
    const handle = normalizeXHandle(
      stringValue(record.handle)
      || stringValue(record.username)
      || stringValue(record.userName)
      || stringValue(record.user_name)
      || stringValue(record.screenName)
      || stringValue(record.screen_name)
      || stringValue(record.nickname)
      || stringValue(record.name)
      || handleFromUrl(stringValue(record.url) || stringValue(record.href) || stringValue(record.profileUrl) || stringValue(record.profile_url)),
    );
    if (handle) return handle;
  }
  return null;
}

function handleFromUrl(value: string): string {
  const match = value.match(/(?:twitter\.com|x\.com)\/@?([^/?#]+)/i);
  return match ? match[1] || "" : "";
}

async function loadIdentityCache(): Promise<ReminetIdentityCache> {
  const stored = await chrome.storage.local.get({
    [REMINET_IDENTITY_CACHE_KEY]: emptyReminetIdentityCache(),
    [LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY]: null,
  }).catch(() => ({})) as Record<string, unknown>;
  const cache = normalizeReminetIdentityCache(stored[REMINET_IDENTITY_CACHE_KEY]);
  const legacyChatCache = objectValue(stored[LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY]);
  if (!Object.keys(legacyChatCache).length) return cache;

  const migrated = await mutateSharedIdentityCache((latest) => {
    for (const [handle, candidate] of Object.entries(legacyChatCache)) {
      const entry = objectValue(candidate);
      const user = objectValue(entry.user);
      const cachedAt = numberValue(entry.cachedAt);
      if (!Object.keys(user).length || cachedAt === null) continue;
      const profile = mergeIdentityProfile(
        emptyIdentityProfile(),
        profileFromRemiliaResponse({ user }, handle),
        "reminet-chat:migrated",
      );
      rememberSharedIdentity(latest, profile, {
        cachedAt,
        publicProfileCachedAt: cachedAt,
        aliases: [
          identityCacheKeyForRemiliaUsername(handle),
          profile.xHandle ? identityCacheKeyForXHandle(profile.xHandle) : "",
        ],
      });
    }
  });
  await chrome.storage.local.remove(LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY);
  return migrated;
}

async function rememberIdentityProfile(
  profile: ReminetIdentityProfile,
  aliases: { xHandles?: string[]; remiliaUsernames?: string[]; publicProfileCachedAt?: number } = {},
): Promise<void> {
  const xHandles = new Set([normalizeXHandle(profile.xHandle), ...(aliases.xHandles || []).map(normalizeXHandle)].filter(Boolean));
  const remiliaUsernames = new Set([normalizeRemiliaUsername(profile.remiliaUsername), ...(aliases.remiliaUsernames || []).map(normalizeRemiliaUsername)].filter(Boolean));
  await mutateSharedIdentityCache((latest) => {
    rememberSharedIdentity(latest, profile, {
      publicProfileCachedAt: aliases.publicProfileCachedAt,
      aliases: [
        ...Array.from(xHandles, identityCacheKeyForXHandle),
        ...Array.from(remiliaUsernames, identityCacheKeyForRemiliaUsername),
      ],
    });
  });
}

async function mutateSharedIdentityCache(mutator: (cache: ReminetIdentityCache) => void): Promise<ReminetIdentityCache> {
  let result = emptyReminetIdentityCache();
  const write = sharedIdentityCacheWriteQueue.then(async () => {
    const stored = await chrome.storage.local.get({ [REMINET_IDENTITY_CACHE_KEY]: emptyReminetIdentityCache() });
    const latest = normalizeReminetIdentityCache(stored[REMINET_IDENTITY_CACHE_KEY]);
    mutator(latest);
    result = pruneSharedIdentityCache(latest);
    await chrome.storage.local.set({ [REMINET_IDENTITY_CACHE_KEY]: result });
  });
  sharedIdentityCacheWriteQueue = write.catch((error) => {
    console.warn("Shared RemiNET identity cache write failed:", error);
  });
  await write;
  return result;
}

function freshIdentityEntry(
  entry: ReminetIdentityCacheEntry | undefined,
  maxAgeMs = REMINET_IDENTITY_CACHE_TTL_MS,
  requirePublicProfile = false,
): entry is ReminetIdentityCacheEntry {
  if (!entry?.profile) return false;
  const timestamp = requirePublicProfile ? entry.publicProfileCachedAt : entry.cachedAt;
  return typeof timestamp === "number" && Date.now() - timestamp < maxAgeMs;
}

function hasCurrentIdentitySchema(profile: ReminetIdentityProfile): boolean {
  return Object.prototype.hasOwnProperty.call(profile, "ensName")
    && Object.prototype.hasOwnProperty.call(profile, "gweiName");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function fetchMusicJson(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MUSICBRAINZ_JSON_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported music lookup URL." };
  }

  try {
    const response = await budgetedFetch(parsed.href, {
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "User-Agent": "milXdy/0.1.5 (https://github.com/bonklek/milXdy)",
      },
    }, "music:json");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchMusicJsonForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchMusicJson(url);
}

async function postMusicForm(url: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, ACOUSTID_FORM_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported music lookup URL." };
  }

  try {
    const response = await budgetedFetch(parsed.href, {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "milXdy/0.1.5 (https://github.com/bonklek/milXdy)",
      },
      body: new URLSearchParams(form),
    }, "music:postForm");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function postMusicFormForSender(url: string, form: Record<string, string>, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return postMusicForm(url, form);
}

async function fetchMusicImageDataUrl(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MUSIC_IMAGE_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported image URL." };
  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "music:image");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(contentType)) return { ok: false, status: response.status, error: "Unsupported image type." };
    const bytes = await readCappedResponseBytes(response, MAX_IMAGE_RESPONSE_BYTES);
    return { ok: true, status: response.status, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchMusicImageDataUrlForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchMusicImageDataUrl(url);
}

async function fetchMiladychanJson(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MILADYCHAN_JSON_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported Miladychan URL." };
  }

  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "miladychan:json");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchMiladychanJsonForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchMiladychanJson(url);
}

async function fetchImageDataUrl(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MILADY_MAKER_BANNER_RULES);
  if (!parsed) {
    return { ok: false, error: "UNSUPPORTED_IMAGE_URL" };
  }

  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "milxdy:imageDataUrl");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\/png\b/i.test(contentType)) return { ok: false, error: "UNSUPPORTED_IMAGE_TYPE" };
    const bytes = await readCappedResponseBytes(response, MAX_IMAGE_RESPONSE_BYTES);
    return { ok: true, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchImageDataUrlForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchImageDataUrl(url);
}

async function fetchWikiImageDataUrl(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, WIKI_IMAGE_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported wiki image URL." };
  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "wiki:image");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(contentType)) return { ok: false, status: response.status, error: "Unsupported image type." };
    const bytes = await readCappedResponseBytes(response, MAX_IMAGE_RESPONSE_BYTES);
    return { ok: true, status: response.status, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchWikiImageDataUrlForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiImageSender(sender)) return unsupportedSender();
  return fetchWikiImageDataUrl(url);
}

async function openWikiSidebarTab(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender)) return { ok: false, status: 0, error: "Unsupported wiki frame sender." };
  const parsed = parseAllowedUrl(url, WIKI_SIDEBAR_OPEN_TAB_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported wiki sidebar URL." };
  await chrome.tabs.create({ url: parsed.href });
  return { ok: true };
}

async function forwardWikiSidebarNavigation(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  const parsed = parseAllowedUrl(url, WIKI_SIDEBAR_NAVIGATION_RULES);
  if (!parsed) return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, {
    type: "wikiSidebar:navigated",
    url: parsed.href,
  }, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

async function forwardWikiSidebarNavigateInFrame(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  const parsed = parseAllowedUrl(url, WIKI_SIDEBAR_NAVIGATION_RULES);
  if (!parsed) return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, {
    type: "wikiSidebar:navigate",
    url: parsed.href,
  }, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

async function forwardWikiSidebarHistory(direction: "back" | "forward", sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, {
    type: "wikiSidebar:history",
    direction,
  }, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

async function forwardWikiSidebarReadAloudRequest(message: WikiSidebarReadAloudRequestMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, message, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

function isWikiFrameSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || typeof sender.tab?.id !== "number") return false;
  if (typeof sender.frameId !== "number" || sender.frameId <= 0) return false;
  const source = sender.url || sender.origin || "";
  try {
    const url = new URL(source);
    return WIKI_SIDEBAR_OPEN_TAB_RULES.some((rule) => parseAllowedUrl(url.href, [rule]) !== null);
  } catch {
    return false;
  }
}

function isWikiImageSender(sender: chrome.runtime.MessageSender): boolean {
  return isXContentScriptSender(sender) || isWikiFrameSender(sender);
}

function isXContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  return isSameExtensionTopFrameHttpsSender(sender, ["x.com", "twitter.com"]);
}

function isSameExtensionTopFrameHttpsSender(sender: chrome.runtime.MessageSender, allowedHosts: readonly string[]): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (typeof sender.tab?.id !== "number") return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  const source = sender.url || sender.origin || sender.tab.url || "";
  try {
    const url = new URL(source);
    return url.protocol === "https:" && allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function unsupportedSender(): Record<string, unknown> {
  return { ok: false, status: 0, error: "UNSUPPORTED_SENDER" };
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function readCappedResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number.parseInt(declaredLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) throw new Error(IMAGE_TOO_LARGE_ERROR);
  }
  if (!response.body) throw new Error(IMAGE_TOO_LARGE_ERROR);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(IMAGE_TOO_LARGE_ERROR);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function budgetedFetch(input: RequestInfo | URL, init?: RequestInit, label?: string): Promise<Response> {
  return runNetworkTask((signal) => fetch(input, {
    ...init,
    signal: combineAbortSignals(
      combineAbortSignals(init?.signal, signal),
      createBackgroundNetworkDeadlineSignal(),
    ),
  }), label);
}

function combineAbortSignals(existing: AbortSignal | null | undefined, deadline: AbortSignal): AbortSignal {
  if (!existing) return deadline;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([existing, deadline]);
  const combined = new AbortController();
  const abort = (event: Event) => {
    const source = event.target instanceof AbortSignal ? event.target : null;
    combined.abort(source?.reason);
  };
  if (existing.aborted) combined.abort(existing.reason);
  else if (deadline.aborted) combined.abort(deadline.reason);
  else {
    existing.addEventListener("abort", abort, { once: true });
    deadline.addEventListener("abort", abort, { once: true });
  }
  return combined.signal;
}

chrome.runtime.onInstalled.addListener((details) => {
  scheduleUpdateChecks();
  void runUpdateCheck();
  // Chrome reports an unpacked-extension reload as an update. Re-arm the
  // lightweight Beetle tip so it is straightforward to verify during QA.
  void chrome.storage.local.set({ "milxdy.reminet.beetleWelcomePending": true });
  if (details.reason !== "install") return;
  void chrome.storage.local.set({
    "milxdy.diagnostics.enabled": false,
    "milxdy.apps.firstRun.status": "pending",
    "milxdy.miladychan.enabled": true,
    "milxdy.music.enabled": true,
    "milxdy.reminetChat.enabled": false,
    "milxdy.remistats.beetol.enabled": true,
  });
  void chrome.storage.sync.set({
    mode: "milady",
    showTooltips: true,
    soundsEnabled: true,
  });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleUpdateChecks();
  void runUpdateCheck();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_ALARM_NAME) return;
  void runUpdateCheck();
});

void scheduleUpdateChecks();

function scheduleUpdateChecks(): void {
  void chrome.alarms.create(UPDATE_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES,
  });
}

async function runUpdateCheck(): Promise<UpdateStatus> {
  const status = await checkForUpdate();
  await chrome.storage.local.set({ [UPDATE_STATUS_KEY]: status });
  await renderUpdateBadge(status);
  return status;
}

async function renderUpdateBadge(status: UpdateStatus): Promise<void> {
  if (status.updateAvailable) {
    await browserAction.setBadgeText({ text: "UP" });
    await browserAction.setBadgeBackgroundColor({ color: "#a45100" });
    await browserAction.setBadgeTextColor?.({ color: "#ffffff" });
    return;
  }
  await browserAction.setBadgeText({ text: "" });
}
