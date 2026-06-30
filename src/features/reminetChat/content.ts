import { safeRuntimeMessage } from "../../shared/extensionRuntime";
import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../shared/overlayAppChrome";
import { createOverlayAppFrame, type OverlayAppFrame } from "../../shared/overlayAppFrame";
import {
  clampOverlayPanelBox,
  observeOverlayPanelTheme,
  resolveOverlayPanelTheme,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
  startOverlayPanelResize,
} from "../../shared/overlayPanelBase";
import { registerOverlayAppRoot } from "../../shared/overlayAppLayout";
import type { AppRuntimeScheduler, MilxdyContentAppContext, MilxdyRouteChange } from "../../shared/appPlatform";
import { createFallbackRuntimeScheduler } from "../../shared/runtimeScheduler";

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
const PROFILE_CACHE_KEY = "milxdy.reminetChat.profileCache.v3";
const MAX_MESSAGES = 300;
const HISTORY_PAGE_SIZE = 30;
const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_CACHE_MAX_ENTRIES = 250;
const LEFT_RAIL_BOTTOM_CLEARANCE_PX = 24;
const LEFT_RAIL_MIN_HEIGHT_PX = 260;
const SOCKET_STALE_TIMEOUT_MS = 70_000;
const SOCKET_RECOVERY_MIN_GAP_MS = 5_000;
const RECENT_REFRESH_LIMIT = 20;
const SHOCKED_REACTION = "\u{1f62e}";
const REACTIONS = [SHOCKED_REACTION, "\u{1f525}", "\u{1f639}", "\u{1f90d}", "\u{1f44d}"];
const REACTION_ALIASES = new Map([
  ["\u{1f62e}", SHOCKED_REACTION],
  ["\u{1f632}", SHOCKED_REACTION],
  ["\u{1f631}", SHOCKED_REACTION],
  ["\u{1f633}", SHOCKED_REACTION],
]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const POKE_ICON = "\u{1faf5}";
const DEFAULT_POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const REMINET_CHAT_ICON = chrome.runtime.getURL("remistats/star.svg");
const mediaDataUrlCache = new Map<string, string>();
const mediaDataUrlPending = new Set<string>();
const xHandleByRemiliaHandle = new Map<string, string>();
const profileLookupPending = new Set<string>();
const profileLookupDone = new Set<string>();
const pokeCooldowns = new Map<string, number>();
const pokeCountdownTimers = new Map<HTMLElement, () => void>();
const pokeButtonsByUsername = new Map<string, Set<HTMLElement>>();
const hiddenNativeDmElements = new Set<HTMLElement>();
const ROUTE_MOUNT_RETRY_DELAYS_MS = [120, 300, 700, 1500, 3000] as const;
let audioContext: AudioContext | null = null;
let booted = false;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;
let cancelReconnectTimer: (() => void) | null = null;
let cancelStaleTimer: (() => void) | null = null;
let cancelSendResetTimer: (() => void) | null = null;
let cancelMountRetryTimer: (() => void) | null = null;
let runtimeSendMessage: MilxdyContentAppContext["sendMessage"] = safeRuntimeMessage;
let recordDiagnostic: MilxdyContentAppContext["recordDiagnostic"] = () => undefined;
let lifecycleSignal: AbortSignal | null = null;
let runtimeScheduler: AppRuntimeScheduler = createFallbackRuntimeScheduler({ idleTimeoutMs: 16 });

type RuntimeRecord = Record<string, unknown>;

type ApiUser = {
  id?: number;
  userId?: number;
  user_id?: number;
  handle?: string;
  userHandle?: string;
  user_handle?: string;
  username?: string;
  twitterHandle?: string;
  twitter_handle?: string;
  twitterUsername?: string;
  twitter_username?: string;
  twitterUrl?: string;
  twitter_url?: string;
  xHandle?: string;
  x_handle?: string;
  xUsername?: string;
  x_username?: string;
  xUrl?: string;
  x_url?: string;
  displayName?: string;
  display_name?: string;
  name?: string;
  profilePicUrl?: string;
  profile_pic_url?: string;
  pfpUrl?: string;
  pfp_url?: string;
  color?: number | string;
  theme?: string;
  connections?: unknown[];
};

type CachedProfile = {
  cachedAt?: number;
  user?: ApiUser;
};

type ProfileCache = Record<string, CachedProfile>;

type MediaAttachment = {
  mediaId?: number | null;
  media_id?: number | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  mime_type?: string | null;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
};

type Reaction = {
  userId?: number;
  user_id?: number;
  user?: ApiUser | null;
  username?: string;
  handle?: string;
  name?: string;
  emoji?: string;
};

type ReplyReference = {
  id: number;
  authorId?: number;
  author_id?: number;
  body?: string;
};

type ApiMessage = {
  id: number;
  chatId?: number;
  chat_id?: number;
  authorId?: number;
  author_id?: number;
  userId?: number;
  user_id?: number;
  body?: string;
  createdAt?: number;
  created_at?: number;
  isDeleted?: boolean;
  is_deleted?: boolean;
  images?: MediaAttachment[] | null;
  video?: MediaAttachment | null;
  reactions?: Reaction[] | null;
  replyToMessageId?: number | null;
  reply_to_message_id?: number | null;
  inReplyToId?: number;
  in_reply_to_id?: number;
  replyTo?: ReplyReference | null;
  reply_to?: ReplyReference | null;
  inReplyTo?: ReplyReference | null;
  in_reply_to?: ReplyReference | null;
};

type PendingAttachment = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  status: "ready" | "uploading" | "error";
};

type MessageGroup = {
  authorId: number;
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
  sending: boolean;
  signedIn: boolean;
  enabled: boolean;
  currentUser: ApiUser | null;
  pendingAttachments: PendingAttachment[];
  composerError: string;
  replyTo: ReplyReference | null;
  minimized: boolean;
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
  sending: false,
  signedIn: false,
  enabled: true,
  currentUser: null,
  pendingAttachments: [],
  composerError: "",
  replyTo: null,
  minimized: true,
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
};

export function boot(context?: MilxdyContentAppContext): void {
  if (booted) return;
  booted = true;
  state.enabled = true;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  lifecycleSignal = context?.signal || null;
  runtimeScheduler = context?.scheduler || runtimeScheduler;
  runtimeSendMessage = context?.sendMessage || runtimeSendMessage;
  recordDiagnostic = context?.recordDiagnostic || recordDiagnostic;
  ensureOverlayAppChromeStyles();
  registerDockItem();
  if (shouldAutoOpenMessagesChat()) {
    state.messagesSelected = true;
    state.minimized = false;
  }
  ensureRoot();
  scheduleMountRetry();
  void loadLayoutSettings();
  void loadTheme();
  void loadSoundSettings();
  addRuntimeDisposable(observeOverlayPanelTheme(applyTheme));
  observeLayoutSignals();
  observeHostImageViewer();
  observeEnablement();
  observeMessagesSelection();
  void refreshAuthAndHistory();
}

export function onRouteChange(_route: MilxdyRouteChange): void {
  if (!lifecycleActive()) return;
  if (isMessagesRoute()) {
    state.messagesSelected = shouldAutoOpenMessagesChat();
    if (state.messagesSelected) state.minimized = false;
  }
  ensureRoot();
  scheduleMountRetry();
  void refreshAuthAndHistory();
}

export function open(): void {
  if (!lifecycleActive()) return;
  if (isMessagesRoute() && !state.messagesSelected) state.messagesSelected = true;
  state.minimized = false;
  ensureRoot();
  scheduleMountRetry();
  render();
  void refreshAuthAndHistory();
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
  state.appFrame?.remove();
  state.appFrame = null;
  addRuntimeDisposable = () => undefined;
  lifecycleSignal = null;
  booted = false;
}

function lifecycleActive(): boolean {
  return booted && state.enabled && lifecycleSignal?.aborted !== true;
}

function registerDockItem(): void {
  state.appFrame = createOverlayAppFrame({
    id: "reminetChat",
    label: "RemiNet Chat",
    icon: REMINET_CHAT_ICON,
    initialSide: state.side,
    isOpen: () => Boolean(state.root && !state.minimized),
    onOpen: () => {
      if (isMessagesRoute() && !state.messagesSelected) {
        state.messagesSelected = true;
        state.minimized = false;
        ensureRoot();
        void refreshAuthAndHistory();
        return;
      }
      if (!state.root) {
        state.minimized = false;
        ensureRoot();
        void refreshAuthAndHistory();
      }
      render();
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
    if (document.hidden) closeSocket();
    else if (lifecycleActive()) {
      ensureRoot();
      scheduleMountRetry();
      if (state.signedIn && isChatRoute()) void recoverChatConnection("visibility-resume", { visible: false, force: true });
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
      return;
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
  removePseudoChatRow();
  restoreNativeDmPane();
  state.messages = [];
  state.users.clear();
  state.pendingAttachments = [];
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
}

function isSupportedRoute(): boolean {
  return location.pathname === "/"
    || location.pathname === "/home"
    || location.pathname === "/notifications"
    || isMessagesRoute()
    || /^\/[^/]+\/status\/\d+/.test(location.pathname)
    || isProfileRoute();
}

function isChatRoute(): boolean {
  if (isMessagesRoute()) return state.messagesSelected;
  return isSupportedRoute();
}

function isMessagesRoute(): boolean {
  return location.pathname === "/messages" || location.pathname.startsWith("/messages/") || location.pathname.startsWith("/i/chat");
}

function shouldAutoOpenMessagesChat(): boolean {
  return location.pathname === "/i/chat" || location.pathname === "/i/chat/";
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
  const mount = isMessagesRoute() ? "messages" : "rail";
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
  if (isMessagesRoute()) return findDmConversationPane();
  return document.body;
}

function findRightRail(): HTMLElement | null {
  const column = document.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
  if (!column || column.offsetWidth < 260) return null;
  return column.querySelector<HTMLElement>(":scope > div") || column;
}

function findDmContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="dm-container"]')
    || document.querySelector<HTMLElement>('[aria-label="Timeline: Messages"]')
    || document.querySelector<HTMLElement>('main[role="main"]');
}

function findDmListMount(): HTMLElement | null {
  const container = findDmContainer();
  if (!container) return null;
  const existing = document.getElementById(PSEUDO_ROW_ID);
  if (existing?.parentElement) return existing.parentElement;
  const conversationRow = findFirstDmConversationRow();
  if (conversationRow?.parentElement && container.contains(conversationRow.parentElement)) return conversationRow.parentElement;
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
  const panel = container.querySelector<HTMLElement>('[data-testid="dm-conversation-panel"]');
  if (panel && panel.offsetWidth >= 320) return panel;
  const candidates = Array.from(container.querySelectorAll<HTMLElement>('[role="region"], main, section, div'))
    .filter((element) => element.id !== ROOT_ID && element.offsetWidth >= 320 && element.offsetHeight >= 260);
  const listMount = findDmListMount();
  return candidates
    .filter((element) => element !== listMount && !element.contains(listMount))
    .sort((left, right) => right.offsetWidth * right.offsetHeight - left.offsetWidth * left.offsetHeight)[0] || null;
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
    if (row.parentElement !== mount || row.nextElementSibling !== before) mount.insertBefore(row, before);
  } else if (row.parentElement !== mount) {
    mount.insertBefore(row, mount.firstChild);
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
    const nativeDmLink = target.closest('a[href^="/messages/"], a[href^="/i/chat/"]');
    if (!nativeDmLink) return;
    state.messagesSelected = false;
    closeSocket();
    state.root?.remove();
    state.root = null;
    state.mountMode = null;
    restoreNativeDmPane();
    updatePseudoChatRowState();
  };
  document.addEventListener("click", selectionListener, true);
  addRuntimeDisposable(() => document.removeEventListener("click", selectionListener, true));
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
  root.innerHTML = `
    <div class="milxdy-chat-card milxdy-overlay-app-card">
      <header class="milxdy-chat-header milxdy-overlay-app-header">
        <div>
          <strong>RemiliaNET Chat</strong>
          <span data-role="status">Connecting...</span>
        </div>
        <div class="milxdy-chat-header-actions">
          <button type="button" data-role="refresh" title="Refresh chat">Refresh</button>
          <button type="button" data-role="minimize" title="Minimize chat" aria-label="Minimize chat">-</button>
        </div>
      </header>
      <div class="milxdy-chat-surface-notice">RemiNet Global Chat</div>
      <div class="milxdy-chat-load-older" data-role="load-older" hidden></div>
      <div class="milxdy-chat-messages" data-role="messages"></div>
      <div class="milxdy-chat-attachment-preview" data-role="attachments" hidden></div>
      <div class="milxdy-chat-error" data-role="error" hidden></div>
      <div class="milxdy-chat-reply-preview" data-role="reply" hidden></div>
      <form class="milxdy-chat-composer" data-role="form">
        <input data-role="file" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden>
        <button data-role="attach" data-chat-action="attach" type="button" title="Attach media">+</button>
        <input data-role="input" type="text" maxlength="500" autocomplete="off" placeholder="Say something">
        <button data-role="send" type="submit">Send</button>
      </form>
      <div class="milxdy-chat-resize-grip" data-role="resize" data-resize-axis="y" title="Drag to resize chat height"></div>
      <div class="milxdy-chat-resize-corner milxdy-chat-resize-corner-left" data-role="resize" data-resize-axis="both" data-resize-side="left" title="Drag to resize chat"></div>
      <div class="milxdy-chat-resize-corner milxdy-chat-resize-corner-right" data-role="resize" data-resize-axis="both" data-resize-side="right" title="Drag to resize chat"></div>
      <div class="milxdy-chat-resize-edge milxdy-chat-resize-edge-side" data-role="resize" data-resize-axis="x" title="Drag to resize chat width"></div>
    </div>
  `;
  root.querySelector<HTMLButtonElement>('[data-role="refresh"]')?.addEventListener("click", () => {
    void refreshAuthAndHistory(true);
  });
  root.querySelector<HTMLButtonElement>('[data-role="minimize"]')?.addEventListener("click", () => {
    closeChatPanel();
  });
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
    void addPendingFiles(files);
  });
  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const action = target?.closest<HTMLElement>("[data-chat-action]");
    if (!action) return;
    event.preventDefault();
    const kind = action.dataset.chatAction;
    if (kind === "attach") root.querySelector<HTMLInputElement>('[data-role="file"]')?.click();
    if (kind === "remove-attachment") removePendingAttachment(action.dataset.attachmentId || "");
    if (kind === "react") reactToMessage(Number(action.dataset.messageId), action.dataset.emoji || "");
    if (kind === "reply") setReplyTo(Number(action.dataset.messageId));
    if (kind === "cancel-reply") clearReplyTo();
    if (kind === "poke") void pokeUser(action.dataset.username || "");
    if (kind === "load-older") void loadOlderMessages();
    if (kind === "retry-session") void recoverChatConnection("manual-retry", { visible: true, force: true });
  });
  return root;
}

async function refreshAuthAndHistory(force = false): Promise<void> {
  if (!lifecycleActive()) return;
  if (state.minimized) return;
  if (!state.enabled || !isChatRoute() || state.loading && !force) return;
  state.loading = true;
  state.recoveryVisibleState = "none";
  state.recoveryMessage = "";
  if (force) {
    state.hasMoreOlder = true;
    state.showOlderButton = false;
  }
  renderStatus("Checking RemiNet session...");
  const auth = await runtimeSendMessage({ type: "reminetChat:authStatus" }, "reminetChat:authStatus").then(asRecord).catch(() => null);
  if (!lifecycleActive()) return;
  state.signedIn = Boolean(auth?.signedIn);
  state.currentUser = state.signedIn ? normalizeCurrentUser(auth?.user) : null;
  if (!state.signedIn) {
    state.loading = false;
    closeSocket();
    setRecoveryVisibleState("auth-required", "Reconnect / Retry session");
    render();
    return;
  }

  const history = await runtimeSendMessage({ type: "reminetChat:getHistory", limit: HISTORY_PAGE_SIZE }, "reminetChat:getHistory")
    .then(asRecord)
    .catch((error) => asRecord({ ok: false, error: String(error) }));
  if (!lifecycleActive()) return;
  if (history.ok) {
    ingestApiPayload(history.data);
    sortAndTrimMessages();
    state.hasMoreOlder = state.messages.some((message) => message.id > 0);
    renderStatus("Live");
    connectSocket();
  } else {
    if (history.authRequired) setRecoveryVisibleState("auth-required", "Reconnect / Retry session");
    else renderStatus("Could not load chat.");
  }
  state.loading = false;
  render();
}

async function loadOlderMessages(): Promise<void> {
  if (!lifecycleActive()) return;
  if (!state.signedIn || state.loadingOlder || state.messages.length === 0) return;
  const before = oldestMessageId();
  if (!before) return;
  const scroller = state.root?.querySelector<HTMLElement>('[data-role="messages"]') || null;
  const previousHeight = scroller?.scrollHeight || 0;
  const previousTop = scroller?.scrollTop || 0;
  const previousIds = new Set(state.messages.map((message) => message.id));
  state.loadingOlder = true;
  render();
  const history = await runtimeSendMessage({ type: "reminetChat:getHistory", limit: HISTORY_PAGE_SIZE, before }, "reminetChat:getHistoryOlder")
    .then(asRecord)
    .catch((error) => asRecord({ ok: false, error: String(error) }));
  if (!lifecycleActive()) return;
  if (history.ok) {
    const historyCount = countPayloadMessages(history.data);
    ingestApiPayload(history.data);
    sortAndTrimMessages("oldest");
    const addedMessages = state.messages.some((message) => !previousIds.has(message.id));
    state.hasMoreOlder = addedMessages;
    state.showOlderButton = state.hasMoreOlder;
  } else {
    state.hasMoreOlder = false;
    state.showOlderButton = false;
    renderStatus(history.authRequired ? "Sign in to RemiliaNET." : "Could not load older chat.");
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
    const next = normalizeMessage(Number(id), message as RuntimeRecord);
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

function normalizeMessage(id: number, value: RuntimeRecord): ApiMessage | null {
  const messageId = Number(value.id ?? id);
  if (!Number.isFinite(messageId)) return null;
  return {
    id: messageId,
    chatId: numberOrUndefined(value.chatId ?? value.chat_id),
    chat_id: numberOrUndefined(value.chat_id ?? value.chatId),
    authorId: numberOrUndefined(value.authorId ?? value.author_id ?? value.userId ?? value.user_id),
    author_id: numberOrUndefined(value.author_id ?? value.authorId ?? value.user_id ?? value.userId),
    userId: numberOrUndefined(value.userId ?? value.user_id ?? value.authorId ?? value.author_id),
    user_id: numberOrUndefined(value.user_id ?? value.userId ?? value.author_id ?? value.authorId),
    body: typeof value.body === "string" ? value.body : "",
    createdAt: numberOrUndefined(value.createdAt ?? value.created_at),
    created_at: numberOrUndefined(value.created_at ?? value.createdAt),
    isDeleted: Boolean(value.isDeleted ?? value.is_deleted),
    is_deleted: Boolean(value.is_deleted ?? value.isDeleted),
    images: normalizeImages(value.images),
    video: normalizeMedia(value.video),
    reactions: normalizeReactions(value.reactions),
    replyToMessageId: numberOrNull(value.replyToMessageId ?? value.reply_to_message_id ?? value.inReplyToId ?? value.in_reply_to_id),
    reply_to_message_id: numberOrNull(value.reply_to_message_id ?? value.replyToMessageId ?? value.in_reply_to_id ?? value.inReplyToId),
    inReplyToId: numberOrUndefined(value.inReplyToId ?? value.in_reply_to_id ?? value.replyToMessageId ?? value.reply_to_message_id),
    in_reply_to_id: numberOrUndefined(value.in_reply_to_id ?? value.inReplyToId ?? value.reply_to_message_id ?? value.replyToMessageId),
    replyTo: normalizeReplyReference(value.replyTo ?? value.replyToMessage ?? value.parentMessage),
    reply_to: normalizeReplyReference(value.reply_to ?? value.reply_to_message ?? value.parent_message),
    inReplyTo: normalizeReplyReference(value.inReplyTo ?? value.inReplyToMessage),
    in_reply_to: normalizeReplyReference(value.in_reply_to ?? value.in_reply_to_message),
  };
}

function normalizeImages(value: unknown): MediaAttachment[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(normalizeMedia).filter((item): item is MediaAttachment => Boolean(item));
}

function normalizeMedia(value: unknown): MediaAttachment | null {
  if (!value || typeof value !== "object") return null;
  const record = value as RuntimeRecord;
  return {
    mediaId: numberOrNull(record.mediaId ?? record.media_id),
    media_id: numberOrNull(record.media_id ?? record.mediaId),
    url: stringOrNull(record.url ?? record.src ?? record.mediaUrl ?? record.media_url ?? record.videoUrl ?? record.video_url ?? record.sourceUrl ?? record.source_url),
    width: numberOrNull(record.width),
    height: numberOrNull(record.height),
    mimeType: stringOrNull(record.mimeType ?? record.mime_type),
    mime_type: stringOrNull(record.mime_type ?? record.mimeType),
    thumbnailUrl: stringOrNull(record.thumbnailUrl ?? record.thumbnail_url ?? record.thumbUrl ?? record.thumb_url ?? record.posterUrl ?? record.poster_url),
    thumbnail_url: stringOrNull(record.thumbnail_url ?? record.thumbnailUrl ?? record.thumb_url ?? record.thumbUrl ?? record.poster_url ?? record.posterUrl),
  };
}

function normalizeReactions(value: unknown): Reaction[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => {
    const record = objectValue(item);
    const user = normalizeReactionUser(record.user ?? record.author ?? record.profile);
    return {
      userId: numberOrUndefined(record.userId ?? record.user_id),
      user_id: numberOrUndefined(record.user_id ?? record.userId),
      user,
      username: stringOrUndefined(record.username ?? record.userName ?? record.user_name ?? record.handle),
      handle: stringOrUndefined(record.handle ?? record.userHandle ?? record.user_handle),
      name: stringOrUndefined(record.name ?? record.displayName ?? record.display_name),
      emoji: normalizeReactionEmoji(stringOrUndefined(record.emoji ?? record.reaction)),
    };
  }).filter((item) => item.emoji);
}

function normalizeReactionEmoji(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\ufe0f/g, "");
  return REACTION_ALIASES.get(normalized) || normalized;
}

function normalizeReactionUser(value: unknown): ApiUser | null {
  return value && typeof value === "object" ? value as ApiUser : null;
}

function normalizeReplyReference(value: unknown): ReplyReference | null {
  if (!value || typeof value !== "object") return null;
  const record = value as RuntimeRecord;
  const id = numberOrUndefined(record.id ?? record.messageId ?? record.message_id);
  const authorId = numberOrUndefined(record.authorId ?? record.author_id ?? record.userId ?? record.user_id);
  const body = stringOrUndefined(record.body ?? record.text ?? record.message);
  if (!id) return null;
  return {
    id,
    authorId,
    author_id: authorId,
    body: body || "",
  };
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
  recordChatDiagnostic("socket.connect", { attempt: state.reconnectAttempts, route: location.pathname });
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
  const dueIn = Math.max(1_000, state.lastSocketActivityAt + SOCKET_STALE_TIMEOUT_MS - Date.now());
  cancelStaleTimer = runtimeScheduler.timeout(() => {
    cancelStaleTimer = null;
    state.staleTimer = null;
    if (!lifecycleActive() || document.hidden || state.socketState !== "open") return;
    const idleMs = Date.now() - state.lastSocketActivityAt;
    if (idleMs >= SOCKET_STALE_TIMEOUT_MS) {
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
  if (options.visible) setRecoveryVisibleState("recovering", "Checking RemiNet session...");
  else renderStatus("Reconnecting...");
  recordChatDiagnostic("recovery.start", { reason, visible: Boolean(options.visible), socketState: state.socketState });

  closeSocket();
  const auth = await runtimeSendMessage({ type: "reminetChat:authStatus" }, "reminetChat:recoveryAuthStatus")
    .then(asRecord)
    .catch((error) => asRecord({ ok: false, error: String(error) }));
  if (!lifecycleActive()) return;
  const signedIn = Boolean(auth?.signedIn);
  recordChatDiagnostic("recovery.auth", { reason, signedIn, ok: auth?.ok !== false, error: auth?.error });
  state.signedIn = signedIn;
  state.currentUser = signedIn ? normalizeCurrentUser(auth?.user) : null;
  if (!signedIn) {
    state.recoveryInFlight = false;
    setRecoveryVisibleState("auth-required", "Reconnect / Retry session");
    recordChatDiagnostic("recovery.finalState", { reason, state: "auth-required" });
    render();
    return;
  }

  const history = await runtimeSendMessage({ type: "reminetChat:getHistory", limit: RECENT_REFRESH_LIMIT }, "reminetChat:recoveryHistory")
    .then(asRecord)
    .catch((error) => asRecord({ ok: false, error: String(error) }));
  if (!lifecycleActive()) return;
  if (history.ok) {
    ingestApiPayload(history.data);
    sortAndTrimMessages();
    state.recoveryVisibleState = "none";
    state.recoveryMessage = "";
    connectSocket();
    renderStatus("Live");
    recordChatDiagnostic("recovery.finalState", { reason, state: "reconnected", messages: state.messages.length });
  } else if (history.authRequired) {
    state.signedIn = false;
    setRecoveryVisibleState("auth-required", "Reconnect / Retry session");
    recordChatDiagnostic("recovery.finalState", { reason, state: "auth-required-history" });
  } else {
    setRecoveryVisibleState("failed", "Reconnect / Retry session");
    recordChatDiagnostic("recovery.finalState", { reason, state: "failed", error: history.error, status: history.status });
  }
  state.recoveryInFlight = false;
  render();
}

function handleSocketFrame(data: unknown): void {
  if (typeof data !== "string") return;
  let frame: RuntimeRecord;
  try {
    frame = JSON.parse(data);
  } catch {
    return;
  }
  const payload = frame.payload;
  if (frame.type === "deliver" || frame.type === "message_edit" || frame.type === "reaction") {
    const previousMessages = new Map(state.messages.map((message) => [message.id, message]));
    ingestApiPayload(payload);
    const messageId = payload && typeof payload === "object" ? Number((payload as RuntimeRecord).message_id) : NaN;
    if (Number.isFinite(messageId)) removeOptimisticForServerEcho(messageId);
    playSocketFrameSound(frame.type, payload, previousMessages);
    sortAndTrimMessages();
    render();
  }
  if (frame.type === "message_delete" && payload && typeof payload === "object") {
    const id = Number((payload as RuntimeRecord).message_id);
    const message = state.messages.find((item) => item.id === id);
    if (message) message.isDeleted = true;
    render();
  }
  if (frame.type === "error") {
    const message = payload && typeof payload === "object" ? String((payload as RuntimeRecord).message || "") : "";
    renderStatus(message || "Chat error.");
  }
}

async function submitMessage(): Promise<void> {
  if (!lifecycleActive()) return;
  const root = state.root;
  const input = root?.querySelector<HTMLInputElement>('[data-role="input"]');
  if (!input || state.sending) return;
  const text = input.value.trim();
  if (!text && state.pendingAttachments.length === 0) return;
  if (state.socketState !== "open") connectSocket();
  if (state.socketState !== "open") {
    renderStatus("Chat is reconnecting.");
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

  const optimisticId = -Date.now();
  upsertMessage({
    id: optimisticId,
    chatId: CHAT_ID,
    authorId: currentUserId(),
    body: text,
    createdAt: Date.now(),
    images: uploaded.images,
    video: uploaded.video,
    inReplyToId: state.replyTo?.id,
    in_reply_to_id: state.replyTo?.id,
    replyTo: state.replyTo,
  });
  sortAndTrimMessages();
  render();
  const mediaIds = [...uploaded.images.map(mediaId), mediaId(uploaded.video)].filter((id): id is number => typeof id === "number");
  const inReplyToId = state.replyTo?.id;
  const sent = sendSocketPayload({
    type: "submit",
    payload: {
      chat_id: CHAT_ID,
      text,
      in_reply_to_id: Number.isFinite(inReplyToId) ? inReplyToId : undefined,
      media_ids: mediaIds.length ? mediaIds : undefined,
    },
  });
  if (!sent) {
    state.sending = false;
    renderStatus("Chat is reconnecting.");
    render();
    return;
  }
  playChatSound("send");
  input.value = "";
  clearPendingAttachments();
  state.replyTo = null;
  cancelSendResetTimer?.();
  cancelSendResetTimer = runtimeScheduler.timeout(() => {
    cancelSendResetTimer = null;
    if (!lifecycleActive()) return;
    state.sending = false;
    render();
  }, 350);
}

function handleSocketPortMessage(message: unknown): void {
  const record = asRecord(message);
  if (record.type === "socket:connecting") {
    state.socketState = "connecting";
    renderStatus("Connecting...");
    markSocketActivity("connecting");
    return;
  }
  if (record.type === "socket:open") {
    state.socketState = "open";
    state.reconnectAttempts = 0;
    state.recoveryVisibleState = "none";
    state.recoveryMessage = "";
    markSocketActivity("open");
    renderStatus("Live");
    render();
    return;
  }
  if (record.type === "socket:heartbeat") {
    if (record.ok === false) {
      void recoverChatConnection(String(record.reason || "heartbeat-not-open"), { visible: false });
      return;
    }
    markSocketActivity("heartbeat");
    return;
  }
  if (record.type === "socket:frame") {
    markSocketActivity("frame");
    handleSocketFrame(record.data);
    return;
  }
  if (record.type === "socket:close") {
    state.socketState = "closed";
    clearSocketStaleTimer();
    recordChatDiagnostic("socket.close", {
      code: record.code,
      reason: record.reason,
      wasClean: record.wasClean,
    });
    void recoverChatConnection("socket-close", { visible: false });
    return;
  }
  if (record.type === "socket:error") {
    clearSocketStaleTimer();
    recordChatDiagnostic("socket.error", {
      error: record.error,
      reason: record.reason,
      authRequired: record.authRequired,
    });
    if (record.authRequired) {
      state.signedIn = false;
      setRecoveryVisibleState("auth-required", "Reconnect / Retry session");
      render();
      return;
    }
    void recoverChatConnection(String(record.reason || "socket-error"), { visible: true });
  }
}

function sendSocketPayload(payload: Record<string, unknown>): boolean {
  if (!state.socketPort || state.socketState !== "open") return false;
  try {
    state.socketPort.postMessage({ type: "send", payload });
    return true;
  } catch {
    state.socketState = "closed";
    void recoverChatConnection("send-port-failed", { visible: true });
    return false;
  }
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
    messages.innerHTML = renderReconnectState();
    attachments.hidden = true;
    error.hidden = true;
    reply.hidden = true;
    loadOlder.hidden = true;
    return;
  }
  if (state.loading && state.messages.length === 0) {
    loadOlder.hidden = true;
    messages.innerHTML = `<div class="milxdy-chat-empty">Loading chat...</div>`;
    return;
  }

  const atBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 48;
  const canRequestOlder = state.loadingOlder || (state.hasMoreOlder && state.messages.some((message) => message.id > 0));
  loadOlder.hidden = true;
  loadOlder.innerHTML = "";
  const messageHtml = groupMessages(state.messages.filter((message) => !message.isDeleted && !message.is_deleted))
    .map(renderMessageGroup)
    .join("");
  const recoveryHtml = state.recoveryVisibleState !== "none" ? renderReconnectState() : "";
  messages.innerHTML = `${recoveryHtml}${canRequestOlder ? renderLoadOlderButton() : ""}${messageHtml || `<div class="milxdy-chat-empty">No messages yet.</div>`}`;
  attachments.hidden = state.pendingAttachments.length === 0;
  attachments.innerHTML = state.pendingAttachments.map(renderPendingAttachment).join("");
  error.hidden = !state.composerError;
  error.textContent = state.composerError;
  renderReplyPreview(reply);
  if (atBottom) messages.scrollTop = messages.scrollHeight;
  hydrateInlineMedia(messages);
  syncPokeCooldownButtons(root);
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

function renderReconnectState(): string {
  const label = state.recoveryMessage || "Reconnect / Retry session";
  const copy = state.recoveryVisibleState === "recovering"
    ? "Checking your existing RemiliaNET browser session..."
    : state.recoveryVisibleState === "failed"
      ? "Chat connection stalled. Retry your current browser session."
      : "RemiliaNET needs your browser session again. Sign in if prompted, then retry.";
  const disabled = state.recoveryVisibleState === "recovering" ? " disabled" : "";
  return `
    <div class="milxdy-chat-empty milxdy-chat-reconnect">
      <span>${escapeHtml(copy)}</span>
      <button type="button" data-chat-action="retry-session"${disabled}>${escapeHtml(label)}</button>
      <a href="https://www.remilia.net/" target="_blank" rel="noopener noreferrer">Open RemiliaNET</a>
    </div>
  `;
}

function recordChatDiagnostic(key: string, value: Record<string, unknown>): void {
  recordDiagnostic(key, {
    ...value,
    socketState: state.socketState,
    signedIn: state.signedIn,
    visibleState: state.recoveryVisibleState,
    updatedAt: Date.now(),
  });
}

function renderLoadOlderButton(): string {
  const disabled = state.loadingOlder ? " disabled" : "";
  const label = state.loadingOlder ? "Loading..." : "Show more";
  return `
    <div class="milxdy-chat-load-older">
      <button type="button" data-chat-action="load-older"${disabled}>${label}</button>
    </div>
  `;
}

async function loadTheme(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(SETTINGS_THEME_KEY).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.theme = normalizeThemeMode(stored[SETTINGS_THEME_KEY]);
  applyTheme();
}

function closeChatPanel(): void {
  state.minimized = true;
  closeSocket();
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
  }).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.soundEnabled = stored[SOUND_ENABLED_KEY] !== false;
  state.soundVolume = clampVolume(stored[SOUND_VOLUME_KEY]);
  state.soundSend = stored[SOUND_SEND_KEY] !== false;
  state.soundReact = stored[SOUND_REACT_KEY] !== false;
  state.soundReactToMe = stored[SOUND_REACT_TO_ME_KEY] !== false;
  state.soundMessage = stored[SOUND_MESSAGE_KEY] !== false;
  state.soundPoke = stored[SOUND_POKE_KEY] !== false;
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

function playSocketFrameSound(type: unknown, payload: unknown, previousMessages: Map<number, ApiMessage>): void {
  if (type === "deliver") {
    const message = messageFromSocketPayload(payload) || messageFromPayloadId(payload);
    if (!message || messageAuthorId(message) === currentUserId()) return;
    if (!previousMessages.has(message.id)) playChatSound("message");
    return;
  }
  if (type !== "reaction") return;
  const message = messageFromSocketPayload(payload) || messageFromPayloadId(payload);
  if (!message || messageAuthorId(message) !== currentUserId()) return;
  const previous = previousMessages.get(message.id);
  if (reactionSignature(previous) !== reactionSignature(message)) playChatSound("reactToMe");
}

function messageFromPayloadId(payload: unknown): ApiMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const id = Number((payload as RuntimeRecord).message_id ?? (payload as RuntimeRecord).messageId ?? (payload as RuntimeRecord).id);
  return Number.isFinite(id) ? state.messages.find((message) => message.id === id) || null : null;
}

function messageFromSocketPayload(payload: unknown): ApiMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as RuntimeRecord;
  const candidates = [
    record.message,
    record.chatMessage,
    record.chat_message,
    record.data,
    payload,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const message = normalizeMessage(Number(objectValue(candidate).id ?? objectValue(candidate).message_id), candidate as RuntimeRecord);
    if (message) return message;
  }
  return null;
}

function reactionSignature(message: ApiMessage | undefined): string {
  return (message?.reactions || [])
    .map((reaction) => `${normalizeReactionEmoji(reaction.emoji) || ""}:${reaction.userId ?? reaction.user_id ?? reaction.username ?? reaction.handle ?? reaction.name ?? ""}`)
    .sort()
    .join("|");
}

type ChatSoundKind = "send" | "react" | "reactToMe" | "message" | "poke";

function playChatSound(kind: ChatSoundKind): void {
  if (!state.soundEnabled || state.soundVolume <= 0) return;
  if (kind === "send" && !state.soundSend) return;
  if (kind === "react" && !state.soundReact) return;
  if (kind === "reactToMe" && !state.soundReactToMe) return;
  if (kind === "message" && !state.soundMessage) return;
  if (kind === "poke" && !state.soundPoke) return;
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  const now = context.currentTime + 0.01;
  if (kind === "send") playTone(context, now, [520, 700], 0.055, "triangle", 0.8);
  if (kind === "react") playTone(context, now, [860, 620], 0.045, "square", 0.45);
  if (kind === "reactToMe") playTone(context, now, [480, 720, 960], 0.05, "sine", 0.75);
  if (kind === "message") playTone(context, now, [660, 880], 0.065, "sine", 0.65);
  if (kind === "poke") playPokeTone(context, now);
}

function playTone(context: AudioContext, start: number, frequencies: number[], step: number, type: OscillatorType, gainScale: number): void {
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const when = start + index * step;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, state.soundVolume * 0.08 * gainScale), when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + step);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + step + 0.02);
  });
}

function playPokeTone(context: AudioContext, start: number): void {
  const tap = context.createOscillator();
  const tapGain = context.createGain();
  tap.type = "square";
  tap.frequency.setValueAtTime(220, start);
  tapGain.gain.setValueAtTime(0.0001, start);
  tapGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, state.soundVolume * 0.035), start + 0.006);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
  tap.connect(tapGain);
  tapGain.connect(context.destination);
  tap.start(start);
  tap.stop(start + 0.06);

  const chirp = context.createOscillator();
  const chirpGain = context.createGain();
  const chirpStart = start + 0.035;
  chirp.type = "triangle";
  chirp.frequency.setValueAtTime(740, chirpStart);
  chirp.frequency.exponentialRampToValueAtTime(1180, start + 0.18);
  chirpGain.gain.setValueAtTime(0.0001, chirpStart);
  chirpGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, state.soundVolume * 0.025), chirpStart + 0.02);
  chirpGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
  chirp.connect(chirpGain);
  chirpGain.connect(context.destination);
  chirp.start(chirpStart);
  chirp.stop(start + 0.24);
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext = new AudioContextCtor();
  return audioContext;
}

function clampVolume(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.55;
  return Math.max(0, Math.min(1, numeric));
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

function normalizeThemeMode(value: unknown): "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
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
    const authorId = messageAuthorId(message);
    const last = groups[groups.length - 1];
    if (last && last.authorId === authorId && messageTime(message) - messageTime(last.messages[last.messages.length - 1]) < 10 * 60 * 1000) {
      last.messages.push(message);
    } else {
      groups.push({ authorId, messages: [message] });
    }
  }
  return groups;
}

function renderMessageGroup(group: MessageGroup): string {
  const first = group.messages[0];
  const user = userForAuthor(group.authorId, first);
  const handleValue = remiliaHandle(user);
  const name = displayName(user, group.authorId, first);
  const avatar = avatarUrl(user);
  const color = remiliaUserColor(user);
  const profileUrl = handleValue ? `https://www.remilia.net/~${encodeURIComponent(handleValue)}` : "https://www.remilia.net";
  const xHandle = connectedXHandle(user) || cachedXHandleForRemiliaHandle(handleValue);
  return `
    <article class="milxdy-chat-message-group" data-remilia-handle="${escapeHtml(handleValue)}" data-x-handle="${escapeHtml(xHandle)}"${color ? ` style="--rn-user-color:${escapeHtml(color)}"` : ""}>
      <div class="milxdy-chat-user-column">
        <a class="milxdy-chat-avatar" href="${profileUrl}" target="_blank" rel="noopener noreferrer" title="Open RemiliaNET profile">${avatar ? `<img src="${escapeHtml(absoluteRemiliaUrl(avatar))}" alt="">` : ""}</a>
      </div>
      <div class="milxdy-chat-body">
        <div class="milxdy-chat-meta">
          <a class="milxdy-chat-author" href="${profileUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>
          ${handleValue ? `<span>~${escapeHtml(handleValue)}</span>` : ""}
          <time>${escapeHtml(formatTime(messageTime(first)))}</time>
          <span class="milxdy-chat-inline-actions">
            ${xHandle ? `<a class="milxdy-chat-x-link" href="https://x.com/${encodeURIComponent(xHandle)}" target="_blank" rel="noopener noreferrer" title="Open X profile" aria-label="Open X profile">${xLogoSvg()}</a>` : ""}
            ${handleValue ? renderPokeButton(handleValue) : ""}
          </span>
        </div>
        <div class="milxdy-chat-stack">${group.messages.map(renderStackedMessage).join("")}</div>
      </div>
    </article>
  `;
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
  const images = message.images || [];
  const video = message.video;
  if (!images.length && !video) return "";
  return `
    <div class="milxdy-chat-media">
      ${images.map(renderImageAttachment).join("")}
      ${video ? renderVideoAttachment(video) : ""}
    </div>
  `;
}

function renderImageAttachment(media: MediaAttachment): string {
  if (!media.url) return "";
  const url = absoluteRemiliaUrl(media.url);
  if (!url) return "";
  const cached = mediaDataUrlCache.get(url);
  const src = cached || (isRemiliaMediaUrl(url) ? "" : url);
  const bridgeAttribute = isRemiliaMediaUrl(url) ? ` data-media-url="${escapeHtml(url)}"` : "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img ${src ? `src="${escapeHtml(src)}"` : ""}${bridgeAttribute} alt="" loading="lazy"></a>`;
}

function renderVideoAttachment(media: MediaAttachment): string {
  const videoUrl = media.url ? absoluteRemiliaUrl(media.url) : "";
  const posterUrl = media.thumbnailUrl || media.thumbnail_url ? absoluteRemiliaUrl(media.thumbnailUrl || media.thumbnail_url || "") : "";
  if (!videoUrl && posterUrl) {
    return `<a href="${escapeHtml(posterUrl)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(posterUrl)}" alt="" loading="lazy"></a>`;
  }
  if (!videoUrl) return "";
  return `<video src="${escapeHtml(videoUrl)}"${posterUrl ? ` poster="${escapeHtml(posterUrl)}"` : ""} controls playsinline preload="metadata"></video>`;
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
  return `
    <div class="milxdy-chat-message-actions">
      ${renderReactions(message)}
      <button class="milxdy-chat-reply-action" type="button" data-chat-action="reply" data-message-id="${message.id}" title="Reply" aria-label="Reply">${replyIconSvg()}</button>
    </div>
  `;
}

function replyIconSvg(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 5.5h13v9h-7l-5 4v-4h-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

function renderReactions(message: ApiMessage): string {
  const counts = reactionCounts(message);
  return `
    <div class="milxdy-chat-reactions">
      ${REACTIONS.map((emoji) => {
        const count = counts.get(emoji) || 0;
        const reacted = currentUserReacted(message, emoji);
        return `<button type="button" data-active="${String(reacted)}" data-chat-action="react" data-message-id="${message.id}" data-emoji="${emoji}" title="${escapeHtml(reactionTooltip(message, emoji, count))}" aria-pressed="${String(reacted)}">${emoji}</button>`;
      }).join("")}
    </div>
  `;
}

function renderReactionCounts(message: ApiMessage): string {
  const counts = reactionCounts(message);
  const items = REACTIONS
    .map((emoji) => {
      const count = counts.get(emoji) || 0;
      if (count < 1) return "";
      const reacted = currentUserReacted(message, emoji);
      return `<button type="button" data-active="${String(reacted)}" data-chat-action="react" data-message-id="${message.id}" data-emoji="${emoji}" title="${escapeHtml(reactionTooltip(message, emoji, count))}" aria-pressed="${String(reacted)}">${emoji} ${count}</button>`;
    })
    .filter(Boolean);
  return items.length ? `<div class="milxdy-chat-reaction-counts">${items.join("")}</div>` : "";
}

function reactionCounts(message: ApiMessage): Map<string, number> {
  const counts = new Map<string, number>();
  for (const reaction of message.reactions || []) {
    const emoji = normalizeReactionEmoji(reaction.emoji);
    if (!emoji) continue;
    counts.set(emoji, (counts.get(emoji) || 0) + 1);
  }
  return counts;
}

function currentUserReacted(message: ApiMessage, emoji: string): boolean {
  const normalized = normalizeReactionEmoji(emoji);
  return (message.reactions || []).some((reaction) => normalizeReactionEmoji(reaction.emoji) === normalized && reactionBelongsToCurrentUser(reaction));
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

function setReplyTo(messageId: number): void {
  if (!Number.isFinite(messageId)) return;
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

function compactText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 1))}...` : compact;
}

function reactToMessage(messageId: number, emoji: string): void {
  const normalizedEmoji = normalizeReactionEmoji(emoji);
  if (!Number.isFinite(messageId) || !normalizedEmoji || state.socketState !== "open") return;
  const message = state.messages.find((item) => item.id === messageId);
  const type = message && currentUserReacted(message, normalizedEmoji) ? "unreact" : "react";
  if (!sendSocketPayload({ type, payload: { chat_id: CHAT_ID, message_id: messageId, emoji: normalizedEmoji } })) return;
  if (type === "react") playChatSound("react");
}

function renderPokeButton(username: string): string {
  const clean = cleanUsername(username);
  if (!clean) return "";
  const cooldownUntil = pokeCooldowns.get(clean.toLowerCase()) || 0;
  if (cooldownUntil > Date.now()) {
    return `<button class="milxdy-chat-poke" type="button" data-chat-action="poke" data-poke-state="cooldown" data-username="${escapeHtml(clean)}" title="Poke ${escapeHtml(clean)} again in ${escapeHtml(formatPokeCooldown(cooldownUntil - Date.now()))}" aria-label="Poke ${escapeHtml(clean)} again later">${escapeHtml(formatPokeCooldown(cooldownUntil - Date.now()))}</button>`;
  }
  return `<button class="milxdy-chat-poke" type="button" data-chat-action="poke" data-poke-state="idle" data-username="${escapeHtml(clean)}" title="Poke ${escapeHtml(clean)} on RemiliaNET" aria-label="Poke ${escapeHtml(clean)} on RemiliaNET">${POKE_ICON}</button>`;
}

async function pokeUser(username: string): Promise<void> {
  if (!lifecycleActive()) return;
  const clean = cleanUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  const cooldownUntil = pokeCooldowns.get(key) || 0;
  const button = pokeButtonsForUsername(clean)[0] || null;
  if (cooldownUntil > Date.now()) {
    if (button) startPokeCooldown(button, clean, cooldownUntil - Date.now());
    return;
  }
  playChatSound("poke");
  if (button) setPokeButtonState(button, "loading", `Poking ${clean}...`);
  renderStatus(`Poking ${clean}...`);
  const response = await runtimeSendMessage({ type: "beetol:poke", username: clean }, "beetol:poke").then(asRecord).catch((error) => asRecord({ ok: false, error: String(error) }));
  if (!lifecycleActive()) return;
  const cooldownMs = extractPokeCooldownMs(response);
  if (response.ok || cooldownMs > 0) {
    startPokeCooldownForUser(clean, cooldownMs || DEFAULT_POKE_COOLDOWN_MS);
    renderStatus("Poke sent.");
    return;
  }
  if (isExplicitPokeCooldownResponse(response)) {
    const message = stringOrUndefined(response.error) || stringOrUndefined(asRecord(response.data).error) || stringOrUndefined(asRecord(response.data).message) || "Already poked.";
    if (button) setPokeButtonState(button, "error", message);
    renderStatus(message);
    return;
  }
  if (button) setPokeButtonState(button, "error", String(response.error || "Poke failed."));
  renderStatus("Poke failed.");
}

function startPokeCooldownForUser(username: string, cooldownMs: number): void {
  const clean = cleanUsername(username);
  if (!clean) return;
  const until = Date.now() + Math.max(1000, Number(cooldownMs) || 0);
  pokeCooldowns.set(clean.toLowerCase(), until);
  const buttons = pokeButtonsForUsername(clean);
  if (!buttons.length) {
    render();
    return;
  }
  for (const button of buttons) {
    startPokeCooldown(button, clean, until - Date.now(), until);
  }
}

function syncPokeCooldownButtons(root: HTMLElement): void {
  for (const button of Array.from(root.querySelectorAll<HTMLElement>(".milxdy-chat-poke"))) {
    const username = cleanUsername(button.dataset.username || "");
    if (!username) continue;
    registerPokeButton(button, username);
    const cooldownUntil = pokeCooldowns.get(username.toLowerCase()) || 0;
    if (cooldownUntil > Date.now()) startPokeCooldown(button, username, cooldownUntil - Date.now(), cooldownUntil);
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

function startPokeCooldown(button: HTMLElement, username: string, cooldownMs: number, knownUntil?: number): void {
  if (!lifecycleActive()) return;
  const clean = cleanUsername(username);
  if (!clean) return;
  const until = knownUntil || Date.now() + Math.max(1000, Number(cooldownMs) || 0);
  if (button.dataset.pokeCooldownUntil === String(until) && pokeCountdownTimers.has(button)) return;
  pokeCooldowns.set(clean.toLowerCase(), until);
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
      delete button.dataset.pokeCooldownUntil;
      setPokeButtonState(button, "idle", `Poke ${clean} on RemiliaNET`);
      button.textContent = POKE_ICON;
      return;
    }
    const label = formatPokeCooldown(remaining);
    button.textContent = label;
    button.title = `Poke ${clean} again in ${label}`;
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

function setPokeButtonState(button: HTMLElement, stateValue: "idle" | "loading" | "cooldown" | "error", label: string): void {
  button.dataset.pokeState = stateValue;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.toggleAttribute("disabled", stateValue === "loading" || stateValue === "cooldown");
  if (stateValue !== "cooldown") {
    clearPokeCountdown(button);
    button.textContent = POKE_ICON;
  }
}

function extractPokeCooldownMs(response: RuntimeRecord): number {
  const data = objectValue(response.data);
  const nested = objectValue(data.data);
  const values = [
    response.cooldownMs,
    data.cooldownMs,
    data.cooldown,
    data.cooldownRemaining,
    data.cooldownRemainingMs,
    data.remainingMs,
    data.remaining,
    data.retryAfterMs,
    data.retryAfter,
    data.nextPokeInMs,
    data.nextPokeIn,
    data.pokeCooldownMs,
    data.pokeCooldown,
    data.pokeCooldownSeconds,
    nested.cooldownMs,
    nested.cooldown,
    nested.cooldownRemaining,
    nested.cooldownRemainingMs,
    nested.remainingMs,
    nested.remaining,
    nested.retryAfterMs,
    nested.retryAfter,
    nested.nextPokeInMs,
    nested.nextPokeIn,
    nested.pokeCooldownMs,
    nested.pokeCooldown,
    nested.pokeCooldownSeconds,
  ];
  for (const value of values) {
    const ms = normalizeCooldownMs(value);
    if (ms > 0) return ms;
  }

  const untilValues = [
    response.cooldownUntil,
    data.cooldownUntil,
    data.nextPokeAt,
    data.pokeAvailableAt,
    data.availableAt,
    nested.cooldownUntil,
    nested.nextPokeAt,
    nested.pokeAvailableAt,
    nested.availableAt,
  ];
  for (const value of untilValues) {
    const timestamp = typeof value === "string" ? Date.parse(value) : NaN;
    if (Number.isFinite(timestamp) && timestamp > Date.now()) return timestamp - Date.now();
  }
  return 0;
}

function isExplicitPokeCooldownResponse(response: RuntimeRecord): boolean {
  if (!response || response.authRequired) return false;
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

function normalizeCooldownMs(value: unknown): number {
  if (value == null || value === false) return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 1000 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return normalizeCooldownMs(numeric);
    const match = trimmed.match(/(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
    if (match && match[0].trim()) {
      const days = Number(match[1] || 0);
      const hours = Number(match[2] || 0);
      const minutes = Number(match[3] || 0);
      const seconds = Number(match[4] || 0);
      return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    }
  }
  return 0;
}

function formatPokeCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
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
  if (VIDEO_TYPES.has(file.type) && file.size > 100 * 1024 * 1024) return "Videos must be 100 MB or smaller.";
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
    attachment.status = "uploading";
    render();
    const response = await runtimeSendMessage({
      type: "reminetChat:uploadAttachment",
      name: attachment.name,
      mimeType: attachment.mimeType,
      dataUrl: attachment.dataUrl,
    }, "reminetChat:uploadAttachment").then(asRecord).catch((error) => asRecord({ ok: false, error: String(error) }));
    if (!lifecycleActive()) return { ok: false, error: "Chat closed." };
    if (!response.ok) {
      attachment.status = "error";
      return { ok: false, error: String(response.error || "Upload failed.") };
    }
    const media = normalizeMedia(response.media) || {};
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
  return state.users.get(authorId) || (authorId && authorId === currentUserId() ? state.currentUser : null) || (message.id < 0 ? state.currentUser : null);
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
      const cached = await getCachedProfile(cacheKey);
      if (!lifecycleActive()) return;
      if (cached) {
        const cachedXHandle = connectedXHandle(cached);
        if (cachedXHandle) xHandleByRemiliaHandle.set(cacheKey, cachedXHandle);
        profileLookupDone.add(cacheKey);
        state.users.set(authorId, { ...state.users.get(authorId), ...cached });
        render();
        return;
      }

      const profileResponse = await runtimeSendMessage({ type: "reminetChat:getProfile", username: handleValue }, "reminetChat:getProfile").then(asRecord);
      if (!lifecycleActive()) return;
      const enriched = profileUserFromResponse(profileResponse);
      const enrichedXHandle = enriched ? connectedXHandle(enriched) : "";
      if (profileResponse.ok && enriched && enrichedXHandle) {
        xHandleByRemiliaHandle.set(cacheKey, enrichedXHandle);
        profileLookupDone.add(cacheKey);
        void storeCachedProfile(cacheKey, enriched);
        state.users.set(authorId, { ...state.users.get(authorId), ...enriched });
        render();
        return;
      }
      if (profileResponse.ok && enriched) {
        state.users.set(authorId, { ...state.users.get(authorId), ...enriched });
        render();
      }

      const remiStatsUser = await getRemiStatsCachedUser(cacheKey);
      if (!lifecycleActive()) return;
      const remiStatsXHandle = remiStatsUser ? connectedXHandle(remiStatsUser) : "";
      if (remiStatsUser && remiStatsXHandle) {
        xHandleByRemiliaHandle.set(cacheKey, remiStatsXHandle);
        profileLookupDone.add(cacheKey);
        void storeCachedProfile(cacheKey, remiStatsUser);
        state.users.set(authorId, { ...state.users.get(authorId), ...remiStatsUser });
        render();
      }
    } finally {
      profileLookupPending.delete(cacheKey);
    }
  })();
}

async function getRemiStatsCachedUser(handleKey: string): Promise<ApiUser | null> {
  const response = await runtimeSendMessage({ type: "remistats:getUser", handle: handleKey }, "remistats:getUser").then(asRecord).catch(() => asRecord({}));
  if (!response.ok) return null;
  const data = objectValue(response.data);
  const user = objectValue(data.user);
  const twitterHandle = stringOrUndefined(user.twitterHandle ?? user.twitter_handle);
  if (!twitterHandle) return null;
  return {
    handle: stringOrUndefined(user.username ?? user.userHandle ?? user.user_handle ?? user.handle ?? handleKey),
    userHandle: stringOrUndefined(user.userHandle ?? user.user_handle ?? user.username ?? user.handle ?? handleKey),
    username: stringOrUndefined(user.username ?? user.userHandle ?? user.user_handle ?? user.handle ?? handleKey),
    displayName: stringOrUndefined(user.displayName ?? user.display_name),
    twitterHandle,
    xHandle: twitterHandle,
  };
}

async function getCachedProfile(handleKey: string): Promise<ApiUser | null> {
  const stored: RuntimeRecord = await chrome.storage.local.get(PROFILE_CACHE_KEY).catch(() => ({}));
  const cache = normalizeProfileCache(stored[PROFILE_CACHE_KEY]);
  const entry = cache[handleKey];
  if (!entry?.cachedAt) return null;
  const age = Date.now() - entry.cachedAt;
  return entry.user && age < PROFILE_CACHE_TTL_MS ? entry.user : null;
}

async function storeCachedProfile(handleKey: string, user: ApiUser): Promise<void> {
  const stored: RuntimeRecord = await chrome.storage.local.get(PROFILE_CACHE_KEY).catch(() => ({}));
  const cache = pruneProfileCache(normalizeProfileCache(stored[PROFILE_CACHE_KEY]));
  cache[handleKey] = { cachedAt: Date.now(), user: compactCachedProfile(user) };
  await chrome.storage.local.set({ [PROFILE_CACHE_KEY]: cache }).catch(() => undefined);
}

function normalizeProfileCache(value: unknown): ProfileCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ProfileCache;
}

function pruneProfileCache(cache: ProfileCache): ProfileCache {
  const entries = Object.entries(cache)
    .filter(([, entry]) => entry && typeof entry === "object" && typeof entry.cachedAt === "number")
    .sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0))
    .slice(0, PROFILE_CACHE_MAX_ENTRIES - 1);
  return Object.fromEntries(entries);
}

function compactCachedProfile(user: ApiUser): ApiUser {
  return {
    id: user.id,
    userId: user.userId,
    user_id: user.user_id,
    handle: user.handle,
    userHandle: user.userHandle,
    user_handle: user.user_handle,
    username: user.username,
    twitterHandle: user.twitterHandle,
    twitter_handle: user.twitter_handle,
    twitterUsername: user.twitterUsername,
    twitter_username: user.twitter_username,
    twitterUrl: user.twitterUrl,
    twitter_url: user.twitter_url,
    xHandle: user.xHandle,
    x_handle: user.x_handle,
    xUsername: user.xUsername,
    x_username: user.x_username,
    xUrl: user.xUrl,
    x_url: user.x_url,
    displayName: user.displayName,
    display_name: user.display_name,
    name: user.name,
    profilePicUrl: user.profilePicUrl,
    profile_pic_url: user.profile_pic_url,
    pfpUrl: user.pfpUrl,
    pfp_url: user.pfp_url,
    color: user.color,
    theme: user.theme,
    connections: user.connections,
  };
}

function profileUserFromResponse(response: RuntimeRecord): ApiUser | null {
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

function displayName(user: ApiUser | null, authorId: number, message: ApiMessage): string {
  const handleValue = remiliaHandle(user);
  return user?.displayName || user?.display_name || user?.name || handleValue || (message.id < 0 ? "You" : `User ${authorId || "?"}`);
}

function remiliaUserColor(user: ApiUser | null): string {
  const hue = remiliaUserHue(user);
  return hue === null ? "" : `hsl(${hue}, 60%, 45%)`;
}

function remiliaUserHue(user: ApiUser | null): number | null {
  const raw = user?.color;
  if (typeof raw === "number" && Number.isFinite(raw)) return normalizeHue(raw);
  if (typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim())) return normalizeHue(Number(raw));
  return null;
}

function normalizeHue(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function remiliaHandle(user: ApiUser | null): string {
  return user?.handle || user?.userHandle || user?.user_handle || user?.username || "";
}

function avatarUrl(user: ApiUser | null): string {
  return user?.profilePicUrl || user?.profile_pic_url || user?.pfpUrl || user?.pfp_url || "";
}

function connectedXHandle(user: ApiUser | null): string {
  const direct = user?.twitterHandle
    || user?.twitter_handle
    || user?.twitterUsername
    || user?.twitter_username
    || user?.xHandle
    || user?.x_handle
    || user?.xUsername
    || user?.x_username
    || handleFromUrl(user?.twitterUrl || user?.twitter_url || user?.xUrl || user?.x_url);
  if (direct) return cleanXHandle(direct);
  const record = objectValue(user);
  const nestedHandle = findNestedXHandle(record);
  if (nestedHandle) return nestedHandle;
  const deepHandle = findDeepXHandle(record);
  if (deepHandle) return deepHandle;
  for (const item of user?.connections || []) {
    const record = objectValue(item);
    const provider = String(record.provider || record.type || record.platform || record.service || record.kind || "").toLowerCase();
    if (!/twitter|x/.test(provider)) continue;
    const handle = stringOrUndefined(record.handle
      ?? record.username
      ?? record.userName
      ?? record.user_name
      ?? record.screenName
      ?? record.screen_name
      ?? record.nickname
      ?? record.name
      ?? handleFromUrl(stringOrUndefined(record.url ?? record.href ?? record.profileUrl ?? record.profile_url)));
    if (handle) return cleanXHandle(handle);
  }
  return "";
}

function findDeepXHandle(value: unknown, depth = 0): string {
  if (!value || typeof value !== "object" || depth > 4) return "";
  const record = value as RuntimeRecord;
  const direct = stringOrUndefined(record.twitterHandle
    ?? record.twitter_handle
    ?? record.twitterUsername
    ?? record.twitter_username
    ?? record.xHandle
    ?? record.x_handle
    ?? record.xUsername
    ?? record.x_username
    ?? record.screenName
    ?? record.screen_name
    ?? handleFromUrl(stringOrUndefined(record.twitterUrl ?? record.twitter_url ?? record.xUrl ?? record.x_url ?? record.url ?? record.href)));
  if (direct) return cleanXHandle(direct);

  const provider = String(record.provider || record.type || record.platform || record.service || record.kind || record.network || "").toLowerCase();
  if (/twitter|^x$/.test(provider)) {
    const handle = stringOrUndefined(record.handle
      ?? record.username
      ?? record.userName
      ?? record.user_name
      ?? record.name
      ?? record.nickname
      ?? handleFromUrl(stringOrUndefined(record.url ?? record.href ?? record.profileUrl ?? record.profile_url)));
    if (handle) return cleanXHandle(handle);
  }

  for (const [key, nested] of Object.entries(record)) {
    if (!/(twitter|x|social|connection|account|profile|links?)/i.test(key) && depth > 0) continue;
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const handle = findDeepXHandle(item, depth + 1);
        if (handle) return handle;
      }
      continue;
    }
    const handle = findDeepXHandle(nested, depth + 1);
    if (handle) return handle;
  }
  return "";
}

function findNestedXHandle(record: RuntimeRecord): string {
  for (const key of ["twitter", "x", "twitterAccount", "twitter_account", "xAccount", "x_account", "socials", "social"]) {
    const value = record[key];
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const itemRecord = objectValue(item);
        const provider = String(itemRecord.provider || itemRecord.type || itemRecord.platform || itemRecord.service || itemRecord.kind || "").toLowerCase();
        if (!/twitter|x/.test(provider)) continue;
        const handle = handleFromSocialRecord(itemRecord);
        if (handle) return handle;
      }
      continue;
    }
    const handle = handleFromSocialRecord(value as RuntimeRecord);
    if (handle) return handle;
  }
  return "";
}

function handleFromSocialRecord(record: RuntimeRecord): string {
  const handle = stringOrUndefined(record.handle
    ?? record.username
    ?? record.userName
    ?? record.user_name
    ?? record.screenName
    ?? record.screen_name
    ?? record.nickname
    ?? record.name
    ?? handleFromUrl(stringOrUndefined(record.url ?? record.href ?? record.profileUrl ?? record.profile_url)));
  return handle ? cleanXHandle(handle) : "";
}

function handleFromUrl(value: string | undefined): string {
  if (!value) return "";
  const match = value.match(/(?:twitter\.com|x\.com)\/@?([^/?#]+)/i);
  return match ? match[1] : "";
}

function cleanXHandle(value: string): string {
  return value.replace(/^@/, "").replace(/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\//i, "").split(/[/?#]/)[0];
}

function cleanUsername(value: string): string {
  return value.trim().replace(/^[@~]/, "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function normalizeCurrentUser(value: unknown): ApiUser | null {
  if (!value || typeof value !== "object") return null;
  const record = value as RuntimeRecord;
  const nested = record.user && typeof record.user === "object" ? record.user as RuntimeRecord : record;
  return {
    id: numberOrUndefined(nested.id ?? nested.userId ?? nested.user_id),
    userId: numberOrUndefined(nested.userId ?? nested.user_id ?? nested.id),
    handle: stringOrUndefined(nested.handle ?? nested.userHandle ?? nested.user_handle ?? nested.username),
    userHandle: stringOrUndefined(nested.userHandle ?? nested.user_handle ?? nested.handle ?? nested.username),
    username: stringOrUndefined(nested.username ?? nested.handle ?? nested.userHandle),
    displayName: stringOrUndefined(nested.displayName ?? nested.display_name ?? nested.name),
    name: stringOrUndefined(nested.name ?? nested.displayName ?? nested.display_name),
    profilePicUrl: stringOrUndefined(nested.profilePicUrl ?? nested.profile_pic_url ?? nested.pfpUrl ?? nested.pfp_url),
    pfpUrl: stringOrUndefined(nested.pfpUrl ?? nested.pfp_url ?? nested.profilePicUrl ?? nested.profile_pic_url),
    color: stringOrUndefined(nested.color),
    theme: stringOrUndefined(nested.theme),
    connections: Array.isArray(nested.connections) ? nested.connections : undefined,
  };
}

function currentUserId(): number {
  return state.currentUser?.userId || state.currentUser?.user_id || state.currentUser?.id || 0;
}

function removeOptimisticForServerEcho(serverMessageId: number): void {
  const serverMessage = state.messages.find((message) => message.id === serverMessageId);
  if (!serverMessage) return;
  const serverBody = serverMessage.body || "";
  const serverAuthor = messageAuthorId(serverMessage);
  const currentAuthor = currentUserId();
  state.messages = state.messages.filter((message) => {
    if (message.id >= 0) return true;
    if ((message.body || "") !== serverBody) return true;
    if (currentAuthor && serverAuthor && currentAuthor !== serverAuthor) return true;
    return Math.abs(messageTime(serverMessage) - messageTime(message)) > 60_000;
  });
}

function sortAndTrimMessages(anchor: "newest" | "oldest" = "newest"): void {
  state.messages.sort((left, right) => messageTime(left) - messageTime(right));
  state.messages = anchor === "oldest"
    ? state.messages.slice(0, MAX_MESSAGES)
    : state.messages.slice(-MAX_MESSAGES);
}

function oldestMessageId(): number | null {
  let oldest: ApiMessage | null = null;
  for (const message of state.messages) {
    if (!Number.isFinite(message.id) || message.id <= 0) continue;
    if (!oldest || messageTime(message) < messageTime(oldest)) oldest = message;
  }
  return oldest?.id ?? null;
}

function countPayloadMessages(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== "object") return 0;
  const record = payload as RuntimeRecord;
  let count = 0;
  if (record.global && typeof record.global === "object") count = Math.max(count, countPayloadMessages(record.global));
  if (record.data && typeof record.data === "object") count = Math.max(count, countPayloadMessages(record.data));
  if (record.results && typeof record.results === "object") count = Math.max(count, countPayloadMessages(record.results));
  if (record.items && typeof record.items === "object") count = Math.max(count, countPayloadMessages(record.items));
  if (Array.isArray(record.messages)) return Math.max(count, record.messages.length);
  if (record.messages && typeof record.messages === "object") return Math.max(count, Object.keys(record.messages).length);
  return count;
}

function messageTime(message: ApiMessage): number {
  const raw = message.createdAt ?? message.created_at ?? 0;
  return raw > 10_000_000_000 ? raw : raw * 1000;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function mediaId(media: MediaAttachment | null): number | null {
  return media?.mediaId || media?.media_id || null;
}

function absoluteRemiliaUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://www.remilia.net");
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function isRemiliaMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "www.remilia.net";
  } catch {
    return false;
  }
}

function formatBody(value: string): string {
  return escapeHtml(value)
    .replace(/\bhttps?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
    .replace(/\n/g, "<br>");
}

function numberOrUndefined(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function objectValue(value: unknown): RuntimeRecord {
  return value && typeof value === "object" ? value as RuntimeRecord : {};
}

function asRecord(value: unknown): RuntimeRecord {
  return objectValue(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}
