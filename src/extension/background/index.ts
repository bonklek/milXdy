import { createExternalHandoffTabs, isSafeMakerImageDataUrl } from "./external-handoff-tabs";
import { createAddonsCatalogLauncher } from "../../platform/background/addons-catalog-launch";
import { fetchMusicEnrichment } from "../../apps/music/enrichment-background";
import { base64Encode, readCappedResponseBytes, fetchMusicImageDataUrl, fetchImageDataUrl, fetchWikiImageDataUrl } from "./image-fetch-handlers";
import "../../apps/wiki-links/background";
import "../../apps/post-reading/background";
import "../../apps/milady-maxxer/background";
import "../../apps/beetol/background.js";
import "../../apps/remistats/background.js";
import "../../apps/reminet-chat/background";
import "./remilia-auth-router";
import "../../platform/background/remilia-api-registration";
import { createBackgroundNetworkDeadlineSignal, initializeBackgroundNetworkBudget, runNetworkTask, setupBackgroundMessageRouter } from "../../platform/background/router";
import { browserAction } from "../../platform/background/browser-action";
import type { ReminetDirectoryIdentifier } from "../../platform/auth/reminet-directory";
import {
  UPDATE_ALARM_NAME,
  UPDATE_CHECK_INTERVAL_MINUTES,
  UPDATE_STATUS_KEY,
  checkForUpdate,
  type UpdateStatus,
} from "../../platform/background/update-check";
import { parseAllowedUrl, type UrlAllowRule } from "../../platform/browser/url-allowlist";
import appRegistry from "../../platform/app-sdk/first-party-apps.json";
import { externalHandoffUrl, isExternalHandoffAdapter, isExternalHandoffTarget, validateExternalHandoffCaptions, validateExternalHandoffImageDataUrl, withExternalHandoffTimeout, type ExternalHandoffRequest } from "../../platform/app-sdk/external-handoff";
import { REMIBOORU_QUERY_ORIGIN, REMOTE_QUERY_RESULT_TTL_MS, RemoteQueryResultStore, isStoredRemibooruResultPage, remibooruQueryUrl, sanitizeRemibooruFacets, sanitizeRemibooruPosts, type RemoteQueryRequest, type SanitizedRemibooruPostPage } from "../../platform/app-sdk/remote-query";
import { isSupportedMediaContributionMime, MEDIA_CONTRIBUTION_MAX_BYTES, mediaContributionFailureMessage, mediaContributionPreparationFailureMessage, OPAQUE_MEDIA_HANDLE_TTL_MS, OpaqueMediaHandleStore, remibooruUploadSizeBucket, validateMediaContributionTags, type OpaqueMediaHandleRecord } from "../../platform/app-sdk/media-contribution";
import { registerPageContextActions, type PageContextActionApp } from "../../platform/background/page-context-actions";
import { renderCheeseWorldImage, renderRemiliaMakerImage } from "./external-handoff-page-adapters";
import { removeLegacyReminetChatDiagnostics } from "../../platform/runtime/reminet-chat-diagnostics";
import {
  configureReminetIdentityNetworkFetch,
  fetchRemiStatsUser,
  resolveReminetIdentity,
  resolveReminetIdentityBatch,
} from "./reminet-identity-handlers";

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

type ReminetIdentityResolveMessage = {
  type: "reminetIdentity:resolve";
  identifiers: ReminetDirectoryIdentifier[];
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

type RemoteQueryMessage = {
  type: "milxdy:remoteQuery";
  appId: string;
  queryId: string;
  request: RemoteQueryRequest;
};

type RemoteQueryAttachMessage = {
  type: "milxdy:remoteQueryAttach";
  appId: string;
  queryId: string;
  itemId: string;
};

type ContextMediaPrepareMessage = {
  type: "milxdy:contextMediaPrepare";
  appId: string;
  actionId: string;
  sourceUrl: string;
  width: number | null;
  height: number | null;
  altAvailable: boolean;
};

type MediaContributionSubmitMessage = {
  type: "milxdy:mediaContributionSubmit";
  appId: string;
  actionId: string;
  contributionId: string;
  mediaHandle: string;
  tags: string[];
};
type ContextMediaMenuStateMessage = { type: "milxdy:contextMediaMenuState"; available: boolean };

const launchAddonsCatalog = createAddonsCatalogLauncher(chrome.tabs, id => chrome.windows.update(id, { focused: true }), async id => {
  const response = await chrome.tabs.sendMessage(id, { type: "milxdy:confirmCatalogTab" });
  return response?.catalog === true;
});
const remoteQueryLastRequestAt = new Map<string, number>();
const remoteQueryCache = new Map<string, { expiresAt: number; response: Record<string, unknown> }>();
const remoteQueryResults = new RemoteQueryResultStore();
const REMOTE_QUERY_RESULT_SESSION_PREFIX = "milxdy.remoteQueryResult.";
const contextMediaHandles = new OpaqueMediaHandleStore();
const CONTEXT_MEDIA_MENU_ID = "milxdy:context-media";
const CONTEXT_MEDIA_SESSION_PREFIX = "milxdy.contextMediaHandle.";

registerPageContextActions(appRegistry as PageContextActionApp[]);

type MiladychanFetchJsonMessage = {
  type: "miladychan:fetchJson";
  url: string;
};

type MiladychanPostTextMessage = {
  type: "miladychan:postText";
  destination: {
    board: string;
    threadId: number | null;
  };
  name?: string;
  subject?: string;
  body: string;
};

type MusicFetchJsonMessage = {
  type: "music:fetchJson";
  authorization?: string;
  url: string;
};

type MusicPostFormMessage = {
  type: "music:postForm";
  authorization?: string;
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
const MILADYCHAN_API_ROOT = "https://boards.miladychan.org";
const MILADYCHAN_POST_RULES: readonly UrlAllowRule[] = [
  { origin: "https://boards.miladychan.org", pathPattern: /^\/api\/create-thread$/ },
  { origin: "https://boards.miladychan.org", pathPattern: /^\/api\/create-reply$/ },
];
const MILADYCHAN_POST_BOARDS = new Set(["milady", "remilio", "a", "ai", "kpop", "pol", "v"]);

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
const externalHandoffTabs = createExternalHandoffTabs();
void externalHandoffTabs.recover().catch(() => undefined);
const X_CONTEXT_MEDIA_RULES: readonly UrlAllowRule[] = [
  { origin: "https://pbs.twimg.com" },
  { origin: "https://abs.twimg.com" },
];
const REMIBOORU_MEMBER_POSTS_URL = "https://remibooru.com/api/member/posts";

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
    handle: (_message, sender) => openAddonsCatalogWindow(sender),
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
    type: "milxdy:remoteQuery",
    matches: isRemoteQueryMessage,
    handle: (message, sender) => queryRemoteService(message, sender),
  },
  {
    type: "milxdy:remoteQueryAttach",
    matches: isRemoteQueryAttachMessage,
    handle: (message, sender) => attachRemoteQueryResult(message, sender),
  },
  {
    type: "milxdy:contextMediaPrepare",
    matches: isContextMediaPrepareMessage,
    handle: (message, sender) => prepareContextMedia(message, sender),
  },
  {
    type: "milxdy:mediaContributionSubmit",
    matches: isMediaContributionSubmitMessage,
    handle: (message, sender) => submitMediaContribution(message, sender),
  },
  {
    type: "milxdy:contextMediaMenuState",
    matches: isContextMediaMenuStateMessage,
    handle: (message, sender) => setContextMediaMenuState(message.available, sender),
  },
  {
    type: "miladychan:fetchJson",
    matches: isMiladychanFetchJsonMessage,
    handle: (message, sender) => fetchMiladychanJsonForSender(message.url, sender),
  },
  {
    type: "miladychan:postText",
    matches: isMiladychanPostTextMessage,
    handle: (message, sender) => postMiladychanTextForSender(message, sender),
  },
  {
    type: "music:fetchJson",
    matches: isMusicFetchJsonMessage,
    handle: (message, sender) => fetchMusicJsonForSender(message.url, sender, message.authorization),
  },
  {
    type: "music:postForm",
    matches: isMusicPostFormMessage,
    handle: (message, sender) => postMusicFormForSender(message.url, message.form, sender, message.authorization),
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
  {
    type: "reminetIdentity:resolve",
    matches: isReminetIdentityResolveMessage,
    handle: (message, sender) => resolveReminetIdentityBatchForSender(message, sender),
  },
]);
configureReminetIdentityNetworkFetch(budgetedFetch);
void initializeBackgroundNetworkBudget();
removePersistedLegacyReminetChatDiagnostics();

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

function isReminetIdentityResolveMessage(message: unknown): message is ReminetIdentityResolveMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "reminetIdentity:resolve"
    && Array.isArray(record.identifiers)
    && record.identifiers.length <= 1_000
    && record.identifiers.every((identifier) => {
      if (!identifier || typeof identifier !== "object") return false;
      const candidate = identifier as Record<string, unknown>;
      return ["handle", "x_handle", "github", "discord"].includes(String(candidate.type))
        && typeof candidate.value === "string";
    });
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

async function openAddonsCatalogWindow(sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isApprovedRuntimeContentSender(sender)) return unsupportedSender();
  return launchAddonsCatalog();
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

function isRemoteQueryMessage(message: unknown): message is RemoteQueryMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  const request = record.request as Record<string, unknown> | undefined;
  return record.type === "milxdy:remoteQuery"
    && typeof record.appId === "string"
    && typeof record.queryId === "string"
    && Boolean(request && (request.resource === "posts" || request.resource === "facets"));
}

function isRemoteQueryAttachMessage(message: unknown): message is RemoteQueryAttachMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:remoteQueryAttach"
    && typeof record.appId === "string"
    && typeof record.queryId === "string"
    && typeof record.itemId === "string"
    && record.itemId.length >= 1
    && record.itemId.length <= 128;
}

function isContextMediaPrepareMessage(message: unknown): message is ContextMediaPrepareMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:contextMediaPrepare"
    && typeof record.appId === "string"
    && typeof record.actionId === "string"
    && typeof record.sourceUrl === "string"
    && (record.width === null || (Number.isInteger(record.width) && Number(record.width) > 0))
    && (record.height === null || (Number.isInteger(record.height) && Number(record.height) > 0))
    && typeof record.altAvailable === "boolean";
}

function isMediaContributionSubmitMessage(message: unknown): message is MediaContributionSubmitMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:mediaContributionSubmit"
    && typeof record.appId === "string"
    && typeof record.actionId === "string"
    && typeof record.contributionId === "string"
    && typeof record.mediaHandle === "string"
    && Array.isArray(record.tags)
    && record.tags.every((tag) => typeof tag === "string");
}

function isContextMediaMenuStateMessage(message: unknown): message is ContextMediaMenuStateMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:contextMediaMenuState" && typeof record.available === "boolean";
}

async function setContextMediaMenuState(available: boolean, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender) || !contextMediaMenuAction) return unsupportedSender();
  await chrome.contextMenus.update(CONTEXT_MEDIA_MENU_ID, { visible: available });
  return { ok: true };
}

type ContributionRegistryApp = {
  id?: string;
  contextMediaActions?: Array<{ id?: string; label?: string; site?: string; eligibleMedia?: string[]; presentation?: string }>;
  mediaContributions?: Array<{ id?: string; adapter?: string; contextMediaActionId?: string; maxTags?: number; maxTagLength?: number }>;
};

function contributionDeclaration(appId: string, actionId: string, contributionId?: string) {
  const app = (appRegistry as ContributionRegistryApp[]).find((candidate) => candidate.id === appId);
  const action = app?.contextMediaActions?.find((candidate) => candidate.id === actionId);
  const contribution = app?.mediaContributions?.find((candidate) => candidate.contextMediaActionId === actionId && (!contributionId || candidate.id === contributionId));
  if (!action || action.site !== "x" || action.presentation !== "hostPanel" || !action.eligibleMedia?.includes("image") || !contribution || contribution.adapter !== "remibooru") return null;
  return { action, contribution };
}

type StoredContextMedia = Omit<OpaqueMediaHandleRecord, "bytes"> & { bytesBase64: string };

function contextMediaSessionKey(handle: string): string {
  return `${CONTEXT_MEDIA_SESSION_PREFIX}${handle}`;
}

async function persistContextMedia(handle: string, media: Omit<OpaqueMediaHandleRecord, "expiresAt">, now = Date.now()): Promise<void> {
  const { bytes, ...metadata } = media;
  await chrome.storage.session.set({
    [contextMediaSessionKey(handle)]: {
      ...metadata,
      bytesBase64: base64Encode(bytes),
      expiresAt: now + OPAQUE_MEDIA_HANDLE_TTL_MS,
    } satisfies StoredContextMedia,
  });
}

async function restoreContextMedia(handle: string): Promise<OpaqueMediaHandleRecord | null> {
  const key = contextMediaSessionKey(handle);
  const stored = (await chrome.storage.session.get(key))[key] as StoredContextMedia | undefined;
  if (!stored || typeof stored.bytesBase64 !== "string" || typeof stored.expiresAt !== "number") return null;
  try {
    const binary = atob(stored.bytesBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const record: OpaqueMediaHandleRecord = { ...stored, bytes };
    return contextMediaHandles.restore(handle, record) ? record : null;
  } catch {
    await chrome.storage.session.remove(key);
    return null;
  }
}

async function discardPersistedContextMedia(handle: string): Promise<void> {
  await chrome.storage.session.remove(contextMediaSessionKey(handle));
}

async function clearPersistedContextMedia(): Promise<void> {
  contextMediaHandles.clear();
  const stored = await chrome.storage.session.get(null);
  const keys = Object.keys(stored).filter((key) => key.startsWith(CONTEXT_MEDIA_SESSION_PREFIX));
  if (keys.length) await chrome.storage.session.remove(keys);
}

async function prepareContextMedia(message: ContextMediaPrepareMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender) || !contributionDeclaration(message.appId, message.actionId)) return unsupportedSender();
  const parsed = parseAllowedUrl(message.sourceUrl, X_CONTEXT_MEDIA_RULES);
  if (!parsed) return { ok: false, error: "Only visible X-hosted images can use direct contribution. Use Remibooru's native uploader for other media." };
  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "remibooru:prepareMedia");
    if (!response.ok) return { ok: false, error: `The selected image could not be retrieved from X (HTTP ${response.status}). Retry or use Remibooru's native uploader.` };
    const mimeType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    if (!isSupportedMediaContributionMime(mimeType)) return { ok: false, error: "The selected media is not a supported image or GIF. Choose different media or use Remibooru's native uploader." };
    const bytes = await readCappedResponseBytes(response, MEDIA_CONTRIBUTION_MAX_BYTES);
    let width = message.width;
    let height = message.height;
    if (!width || !height) {
      const uploadBytes = bytes.slice().buffer as ArrayBuffer;
      const bitmap = await createImageBitmap(new Blob([uploadBytes], { type: mimeType }));
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    }
    await clearPersistedContextMedia();
    const mediaRecord = { appId: message.appId, actionId: message.actionId, mimeType, bytes, width, height, altAvailable: message.altAvailable };
    const mediaHandle = contextMediaHandles.create(mediaRecord);
    await persistContextMedia(mediaHandle, mediaRecord);
    return { ok: true, mediaHandle, media: { mimeType, width, height, altAvailable: message.altAvailable } };
  } catch (error) {
    return { ok: false, error: mediaContributionPreparationFailureMessage(error) };
  }
}

async function submitMediaContribution(message: MediaContributionSubmitMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  const declaration = contributionDeclaration(message.appId, message.actionId, message.contributionId);
  if (!declaration) return { ok: false, error: "The requested contribution is not declared by this package." };
  const maxTags = declaration.contribution.maxTags ?? 0;
  const maxTagLength = declaration.contribution.maxTagLength ?? 0;
  const tags = validateMediaContributionTags(message.tags, maxTags, maxTagLength);
  if (!tags) return { ok: false, error: "The supplied tags are outside the reviewed contribution bounds." };
  let media = contextMediaHandles.claim(message.mediaHandle, message.appId, message.actionId);
  if (!media) {
    await restoreContextMedia(message.mediaHandle);
    media = contextMediaHandles.claim(message.mediaHandle, message.appId, message.actionId);
  }
  if (!media) return { ok: false, error: "The selected image expired or was already used. Select it again, or use Remibooru's native uploader." };
  const form = new FormData();
  const extension = media.mimeType === "image/jpeg" ? "jpg" : media.mimeType.slice("image/".length);
  const uploadBytes = media.bytes.slice().buffer as ArrayBuffer;
  form.set("file", new Blob([uploadBytes], { type: media.mimeType }), `upload.${extension}`);
  if (!media.width || !media.height) {
    contextMediaHandles.release(message.mediaHandle);
    return { ok: false, error: "The selected image dimensions could not be verified. Select it again, or use Remibooru's native uploader." };
  }
  form.set("metadata", JSON.stringify({ width: media.width, height: media.height, globalTags: tags, spatialTags: [], authorUrls: [], mediaType: "image", pageCount: 1 }));
  try {
    const response = await budgetedFetch(REMIBOORU_MEMBER_POSTS_URL, { method: "POST", credentials: "include", headers: { accept: "application/json", "x-upload-incident-id": crypto.randomUUID(), "x-upload-media-type": "image", "x-upload-size-bucket": remibooruUploadSizeBucket(media.bytes.byteLength), "x-upload-page-count": "1", "x-upload-browser-family": "chrome" }, body: form }, "remibooru:contributeMedia");
    const payload = (response.headers.get("content-type") || "").includes("application/json")
      ? await response.json().catch(() => null) as Record<string, unknown> | null
      : null;
    if (!response.ok) {
      contextMediaHandles.release(message.mediaHandle);
      return { ok: false, error: mediaContributionFailureMessage(response.status, payload?.error) };
    }
    const post = payload?.post as Record<string, unknown> | undefined;
    if (typeof post?.id !== "string") {
      contextMediaHandles.release(message.mediaHandle);
      return { ok: false, error: "Remibooru returned an unsupported contribution result. The selected-media session is preserved; retry or use the native uploader." };
    }
    contextMediaHandles.consume(message.mediaHandle);
    await discardPersistedContextMedia(message.mediaHandle);
    return { ok: true, canonicalUrl: `https://remibooru.com/posts/${encodeURIComponent(post.id)}` };
  } catch {
    contextMediaHandles.release(message.mediaHandle);
    return { ok: false, error: "Remibooru could not be reached. Check your connection, then retry or use the native uploader." };
  }
}

async function queryRemoteService(message: RemoteQueryMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  const app = (appRegistry as Array<{
    id?: string;
    remoteQueries?: Array<{
      id?: string;
      adapter?: string;
      resources?: string[];
      maxPageSize?: number;
      minIntervalMs?: number;
      cache?: { policy?: string; maxAgeSeconds?: number };
    }>;
  }>).find((candidate) => candidate.id === message.appId);
  const declaration = app?.remoteQueries?.find((candidate) => candidate.id === message.queryId);
  if (!declaration || declaration.adapter !== "remibooru") return { ok: false, error: "The requested remote query is not declared by this package." };
  if (!declaration.resources?.includes(message.request.resource)) return { ok: false, error: "The requested remote resource is not declared by this package." };
  const targetUrl = remibooruQueryUrl(message.request, declaration.maxPageSize ?? 0);
  if (!targetUrl) return { ok: false, error: "The requested Remibooru query is outside the reviewed schema." };
  const key = `${message.appId}:${message.queryId}`;
  const now = Date.now();
  const cached = remoteQueryCache.get(`${key}:${targetUrl.href}`);
  if (cached && cached.expiresAt > now) {
    await rememberRemoteQueryResults(sender, message, cached.response);
    return cached.response;
  }
  const minIntervalMs = declaration.minIntervalMs ?? 0;
  const lastRequestAt = remoteQueryLastRequestAt.get(key) ?? 0;
  if (!Number.isInteger(minIntervalMs) || minIntervalMs < 250 || minIntervalMs > 60_000) return { ok: false, error: "The remote query rate policy is invalid." };
  if (now - lastRequestAt < minIntervalMs) return { ok: false, error: "Please wait before refreshing this gallery." };
  remoteQueryLastRequestAt.set(key, now);
  try {
    const payload = await runNetworkTask(async (signal) => {
      const response = await fetch(targetUrl, { signal, credentials: "omit" });
      if (!response.ok) throw new Error(`Remibooru returned ${response.status}.`);
      return response.json() as Promise<unknown>;
    }, "remibooru-query");
    const response = message.request.resource === "posts"
      ? (() => {
        const page = sanitizeRemibooruPosts(payload);
        return page ? { ok: true, page } : { ok: false, error: "Remibooru returned an unsupported post page." };
      })()
      : (() => {
        const facets = sanitizeRemibooruFacets(payload);
        return facets ? { ok: true, facets } : { ok: false, error: "Remibooru returned an unsupported facet page." };
      })();
    const cache = declaration.cache;
    const cacheMaxAgeSeconds = typeof cache?.maxAgeSeconds === "number" ? cache.maxAgeSeconds : 0;
    if (response.ok === true && cache?.policy === "shortLived" && Number.isInteger(cacheMaxAgeSeconds) && cacheMaxAgeSeconds >= 1 && cacheMaxAgeSeconds <= 300) {
      remoteQueryCache.set(`${key}:${targetUrl.href}`, { expiresAt: now + cacheMaxAgeSeconds * 1000, response });
    }
    await rememberRemoteQueryResults(sender, message, response);
    return response;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The remote gallery is unavailable." };
  }
}

function remoteQueryResultScope(sender: chrome.runtime.MessageSender, appId: string, queryId: string): string | null {
  const tabId = sender.tab?.id;
  if (typeof tabId !== "number") return null;
  return `${tabId}:${sender.frameId ?? 0}:${appId}:${queryId}`;
}

type StoredRemoteQueryResults = {
  page: unknown;
  expiresAt: unknown;
};

function remoteQueryResultSessionKey(scope: string): string {
  return `${REMOTE_QUERY_RESULT_SESSION_PREFIX}${scope}`;
}

async function rememberRemoteQueryResults(sender: chrome.runtime.MessageSender, message: RemoteQueryMessage, response: Record<string, unknown>): Promise<void> {
  if (message.request.resource !== "posts" || response.ok !== true) return;
  const scope = remoteQueryResultScope(sender, message.appId, message.queryId);
  const page = response.page as SanitizedRemibooruPostPage | undefined;
  if (!scope || !page || !Array.isArray(page.items)) return;
  const now = Date.now();
  const expiresAt = now + REMOTE_QUERY_RESULT_TTL_MS;
  if (!remoteQueryResults.remember(scope, page, now, expiresAt)) return;
  await chrome.storage.session.set({
    [remoteQueryResultSessionKey(scope)]: { page, expiresAt } satisfies StoredRemoteQueryResults,
  }).catch(() => undefined);
}

async function resolveRemoteQueryResult(scope: string, itemId: string): Promise<string | null> {
  const remembered = remoteQueryResults.resolve(scope, itemId);
  if (remembered) return remembered;
  const key = remoteQueryResultSessionKey(scope);
  const session = await chrome.storage.session.get(key).catch(() => ({})) as Record<string, unknown>;
  const stored = session[key] as StoredRemoteQueryResults | undefined;
  if (!stored || !isStoredRemibooruResultPage(stored.page) || typeof stored.expiresAt !== "number" || !remoteQueryResults.restore(scope, stored.page, stored.expiresAt)) {
    await chrome.storage.session.remove(key).catch(() => undefined);
    return null;
  }
  return remoteQueryResults.resolve(scope, itemId);
}

async function attachRemoteQueryResult(message: RemoteQueryAttachMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  const app = (appRegistry as Array<{
    id?: string;
    remoteQueries?: Array<{ id?: string; adapter?: string; resultActions?: string[] }>;
  }>).find((candidate) => candidate.id === message.appId);
  const declaration = app?.remoteQueries?.find((candidate) => candidate.id === message.queryId);
  if (!declaration || declaration.adapter !== "remibooru" || !declaration.resultActions?.includes("attachToInitiatingComposer")) {
    return { ok: false, error: "This gallery does not declare composer attachment." };
  }
  const scope = remoteQueryResultScope(sender, message.appId, message.queryId);
  const thumbnailUrl = scope ? await resolveRemoteQueryResult(scope, message.itemId) : null;
  if (!thumbnailUrl) return { ok: false, error: "This gallery result is unavailable or expired." };
  try {
    return await runNetworkTask(async (signal) => {
      const response = await fetch(thumbnailUrl, { signal, credentials: "omit" });
      const finalUrl = new URL(response.url);
      if (!response.ok || finalUrl.origin !== REMIBOORU_QUERY_ORIGIN || !finalUrl.pathname.startsWith("/media/thumbs/")) {
        return { ok: false, error: "Remibooru returned an unsupported image." };
      }
      const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(contentType)) {
        return { ok: false, error: "Remibooru returned an unsupported image type." };
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1 || bytes.length > 10 * 1024 * 1024) {
        return { ok: false, error: "The Remibooru image is unavailable or too large." };
      }
      return { ok: true, imageDataUrl: `data:${contentType};base64,${base64Encode(bytes)}`, contentType };
    }, "remibooru-result-attachment");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The Remibooru image is unavailable." };
  }
}

async function launchExternalHandoff(message: ExternalHandoffMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  const app = (appRegistry as Array<{ id?: string; externalHandoffs?: Array<{ id?: string; adapter?: string; target?: string; modes?: string[]; captionMaxLength?: number; mediaTransfer?: { source?: string; result?: string; consent?: string; maxBytes?: number; allowedMimeTypes?: string[] } }> }>)
    .find((candidate) => candidate.id === message.appId);
  const declaration = app?.externalHandoffs?.find((candidate) => candidate.id === message.handoffId);
  if (!declaration || declaration.adapter !== message.adapter || declaration.target !== message.target) {
    return { ok: false, error: "The requested handoff is not declared by this package." };
  }
  if (!(declaration.modes || ["captioned"]).includes(message.mode)) return { ok: false, error: "The requested handoff mode is not declared by this package." };
  const captions = validateExternalHandoffCaptions(message, declaration.captionMaxLength);
  if (!captions) return { ok: false, error: "The requested captions are invalid for this handoff." };
  const mediaTransfer = declaration.mediaTransfer;
  const sourceImage = message.adapter === "cheeseworld"
    ? validateExternalHandoffImageDataUrl(message.imageDataUrl, mediaTransfer?.maxBytes)
    : null;
  if (message.adapter === "cheeseworld" && (
    mediaTransfer?.source !== "initiatingComposerImage"
    || mediaTransfer.result !== "replaceSameAttachment"
    || mediaTransfer.consent !== "perInvocation"
    || !sourceImage
    || !mediaTransfer.allowedMimeTypes?.includes(sourceImage.contentType)
  )) return { ok: false, error: "The requested CheeseWorld media replacement is outside the reviewed declaration." };
  if (message.adapter !== "cheeseworld" && message.imageDataUrl !== undefined) {
    return { ok: false, error: "This handoff does not accept composer media." };
  }
  const targetUrl = externalHandoffUrl(message.adapter, message.target);
  if (!targetUrl) return { ok: false, error: "Unsupported maker destination." };
  let generatedMakerTabId: number | null = null;
  try {
    const { tab, href } = await externalHandoffTabs.create(targetUrl.href);
    if (typeof tab.id !== "number") return { ok: false, error: "The maker tab could not be created." };
    generatedMakerTabId = tab.id;
    await waitForExternalHandoffTab(tab.id, href);
    const execution = message.adapter === "cheeseworld"
      ? chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: renderCheeseWorldImage,
        args: [sourceImage!.dataUrl, sourceImage!.contentType, captions.topText, captions.bottomText],
      })
      : chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: renderRemiliaMakerImage,
        args: [captions.topText, captions.bottomText, message.mode],
      });
    const results = await withExternalHandoffTimeout(execution);
    const result = results[0]?.result as { ok?: boolean; error?: string; imageDataUrl?: string } | undefined;
    if (result?.ok !== true) return { ok: false, error: result?.error || "The maker controls were unavailable." };
    if (!isSafeMakerImageDataUrl(result.imageDataUrl)) return { ok: false, error: "The maker did not return a usable image." };
    return { ok: true, imageDataUrl: result.imageDataUrl };
  } catch {
    return { ok: false, error: "The maker image could not be generated." };
  } finally {
    if (generatedMakerTabId !== null) await externalHandoffTabs.close(generatedMakerTabId).catch(() => undefined);
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




function isMiladychanFetchJsonMessage(message: unknown): message is MiladychanFetchJsonMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "miladychan:fetchJson" && typeof record.url === "string";
}

function isMiladychanPostTextMessage(message: unknown): message is MiladychanPostTextMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  const destination = record.destination;
  if (record.type !== "miladychan:postText" || !destination || typeof destination !== "object") return false;
  const destinationRecord = destination as Record<string, unknown>;
  return typeof destinationRecord.board === "string"
    && (typeof destinationRecord.threadId === "number" || destinationRecord.threadId === null)
    && typeof record.body === "string"
    && (record.name === undefined || typeof record.name === "string")
    && (record.subject === undefined || typeof record.subject === "string");
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

async function fetchRemiStatsUserForSender(handleValue: string, force: boolean, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchRemiStatsUser(handleValue, force);
}

async function resolveReminetIdentityForSender(message: ReminetIdentityMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return resolveReminetIdentity(message);
}

async function resolveReminetIdentityBatchForSender(message: ReminetIdentityResolveMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return resolveReminetIdentityBatch(message);
}

async function fetchMusicJson(url: string, authorization?: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MUSICBRAINZ_JSON_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported music lookup URL." };
  }

  try {
    const response = await fetchMusicEnrichment("musicbrainz", parsed.href, {
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "User-Agent": "milXdy/0.1.5 (https://github.com/bonklek/milXdy)",
      },
    }, undefined, authorization);
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchMusicJsonForSender(url: string, sender: chrome.runtime.MessageSender, authorization?: string): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchMusicJson(url, authorization);
}

async function postMusicForm(url: string, form: Record<string, string>, authorization?: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, ACOUSTID_FORM_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported music lookup URL." };
  }

  try {
    const response = await fetchMusicEnrichment("acoustid", parsed.href, {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "milXdy/0.1.5 (https://github.com/bonklek/milXdy)",
      },
      body: new URLSearchParams(form),
    }, form.client, authorization);
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function postMusicFormForSender(url: string, form: Record<string, string>, sender: chrome.runtime.MessageSender, authorization?: string): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return postMusicForm(url, form, authorization);
}

async function fetchMusicImageDataUrlForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchMusicImageDataUrl(url, budgetedFetch);
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
  if (!isMiladychanPortalSender(sender)) return unsupportedSender();
  return fetchMiladychanJson(url);
}

async function postMiladychanTextForSender(message: MiladychanPostTextMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isMiladychanPortalSender(sender)) return unsupportedSender();
  return postMiladychanText(message);
}

async function postMiladychanText(message: MiladychanPostTextMessage): Promise<Record<string, unknown>> {
  const board = message.destination.board.trim();
  const threadId = message.destination.threadId;
  const body = message.body.trim();
  const name = typeof message.name === "string" ? message.name.trim() : "milXdy";
  const subject = message.subject?.trim() || "";
  const isReply = threadId !== null;
  if (!MILADYCHAN_POST_BOARDS.has(board)) return { ok: false, status: 0, error: "Choose a supported board before posting." };
  if (isReply && (!Number.isSafeInteger(threadId) || threadId <= 0)) return { ok: false, status: 0, error: "Choose a valid thread before replying." };
  if (!body || body.length > 20_000) return { ok: false, status: 0, error: "Post text must be between 1 and 20,000 characters." };
  if (name.length > 100) return { ok: false, status: 0, error: "Poster name must be at most 100 characters." };
  if (!isReply && (!subject || subject.length > 200)) return { ok: false, status: 0, error: "A new thread needs a subject of 1 to 200 characters." };
  const target = `${MILADYCHAN_API_ROOT}${isReply ? "/api/create-reply" : "/api/create-thread"}`;
  const parsed = parseAllowedUrl(target, MILADYCHAN_POST_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported Miladychan posting URL." };

  const form = new FormData();
  form.set("body", body);
  if (name) form.set("name", name);
  if (isReply) {
    form.set("board", board);
    form.set("op", String(threadId));
  } else {
    form.set("subject", subject);
  }
  try {
    const response = await budgetedFetch(parsed.href, {
      method: "POST",
      credentials: "omit",
      body: form,
    }, "miladychan:postText");
    if (!response.ok) return { ok: false, status: response.status, error: `Miladychan rejected the post (HTTP ${response.status}). Open the native site for CAPTCHA, session, or board-specific requirements.` };
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchImageDataUrlForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isXContentScriptSender(sender)) return unsupportedSender();
  return fetchImageDataUrl(url, budgetedFetch);
}

async function fetchWikiImageDataUrlForSender(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiImageSender(sender)) return unsupportedSender();
  return fetchWikiImageDataUrl(url, budgetedFetch);
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

function isApprovedRuntimeContentSender(sender: chrome.runtime.MessageSender): boolean {
  return isSameExtensionTopFrameHttpsSender(sender, [
    "x.com",
    "twitter.com",
    "www.remilia.net",
    "remilia.wiki",
    "wiki.remilia.org",
    "boards.miladychan.org",
  ]);
}

function isMiladychanPortalSender(sender: chrome.runtime.MessageSender): boolean {
  return isSameExtensionTopFrameHttpsSender(sender, ["x.com", "twitter.com", "boards.miladychan.org"]);
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
  removePersistedLegacyReminetChatDiagnostics();
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
  removePersistedLegacyReminetChatDiagnostics();
  scheduleUpdateChecks();
  void runUpdateCheck();
});

// This item is host-owned. The selected URL stays inside the extension message
// path; package callbacks will receive only an opaque handle after validation.
const contextMediaMenuAction = (appRegistry as ContributionRegistryApp[])
  .flatMap((app) => app.contextMediaActions || [])
  .find((action) => action.site === "x" && action.presentation === "hostPanel" && action.eligibleMedia?.includes("image"));
void chrome.contextMenus.remove(CONTEXT_MEDIA_MENU_ID).catch(() => undefined).then(() => {
  if (!contextMediaMenuAction) return;
  chrome.contextMenus.create({
    id: CONTEXT_MEDIA_MENU_ID,
    title: typeof contextMediaMenuAction.label === "string" ? contextMediaMenuAction.label : "Upload to Remibooru",
    contexts: ["image"],
    documentUrlPatterns: ["https://x.com/*", "https://twitter.com/*"],
    visible: false,
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MEDIA_MENU_ID || typeof tab?.id !== "number" || typeof info.srcUrl !== "string") return;
  void chrome.tabs.sendMessage(tab.id, { type: "milxdy:contextMediaSelected", sourceUrl: info.srcUrl }).catch(() => undefined);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_ALARM_NAME) return;
  void runUpdateCheck();
});

void scheduleUpdateChecks();

function removePersistedLegacyReminetChatDiagnostics(): void {
  void removeLegacyReminetChatDiagnostics(chrome.storage.local).catch(() => undefined);
}

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
