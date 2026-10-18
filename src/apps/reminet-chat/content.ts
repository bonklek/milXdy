import { clampVolume, normalizeThemeMode, normalizePokePlacement, formatTime, mediaId, formatBody, numberOrUndefined, numberOrNull, stringOrUndefined, stringOrNull, objectValue, asRecord, escapeHtml, compactText } from "./chat-value-format";
import { playTone, playPokeTone } from "./chat-sound-synthesis";
import { renderChatReconnectState } from "./chat-connection-view";
import { AudioCueVolumes } from "../../lib/audio-cue-volumes";
const cueVolumes = new AudioCueVolumes(["chatSend", "chatReact", "chatReactToMe", "chatMessage", "chatPoke"]);
import { readPokeCooldownMs, formatPokeCooldown } from "../remistats/poke-cooldown-time";
import { chatRootMarkup, CHAT_MEDIA_UNAVAILABLE } from "./chat-root-markup";
import { renderLoadOlderButton } from "./chat-markup";
import { CHAT_JUMP_CONTROLS, installChatJumpControl, syncChatJumpControl } from "./jump-control";
import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../platform/overlay/app-chrome";
import { createOverlayAppFrame, type OverlayAppFrame } from "../../platform/overlay/app-frame";
import {
  clampOverlayPanelBox,
  observeOverlayPanelTheme,
  resolveOverlayPanelTheme,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
  startOverlayPanelResize,
} from "../../platform/overlay/panel-base";
import { registerOverlayAppRoot } from "../../platform/overlay/app-layout";
import type { AppRuntimeScheduler, MilxdyContentAppContext, MilxdyRouteChange } from "../../platform/app-sdk/app-platform";
import { createFallbackRuntimeScheduler } from "../../platform/runtime/scheduler";
import { sanitizeReminetChatDiagnostic } from "../../platform/runtime/reminet-chat-diagnostics";
import { absoluteRemiliaMediaUrl, isRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";
import { canMountRemiNetChatRoute } from "./route-policy";
import {
  CHAT_REST_MESSAGE_LIMIT_BYTES,
  ChatRestController,
  chatRestUtf8Bytes,
  type ChatRestCapabilityInvoker,
  type ChatRestFailureKind,
  type ChatRestReconciliationReason,
} from "./chat-rest";
import type { RemiliaApiChatMessage, RemiliaApiChatPage, RemiliaApiError, RemiliaApiResult } from "../../platform/auth/remilia-api";
import {
  SHOCKED_REACTION,
  legacyMessageId,
  messageIdOrNull,
  normalizeChatMessage,
  normalizeMedia,
  normalizeReactionEmoji,
  officialChatMessageRecord,
  officialIdentityToApiUser,
  type ApiMessage,
  type ApiUser,
  type MediaAttachment,
  type MessageId,
  type Reaction,
  type ReplyReference,
} from "./chat-model";
import {
  LEGACY_CHAT_ID,
  LEGACY_SOCKET_IDLE_TIMEOUT_MS,
  parseLegacyMediaUploadOutcome,
  parseLegacySocketBridgeEvent,
  type LegacySocketMutation,
} from "./legacy-adapters";
import {
  legacyMediaAttachment,
  legacyMediaFailureMessage,
  legacyMediaSubmitMutation,
  legacyReplyId,
} from "./legacy-content-adapter";
import { LegacyMutationDispatcher } from "./legacy-mutation-dispatcher";
import { avatarUrl, cleanUsername, connectedXHandle, displayName, findDeepXHandle, remiliaHandle, remiliaUserColor } from "./chat-user-formatting";

const ROOT_ID = "milxdy-reminet-chat-root";
const PSEUDO_ROW_ID = "milxdy-reminet-chat-pseudo-row";
const NATIVE_DM_HIDDEN_ATTR = "data-milxdy-native-dm-hidden";
const CHAT_ID = 1;
const SOCKET_PORT_NAME = "reminetChat:socket";
const SETTINGS_THEME_KEY = "milxdy.settings.theme";
const SOUND_ENABLED_KEY = "milxdy.reminetChat.sounds.enabled";
const SOUND_VOLUME_KEY = "milxdy.reminetChat.sounds.volume";
const SOUND_SEND_KEY = "milxdy.reminetChat.sounds.send";
const SOUND_REACT_KEY = "milxdy.reminetChat.sounds.react";
const SOUND_REACT_TO_ME_KEY = "milxdy.reminetChat.sounds.reactToMe";
const SOUND_MESSAGE_KEY = "milxdy.reminetChat.sounds.message";
const SOUND_POKE_KEY = "milxdy.reminetChat.sounds.poke";
const WIDTH_KEY = "milxdy.reminetChat.width";
const HEIGHT_KEY = "milxdy.reminetChat.height";
const TOP_KEY = "milxdy.reminetChat.top";
const MAX_MESSAGES = 1200;
const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEFT_RAIL_BOTTOM_CLEARANCE_PX = 24;
const LEFT_RAIL_MIN_HEIGHT_PX = 260;
const SOCKET_RECOVERY_MIN_GAP_MS = 5_000;
const POKE_PLACEMENT_KEY = "milxdy.reminetChat.pokePlacement";
let extensionAuthPhase = "checking";
let pokePlacement: "reactions" | "name" | "both" = "reactions";


const REACTIONS = [SHOCKED_REACTION, "\u{1f525}", "\u{1f639}", "\u{1f90d}", "\u{1f44d}"];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const POKE_ICON = "\u{1faf5}";
const REMINET_CHAT_ICON = chrome.runtime.getURL("remistats/star.svg");
const mediaDataUrlCache = new Map<string, string>();
const mediaDataUrlPending = new Set<string>();
const xHandleByRemiliaHandle = new Map<string, string>();
const profileLookupPending = new Set<string>();
const profileLookupDone = new Set<string>();
const pokeFeedback = new Map<string, { state: "loading" | "success" | "error"; label: string; celebrateUntil?: number }>();
const reactionFeedback = new Map<string, "pending" | "error">();
const pokeCooldowns = new Map<string, number>();
const pokeCooldownSources = new Map<string, string>();
const pokeEligibilityChecked = new Set<string>();
const pokeCountdownTimers = new Map<HTMLElement, () => void>();
const pokeButtonsByUsername = new Map<string, Set<HTMLElement>>();
const currentUserReactionStates = new Map<string, boolean>();
const hiddenNativeDmElements = new Set<HTMLElement>();
const ROUTE_MOUNT_RETRY_DELAYS_MS = [120, 300, 700, 1500, 3000] as const;
let audioContext: AudioContext | null = null;
let booted = false;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;
let cancelReconnectTimer: (() => void) | null = null;
let cancelStaleTimer: (() => void) | null = null;
let cancelSendResetTimer: (() => void) | null = null;
let cancelMountRetryTimer: (() => void) | null = null;
const unavailableRuntimeSendMessage: MilxdyContentAppContext["sendMessage"] = () => Promise.resolve(null);
let runtimeSendMessage: MilxdyContentAppContext["sendMessage"] = unavailableRuntimeSendMessage;
let invokeRemiliaCapability: ChatRestCapabilityInvoker | null = null;
let recordDiagnostic: MilxdyContentAppContext["recordDiagnostic"] = () => undefined;
let lifecycleSignal: AbortSignal | null = null;
let runtimeScheduler: AppRuntimeScheduler = createFallbackRuntimeScheduler({ idleTimeoutMs: 16 });
let chatRestController: ChatRestController | null = null;
const legacyMutationDispatcher = new LegacyMutationDispatcher();

type RuntimeRecord = Record<string, unknown>;

type PendingAttachment = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  status: "ready" | "uploading" | "error";
  uploadedMedia?: MediaAttachment;
};

type MessageGroup = {
  authorKey: string;
  messages: ApiMessage[];
};

type ChatState = {
  root: HTMLElement | null;
  mountMode: "rail" | "left" | "messages" | null;
  messagesSelected: boolean;
  messages: ApiMessage[];
  users: Map<number, ApiUser>;
  socketPort: chrome.runtime.Port | null;
  socketState: "closed" | "connecting" | "open";
  reconnectTimer: number | null;
  staleTimer: number | null;
  recoveryInFlight: boolean;
  lastSocketActivityAt: number;
  lastRecoveryAt: number;
  reconnectAttempts: number;
  recoveryVisibleState: "none" | "recovering" | "auth-required" | "failed";
  recoveryMessage: string;
  loading: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  showOlderButton: boolean;
  olderCursor: string | null;
  sending: boolean;
  signedIn: boolean;
  enabled: boolean;
  currentUser: ApiUser | null;
  pendingAttachments: PendingAttachment[];
  composerError: string;
  replyTo: ReplyReference | null;
  minimized: boolean;
  explicitlyOpened: boolean;
  theme: "light" | "dark" | "system";
  side: "left" | "right";
  x: number;
  frameWidth: number;
  frameHeight: number;
  topOffset: number;
  soundEnabled: boolean;
  soundVolume: number;
  soundSend: boolean;
  soundReact: boolean;
  soundReactToMe: boolean;
  soundMessage: boolean;
  soundPoke: boolean;
  appFrame: OverlayAppFrame | null;
  layoutReady: boolean;
  hostImageViewerOpen: boolean;
  activeMessageActionId: MessageId | null;
};

const state: ChatState = {
  root: null,
  mountMode: null,
  messagesSelected: false,
  messages: [],
  users: new Map(),
  socketPort: null,
  socketState: "closed",
  reconnectTimer: null,
  staleTimer: null,
  recoveryInFlight: false,
  lastSocketActivityAt: 0,
  lastRecoveryAt: 0,
  reconnectAttempts: 0,
  recoveryVisibleState: "none",
  recoveryMessage: "",
  loading: false,
  loadingOlder: false,
  hasMoreOlder: true,
  showOlderButton: false,
  olderCursor: null,
  sending: false,
  signedIn: false,
  enabled: true,
  currentUser: null,
  pendingAttachments: [],
  composerError: "",
  replyTo: null,
  minimized: true,
  explicitlyOpened: false,
  theme: "system",
  side: "right",
  x: 0,
  frameWidth: 350,
  frameHeight: 560,
  topOffset: 8,
  soundEnabled: true,
  soundVolume: 0.55,
  soundSend: true,
  soundReact: true,
  soundReactToMe: true,
  soundMessage: true,
  soundPoke: true,
  appFrame: null,
  layoutReady: false,
  hostImageViewerOpen: false,
  activeMessageActionId: null,
};

export function boot(context?: MilxdyContentAppContext): void {
  if (booted) return;
  booted = true;
  state.enabled = true;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  lifecycleSignal = context?.signal || null;
  runtimeScheduler = context?.scheduler || runtimeScheduler;
  runtimeSendMessage = context?.sendMessage || unavailableRuntimeSendMessage;
  invokeRemiliaCapability = context?.invokeRemiliaCapability
    ? (operation, params) => context.invokeRemiliaCapability!(operation, params)
    : null;
  recordDiagnostic = context?.recordDiagnostic || recordDiagnostic;
  chatRestController = createChatRestController();
  ensureOverlayAppChromeStyles();
  registerDockItem();
  ensureRoot();
  scheduleMountRetry();
  void loadLayoutSettings();
  void loadTheme();
  if (context) void cueVolumes.start(addRuntimeDisposable, context.storage.local);
  void loadSoundSettings();
  addRuntimeDisposable(observeOverlayPanelTheme(applyTheme));
  observeLayoutSignals();
  observeHostImageViewer();
  observeEnablement();
  observeMessagesSelection();
  observeMessagesList();
  void refreshAuthAndHistory();
}

export function onRouteChange(_route: MilxdyRouteChange): void {
  if (!lifecycleActive()) return;
  if (isMessagesRoute() && state.messagesSelected && isConversationHref(location.pathname)) clearMessagesSelection();
  ensureRoot();
  scheduleMountRetry();
  void refreshAuthAndHistory();
  updateOfficialPolling();
}

export function open(): void {
  if (!lifecycleActive()) return;
  state.explicitlyOpened = true;
  if (isMessagesRoute() && !state.messagesSelected) state.messagesSelected = true;
  state.minimized = false;
  ensureRoot();
  scheduleMountRetry();
  render();
  void refreshAuthAndHistory();
  updateOfficialPolling();
}

export async function stageLocalAttachment(file: File): Promise<{ ok: boolean; error?: string }> {
  if (!lifecycleActive()) return { ok: false, error: "RemiNet Chat is unavailable." };
  const error = validateAttachment(file);
  if (error) return { ok: false, error };
  if (state.pendingAttachments.length >= 4) return { ok: false, error: "Maximum 4 attachments." };
  state.composerError = "";
  const attachment: PendingAttachment = {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type,
    dataUrl: await fileToDataUrl(file),
    status: "ready",
  };
  state.pendingAttachments.push(attachment);
  open();
  render();
  const composer = state.root?.querySelector<HTMLInputElement>('[data-role="input"]');
  if (!composer?.isConnected) {
    state.pendingAttachments = state.pendingAttachments.filter((item) => item.id !== attachment.id);
    state.composerError = "RemiNet Chat could not open on this page.";
    render();
    return { ok: false, error: state.composerError };
  }
  composer.focus({ preventScroll: true });
  return { ok: true };
}

export function close(): void {
  closeChatPanel();
}

export function disable(): void {
  state.enabled = false;
  destroy();
}

export function dispose(): void {
  disable();
  legacyMutationDispatcher.rejectAll();
  chatRestController?.dispose();
  chatRestController = null;
  state.appFrame?.remove();
  state.appFrame = null;
  addRuntimeDisposable = () => undefined;
  invokeRemiliaCapability = null;
  lifecycleSignal = null;
  booted = false;
}

function lifecycleActive(): boolean {
  return booted && state.enabled && lifecycleSignal?.aborted !== true;
}

function createChatRestController(): ChatRestController {
  return new ChatRestController({
    invokeCapability: (operation, params) => invokeRemiliaCapability?.(operation, params)
      ?? Promise.resolve({
        ok: false,
        error: {
          category: "broker",
          code: "client_unavailable",
          message: "The Remilia capability service is unavailable.",
          status: 0,
        },
      }),
    scheduler: runtimeScheduler,
    onPage: ({ page, reason }) => {
      if (!lifecycleActive()) return;
      ingestOfficialChatPage(page);
      state.signedIn = true;
      if (reason === "initial" || reason === "manual") {
        state.olderCursor = page.next_cursor;
        state.hasMoreOlder = page.has_more;
        state.showOlderButton = page.has_more;
      } else if (reason === "older") {
        state.olderCursor = page.next_cursor;
        state.hasMoreOlder = page.has_more;
        state.showOlderButton = page.has_more;
      } else if (reason === "post" && page.messages[0]) {
        state.currentUser = officialIdentityToApiUser(page.messages[0].author);
      }
      sortAndTrimMessages(reason === "older" ? "oldest" : "newest");
      state.recoveryVisibleState = "none";
      state.recoveryMessage = "";
      clearSuccessfulChatReadError();
      renderStatus("Live");
      render();
    },
    onFailure: handleOfficialChatFailure,
    recordDiagnostic: (key, value) => recordChatDiagnostic(key, value),
  });
}

export function requestOfficialChatReconciliation(reason: ChatRestReconciliationReason): Promise<RemiliaApiResult<RemiliaApiChatPage> | null> {
  return chatRestController?.requestReconciliation(reason) ?? Promise.resolve(null);
}

function updateOfficialPolling(): void {
  chatRestController?.setPollingActive(Boolean(
    lifecycleActive()
      && state.enabled
      && state.signedIn
      && !state.minimized
      && !document.hidden
      && isChatRoute(),
  ));
}

function registerDockItem(): void {
  state.appFrame = createOverlayAppFrame({
    id: "reminetChat",
    label: "RemiNet Chat",
    icon: REMINET_CHAT_ICON,
    initialSide: state.side,
    isOpen: () => Boolean(state.root && !state.minimized),
    onOpen: () => {
      open();
    },
    onClose: () => {
      closeChatPanel();
    },
    onSideChange: (side) => {
      state.side = side;
      ensureRoot();
      render();
    },
  });
}

function observeLayoutSignals(): void {
  let cancelLayoutTimer: (() => void) | null = null;
  addRuntimeDisposable(() => {
    cancelLayoutTimer?.();
    cancelLayoutTimer = null;
    cancelMountRetryTimer?.();
    cancelMountRetryTimer = null;
  });
  const scheduleLayout = () => {
    if (!lifecycleActive() || cancelLayoutTimer) return;
    cancelLayoutTimer = runtimeScheduler.timeout(() => {
      cancelLayoutTimer = null;
      if (!lifecycleActive()) return;
      applyLayout();
    }, 300);
  };
  window.addEventListener("resize", scheduleLayout, { passive: true });
  addRuntimeDisposable(() => window.removeEventListener("resize", scheduleLayout));
  const visibilityListener = () => {
    if (document.hidden) {
      closeSocket();
      updateOfficialPolling();
    }
    else if (lifecycleActive()) {
      ensureRoot();
      scheduleMountRetry();
      updateOfficialPolling();
      if (state.signedIn && isChatRoute()) {
        void requestOfficialChatReconciliation("visibility-resume");
        connectSocket();
      }
    }
  };
  document.addEventListener("visibilitychange", visibilityListener);
  addRuntimeDisposable(() => document.removeEventListener("visibilitychange", visibilityListener));
}

function scheduleMountRetry(attempt = 0): void {
  cancelMountRetryTimer?.();
  cancelMountRetryTimer = null;
  if (!lifecycleActive() || state.minimized || state.root || !isChatRoute()) return;
  const delayMs = ROUTE_MOUNT_RETRY_DELAYS_MS[Math.min(attempt, ROUTE_MOUNT_RETRY_DELAYS_MS.length - 1)];
  cancelMountRetryTimer = runtimeScheduler.timeout(() => {
    cancelMountRetryTimer = null;
    if (!lifecycleActive() || state.minimized || state.root || !isChatRoute()) return;
    ensureRoot();
    if (!state.root && attempt < ROUTE_MOUNT_RETRY_DELAYS_MS.length - 1) scheduleMountRetry(attempt + 1);
  }, delayMs);
}

function observeEnablement(): void {
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "sync") {
      applySoundSettingChanges(changes);
      if (changes[POKE_PLACEMENT_KEY]) {
        pokePlacement = normalizePokePlacement(changes[POKE_PLACEMENT_KEY].newValue);
        render();
      }
      return;
    }
    if ((area === "local" && changes["milxdy.remiliaAuth.control.v1"])
      || (area === "session" && changes["milxdy.remiliaAuth.credentials.v1"])) {
      void refreshAuthAndHistory(true);
    }
    if (area !== "local") return;
    if (changes[SETTINGS_THEME_KEY]) {
      state.theme = normalizeThemeMode(changes[SETTINGS_THEME_KEY].newValue);
      applyTheme();
    }
    if (changes["milxdy.reminetChat.enabled"]) {
      state.enabled = changes["milxdy.reminetChat.enabled"].newValue === true;
      if (!state.enabled) {
        destroy();
        return;
      }
      ensureRoot();
      void refreshAuthAndHistory(true);
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
  addRuntimeDisposable(() => chrome.storage.onChanged.removeListener(storageListener));
}

function destroy(): void {
  cancelMountRetryTimer?.();
  cancelMountRetryTimer = null;
  clearSocketStaleTimer();
  closeSocket();
  cancelSendResetTimer?.();
  cancelSendResetTimer = null;
  for (const cancelTimer of pokeCountdownTimers.values()) cancelTimer();
  pokeCountdownTimers.clear();
  pokeButtonsByUsername.clear();
  pokeCooldowns.clear();
  pokeFeedback.clear();
  reactionFeedback.clear();
  pokeCooldownSources.clear();
  pokeEligibilityChecked.clear();
  currentUserReactionStates.clear();
  removePseudoChatRow();
  restoreNativeDmPane();
  state.messages = [];
  state.olderCursor = null;
  state.hasMoreOlder = true;
  state.showOlderButton = false;
  state.users.clear();
  state.pendingAttachments = [];
  updateOfficialPolling();
  state.composerError = "";
  state.replyTo = null;
  state.signedIn = false;
  state.loading = false;
  state.loadingOlder = false;
  state.hasMoreOlder = true;
  state.showOlderButton = false;
  state.sending = false;
  state.recoveryInFlight = false;
  state.recoveryVisibleState = "none";
  state.recoveryMessage = "";
  state.hostImageViewerOpen = false;
  state.root?.remove();
  state.root = null;
  state.mountMode = null;
  state.messagesSelected = false;
  state.explicitlyOpened = false;
}

function isSupportedRoute(): boolean {
  return canMountRemiNetChatRoute(location.pathname, state.explicitlyOpened);
}

function isChatRoute(): boolean {
  if (isMessagesRoute()) return state.messagesSelected;
  return isSupportedRoute();
}

function isMessagesRoute(pathname = location.pathname): boolean {
  return pathname === "/messages" || pathname.startsWith("/messages/") || pathname.startsWith("/i/chat");
}

function isProfileRoute(): boolean {
  const match = location.pathname.match(/^\/([^/?#]+)\/?$/);
  if (!match) return false;
  return !new Set([
    "compose",
    "explore",
    "home",
    "i",
    "jobs",
    "messages",
    "notifications",
    "search",
    "settings",
  ]).has(match[1].toLowerCase());
}

function ensureRoot(): void {
  if (!state.enabled) return;
  if (!isSupportedRoute()) {
    removePseudoChatRow();
    restoreNativeDmPane();
    if (state.root) {
      closeSocket();
      state.root.remove();
      state.root = null;
      state.mountMode = null;
    }
    return;
  }

  const existing = document.getElementById(ROOT_ID) as HTMLElement | null;
  const mountTarget = findMountTarget();
  if (isMessagesRoute()) {
    ensurePseudoChatRow();
  } else {
    removePseudoChatRow();
    state.messagesSelected = false;
    restoreNativeDmPane();
  }

  if (state.minimized) {
    if (existing) {
      closeSocket();
      existing.remove();
    }
    state.root = null;
    state.mountMode = null;
    restoreNativeDmPane();
    updatePseudoChatRowState();
    updateDockState();
    return;
  }

  if (!isChatRoute()) {
    if (existing) {
      closeSocket();
      existing.remove();
    }
    state.root = null;
    state.mountMode = null;
    restoreNativeDmPane();
    updatePseudoChatRowState();
    return;
  }

  if (!mountTarget) {
    if (existing) {
      closeSocket();
      existing.remove();
    }
    state.root = null;
    state.mountMode = null;
    if (isMessagesRoute()) restoreNativeDmPane();
    return;
  }

  const root = existing || createRoot();
  root.classList.add("milxdy-overlay-app-shell");
  root.querySelector(".milxdy-chat-card")?.classList.add("milxdy-overlay-app-card");
  root.querySelector(".milxdy-chat-header")?.classList.add("milxdy-overlay-app-header");
  const mount = isMessagesRoute() && mountTarget !== document.body ? "messages" : "rail";
  const changed = !existing || root.parentElement !== mountTarget || root.dataset.mount !== mount;
  if (root.parentElement !== mountTarget) {
    mountTarget.appendChild(root);
  }
  root.dataset.mount = mount;
  state.root = root;
  state.mountMode = mount;
  applyHostImageViewerState();
  if (mount === "messages") hideNativeDmPaneContent(mountTarget, root);
  else restoreNativeDmPane();
  updatePseudoChatRowState();
  applyTheme();
  applyLayout();
  if (changed) render();
}

function findMountTarget(): HTMLElement | null {
  if (isMessagesRoute()) {
    const pane = findDmConversationPane();
    // A dock click must still open Chat when X's embedded or narrow DM layout
    // does not expose a conversation pane we can safely replace.
    return pane || (state.explicitlyOpened ? document.body : null);
  }
  return document.body;
}

function findRightRail(): HTMLElement | null {
  const column = document.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
  if (!column || column.offsetWidth < 260) return null;
  return column.querySelector<HTMLElement>(":scope > div") || column;
}

function findDmContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="dm-main-container"]')
    || document.querySelector<HTMLElement>('[data-testid="dm-container"]')
    || document.querySelector<HTMLElement>('[aria-label="Timeline: Messages"]')
    || document.querySelector<HTMLElement>('main[role="main"]');
}

function findDmListMount(): HTMLElement | null {
  const container = findDmContainer();
  if (!container) return null;
  const modernConversationList = container.querySelector<HTMLElement>('[data-testid="x-chat-conversation-list"]');
  if (modernConversationList) {
    return modernConversationList.querySelector<HTMLElement>('[role="list"]') || modernConversationList;
  }
  const conversationRow = findFirstDmConversationRow();
  if (conversationRow?.parentElement && container.contains(conversationRow.parentElement)) return conversationRow.parentElement;
  const existing = document.getElementById(PSEUDO_ROW_ID);
  if (existing?.parentElement && container.contains(existing.parentElement)) return existing.parentElement;
  const timeline = findMessagesTimeline();
  const firstCell = firstMessagesTimelineCell(timeline);
  if (firstCell?.parentElement && container.contains(firstCell.parentElement)) return firstCell.parentElement;
  return timeline?.querySelector<HTMLElement>(":scope > div") || timeline;
}

function findFirstDmConversationRow(): HTMLElement | null {
  const container = findDmContainer();
  const timeline = findMessagesTimeline();
  const root = timeline || container || document;
  const timelineCell = firstMessagesTimelineCell(root);
  if (timelineCell) return timelineCell;
  const link = Array.from(root.querySelectorAll<HTMLElement>('a[href^="/messages/"], a[href^="/i/chat/"]'))
    .find((candidate) => isConversationHref(candidate.getAttribute("href")) && candidate.offsetWidth > 0 && candidate.offsetHeight > 0) || null;
  if (!link) return null;
  return link.closest<HTMLElement>('[data-testid="cellInnerDiv"], [role="link"], [role="button"], [data-testid="conversation"]') || link.closest<HTMLElement>("a") || link;
}

function isConversationHref(value: string | null): boolean {
  if (!value) return false;
  if (value === "/messages" || value === "/messages/compose") return false;
  return /^\/messages\/[^/?#]+/.test(value) || /^\/i\/chat\/[^/?#]+/.test(value);
}

function findMessagesTimeline(): HTMLElement | null {
  const container = findDmContainer();
  if (!container) return null;
  return Array.from(document.querySelectorAll<HTMLElement>('[aria-label="Timeline: Messages"]'))
    .find((element) => (container.contains(element) || element.contains(container)) && element.offsetWidth >= 240 && element.offsetHeight >= 80) || null;
}

function firstMessagesTimelineCell(root: ParentNode | null): HTMLElement | null {
  if (!root) return null;
  return Array.from(root.querySelectorAll<HTMLElement>('[data-testid="cellInnerDiv"]'))
    .find((candidate) => isLikelyDmConversationRow(candidate) || isUsableMessagesTimelineCell(candidate)) || null;
}

function isLikelyDmConversationRow(element: HTMLElement): boolean {
  if (element.id === PSEUDO_ROW_ID || element.querySelector(`#${PSEUDO_ROW_ID}`)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 240 || rect.height < 56) return false;
  if (element.querySelector('input, textarea, [role="searchbox"]')) return false;
  const link = element.querySelector<HTMLElement>('a[href^="/messages/"], a[href^="/i/chat/"]');
  if (isConversationHref(link?.getAttribute("href") || null)) return true;
  const text = (element.textContent || "").trim();
  const hasAvatar = Boolean(element.querySelector('img, [data-testid*="UserAvatar"], [aria-label*="profile" i]'));
  return hasAvatar && text.length > 0;
}

function isUsableMessagesTimelineCell(element: HTMLElement): boolean {
  if (element.id === PSEUDO_ROW_ID || element.querySelector(`#${PSEUDO_ROW_ID}`)) return false;
  if (element.querySelector('input, textarea, [role="searchbox"]')) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 240 || rect.height < 40) return false;
  return Boolean((element.textContent || "").trim());
}

function findDmConversationPane(): HTMLElement | null {
  const container = findDmContainer();
  if (!container) return null;
  const listMount = findDmListMount();
  if (!listMount) return null;
  const listRect = listMount.getBoundingClientRect();
  if (listRect.width < 240 || listRect.height < 260) return null;
  const panel = container.querySelector<HTMLElement>('[data-testid="dm-conversation-panel"]');
  if (panel && isAdjacentDmConversationPane(panel, listRect)) return panel;
  const candidates = Array.from(container.querySelectorAll<HTMLElement>('[role="region"], main, section, div'))
    .filter((element) => element !== listMount && !element.contains(listMount))
    .filter((element) => isAdjacentDmConversationPane(element, listRect));
  return candidates
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftGap = Math.abs(leftRect.left - listRect.right);
      const rightGap = Math.abs(rightRect.left - listRect.right);
      if (leftGap !== rightGap) return leftGap - rightGap;
      return leftRect.width - rightRect.width;
    })[0] || null;
}

function isAdjacentDmConversationPane(element: HTMLElement, listRect: DOMRect): boolean {
  if (element.id === ROOT_ID || element.closest('[data-testid="sidebarColumn"]')) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 320 || rect.height < 260) return false;
  const horizontalGap = rect.left - listRect.right;
  const verticalOverlap = Math.max(0, Math.min(rect.bottom, listRect.bottom) - Math.max(rect.top, listRect.top));
  return horizontalGap >= -8
    && horizontalGap <= 32
    && verticalOverlap >= Math.min(rect.height, listRect.height) * 0.6;
}

function ensurePseudoChatRow(): void {
  const mount = findDmListMount();
  if (!mount) {
    removePseudoChatRow();
    return;
  }
  const before = findFirstDmConversationRow();
  const row = document.getElementById(PSEUDO_ROW_ID) as HTMLButtonElement | null || createPseudoChatRow();
  if (before?.parentElement === mount) {
    const nativeRowIsBeforePseudoRow = (before.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (row.parentElement !== mount || nativeRowIsBeforePseudoRow) {
      mount.insertBefore(row, before);
    }
  } else if (row.parentElement !== mount || row !== mount.firstElementChild) {
    mount.insertBefore(row, mount.firstElementChild);
  }
  updatePseudoChatRowState();
}

function createPseudoChatRow(): HTMLButtonElement {
  const row = document.createElement("button");
  const logoUrl = REMINET_CHAT_ICON;
  row.id = PSEUDO_ROW_ID;
  row.type = "button";
  row.setAttribute("role", "link");
  row.dataset.milxdyReminetChatRow = "true";
  row.setAttribute("aria-label", "Open RemiliaNET Chat in milXdy");
  row.innerHTML = `
    <span class="milxdy-chat-pseudo-avatar" aria-hidden="true"><img src="${escapeHtml(logoUrl)}" alt=""></span>
    <span class="milxdy-chat-pseudo-copy">
      <strong>RemiliaNET Chat</strong>
      <span>RemiNet Global Chat</span>
    </span>
  `;
  row.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.messagesSelected = true;
    state.minimized = false;
    ensureRoot();
    void refreshAuthAndHistory();
  });
  return row;
}

function updatePseudoChatRowState(): void {
  const row = document.getElementById(PSEUDO_ROW_ID);
  if (!row) return;
  row.dataset.selected = String(state.messagesSelected);
  row.setAttribute("aria-pressed", String(state.messagesSelected));
}

function removePseudoChatRow(): void {
  document.getElementById(PSEUDO_ROW_ID)?.remove();
}

function hideNativeDmPaneContent(pane: HTMLElement, root: HTMLElement): void {
  for (const child of Array.from(pane.children)) {
    if (child === root || !(child instanceof HTMLElement)) continue;
    child.setAttribute(NATIVE_DM_HIDDEN_ATTR, "true");
    hiddenNativeDmElements.add(child);
  }
}

function restoreNativeDmPane(): void {
  for (const element of Array.from(hiddenNativeDmElements)) {
    element.removeAttribute(NATIVE_DM_HIDDEN_ATTR);
    hiddenNativeDmElements.delete(element);
  }
}

function observeMessagesSelection(): void {
  const selectionListener = (event: MouseEvent) => {
    if (!state.messagesSelected || !isMessagesRoute()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`#${PSEUDO_ROW_ID}`) || target.closest(`#${ROOT_ID}`)) return;
    if (!findNativeDmSelectionTarget(target)) return;
    clearMessagesSelection();
  };
  document.addEventListener("click", selectionListener, true);
  addRuntimeDisposable(() => document.removeEventListener("click", selectionListener, true));
}

function observeMessagesList(): void {
  let cancelCheckTimer: (() => void) | null = null;
  const scheduleCheck = () => {
    if (!lifecycleActive() || cancelCheckTimer) return;
    cancelCheckTimer = runtimeScheduler.timeout(() => {
      cancelCheckTimer = null;
      if (!lifecycleActive()) return;
      if (!isMessagesRoute()) {
        removePseudoChatRow();
        return;
      }
      ensurePseudoChatRow();
    }, 150);
  };
  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-testid", "href", "style"],
    childList: true,
    subtree: true,
  });
  window.addEventListener("scroll", scheduleCheck, true);
  addRuntimeDisposable(() => {
    cancelCheckTimer?.();
    cancelCheckTimer = null;
    observer.disconnect();
    window.removeEventListener("scroll", scheduleCheck, true);
  });
}

function findNativeDmSelectionTarget(target: Element): HTMLElement | null {
  const link = target.closest<HTMLElement>('a[href^="/messages/"], a[href^="/i/chat/"]');
  if (isConversationHref(link?.getAttribute("href") || null)) return link;
  const row = target.closest<HTMLElement>('[data-testid="cellInnerDiv"], [role="link"], [role="button"], [data-testid="conversation"]');
  if (!row || row.id === PSEUDO_ROW_ID || row.querySelector(`#${PSEUDO_ROW_ID}`)) return null;
  return isLikelyDmConversationRow(row) ? row : null;
}

function clearMessagesSelection(): void {
  state.messagesSelected = false;
  state.minimized = true;
  state.explicitlyOpened = false;
  closeSocket();
  state.root?.remove();
  state.root = null;
  state.mountMode = null;
  restoreNativeDmPane();
  updatePseudoChatRowState();
  updateDockState();
}

function observeHostImageViewer(): void {
  let cancelCheckTimer: (() => void) | null = null;
  const scheduleCheck = () => {
    if (!lifecycleActive() || cancelCheckTimer) return;
    cancelCheckTimer = runtimeScheduler.timeout(() => {
      cancelCheckTimer = null;
      updateHostImageViewerState();
    }, 50);
  };
  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["aria-label", "aria-modal", "data-testid", "role"],
    childList: true,
    subtree: true,
  });
  window.addEventListener("popstate", scheduleCheck);
  window.addEventListener("hashchange", scheduleCheck);
  addRuntimeDisposable(() => {
    cancelCheckTimer?.();
    cancelCheckTimer = null;
    observer.disconnect();
    window.removeEventListener("popstate", scheduleCheck);
    window.removeEventListener("hashchange", scheduleCheck);
  });
  updateHostImageViewerState();
}

function updateHostImageViewerState(): void {
  const open = isHostImageViewerOpen();
  if (state.hostImageViewerOpen === open) {
    applyHostImageViewerState();
    return;
  }
  state.hostImageViewerOpen = open;
  applyHostImageViewerState();
}

function applyHostImageViewerState(): void {
  if (!state.root) return;
  state.root.dataset.hostImageViewerOpen = String(state.hostImageViewerOpen);
}

function isHostImageViewerOpen(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'))
    .some(isLikelyHostImageViewerDialog);
}

function isLikelyHostImageViewerDialog(dialog: HTMLElement): boolean {
  if (dialog.closest(`#${ROOT_ID}`) || !isVisibleElement(dialog)) return false;
  const hasCloseControl = Boolean(dialog.querySelector<HTMLElement>('[aria-label="Close"], [data-testid="app-bar-close"], [data-testid="close"]'));
  if (!hasCloseControl) return false;
  return isXPhotoRoute() || hasXPhotoLink(dialog) || hasXMediaViewerSignature(dialog);
}

function isXPhotoRoute(): boolean {
  return /\/photo\/\d+(?:$|[/?#])/.test(location.pathname);
}

function hasXPhotoLink(dialog: HTMLElement): boolean {
  return Boolean(dialog.querySelector<HTMLAnchorElement>('a[href*="/photo/"]'));
}

function hasXMediaViewerSignature(dialog: HTMLElement): boolean {
  const swipeContainer = dialog.querySelector<HTMLElement>('[data-testid="swipe-to-dismiss"]');
  if (!swipeContainer) return false;
  return Boolean(swipeContainer.querySelector<HTMLElement>(
    [
      'img[src*="pbs.twimg.com/media"]',
      'img[src*="twimg.com/media"]',
      "video",
    ].join(", "),
  ));
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
}

function createRoot(): HTMLElement {
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.className = "milxdy-overlay-app-shell";
  prepareOverlayAppRoot(root);
  root.innerHTML = chatRootMarkup(CHAT_JUMP_CONTROLS);
  root.querySelector<HTMLButtonElement>('[data-role="refresh"]')?.addEventListener("click", () => {
    void refreshAuthAndHistory(true);
  });
  root.querySelector<HTMLButtonElement>('[data-role="minimize"]')?.addEventListener("click", () => {
    closeChatPanel();
  });
  root.querySelector<HTMLButtonElement>('[data-role="close"]')?.addEventListener("click", closeChatPanel);
  for (const handle of Array.from(root.querySelectorAll<HTMLElement>('[data-role="resize"]'))) {
    handle.addEventListener("pointerdown", startResize);
  }
  root.querySelector<HTMLElement>(".milxdy-chat-header")?.addEventListener("pointerdown", startDrag);
  root.querySelector<HTMLFormElement>('[data-role="form"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitMessage();
  });
  root.querySelector<HTMLInputElement>('[data-role="file"]')?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) return;
    void addPendingFiles(input.files);
    input.value = "";
  });
  root.addEventListener("paste", (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    state.composerError = CHAT_MEDIA_UNAVAILABLE;
    render();
  });
  root.addEventListener("click", handleChatActionClick);
  root.addEventListener("pointerout", handleChatMessagePointerOut);
  installChatJumpControl(root);
  return root;
}

function handleChatMessagePointerOut(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const message = target?.closest<HTMLElement>(".milxdy-chat-message");
  if (!message) return;
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && message.contains(nextTarget)) return;

  const messageId = messageIdOrNull(message.dataset.messageId);
  if (messageId !== null && state.activeMessageActionId === messageId) {
    state.activeMessageActionId = null;
  }
  const actions = message.querySelector<HTMLElement>(".milxdy-chat-message-actions");
  if (actions) actions.dataset.open = "false";
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (focused && message.contains(focused)) focused.blur();
}

function handleChatActionClick(event: MouseEvent): void {
  const root = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const target = event.target instanceof Element ? event.target : null;
  const action = target?.closest<HTMLElement>("[data-chat-action]");
  if (!root || !action) return;
  event.preventDefault();
  const kind = action.dataset.chatAction;
  if (kind === "attach") { state.composerError = CHAT_MEDIA_UNAVAILABLE; render(); }
  if (kind === "remove-attachment") removePendingAttachment(action.dataset.attachmentId || "");
  if (kind === "react") {
    const messageId = messageIdOrNull(action.dataset.messageId);
    state.activeMessageActionId = messageId;
    if (messageId) reactToMessage(messageId, action.dataset.emoji || "", action);
  }
  if (kind === "reply") {
    const messageId = messageIdOrNull(action.dataset.messageId);
    if (messageId) setReplyTo(messageId);
  }
  if (kind === "cancel-reply") clearReplyTo();
  if (kind === "poke") void pokeUser(action.dataset.username || "");
  if (kind === "load-older") void loadOlderMessages();
  if (kind === "retry-connection") void refreshAuthAndHistory(true);
  if (kind === "login") {
    void runtimeSendMessage({ type: "reminetChat:openLogin" }, "reminetChat:openLogin")
      .then(asRecord).then((result) => {
        if (!lifecycleActive()) return;
        renderStatus(result.ok ? "Use the RemiliaNET login button in milXdy." : "Could not open login. Open the milXdy extension popup.");
      }).catch(() => renderStatus("Could not open login. Open the milXdy extension popup."));
  }
}

async function refreshAuthAndHistory(force = false): Promise<void> {
  if (!lifecycleActive()) return;
  if (state.minimized) return;
  if (!state.enabled || !isChatRoute() || state.loading && !force) return;
  const controller = chatRestController;
  if (!controller) return;
  state.loading = true;
  state.recoveryVisibleState = "none";
  state.recoveryMessage = "";
  if (force) {
    state.hasMoreOlder = true;
    state.showOlderButton = false;
    state.olderCursor = null;
  }
  renderStatus("Checking RemiliaNET connection...");
  const auth = await runtimeSendMessage({ type: "reminetChat:authStatus" }, "reminetChat:authStatus")
    .then(asRecord).catch(() => asRecord({}));
  if (!lifecycleActive()) return;
  extensionAuthPhase = auth.ok && typeof auth.phase === "string" ? auth.phase : "unknown";
  if (auth.ok && auth.signedIn === false) {
    state.signedIn = false;
    state.loading = false;
    state.composerError = "";
    closeSocket();
    updateOfficialPolling();
    renderStatus(extensionAuthPhase === "disconnected" ? "Log in to use Chat."
      : extensionAuthPhase === "connecting" ? "RemiliaNET login in progress…"
      : extensionAuthPhase === "expired" ? "RemiliaNET connection expired."
      : extensionAuthPhase === "missing-scope" ? "Chat access required."
      : "RemiliaNET connection required.");
    render();
    return;
  }
  renderStatus("Loading official chat...");
  const history = force
    ? await controller.requestReconciliation("manual")
    : await controller.loadInitial();
  if (!lifecycleActive()) return;
  if (history?.ok) {
    state.signedIn = true;
    connectSocket();
  } else if (!state.signedIn) {
    closeSocket();
  }
  state.loading = false;
  updateOfficialPolling();
  render();
}

async function loadOlderMessages(): Promise<void> {
  if (!lifecycleActive()) return;
  const controller = chatRestController;
  const before = state.olderCursor;
  if (!controller || !state.signedIn || state.loadingOlder || !before) return;
  const scroller = state.root?.querySelector<HTMLElement>('[data-role="messages"]') || null;
  const previousHeight = scroller?.scrollHeight || 0;
  const previousTop = scroller?.scrollTop || 0;
  const previousIds = new Set(state.messages.map((message) => message.id));
  state.loadingOlder = true;
  render();
  const history = await controller.loadOlder(before);
  if (!lifecycleActive()) return;
  if (history.ok) {
    const addedMessages = state.messages.some((message) => !previousIds.has(message.id));
    state.hasMoreOlder = history.data.has_more && Boolean(history.data.next_cursor) && addedMessages;
    state.showOlderButton = state.hasMoreOlder;
  } else {
    state.hasMoreOlder = false;
    state.showOlderButton = false;
    renderStatus("Could not load older chat.");
  }
  state.loadingOlder = false;
  render();
  window.requestAnimationFrame(() => {
    if (!lifecycleActive()) return;
    const nextScroller = state.root?.querySelector<HTMLElement>('[data-role="messages"]') || null;
    if (!nextScroller) return;
    const delta = nextScroller.scrollHeight - previousHeight;
    nextScroller.scrollTop = Math.max(0, previousTop + delta);
  });
}

function ingestOfficialChatPage(page: RemiliaApiChatPage): void {
  for (const message of page.messages) ingestOfficialChatMessage(message);
}

function ingestOfficialChatMessage(message: RemiliaApiChatMessage): void {
  const normalized = normalizeChatMessage(message.id, officialChatMessageRecord(message));
  if (normalized) upsertMessage(normalized);
}

function handleOfficialChatFailure(error: RemiliaApiError, kind: ChatRestFailureKind): void {
  if (!lifecycleActive()) return;
  if (kind === "auth-expired" || kind === "missing-scope") {
    state.signedIn = false;
    updateOfficialPolling();
  }
  if (kind === "auth-expired") {
    extensionAuthPhase = "expired";
    setRecoveryVisibleState("auth-required", "Log in");
    state.composerError = "Your RemiliaNET connection has expired. Log in again.";
  } else if (kind === "missing-scope") {
    extensionAuthPhase = "missing-scope";
    setRecoveryVisibleState("auth-required", "Reconnect");
    state.composerError = "Reconnect RemiliaNET with Chat access.";
  } else if (kind === "rate-limited") {
    renderStatus("Chat is rate limited.");
    state.composerError = "Wait before trying Chat again.";
  } else if (kind === "offline") {
    renderStatus("Chat offline — retrying");
    state.composerError = "Remilia Chat is offline. Nothing was sent.";
  } else if (kind !== "cancelled") {
    renderStatus("Could not refresh chat.");
    state.composerError = "Remilia Chat could not complete the request.";
  }
  recordChatDiagnostic("official-rest.failure", {
    kind,
    category: error.category,
    code: error.code,
    status: error.status,
  });
  render();
}

function clearSuccessfulChatReadError(): void {
  if (
    state.composerError === "Reconnect Remilia from the milXdy popup, then recheck Chat."
    || state.composerError === "Reconnect Remilia with Chat access from the milXdy popup, then recheck Chat."
  ) {
    state.composerError = "";
  }
}

function ingestApiPayload(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const record = payload as RuntimeRecord;
  if (record.global && typeof record.global === "object") ingestApiPayload(record.global);
  if (record.data && typeof record.data === "object") ingestApiPayload(record.data);
  ingestUsers(record.users);
  ingestMessages(record.messages);
}

function ingestUsers(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const entries = Array.isArray(value)
    ? value.map((user) => {
      const record = objectValue(user);
      return [String(record.id ?? record.userId ?? record.user_id), user];
    })
    : Object.entries(value as Record<string, unknown>);
  for (const [id, user] of entries) {
    const numeric = Number(id);
    if (!Number.isFinite(numeric) || !user || typeof user !== "object") continue;
    const next = user as ApiUser;
    state.users.set(numeric, { ...state.users.get(numeric), ...next });
    queueProfileLookup(numeric, next);
  }
}

function ingestMessages(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const entries = Array.isArray(value)
    ? value.map((message) => [String(objectValue(message).id), message])
    : Object.entries(value as Record<string, unknown>);
  for (const [id, message] of entries) {
    if (!message || typeof message !== "object") continue;
    ingestMessageUser(message as RuntimeRecord);
    const next = normalizeChatMessage(id, message as RuntimeRecord);
    if (next) upsertMessage(next);
  }
}

function ingestMessageUser(message: RuntimeRecord): void {
  const author = message.author ?? message.user ?? message.sender;
  if (!author || typeof author !== "object") return;
  const record = author as ApiUser;
  const authorId = numberOrUndefined(message.authorId ?? message.author_id ?? record.id ?? record.userId ?? record.user_id);
  if (!authorId) return;
  state.users.set(authorId, { ...state.users.get(authorId), ...record });
  queueProfileLookup(authorId, record);
}

function upsertMessage(message: ApiMessage): void {
  if ((message.chatId ?? message.chat_id) !== CHAT_ID) return;
  const index = state.messages.findIndex((item) => item.id === message.id);
  if (index >= 0) state.messages[index] = { ...state.messages[index], ...message };
  else state.messages.push(message);
}

function connectSocket(): void {
  if (!lifecycleActive() || document.hidden || state.socketState === "open" || state.socketState === "connecting") return;
  state.reconnectAttempts += 1;
  recordChatDiagnostic("socket.connect", { attempt: state.reconnectAttempts });
  if (!state.socketPort) {
    try {
      state.socketPort = chrome.runtime.connect({ name: SOCKET_PORT_NAME });
    } catch {
      void recoverChatConnection("port-connect-failed", { visible: true });
      return;
    }
    state.socketPort.onMessage.addListener(handleSocketPortMessage);
    state.socketPort.onDisconnect.addListener(() => {
      state.socketPort = null;
      state.socketState = "closed";
      legacyMutationDispatcher.rejectAll();
      clearSocketStaleTimer();
      void recoverChatConnection("port-disconnect", { visible: false });
    });
  }
  state.socketState = "connecting";
  state.socketPort.postMessage({ type: "connect" });
  markSocketActivity("connect-request");
}

function closeSocket(): void {
  cancelReconnectTimer?.();
  cancelReconnectTimer = null;
  state.reconnectTimer = null;
  clearSocketStaleTimer();
  legacyMutationDispatcher.rejectAll();
  if (state.socketPort) {
    try {
      state.socketPort.postMessage({ type: "close" });
      state.socketPort.disconnect();
    } catch {
      // Port may already be disconnected after route changes or reloads.
    }
  }
  state.socketPort = null;
  state.socketState = "closed";
}

function scheduleReconnect(): void {
  if (!lifecycleActive() || !state.signedIn || !isChatRoute() || document.hidden || state.reconnectTimer) return;
  renderStatus("Reconnecting...");
  cancelReconnectTimer = runtimeScheduler.timeout(() => {
    cancelReconnectTimer = null;
    state.reconnectTimer = null;
    if (!lifecycleActive()) return;
    connectSocket();
  }, 2500);
  state.reconnectTimer = -1;
}

function markSocketActivity(reason: string): void {
  state.lastSocketActivityAt = Date.now();
  recordChatDiagnostic("socket.activity", { reason, socketState: state.socketState, at: state.lastSocketActivityAt });
  scheduleSocketStaleTimer();
}

function scheduleSocketStaleTimer(): void {
  clearSocketStaleTimer();
  if (!lifecycleActive() || document.hidden || state.socketState !== "open") return;
  const dueIn = Math.max(1_000, state.lastSocketActivityAt + LEGACY_SOCKET_IDLE_TIMEOUT_MS - Date.now());
  cancelStaleTimer = runtimeScheduler.timeout(() => {
    cancelStaleTimer = null;
    state.staleTimer = null;
    if (!lifecycleActive() || document.hidden || state.socketState !== "open") return;
    const idleMs = Date.now() - state.lastSocketActivityAt;
    if (idleMs >= LEGACY_SOCKET_IDLE_TIMEOUT_MS) {
      void recoverChatConnection("socket-stale-timeout", { visible: false });
    } else {
      scheduleSocketStaleTimer();
    }
  }, dueIn);
  state.staleTimer = -1;
}

function clearSocketStaleTimer(): void {
  cancelStaleTimer?.();
  cancelStaleTimer = null;
  if (state.staleTimer !== null) {
    state.staleTimer = null;
  }
}

async function recoverChatConnection(
  reason: string,
  options: { visible?: boolean; force?: boolean } = {},
): Promise<void> {
  if (!lifecycleActive() || !isChatRoute()) return;
  if (document.hidden && !options.force) return;
  if (!options.force && state.recoveryInFlight) return;
  const now = Date.now();
  if (!options.force && now - state.lastRecoveryAt < SOCKET_RECOVERY_MIN_GAP_MS) return;
  state.lastRecoveryAt = now;
  state.recoveryInFlight = true;
  if (options.visible) setRecoveryVisibleState("recovering", "Checking Remilia Chat authorization...");
  else renderStatus("Reconnecting...");
  recordChatDiagnostic("recovery.start", { reason, visible: Boolean(options.visible), socketState: state.socketState });

  closeSocket();
  const history = await requestOfficialChatReconciliation(options.force ? "manual" : "realtime-gap");
  if (!lifecycleActive()) return;
  if (history?.ok) {
    state.signedIn = true;
    state.recoveryVisibleState = "none";
    state.recoveryMessage = "";
    connectSocket();
    renderStatus("Live");
    recordChatDiagnostic("recovery.finalState", { reason, state: "reconnected", messages: state.messages.length });
  } else if (history) {
    recordChatDiagnostic("recovery.finalState", { reason, state: "failed" });
  }
  state.recoveryInFlight = false;
  render();
}

async function submitMessage(): Promise<void> {
  if (!lifecycleActive()) return;
  const root = state.root;
  const input = root?.querySelector<HTMLInputElement>('[data-role="input"]');
  if (!input || state.sending) return;
  const text = input.value.trim();
  if (!text && state.pendingAttachments.length === 0) return;
  if (text && chatRestUtf8Bytes(text) > CHAT_REST_MESSAGE_LIMIT_BYTES) {
    state.composerError = "Chat messages must be 8,192 UTF-8 bytes or fewer.";
    render();
    return;
  }

  if (state.pendingAttachments.length === 0) {
    await submitOfficialTextMessage(input, text);
    return;
  }

  if (state.socketState !== "open") connectSocket();
  if (state.socketState !== "open") {
    renderStatus("Chat is reconnecting.");
    return;
  }
  const replyToId = state.replyTo?.id;
  const legacyReplyToId = legacyReplyId(replyToId);
  if (replyToId && legacyReplyToId === null) {
    state.composerError = "This legacy media adapter cannot reply to that message. Remove the reply or the attachment and try again.";
    render();
    return;
  }

  state.sending = true;
  state.composerError = "";
  render();
  const uploaded = await uploadPendingAttachments();
  if (!lifecycleActive()) return;
  if (!uploaded.ok) {
    state.sending = false;
    state.composerError = uploaded.error;
    render();
    return;
  }
  await submitUploadedLegacyMedia(input, text, replyToId, legacyReplyToId, uploaded);
}

async function submitUploadedLegacyMedia(
  input: HTMLInputElement,
  text: string,
  replyToId: MessageId | undefined,
  legacyReplyToId: number | null,
  uploaded: { images: MediaAttachment[]; video: MediaAttachment | null },
): Promise<void> {
  const mutation = legacyMediaSubmitMutation(text, legacyReplyToId, [...uploaded.images, ...(uploaded.video ? [uploaded.video] : [])]);
  if (!mutation) {
    state.sending = false;
    state.composerError = legacyMediaFailureMessage("LEGACY_CONFIRM_RESPONSE_INVALID");
    render();
    return;
  }
  const sent = await dispatchLegacyMutation(mutation);
  if (!lifecycleActive()) return;
  if (!sent.ok) {
    state.sending = false;
    state.pendingAttachments.forEach((attachment) => { attachment.status = "error"; });
    state.composerError = legacyMediaFailureMessage(sent.error);
    render();
    return;
  }
  upsertMessage({
    id: `local:${Date.now()}`,
    chatId: CHAT_ID,
    authorId: currentUserId(),
    body: text,
    createdAt: Date.now(),
    images: uploaded.images,
    video: uploaded.video,
    inReplyToId: replyToId,
    in_reply_to_id: replyToId,
    replyTo: state.replyTo,
  });
  sortAndTrimMessages();
  playChatSound("send");
  input.value = "";
  clearPendingAttachments();
  state.replyTo = null;
  void requestOfficialChatReconciliation("post");
  cancelSendResetTimer?.();
  cancelSendResetTimer = runtimeScheduler.timeout(() => {
    cancelSendResetTimer = null;
    if (!lifecycleActive()) return;
    state.sending = false;
    render();
  }, 350);
}

async function submitOfficialTextMessage(input: HTMLInputElement, text: string): Promise<void> {
  const controller = chatRestController;
  if (!controller || !text) return;
  state.sending = true;
  state.composerError = "";
  render();
  const result = await controller.postMessage(text, state.replyTo?.id);
  if (!lifecycleActive()) return;
  state.sending = false;
  if (!result.ok) {
    state.composerError = result.error.message;
    render();
    return;
  }
  input.value = "";
  state.replyTo = null;
  state.composerError = "";
  playChatSound("send");
  render();
}

function handleSocketPortMessage(message: unknown): void {
  const event = parseLegacySocketBridgeEvent(message);
  if (!event) {
    void requestOfficialChatReconciliation("realtime-invalid");
    return;
  }
  if (legacyMutationDispatcher.accept(event)) return;
  if (event.type === "socket:connecting") {
    state.socketState = "connecting";
    renderStatus("Connecting...");
    markSocketActivity("connecting");
    return;
  }
  if (event.type === "socket:open") {
    state.socketState = "open";
    state.reconnectAttempts = 0;
    state.recoveryVisibleState = "none";
    state.recoveryMessage = "";
    markSocketActivity("open");
    renderStatus("Live");
    render();
    return;
  }
  if (event.type === "socket:heartbeat") {
    markSocketActivity("heartbeat");
    return;
  }
  if (event.type === "socket:hint") {
    markSocketActivity("hint");
    if (event.event === "error") {
      renderStatus("Chat update unavailable.");
      void requestOfficialChatReconciliation("realtime-invalid");
    } else {
      void requestOfficialChatReconciliation("realtime-hint");
    }
    return;
  }
  if (event.type === "socket:reconcile") {
    void requestOfficialChatReconciliation(event.reason === "legacy-frame-dropped" ? "realtime-invalid" : "realtime-gap");
    return;
  }
  if (event.type === "socket:close") {
    state.socketState = "closed";
    clearSocketStaleTimer();
    recordChatDiagnostic("socket.close", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
    void recoverChatConnection("socket-close", { visible: false });
    return;
  }
  if (event.type === "socket:error") {
    clearSocketStaleTimer();
    recordChatDiagnostic("socket.error", {
      reason: event.reason,
    });
    if (event.reason === "site-bridge-required") {
      state.socketState = "closed";
      state.composerError = "Open or refresh a signed-in RemiliaNET tab to enable live chat.";
      setRecoveryVisibleState("failed", "Reconnect Chat");
      render();
      return;
    }
    void recoverChatConnection(event.reason, { visible: true });
  }
}

function dispatchLegacyMutation(mutation: LegacySocketMutation) {
  if (state.socketState !== "open") return Promise.resolve({
    ok: false,
    error: "LEGACY_MEDIA_SUBMIT_UNAVAILABLE",
    retryable: true,
  } as const);
  return legacyMutationDispatcher.dispatch(state.socketPort, mutation);
}

function render(): void {
  const root = state.root;
  if (!root) {
    updateDockState();
    return;
  }
  const loadOlder = root.querySelector<HTMLElement>('[data-role="load-older"]');
  const messages = root.querySelector<HTMLElement>('[data-role="messages"]');
  const send = root.querySelector<HTMLButtonElement>('[data-role="send"]');
  const input = root.querySelector<HTMLInputElement>('[data-role="input"]');
  const attachments = root.querySelector<HTMLElement>('[data-role="attachments"]');
  const error = root.querySelector<HTMLElement>('[data-role="error"]');
  const reply = root.querySelector<HTMLElement>('[data-role="reply"]');
  if (!loadOlder || !messages || !send || !input || !attachments || !error || !reply) return;

  root.dataset.minimized = String(state.minimized);
  root.dataset.side = state.side;
  updateDockState();
  const minimize = root.querySelector<HTMLButtonElement>('[data-role="minimize"]');
  if (minimize) {
    minimize.textContent = state.minimized ? "+" : "-";
    minimize.title = state.minimized ? "Expand chat" : "Minimize chat";
    minimize.setAttribute("aria-label", minimize.title);
  }

  input.disabled = !state.signedIn;
  send.disabled = !state.signedIn || state.sending;

  if (!state.signedIn) {
    syncChatJumpControl(root, false);
    messages.innerHTML = renderReconnectState();
    attachments.hidden = true;
    error.hidden = true;
    reply.hidden = true;
    loadOlder.hidden = true;
    return;
  }
  if (state.loading && state.messages.length === 0) {
    syncChatJumpControl(root, false);
    loadOlder.hidden = true;
    messages.innerHTML = `<div class="milxdy-chat-empty">Loading chat...</div>`;
    return;
  }

  const focusedMessageControl = captureFocusedMessageControl(messages);
  const atBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 48;
  const canRequestOlder = state.loadingOlder || (state.hasMoreOlder && Boolean(state.olderCursor));
  loadOlder.hidden = true;
  loadOlder.innerHTML = "";
  const messageHtml = groupMessages(state.messages.filter((message) => !message.isDeleted && !message.is_deleted))
    .map(renderMessageGroup)
    .join("");
  const recoveryHtml = state.recoveryVisibleState !== "none" ? renderReconnectState() : "";
  messages.innerHTML = `${recoveryHtml}${canRequestOlder ? renderLoadOlderButton(state.loadingOlder) : ""}${messageHtml || `<div class="milxdy-chat-empty">No messages yet.</div>`}`;
  attachments.hidden = state.pendingAttachments.length === 0;
  attachments.innerHTML = state.pendingAttachments.map(renderPendingAttachment).join("");
  error.hidden = !state.composerError;
  error.textContent = state.composerError;
  renderReplyPreview(reply);
  if (atBottom) messages.scrollTop = messages.scrollHeight;
  syncChatJumpControl(root, true);
  hydrateInlineMedia(messages);
  restoreFocusedMessageControl(messages, focusedMessageControl);
  syncPokeCooldownButtons(root);
}

type FocusedMessageControl = { action: string; messageId: string; emoji: string; username: string };

function captureFocusedMessageControl(messages: HTMLElement): FocusedMessageControl | null {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!active || !messages.contains(active)) return null;
  return {
    action: active.dataset.chatAction || "",
    messageId: active.dataset.messageId || active.closest<HTMLElement>("[data-message-id]")?.dataset.messageId || "",
    emoji: active.dataset.emoji || "",
    username: active.dataset.username || "",
  };
}

function restoreFocusedMessageControl(messages: HTMLElement, focused: FocusedMessageControl | null): void {
  if (!focused) return;
  const selectors = [
    focused.action ? `[data-chat-action="${cssEscape(focused.action)}"]` : "",
    focused.messageId ? `[data-message-id="${cssEscape(focused.messageId)}"]` : "",
    focused.emoji ? `[data-emoji="${cssEscape(focused.emoji)}"]` : "",
    focused.username ? `[data-username="${cssEscape(focused.username)}"]` : "",
  ].filter(Boolean).join("");
  messages.querySelector<HTMLElement>(selectors)?.focus({ preventScroll: true });
}

function renderStatus(text: string): void {
  const status = state.root?.querySelector<HTMLElement>('[data-role="status"]');
  if (status) status.textContent = text;
}

function setRecoveryVisibleState(next: ChatState["recoveryVisibleState"], message: string): void {
  state.recoveryVisibleState = next;
  state.recoveryMessage = message;
  renderStatus(message);
  recordChatDiagnostic("visibleState", { state: next, message });
}

function renderReconnectState(): string { return renderChatReconnectState(extensionAuthPhase, state, escapeHtml); }

function recordChatDiagnostic(key: string, value: Record<string, unknown>): void {
  const sanitized = sanitizeReminetChatDiagnostic(key, value);
  recordDiagnostic(key, {
    ...sanitized,
    socketState: state.socketState,
    signedIn: state.signedIn,
    visibleState: state.recoveryVisibleState,
    updatedAt: Date.now(),
  });
}


async function loadTheme(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(SETTINGS_THEME_KEY).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.theme = normalizeThemeMode(stored[SETTINGS_THEME_KEY]);
  applyTheme();
}

function closeChatPanel(): void {
  state.minimized = true;
  state.explicitlyOpened = false;
  closeSocket();
  updateOfficialPolling();
  const root = state.root;
  state.root = null;
  state.mountMode = null;
  if (isMessagesRoute()) state.messagesSelected = false;
  restoreNativeDmPane();
  updatePseudoChatRowState();
  updateDockState();
  animateOverlayAppClose(root, () => root?.remove());
}

function updateDockState(): void {
  state.appFrame?.updateDock({
    badgeText: state.signedIn ? "" : "!",
    title: state.signedIn ? "RemiNet Chat" : "RemiNet Chat: sign in",
  });
}

async function loadSoundSettings(): Promise<void> {
  const stored: RuntimeRecord = await chrome.storage.sync.get({
    [SOUND_ENABLED_KEY]: true,
    [SOUND_VOLUME_KEY]: 0.55,
    [SOUND_SEND_KEY]: true,
    [SOUND_REACT_KEY]: true,
    [SOUND_REACT_TO_ME_KEY]: true,
    [SOUND_MESSAGE_KEY]: true,
    [SOUND_POKE_KEY]: true,
    [POKE_PLACEMENT_KEY]: "reactions",
  }).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.soundEnabled = stored[SOUND_ENABLED_KEY] !== false;
  state.soundVolume = clampVolume(stored[SOUND_VOLUME_KEY]);
  state.soundSend = stored[SOUND_SEND_KEY] !== false;
  state.soundReact = stored[SOUND_REACT_KEY] !== false;
  state.soundReactToMe = stored[SOUND_REACT_TO_ME_KEY] !== false;
  state.soundMessage = stored[SOUND_MESSAGE_KEY] !== false;
  state.soundPoke = stored[SOUND_POKE_KEY] !== false;
  pokePlacement = normalizePokePlacement(stored[POKE_PLACEMENT_KEY]);
  render();
}

function applySoundSettingChanges(changes: Record<string, chrome.storage.StorageChange>): void {
  if (changes[SOUND_ENABLED_KEY]) state.soundEnabled = changes[SOUND_ENABLED_KEY].newValue !== false;
  if (changes[SOUND_VOLUME_KEY]) state.soundVolume = clampVolume(changes[SOUND_VOLUME_KEY].newValue);
  if (changes[SOUND_SEND_KEY]) state.soundSend = changes[SOUND_SEND_KEY].newValue !== false;
  if (changes[SOUND_REACT_KEY]) state.soundReact = changes[SOUND_REACT_KEY].newValue !== false;
  if (changes[SOUND_REACT_TO_ME_KEY]) state.soundReactToMe = changes[SOUND_REACT_TO_ME_KEY].newValue !== false;
  if (changes[SOUND_MESSAGE_KEY]) state.soundMessage = changes[SOUND_MESSAGE_KEY].newValue !== false;
  if (changes[SOUND_POKE_KEY]) state.soundPoke = changes[SOUND_POKE_KEY].newValue !== false;
}

type ChatSoundKind = "send" | "react" | "reactToMe" | "message" | "poke";

function playChatSound(kind: ChatSoundKind): void {
  if (!state.soundEnabled || state.soundVolume <= 0) return;
  if (kind === "send" && !state.soundSend) return;
  if (kind === "react" && !state.soundReact) return;
  if (kind === "reactToMe" && !state.soundReactToMe) return;
  if (kind === "message" && !state.soundMessage) return;
  if (kind === "poke" && !state.soundPoke) return;
  const cue = { send: "chatSend", react: "chatReact", reactToMe: "chatReactToMe", message: "chatMessage", poke: "chatPoke" } as const;
  const volume = state.soundVolume * cueVolumes.get(cue[kind]);
  if (volume <= 0) return;
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  const now = context.currentTime + 0.01;
  if (kind === "send") playTone(context, now, [520, 700], 0.055, "triangle", 0.8, volume);
  if (kind === "react") playTone(context, now, [860, 620], 0.045, "square", 0.45, volume);
  if (kind === "reactToMe") playTone(context, now, [480, 720, 960], 0.05, "sine", 0.75, volume);
  if (kind === "message") playTone(context, now, [660, 880], 0.065, "sine", 0.65, volume);
  if (kind === "poke") playPokeTone(context, now, volume);
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext = new AudioContextCtor();
  return audioContext;
}


async function loadLayoutSettings(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get([WIDTH_KEY, HEIGHT_KEY, TOP_KEY]).catch(() => ({}));
  if (!lifecycleActive()) return;
  const layout = await restoreOverlayPanelBox("reminetChat", {
    side: state.side,
    minWidth: 320,
    minHeight: 260,
    defaultWidth: state.frameWidth,
    defaultHeight: state.frameHeight,
    legacy: {
      width: stored[WIDTH_KEY],
      height: stored[HEIGHT_KEY],
      topOffset: stored[TOP_KEY],
    },
  });
  state.x = layout.x ?? state.x;
  state.frameWidth = layout.width;
  state.frameHeight = layout.height;
  state.topOffset = layout.topOffset;
  state.layoutReady = true;
  applyLayout();
  ensureRoot();
}


function applyTheme(): void {
  const root = state.root;
  if (!root) return;
  root.dataset.theme = appThemeMode();
}

function appThemeMode(): "light" | "dark" {
  return resolveOverlayPanelTheme();
}

function applyLayout(): void {
  const root = state.root;
  if (!root) return;
  registerOverlayAppRoot("reminetChat", root);
  if (state.mountMode === "messages") {
    root.style.removeProperty("--rn-left-top");
    root.style.removeProperty("--rn-rail-top");
    root.style.removeProperty("--rn-frame-height");
    markOverlayAppLayoutReady(root, true);
    return;
  }
  const box = clampOverlayPanelBox(
    { x: state.x, width: state.frameWidth, height: state.frameHeight, topOffset: state.topOffset },
    { minWidth: 320, minHeight: 260, dockSide: state.side },
  );
  state.x = box.x ?? state.x;
  state.frameWidth = box.width;
  state.frameHeight = box.height;
  state.topOffset = box.topOffset;
  root.style.setProperty("--rn-rail-top", `${state.topOffset}px`);
  root.style.setProperty("--rn-rail-left", `${state.x}px`);
  root.style.setProperty("--rn-rail-width", `${state.frameWidth}px`);
  root.style.removeProperty("--rn-left-top");
  root.style.setProperty("--rn-frame-height", `${state.frameHeight}px`);
  markOverlayAppLayoutReady(root, state.layoutReady);
}

function rightRailRect(): DOMRect | null {
  const column = document.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
  const rail = column?.querySelector<HTMLElement>(":scope > div") || column;
  const rect = rail?.getBoundingClientRect();
  if (!rect || rect.width < 260) return null;
  return rect;
}

function leftDockTop(): number {
  const beetol = document.getElementById("beetol-hunter-root");
  if (!beetol) return 8;
  const rect = beetol.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return 8;
  return Math.max(8, Math.min(layoutViewportHeight() - 120, rect.bottom + 8));
}

function leftRailTop(): number {
  return leftDockTop();
}

function leftRailHeight(topOffset: number): number {
  const available = layoutViewportHeight() - topOffset - LEFT_RAIL_BOTTOM_CLEARANCE_PX;
  if (available < LEFT_RAIL_MIN_HEIGHT_PX) return Math.max(1, Math.floor(available));
  return Math.floor(available);
}

function layoutViewportHeight(): number {
  const heights = [
    window.innerHeight,
    document.documentElement.clientHeight,
  ].filter((height): height is number => typeof height === "number" && Number.isFinite(height) && height > 0);
  return Math.floor(Math.max(...heights));
}

function defaultTopOffset(): number {
  if (state.side !== "left") return rightDockMinTop();
  return leftRailTop();
}

function startDrag(event: PointerEvent): void {
  if (state.mountMode === "messages") return;
  if (event.button !== 0) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("button, a, input, textarea, select, [data-role='resize']")) return;
  const root = state.root;
  if (!root) return;
  root.dataset.dragging = "true";
  startOverlayPanelDrag(event, {
    appId: "reminetChat",
    root,
    side: () => state.side,
    box: () => ({ x: state.x, width: state.frameWidth, height: state.frameHeight, topOffset: state.topOffset }),
    setBox: (box) => {
      if (typeof box.x === "number") state.x = box.x;
      if (typeof box.width === "number") state.frameWidth = box.width;
      if (typeof box.height === "number") state.frameHeight = box.height;
      if (typeof box.topOffset === "number") state.topOffset = box.topOffset;
    },
    apply: applyLayout,
    persist: () => {
      root.dataset.dragging = "false";
      void chrome.storage.local.set({ [TOP_KEY]: state.topOffset });
    },
    disabled: () => state.mountMode === "messages",
    minWidth: 320,
    minHeight: 260,
  });
}

function startResize(event: PointerEvent): void {
  if (state.mountMode === "messages") return;
  if (event.button !== 0 || state.minimized) return;
  const root = state.root;
  if (!root) return;
  const axis = resizeAxis(event.currentTarget);
  startOverlayPanelResize(event, {
    appId: "reminetChat",
    root,
    side: () => state.side,
    box: () => ({ x: state.x, width: state.frameWidth, height: state.frameHeight, topOffset: state.topOffset || defaultTopOffset() }),
    setBox: (box) => {
      if (typeof box.x === "number") state.x = box.x;
      if (typeof box.width === "number") state.frameWidth = box.width;
      if (typeof box.height === "number") state.frameHeight = box.height;
      if (typeof box.topOffset === "number") state.topOffset = box.topOffset;
    },
    apply: applyLayout,
    persist: () => {
      void chrome.storage.local.set({ [WIDTH_KEY]: state.frameWidth, [HEIGHT_KEY]: state.frameHeight, [TOP_KEY]: state.topOffset });
    },
    disabled: () => state.mountMode === "messages" || state.minimized,
    minWidth: 320,
    minHeight: 260,
  }, axis);
}

function resizeAxis(target: EventTarget | null): "both" | "x" | "y" {
  if (!(target instanceof HTMLElement)) return "both";
  return target.dataset.resizeAxis === "x" || target.dataset.resizeAxis === "y" ? target.dataset.resizeAxis : "both";
}

function clampFrameHeight(value: number): number {
  return clampOverlayPanelBox(
    { x: state.x, width: state.frameWidth, height: value, topOffset: state.topOffset || defaultTopOffset() },
    { minWidth: 320, minHeight: 260, dockSide: state.side },
  ).height;
}

function clampTopOffset(value: number, frameHeight = state.frameHeight): number {
  const box = clampOverlayPanelBox(
    { x: state.x, width: state.frameWidth, height: frameHeight, topOffset: value },
    { minWidth: 320, minHeight: 260, dockSide: state.side },
  );
  return box.topOffset;
}

function rightDockMinTop(): number {
  const search = document.querySelector<HTMLElement>('[data-testid="SearchBox_Search_Input"]');
  const container = search?.closest<HTMLElement>('[role="search"], form, div');
  const rect = (container || search)?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return 8;
  return Math.max(8, Math.ceil(rect.bottom + 8));
}

function groupMessages(messages: ApiMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const authorKey = messageAuthorKey(message);
    const last = groups[groups.length - 1];
    if (last && last.authorKey === authorKey && messageTime(message) - messageTime(last.messages[last.messages.length - 1]) < 10 * 60 * 1000) {
      last.messages.push(message);
    } else {
      groups.push({ authorKey, messages: [message] });
    }
  }
  return groups;
}

function renderMessageGroup(group: MessageGroup): string {
  const first = group.messages[0];
  const authorId = messageAuthorId(first);
  const user = userForAuthor(authorId, first);
  const handleValue = remiliaHandle(user);
  const name = displayName(user, authorId, first);
  const avatar = renderAvatarImage(user);
  const color = remiliaUserColor(user);
  const profileUrl = handleValue ? `https://www.remilia.net/~${encodeURIComponent(handleValue)}` : "https://www.remilia.net";
  const xHandle = connectedXHandle(user) || cachedXHandleForRemiliaHandle(handleValue);
  return `
    <article class="milxdy-chat-message-group" data-remilia-handle="${escapeHtml(handleValue)}" data-x-handle="${escapeHtml(xHandle)}"${color ? ` style="--rn-user-color:${escapeHtml(color)}"` : ""}>
      <div class="milxdy-chat-user-column">
        <a class="milxdy-chat-avatar" href="${profileUrl}" target="_blank" rel="noopener noreferrer" title="Open RemiliaNET profile">${avatar}</a>
      </div>
      <div class="milxdy-chat-body">
        <div class="milxdy-chat-meta">
          <a class="milxdy-chat-author" href="${profileUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>
          ${handleValue ? `<span>~${escapeHtml(handleValue)}</span>` : ""}
          <time>${escapeHtml(formatTime(messageTime(first)))}</time>
          <span class="milxdy-chat-inline-actions">
            ${xHandle ? `<a class="milxdy-chat-x-link" href="https://x.com/${encodeURIComponent(xHandle)}" target="_blank" rel="noopener noreferrer" title="Open X profile" aria-label="Open X profile">${xLogoSvg()}</a>` : ""}
            ${handleValue && pokePlacement !== "reactions" ? renderPokeButton(handleValue) : ""}
          </span>
        </div>
        <div class="milxdy-chat-stack">${group.messages.map(renderStackedMessage).join("")}</div>
      </div>
    </article>
  `;
}

function renderAvatarImage(user: ApiUser | null): string {
  const url = absoluteRemiliaMediaUrl(avatarUrl(user));
  if (!url) return "";
  const cached = mediaDataUrlCache.get(url);
  const src = cached || "";
  return `<img ${src ? `src="${escapeHtml(src)}"` : ""} data-media-url="${escapeHtml(url)}" alt="">`;
}

function renderStackedMessage(message: ApiMessage): string {
  return `
    <div class="milxdy-chat-message" data-message-id="${message.id}">
      ${renderReplyContext(message)}
      ${message.body ? `<div class="milxdy-chat-text">${formatBody(message.body)}</div>` : ""}
      ${renderAttachments(message)}
      ${renderReactionCounts(message)}
      ${renderMessageActions(message)}
    </div>
  `;
}

function messageAuthorId(message: ApiMessage): number {
  return message.authorId ?? message.author_id ?? message.userId ?? message.user_id ?? 0;
}

function messageAuthorKey(message: ApiMessage): string {
  const handleValue = remiliaHandle(message.author || null).toLowerCase();
  return handleValue ? `handle:${handleValue}` : `id:${messageAuthorId(message)}`;
}

function xLogoSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"></path></svg>`;
}

function cachedXHandleForRemiliaHandle(handle: string): string {
  return handle ? xHandleByRemiliaHandle.get(handle.toLowerCase()) || "" : "";
}

function renderReplyContext(message: ApiMessage): string {
  const reply = replyReferenceForMessage(message);
  if (!reply) return "";
  return `
    <div class="milxdy-chat-reply-context" title="${escapeHtml(reply.body || "Replied message")}">
      <span aria-hidden="true">&#8625;</span>
      <strong>${escapeHtml(replyAuthorName(reply))}</strong>
      ${reply.body ? `<em>${escapeHtml(compactText(reply.body, 500))}</em>` : ""}
    </div>
  `;
}

function renderAttachments(message: ApiMessage): string {
  const media = message.media?.length
    ? message.media
    : [...(message.images || []), ...(message.video ? [message.video] : [])];
  if (!media.length) return "";
  return `
    <div class="milxdy-chat-media">
      ${media.map((attachment) => isVideoAttachment(attachment) ? renderVideoAttachment(attachment) : renderImageAttachment(attachment)).join("")}
    </div>
  `;
}

function isVideoAttachment(media: MediaAttachment): boolean {
  return media.kind?.toLowerCase().includes("video") === true
    || media.mimeType?.toLowerCase().startsWith("video/") === true
    || media.mime_type?.toLowerCase().startsWith("video/") === true;
}

function renderImageAttachment(media: MediaAttachment): string {
  if (!media.url) return "";
  const url = absoluteRemiliaMediaUrl(media.url);
  if (!url) return renderUnsupportedMediaLink("Unsupported media");
  const cached = mediaDataUrlCache.get(url);
  const src = cached || "";
  const bridgeAttribute = ` data-media-url="${escapeHtml(url)}"`;
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img ${src ? `src="${escapeHtml(src)}"` : ""}${bridgeAttribute} alt="" loading="lazy"></a>`;
}

function renderVideoAttachment(media: MediaAttachment): string {
  const rawVideoUrl = media.url || "";
  const rawPosterUrl = media.thumbnailUrl || media.thumbnail_url || "";
  const videoUrl = rawVideoUrl ? absoluteRemiliaMediaUrl(rawVideoUrl) : "";
  const posterUrl = rawPosterUrl ? absoluteRemiliaMediaUrl(rawPosterUrl) : "";
  if (rawVideoUrl && !videoUrl) return renderUnsupportedMediaLink("Unsupported video");
  if (rawPosterUrl && !posterUrl) return videoUrl ? `<video src="${escapeHtml(videoUrl)}" controls playsinline preload="metadata"></video>` : renderUnsupportedMediaLink("Unsupported media");
  if (!videoUrl && posterUrl) {
    return `<a href="${escapeHtml(posterUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(posterUrl)}" alt="" loading="lazy"></a>`;
  }
  if (!videoUrl) return "";
  return `<video src="${escapeHtml(videoUrl)}"${posterUrl ? ` poster="${escapeHtml(posterUrl)}"` : ""} controls playsinline preload="metadata"></video>`;
}

function renderUnsupportedMediaLink(label: string): string {
  return `<span class="milxdy-chat-media-link" role="text">${escapeHtml(label)}</span>`;
}

function hydrateInlineMedia(container: HTMLElement): void {
  if (!lifecycleActive()) return;
  const media = Array.from(container.querySelectorAll<HTMLImageElement>("img[data-media-url]"));
  for (const element of media) {
    const url = element.dataset.mediaUrl || "";
    if (!url || !isRemiliaMediaUrl(url) || element.currentSrc.startsWith("data:") || element.getAttribute("src")?.startsWith("data:")) continue;
    const cached = mediaDataUrlCache.get(url);
    if (cached) {
      setMediaSource(element, cached);
      continue;
    }
    if (mediaDataUrlPending.has(url)) continue;
    mediaDataUrlPending.add(url);
    void runtimeSendMessage({ type: "reminetChat:fetchMedia", url }, "reminetChat:fetchMedia")
      .then(asRecord)
      .then((response) => {
        if (!lifecycleActive()) return;
        const dataUrl = stringOrUndefined(response.dataUrl);
        if (!response.ok || !dataUrl) return;
        mediaDataUrlCache.set(url, dataUrl);
        for (const next of container.querySelectorAll<HTMLImageElement>(`img[data-media-url="${cssEscape(url)}"]`)) {
          setMediaSource(next, dataUrl);
        }
      })
      .finally(() => {
        mediaDataUrlPending.delete(url);
      });
  }
}

function setMediaSource(element: HTMLImageElement, dataUrl: string): void {
  element.src = dataUrl;
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
}

function renderMessageActions(message: ApiMessage): string {
  const open = state.activeMessageActionId === message.id;
  const handleValue = remiliaHandle(userForAuthor(messageAuthorId(message), message));
  return `
    <div class="milxdy-chat-message-actions" data-open="${String(open)}">
      ${renderReactions(message, handleValue)}
      <button class="milxdy-chat-reply-action" type="button" data-chat-action="reply" data-message-id="${message.id}" title="Reply" aria-label="Reply">${replyIconSvg()}</button>
    </div>
  `;
}

function replyIconSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 5.5h13v9h-7l-5 4v-4h-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

function renderReactions(message: ApiMessage, handleValue: string): string {
  const counts = reactionCounts(message);
  return `
    <div class="milxdy-chat-reactions">
      ${REACTIONS.map((emoji) => {
        const count = counts.get(emoji) || 0;
        return renderReactionButton(message, emoji, count, false);
      }).join("")}
      ${handleValue && pokePlacement !== "name" ? renderPokeButton(handleValue) : ""}
    </div>
  `;
}

function renderReactionCounts(message: ApiMessage): string {
  const counts = reactionCounts(message);
  const items = REACTIONS
    .map((emoji) => {
      const count = counts.get(emoji) || 0;
      if (count < 1) return "";
      return renderReactionButton(message, emoji, count, true);
    })
    .filter(Boolean);
  return items.length ? `<div class="milxdy-chat-reaction-counts">${items.join("")}</div>` : "";
}

function renderReactionButton(message: ApiMessage, emoji: string, count: number, showCount: boolean): string {
  const feedback = reactionFeedback.get(`${message.id}:${emoji}`);
  const unavailable = state.socketState !== "open" || typeof legacyMessageId(message.id) !== "number";
  const status = unavailable ? "unavailable" : feedback || "ready";
  const label = unavailable ? (state.socketState !== "open"
    ? "Reactions unavailable: the RemiliaNET chat bridge is not connected."
    : "Reactions unavailable for this message.")
    : status === "error" ? "Reaction failed. Click to try again."
    : status === "pending" ? "Sending reaction…" : reactionTooltip(message, emoji, count);
  return `<button type="button" data-active="${String(currentUserReacted(message, emoji))}" data-reaction-state="${status}" data-chat-action="react" data-message-id="${escapeHtml(message.id)}" data-emoji="${escapeHtml(emoji)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(`${emoji}: ${label}`)}" aria-pressed="${String(currentUserReacted(message, emoji))}" ${unavailable || status === "pending" ? "disabled" : ""}>${emoji}${showCount ? ` ${count}` : ""}${status === "error" ? '<span aria-hidden="true"> !</span>' : status === "pending" ? '<span aria-hidden="true"> …</span>' : ""}</button>`;
}

function reactionCounts(message: ApiMessage): Map<string, number> {
  const counts = new Map<string, number>();
  for (const reaction of message.reactions || []) {
    const emoji = normalizeReactionEmoji(reaction.emoji);
    if (!emoji) continue;
    counts.set(emoji, (counts.get(emoji) || 0) + Math.max(1, Math.floor(reaction.count ?? 1)));
  }
  return counts;
}

function currentUserReacted(message: ApiMessage, emoji: string): boolean {
  const normalized = normalizeReactionEmoji(emoji);
  const remembered = currentUserReactionStates.get(reactionStateKey(message.id, normalized));
  if (remembered !== undefined) return remembered;
  return (message.reactions || []).some((reaction) => normalizeReactionEmoji(reaction.emoji) === normalized && reactionBelongsToCurrentUser(reaction));
}

function reactionStateKey(messageId: MessageId, emoji: string): string {
  return `${messageId}\u0000${emoji}`;
}

function reactionBelongsToCurrentUser(reaction: Reaction): boolean {
  const user = reaction.user || null;
  const userId = reaction.userId ?? reaction.user_id ?? user?.id ?? user?.userId ?? user?.user_id ?? 0;
  const currentId = currentUserId();
  if (userId && currentId && userId === currentId) return true;
  const current = state.currentUser;
  const currentHandles = [
    remiliaHandle(current),
    current?.username,
    current?.handle,
    current?.userHandle,
    current?.user_handle,
  ].map((value) => (value || "").toLowerCase()).filter(Boolean);
  const reactionHandles = [
    reaction.handle,
    reaction.username,
    reaction.name,
    remiliaHandle(user),
    user?.username,
    user?.handle,
    user?.userHandle,
    user?.user_handle,
  ].map((value) => (value || "").toLowerCase()).filter(Boolean);
  return reactionHandles.some((value) => currentHandles.includes(value));
}

function renderPendingAttachment(attachment: PendingAttachment): string {
  const isImage = attachment.mimeType.startsWith("image/");
  return `
    <div class="milxdy-chat-pending-attachment" data-status="${attachment.status}">
      ${isImage ? `<img src="${escapeHtml(attachment.dataUrl)}" alt="">` : `<span>Video</span>`}
      <strong>${escapeHtml(attachment.status === "uploading" ? "Uploading" : attachment.name)}</strong>
      <button type="button" data-chat-action="remove-attachment" data-attachment-id="${escapeHtml(attachment.id)}">Remove</button>
    </div>
  `;
}

function renderReplyPreview(container: HTMLElement): void {
  const reply = state.replyTo;
  container.hidden = !reply;
  if (!reply) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <div>
      <span aria-hidden="true">&#8625;</span>
      <strong>${escapeHtml(replyAuthorName(reply))}</strong>
      ${reply.body ? `<em>${escapeHtml(compactText(reply.body, 88))}</em>` : ""}
    </div>
    <button type="button" data-chat-action="cancel-reply" title="Cancel reply" aria-label="Cancel reply">&times;</button>
  `;
}

function setReplyTo(messageId: MessageId): void {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message) return;
  state.replyTo = {
    id: message.id,
    authorId: messageAuthorId(message),
    author_id: messageAuthorId(message),
    body: message.body || "",
  };
  render();
  state.root?.querySelector<HTMLInputElement>('[data-role="input"]')?.focus();
}

function clearReplyTo(): void {
  state.replyTo = null;
  render();
}

function replyReferenceForMessage(message: ApiMessage): ReplyReference | null {
  const nested = message.replyTo || message.reply_to || message.inReplyTo || message.in_reply_to;
  if (nested) return nested;
  const id = message.replyToMessageId ?? message.reply_to_message_id ?? message.inReplyToId ?? message.in_reply_to_id;
  if (!id) return null;
  const referenced = state.messages.find((item) => item.id === id);
  if (!referenced) return { id, body: "Original message unavailable" };
  return {
    id,
    authorId: messageAuthorId(referenced),
    author_id: messageAuthorId(referenced),
    body: referenced.body || "",
  };
}

function replyAuthorName(reply: ReplyReference): string {
  const authorId = reply.authorId ?? reply.author_id ?? 0;
  const user = state.users.get(authorId) || (authorId && authorId === currentUserId() ? state.currentUser : null);
  return displayName(user, authorId, { id: reply.id, authorId, body: reply.body || "" });
}

function reactionTooltip(message: ApiMessage, emoji: string, count: number): string {
  if (!count) return `React ${emoji}`;
  const names = (message.reactions || [])
    .filter((reaction) => normalizeReactionEmoji(reaction.emoji) === normalizeReactionEmoji(emoji))
    .map(reactionAuthorName)
    .filter(Boolean);
  if (!names.length) return `${count} reacted ${emoji}`;
  return `${names.join(", ")} reacted ${emoji}`;
}

function reactionAuthorName(reaction: Reaction): string {
  if (reactionBelongsToCurrentUser(reaction)) return "you";
  const userId = reaction.userId ?? reaction.user_id ?? reaction.user?.id ?? reaction.user?.userId ?? reaction.user?.user_id ?? 0;
  const user = reaction.user || state.users.get(userId) || (userId && userId === currentUserId() ? state.currentUser : null);
  return user?.displayName
    || user?.display_name
    || user?.name
    || remiliaHandle(user)
    || reaction.name
    || reaction.handle
    || reaction.username
    || (userId ? `User ${userId}` : "");
}

function reactToMessage(messageId: MessageId, emoji: string, control?: HTMLElement): void {
  const normalizedEmoji = normalizeReactionEmoji(emoji);
  if (!normalizedEmoji) return;
  const key = `${messageId}:${normalizedEmoji}`;
  if (reactionFeedback.get(key) === "pending") return;
  const numericMessageId = legacyMessageId(messageId);
  if (state.socketState !== "open" || typeof numericMessageId !== "number") {
    reactionFeedback.set(key, "error");
    render();
    return;
  }
  const message = state.messages.find((item) => item.id === messageId);
  const previouslyReacted = Boolean(message && currentUserReacted(message, normalizedEmoji));
  const nextReacted = !previouslyReacted;
  const type = nextReacted ? "react" : "unreact";
  const stateKey = reactionStateKey(messageId, normalizedEmoji);
  currentUserReactionStates.set(stateKey, nextReacted);
  syncReactionControls(messageId, normalizedEmoji, nextReacted);
  animateReactionInteraction(control);
  reactionFeedback.set(key, "pending");
  render();
  void dispatchLegacyMutation({
    type,
    payload: { chat_id: LEGACY_CHAT_ID, message_id: numericMessageId, emoji: normalizedEmoji },
  }).then((result) => {
    if (!lifecycleActive()) return;
    if (!result.ok && currentUserReactionStates.get(stateKey) === nextReacted) {
      currentUserReactionStates.set(stateKey, previouslyReacted);
      syncReactionControls(messageId, normalizedEmoji, previouslyReacted);
    }
    if (result.ok) {
      reactionFeedback.delete(key);
      if (type === "react") playChatSound("react");
    } else reactionFeedback.set(key, "error");
    render();
  }).catch(() => {
    if (!lifecycleActive()) return;
    if (currentUserReactionStates.get(stateKey) === nextReacted) currentUserReactionStates.set(stateKey, previouslyReacted);
    reactionFeedback.set(key, "error");
    render();
  });
}

function syncReactionControls(messageId: MessageId, emoji: string, reacted: boolean): void {
  const selector = `[data-chat-action="react"][data-message-id="${cssEscape(messageId)}"][data-emoji="${cssEscape(emoji)}"]`;
  for (const reactionControl of state.root?.querySelectorAll<HTMLElement>(selector) || []) {
    reactionControl.dataset.active = String(reacted);
    reactionControl.setAttribute("aria-pressed", String(reacted));
  }
}

function animateReactionInteraction(control?: HTMLElement): void {
  if (!control) return;
  control.classList.remove("milxdy-chat-reaction-pulse");
  void control.offsetWidth;
  control.classList.add("milxdy-chat-reaction-pulse");
  control.addEventListener("animationend", () => {
    control.classList.remove("milxdy-chat-reaction-pulse");
  }, { once: true });
}

function renderPokeButton(username: string): string {
  const clean = cleanUsername(username);
  if (!clean) return "";
  const cooldownUntil = pokeCooldowns.get(clean.toLowerCase()) || 0;
  if (cooldownUntil > Date.now()) {
    const fallback = pokeCooldownSources.get(clean.toLowerCase()) === "offline-fallback" ? " (offline fallback)" : "";
    const celebrate = (pokeFeedback.get(clean.toLowerCase())?.celebrateUntil || 0) > Date.now();
    return `<button ${celebrate ? 'data-poke-celebrate="true"' : ""} class="milxdy-chat-poke" type="button" data-chat-action="poke" data-poke-state="cooldown" data-username="${escapeHtml(clean)}" title="Poke ${escapeHtml(clean)} again in ${escapeHtml(formatPokeCooldown(cooldownUntil - Date.now()))}${fallback}" aria-label="Poke ${escapeHtml(clean)} again later${fallback}">${escapeHtml(formatPokeCooldown(cooldownUntil - Date.now()))}</button>`;
  }
  const feedback = pokeFeedback.get(clean.toLowerCase());
  if (feedback) return `<button class="milxdy-chat-poke" type="button" data-chat-action="poke" data-poke-state="${feedback.state}" data-username="${escapeHtml(clean)}" title="${escapeHtml(feedback.label)}" aria-label="${escapeHtml(feedback.label)}" ${feedback.state === "loading" ? "disabled" : ""}>${feedback.state === "success" ? "✓" : feedback.state === "error" ? "!" : "…"}</button>`;
  return `<button class="milxdy-chat-poke" type="button" data-chat-action="poke" data-poke-state="idle" data-username="${escapeHtml(clean)}" title="Poke ${escapeHtml(clean)} on RemiliaNET" aria-label="Poke ${escapeHtml(clean)} on RemiliaNET">${POKE_ICON}</button>`;
}

async function pokeUser(username: string): Promise<void> {
  if (!lifecycleActive()) return;
  const clean = cleanUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  if (pokeFeedback.get(key)?.state === "loading") return;
  const cooldownUntil = pokeCooldowns.get(key) || 0;
  const button = pokeButtonsForUsername(clean)[0] || null;
  if (cooldownUntil > Date.now()) {
    if (button) startPokeCooldown(button, clean, cooldownUntil - Date.now());
    return;
  }
  pokeFeedback.set(key, { state: "loading", label: `Poking ${clean}…` });
  for (const target of pokeButtonsForUsername(clean)) setPokeButtonState(target, "loading", `Poking ${clean}…`);
  renderStatus(`Poking ${clean}...`);
  const response = await runtimeSendMessage({ type: "beetol:poke", username: clean }, "beetol:poke").then(asRecord).catch((error) => asRecord({ ok: false, error: String(error) }));
  if (!lifecycleActive()) return;
  const cooldownMs = readPokeCooldownMs(response);
  if (response.ok) {
    pokeCooldowns.delete(key);
    pokeCooldownSources.delete(key);
    pokeFeedback.set(key, { state: "success", label: `Poked ${clean}`, celebrateUntil: Date.now() + 650 });
    for (const target of pokeButtonsForUsername(clean)) {
      setPokeButtonState(target, "success", `Poked ${clean}`);
      target.dataset.pokeCelebrate = "true";
      runtimeScheduler.timeout(() => {
        for (const current of pokeButtonsForUsername(clean)) {
          delete current.dataset.pokeCelebrate;
          if (current.dataset.pokeState === "cooldown") {
            current.textContent = formatPokeCooldown(Math.max(0, Number(current.dataset.pokeCooldownUntil) - Date.now()));
          }
        }
      }, 650);
    }
    playChatSound("poke");
    if (cooldownMs > 0) startPokeCooldownForUser(clean, cooldownMs);
    renderStatus(response.localPokeStatsRecorded === false ? "Poke sent. Local poke count could not be saved; do not retry the poke." : "Poke sent.");
    return;
  }
  if (cooldownMs > 0 || isExplicitPokeCooldownResponse(response)) {
    if (cooldownMs > 0) startPokeCooldownForUser(clean, cooldownMs, stringOrUndefined(response.cooldownSource));
    const message = stringOrUndefined(response.message) || "Already poked.";
    if (button) setPokeButtonState(button, "error", message);
    renderStatus(message);
    return;
  }
  const message = response.scopeRequired
    ? "Reconnect Remilia with poke permission."
    : response.authRequired
      ? "Reconnect Remilia to poke."
      : stringOrUndefined(response.message) || "Poke failed.";
  pokeFeedback.set(key, { state: "error", label: message });
  for (const target of pokeButtonsForUsername(clean)) setPokeButtonState(target, "error", message);
  renderStatus(message);
}

function startPokeCooldownForUser(username: string, cooldownMs: number, source = "official"): void {
  const clean = cleanUsername(username);
  if (!clean) return;
  const until = Date.now() + Math.max(1000, Number(cooldownMs) || 0);
  pokeCooldowns.set(clean.toLowerCase(), until);
  pokeCooldownSources.set(clean.toLowerCase(), source);
  const buttons = pokeButtonsForUsername(clean);
  if (!buttons.length) {
    render();
    return;
  }
  for (const button of buttons) {
    startPokeCooldown(button, clean, until - Date.now(), until, source);
  }
}

function syncPokeCooldownButtons(root: HTMLElement): void {
  for (const button of Array.from(root.querySelectorAll<HTMLElement>(".milxdy-chat-poke"))) {
    const username = cleanUsername(button.dataset.username || "");
    if (!username) continue;
    registerPokeButton(button, username);
    const cooldownUntil = pokeCooldowns.get(username.toLowerCase()) || 0;
    if (cooldownUntil > Date.now()) startPokeCooldown(button, username, cooldownUntil - Date.now(), cooldownUntil, pokeCooldownSources.get(username.toLowerCase()));
  }
}

function registerPokeButton(button: HTMLElement, username: string): void {
  const clean = cleanUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  let buttons = pokeButtonsByUsername.get(key);
  if (!buttons) {
    buttons = new Set();
    pokeButtonsByUsername.set(key, buttons);
  }
  buttons.add(button);
  if (!pokeEligibilityChecked.has(key)) {
    pokeEligibilityChecked.add(key);
    void refreshPokeEligibility(clean);
  }
}

async function refreshPokeEligibility(username: string): Promise<void> {
  const response = await runtimeSendMessage({ type: "beetol:pokeEligibility", username }, "beetol:pokeEligibility").then(asRecord).catch(() => asRecord({}));
  const cooldownMs = readPokeCooldownMs(response);
  if (response.ok && cooldownMs > 0) {
    startPokeCooldownForUser(username, cooldownMs, stringOrUndefined(response.cooldownSource));
  }
}

function pokeButtonsForUsername(username: string): HTMLElement[] {
  const clean = cleanUsername(username);
  if (!clean) return [];
  const key = clean.toLowerCase();
  const buttons = pokeButtonsByUsername.get(key);
  if (!buttons) return [];
  const connected: HTMLElement[] = [];
  for (const button of Array.from(buttons)) {
    if (!button.isConnected || cleanUsername(button.dataset.username || "").toLowerCase() !== key) {
      buttons.delete(button);
      continue;
    }
    connected.push(button);
  }
  if (buttons.size === 0) pokeButtonsByUsername.delete(key);
  return connected;
}

function startPokeCooldown(button: HTMLElement, username: string, cooldownMs: number, knownUntil?: number, source = "official"): void {
  if (!lifecycleActive()) return;
  const clean = cleanUsername(username);
  if (!clean) return;
  const until = knownUntil || Date.now() + Math.max(1000, Number(cooldownMs) || 0);
  if (button.dataset.pokeCooldownUntil === String(until) && pokeCountdownTimers.has(button)) return;
  pokeCooldowns.set(clean.toLowerCase(), until);
  pokeCooldownSources.set(clean.toLowerCase(), source);
  clearPokeCountdown(button);
  setPokeButtonState(button, "cooldown", `Already poked ${clean}`);
  button.dataset.pokeCooldownUntil = String(until);

  let cancelNextTick: (() => void) | null = null;
  const update = () => {
    cancelNextTick = null;
    if (!lifecycleActive() || !button.isConnected) {
      clearPokeCountdown(button);
      return;
    }
    const remaining = until - Date.now();
    if (remaining <= 0) {
      clearPokeCountdown(button);
      pokeCooldowns.delete(clean.toLowerCase());
      pokeCooldownSources.delete(clean.toLowerCase());
      pokeFeedback.delete(clean.toLowerCase());
      delete button.dataset.pokeCooldownUntil;
      setPokeButtonState(button, "idle", `Poke ${clean} on RemiliaNET`);
      button.textContent = POKE_ICON;
      return;
    }
    const label = formatPokeCooldown(remaining);
    button.textContent = button.dataset.pokeCelebrate === "true" ? "✓" : label;
    const fallback = source === "offline-fallback" ? " (offline fallback)" : "";
    button.title = `Poke ${clean} again in ${label}${fallback}`;
    button.setAttribute("aria-label", button.title);
    cancelNextTick = runtimeScheduler.timeout(update, 1000);
    pokeCountdownTimers.set(button, cancelNextTick);
  };

  update();
  if (cancelNextTick) pokeCountdownTimers.set(button, cancelNextTick);
}

function clearPokeCountdown(button: HTMLElement): void {
  const cancelTimer = pokeCountdownTimers.get(button);
  if (cancelTimer) cancelTimer();
  pokeCountdownTimers.delete(button);
}

function setPokeButtonState(button: HTMLElement, stateValue: "idle" | "loading" | "cooldown" | "error" | "success", label: string): void {
  button.dataset.pokeState = stateValue;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.toggleAttribute("disabled", stateValue === "loading" || stateValue === "cooldown");
  if (stateValue !== "cooldown") {
    clearPokeCountdown(button);
    button.textContent = stateValue === "success" ? "✓" : stateValue === "error" ? "!" : stateValue === "loading" ? "…" : POKE_ICON;
  }
}

function isExplicitPokeCooldownResponse(response: RuntimeRecord): boolean {
  if (!response || response.authRequired) return false;
  if (response.code === "poke_cooldown") return true;
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return [
    response.error,
    data.error,
    data.message,
    data.reason,
    data.code,
    nested.error,
    nested.message,
    nested.reason,
    nested.code,
  ].some((value) => {
    const text = String(value || "");
    return /already\s+poked|poke(?:\s+is)?\s+on\s+cool\s*down|poke\s+cool\s*down|cool\s*down/i.test(text)
      || /try again(?:\s+\w+){0,4}\s+to\s+poke/i.test(text)
      || /try again(?:\s+\w+){0,4}\s+(?:after|when|once)(?:\s+\w+){0,4}\s+cool\s*down/i.test(text);
  });
}


async function addPendingFiles(files: FileList | File[] | null): Promise<void> {
  if (!files?.length) return;
  state.composerError = "";
  for (const file of Array.from(files)) {
    const error = validateAttachment(file);
    if (error) {
      state.composerError = error;
      continue;
    }
    if (state.pendingAttachments.length >= 4) {
      state.composerError = "Maximum 4 attachments.";
      break;
    }
    state.pendingAttachments.push({
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type,
      dataUrl: await fileToDataUrl(file),
      status: "ready",
    });
  }
  render();
}

function validateAttachment(file: File): string {
  if (!IMAGE_TYPES.has(file.type) && !VIDEO_TYPES.has(file.type)) return "Unsupported attachment type.";
  if (IMAGE_TYPES.has(file.type) && file.size > 10 * 1024 * 1024) return "Images must be 10 MB or smaller.";
  if (VIDEO_TYPES.has(file.type) && file.size > 32 * 1024 * 1024) return "Videos must be 32 MB or smaller.";
  if (VIDEO_TYPES.has(file.type) && state.pendingAttachments.length > 0) return "Send videos by themselves.";
  if (state.pendingAttachments.some((item) => VIDEO_TYPES.has(item.mimeType))) return "Send videos by themselves.";
  return "";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

async function uploadPendingAttachments(): Promise<{ ok: true; images: MediaAttachment[]; video: MediaAttachment | null } | { ok: false; error: string }> {
  const images: MediaAttachment[] = [];
  let video: MediaAttachment | null = null;
  for (const attachment of state.pendingAttachments) {
    if (!lifecycleActive()) return { ok: false, error: "Chat closed." };
    if (attachment.uploadedMedia) {
      if (attachment.mimeType.startsWith("video/")) video = attachment.uploadedMedia;
      else images.push(attachment.uploadedMedia);
      continue;
    }
    attachment.status = "uploading";
    render();
    const response = await runtimeSendMessage({
      type: "reminetChat:legacy:uploadAttachment",
      mimeType: attachment.mimeType,
      dataUrl: attachment.dataUrl,
    }, "reminetChat:legacy:uploadAttachment").catch(() => null);
    if (!lifecycleActive()) return { ok: false, error: "Chat closed." };
    const outcome = parseLegacyMediaUploadOutcome(response);
    if (!outcome || !outcome.ok) {
      attachment.status = "error";
      return { ok: false, error: legacyMediaFailureMessage(outcome?.error ?? "LEGACY_ADAPTER_UNAVAILABLE") };
    }
    const media = legacyMediaAttachment(outcome.media);
    if (mediaId(media) === null) {
      attachment.status = "error";
      return { ok: false, error: "RemiNet did not confirm the attachment. The image was not sent; try again." };
    }
    attachment.uploadedMedia = media;
    if (attachment.mimeType.startsWith("video/")) video = media;
    else images.push(media);
  }
  return { ok: true, images, video };
}

function clearPendingAttachments(): void {
  state.pendingAttachments = [];
  state.composerError = "";
}

function removePendingAttachment(id: string): void {
  state.pendingAttachments = state.pendingAttachments.filter((item) => item.id !== id);
  render();
}

function userForAuthor(authorId: number, message: ApiMessage): ApiUser | null {
  return message.author
    || state.users.get(authorId)
    || (authorId && authorId === currentUserId() ? state.currentUser : null)
    || (message.id.startsWith("local:") ? state.currentUser : null);
}

function queueProfileLookup(authorId: number, user: ApiUser): void {
  if (!lifecycleActive()) return;
  const handleValue = remiliaHandle(user);
  const directXHandle = connectedXHandle(user);
  if (directXHandle) {
    if (handleValue) {
      const cacheKey = handleValue.toLowerCase();
      xHandleByRemiliaHandle.set(cacheKey, directXHandle);
      profileLookupDone.add(cacheKey);
    }
    return;
  }
  if (!authorId || !handleValue || profileLookupPending.has(handleValue) || profileLookupDone.has(handleValue)) return;
  const cacheKey = handleValue.toLowerCase();
  if (profileLookupPending.has(cacheKey) || profileLookupDone.has(cacheKey)) return;
  profileLookupPending.add(cacheKey);
  void (async () => {
    try {
      const profileResponse = await runtimeSendMessage(
        { type: "reminetIdentity:getProfile", remiliaUsername: handleValue, maxAgeMs: PROFILE_CACHE_TTL_MS },
        "reminetIdentity:getProfile",
      ).then(asRecord).catch(() => asRecord({}));
      if (!lifecycleActive()) return;
      const enriched = profileUserFromResponse(profileResponse);
      if (profileResponse.ok && enriched) {
        if (profileResponse.partial === true) {
          recordChatDiagnostic("profileLookupPartial", {
            warningCount: Array.isArray(profileResponse.warnings) ? profileResponse.warnings.length : 0,
          });
        }
        const enrichedXHandle = connectedXHandle(enriched);
        if (enrichedXHandle) xHandleByRemiliaHandle.set(cacheKey, enrichedXHandle);
        profileLookupDone.add(cacheKey);
        state.users.set(authorId, { ...state.users.get(authorId), ...enriched });
        render();
        return;
      }
      recordChatDiagnostic("profileLookupFailed", {
        code: "PROFILE_LOOKUP_FAILED",
      });
      profileLookupDone.add(cacheKey);
    } finally {
      profileLookupPending.delete(cacheKey);
    }
  })();
}

function profileUserFromResponse(response: RuntimeRecord): ApiUser | null {
  const sharedProfile = objectValue(response.profile);
  if (Object.keys(sharedProfile).length) {
    const remiliaUsername = stringOrUndefined(sharedProfile.remiliaUsername);
    const xHandle = stringOrUndefined(sharedProfile.xHandle);
    const pfpUrl = stringOrUndefined(sharedProfile.pfpUrl);
    return {
      ...(sharedProfile as ApiUser),
      handle: remiliaUsername,
      userHandle: remiliaUsername,
      username: remiliaUsername,
      twitterHandle: xHandle,
      xHandle,
      profilePicUrl: pfpUrl,
      pfpUrl,
    };
  }
  const data = objectValue(response.data);
  const candidates = [
    data.user,
    data.profile,
    data.account,
    data.member,
    objectValue(data.data).user,
    objectValue(data.data).profile,
    data,
  ];
  const user = candidates.find((candidate) => candidate && typeof candidate === "object") as ApiUser | undefined;
  if (!user) return null;
  const xHandle = connectedXHandle(user) || findDeepXHandle(data);
  return xHandle ? { ...user, xHandle } : user;
}

function currentUserId(): number {
  return state.currentUser?.userId || state.currentUser?.user_id || state.currentUser?.id || 0;
}

function sortAndTrimMessages(_anchor: "newest" | "oldest" = "newest"): void {
  state.messages.sort((left, right) => messageTime(left) - messageTime(right));
  state.messages = state.messages.slice(-MAX_MESSAGES);
}

function messageTime(message: ApiMessage): number {
  const raw = message.createdAt ?? message.created_at ?? 0;
  return raw > 10_000_000_000 ? raw : raw * 1000;
}
