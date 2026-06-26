import { safeRuntimeMessage } from "../../shared/extensionRuntime";

const ROOT_ID = "milxdy-reminet-chat-root";
const CHAT_ID = 1;
const SOCKET_URL = "wss://www.remilia.net/api/ws";
const SETTINGS_THEME_KEY = "milxdy.settings.theme";
const SIDE_KEY = "milxdy.reminetChat.side";
const HEIGHT_KEY = "milxdy.reminetChat.height";
const TOP_KEY = "milxdy.reminetChat.top";
const PROFILE_CACHE_KEY = "milxdy.reminetChat.profileCache.v3";
const MAX_MESSAGES = 300;
const HISTORY_PAGE_SIZE = 30;
const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_CACHE_MAX_ENTRIES = 250;
const REACTIONS = ["\u{1f631}", "\u{1f525}", "\u{1f639}", "\u{1f90d}", "\u{1f44d}", "\u{1faa2}"];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const POKE_ICON = "\u{1faf5}";
const DEFAULT_POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const mediaDataUrlCache = new Map<string, string>();
const mediaDataUrlPending = new Set<string>();
const xHandleByRemiliaHandle = new Map<string, string>();
const profileLookupPending = new Set<string>();
const profileLookupDone = new Set<string>();
const pokeCooldowns = new Map<string, number>();
const pokeCountdownTimers = new Map<HTMLElement, number>();

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
  color?: string;
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
  messages: ApiMessage[];
  users: Map<number, ApiUser>;
  ws: WebSocket | null;
  reconnectTimer: number | null;
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
  frameHeight: number;
  topOffset: number;
};

const state: ChatState = {
  root: null,
  messages: [],
  users: new Map(),
  ws: null,
  reconnectTimer: null,
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
  minimized: false,
  theme: "system",
  side: "right",
  frameHeight: 560,
  topOffset: 8,
};

void boot();

function boot(): void {
  ensureRoot();
  void loadLayoutSettings();
  void loadTheme();
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  observeRouteAndLayout();
  observeEnablement();
  void refreshAuthAndHistory();
}

function observeRouteAndLayout(): void {
  let lastHref = location.href;
  let layoutTimer: number | null = null;
  const scheduleLayout = () => {
    if (!state.enabled || layoutTimer !== null) return;
    layoutTimer = window.setTimeout(() => {
      layoutTimer = null;
      ensureRoot();
      applyLayout();
    }, 300);
  };
  const observer = new MutationObserver((mutations) => {
    if (!state.enabled) return;
    if (lastHref !== location.href) {
      lastHref = location.href;
      ensureRoot();
      void refreshAuthAndHistory();
      return;
    }
    const root = state.root;
    if (root && mutations.every((mutation) => root.contains(mutation.target))) return;
    scheduleLayout();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", scheduleLayout, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) closeSocket();
    else if (state.enabled && state.signedIn && isChatRoute()) connectSocket();
  });
}

function observeEnablement(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
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
  });
}

function destroy(): void {
  closeSocket();
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
  state.root?.remove();
  state.root = null;
}

function isChatRoute(): boolean {
  return location.pathname === "/"
    || location.pathname === "/home"
    || location.pathname === "/notifications"
    || /^\/[^/]+\/status\/\d+/.test(location.pathname)
    || isProfileRoute();
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
  if (!isChatRoute()) {
    if (state.root) {
      closeSocket();
      state.root.remove();
      state.root = null;
    }
    return;
  }

  const rail = findMountTarget();
  const existing = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (!rail) {
    if (existing) existing.remove();
    state.root = null;
    return;
  }

  const root = existing || createRoot();
  const mount = state.side === "left" ? "left" : "rail";
  const changed = !existing || root.parentElement !== rail || root.dataset.mount !== mount;
  if (root.parentElement !== rail) {
    if (state.side === "left") rail.appendChild(root);
    else rail.insertBefore(root, rail.firstChild);
  }
  root.dataset.mount = mount;
  state.root = root;
  applyTheme();
  applyLayout();
  if (changed) render();
}

function findMountTarget(): HTMLElement | null {
  if (state.side === "left") return document.body;
  return findRightRail();
}

function findRightRail(): HTMLElement | null {
  const column = document.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
  if (!column || column.offsetWidth < 260) return null;
  return column.querySelector<HTMLElement>(":scope > div") || column;
}

function createRoot(): HTMLElement {
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="milxdy-chat-card">
      <header class="milxdy-chat-header">
        <div>
          <strong>RemiliaNET Chat</strong>
          <span data-role="status">Connecting...</span>
        </div>
        <div class="milxdy-chat-header-actions">
          <button type="button" data-role="refresh" title="Refresh chat">Refresh</button>
          <button type="button" data-role="side" title="Move chat left" aria-label="Move chat left">&#9664;</button>
          <button type="button" data-role="minimize" title="Minimize chat" aria-label="Minimize chat">-</button>
        </div>
      </header>
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
      <div class="milxdy-chat-resize-grip" data-role="resize" title="Drag to resize chat"></div>
    </div>
  `;
  root.querySelector<HTMLButtonElement>('[data-role="refresh"]')?.addEventListener("click", () => {
    void refreshAuthAndHistory(true);
  });
  root.querySelector<HTMLButtonElement>('[data-role="minimize"]')?.addEventListener("click", () => {
    state.minimized = !state.minimized;
    render();
  });
  root.querySelector<HTMLButtonElement>('[data-role="side"]')?.addEventListener("click", () => {
    state.side = state.side === "right" ? "left" : "right";
    state.topOffset = defaultTopOffset();
    void chrome.storage.local.set({ [SIDE_KEY]: state.side, [TOP_KEY]: state.topOffset });
    ensureRoot();
    render();
  });
  root.querySelector<HTMLElement>('[data-role="resize"]')?.addEventListener("pointerdown", startResize);
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
  });
  return root;
}

async function refreshAuthAndHistory(force = false): Promise<void> {
  if (!state.enabled || !isChatRoute() || state.loading && !force) return;
  state.loading = true;
  if (force) {
    state.hasMoreOlder = true;
    state.showOlderButton = false;
  }
  renderStatus("Checking RemiNet session...");
  const auth = await safeRuntimeMessage({ type: "reminetChat:authStatus" }).then(asRecord).catch(() => null);
  state.signedIn = Boolean(auth?.signedIn);
  state.currentUser = state.signedIn ? normalizeCurrentUser(auth?.user) : null;
  if (!state.signedIn) {
    state.loading = false;
    closeSocket();
    renderStatus("Sign in to RemiliaNET.");
    render();
    return;
  }

  const history = await safeRuntimeMessage({ type: "reminetChat:getHistory", limit: HISTORY_PAGE_SIZE })
    .then(asRecord)
    .catch((error) => asRecord({ ok: false, error: String(error) }));
  if (history.ok) {
    ingestApiPayload(history.data);
    sortAndTrimMessages();
    state.hasMoreOlder = state.messages.length > 0;
    renderStatus("Live");
    connectSocket();
  } else {
    renderStatus(history.authRequired ? "Sign in to RemiliaNET." : "Could not load chat.");
  }
  state.loading = false;
  render();
}

async function loadOlderMessages(): Promise<void> {
  if (!state.signedIn || state.loadingOlder || !state.hasMoreOlder || state.messages.length === 0) return;
  const before = oldestMessageId();
  if (!before) return;
  const scroller = state.root?.querySelector<HTMLElement>('[data-role="messages"]') || null;
  const previousHeight = scroller?.scrollHeight || 0;
  const previousTop = scroller?.scrollTop || 0;
  const previousIds = new Set(state.messages.map((message) => message.id));
  state.loadingOlder = true;
  render();
  const history = await safeRuntimeMessage({ type: "reminetChat:getHistory", limit: HISTORY_PAGE_SIZE, before })
    .then(asRecord)
    .catch((error) => asRecord({ ok: false, error: String(error) }));
  if (history.ok) {
    const historyCount = countPayloadMessages(history.data);
    ingestApiPayload(history.data);
    sortAndTrimMessages("oldest");
    const addedMessages = state.messages.some((message) => !previousIds.has(message.id));
    state.hasMoreOlder = addedMessages && historyCount >= HISTORY_PAGE_SIZE;
    state.showOlderButton = state.hasMoreOlder;
  } else {
    state.hasMoreOlder = false;
    state.showOlderButton = false;
    renderStatus(history.authRequired ? "Sign in to RemiliaNET." : "Could not load older chat.");
  }
  state.loadingOlder = false;
  render();
  window.requestAnimationFrame(() => {
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
    url: stringOrNull(record.url ?? record.src ?? record.mediaUrl ?? record.media_url),
    width: numberOrNull(record.width),
    height: numberOrNull(record.height),
    mimeType: stringOrNull(record.mimeType ?? record.mime_type),
    mime_type: stringOrNull(record.mime_type ?? record.mimeType),
    thumbnailUrl: stringOrNull(record.thumbnailUrl ?? record.thumbnail_url ?? record.thumbUrl ?? record.thumb_url),
    thumbnail_url: stringOrNull(record.thumbnail_url ?? record.thumbnailUrl ?? record.thumb_url ?? record.thumbUrl),
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
      emoji: stringOrUndefined(record.emoji ?? record.reaction),
    };
  }).filter((item) => item.emoji);
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
  if (!state.enabled || document.hidden || state.ws?.readyState === WebSocket.OPEN || state.ws?.readyState === WebSocket.CONNECTING) return;
  void safeRuntimeMessage({ type: "reminetChat:prepareSocket" }).then(asRecord).then((ready) => {
    if (!ready.ok) return;
    const ws = new WebSocket(SOCKET_URL);
    state.ws = ws;
    ws.addEventListener("open", () => {
      renderStatus("Live");
      ws.send(JSON.stringify({ type: "subscribe", payload: { chat_id: CHAT_ID } }));
    });
    ws.addEventListener("message", (event) => handleSocketFrame(event.data));
    ws.addEventListener("close", () => {
      if (state.ws === ws) state.ws = null;
      scheduleReconnect();
    });
    ws.addEventListener("error", () => renderStatus("Connection interrupted."));
  });
}

function closeSocket(): void {
  if (state.reconnectTimer) {
    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  if (state.ws) {
    const ws = state.ws;
    state.ws = null;
    ws.close();
  }
}

function scheduleReconnect(): void {
  if (!state.enabled || !state.signedIn || !isChatRoute() || document.hidden || state.reconnectTimer) return;
  renderStatus("Reconnecting...");
  state.reconnectTimer = window.setTimeout(() => {
    state.reconnectTimer = null;
    connectSocket();
  }, 2500);
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
    ingestApiPayload(payload);
    const messageId = payload && typeof payload === "object" ? Number((payload as RuntimeRecord).message_id) : NaN;
    if (Number.isFinite(messageId)) removeOptimisticForServerEcho(messageId);
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
  const root = state.root;
  const input = root?.querySelector<HTMLInputElement>('[data-role="input"]');
  if (!input || state.sending) return;
  const text = input.value.trim();
  if (!text && state.pendingAttachments.length === 0) return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) connectSocket();
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    renderStatus("Chat is reconnecting.");
    return;
  }

  state.sending = true;
  state.composerError = "";
  render();
  const uploaded = await uploadPendingAttachments();
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
  const ws = state.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    state.sending = false;
    renderStatus("Chat is reconnecting.");
    render();
    return;
  }
  const inReplyToId = state.replyTo?.id;
  ws.send(JSON.stringify({
    type: "submit",
    payload: {
      chat_id: CHAT_ID,
      text,
      in_reply_to_id: Number.isFinite(inReplyToId) ? inReplyToId : undefined,
      media_ids: mediaIds.length ? mediaIds : undefined,
    },
  }));
  input.value = "";
  clearPendingAttachments();
  state.replyTo = null;
  window.setTimeout(() => {
    state.sending = false;
    render();
  }, 350);
}

function render(): void {
  const root = state.root;
  if (!root) return;
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
  const minimize = root.querySelector<HTMLButtonElement>('[data-role="minimize"]');
  if (minimize) {
    minimize.textContent = state.minimized ? "+" : "-";
    minimize.title = state.minimized ? "Expand chat" : "Minimize chat";
    minimize.setAttribute("aria-label", minimize.title);
  }
  const side = root.querySelector<HTMLButtonElement>('[data-role="side"]');
  if (side) {
    side.innerHTML = state.side === "right" ? "&#9664;" : "&#9654;";
    side.title = state.side === "right" ? "Move chat left" : "Move chat right";
    side.setAttribute("aria-label", side.title);
  }

  input.disabled = !state.signedIn;
  send.disabled = !state.signedIn || state.sending;

  if (!state.signedIn) {
    messages.innerHTML = `
      <div class="milxdy-chat-empty">
        <a href="https://www.remilia.net/" target="_blank" rel="noopener noreferrer">Sign in</a>
        <span>to RemiliaNET, then refresh chat.</span>
      </div>
    `;
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
  loadOlder.hidden = !(state.hasMoreOlder || state.loadingOlder);
  loadOlder.innerHTML = state.hasMoreOlder || state.loadingOlder ? renderLoadOlderButton() : "";
  const messageHtml = groupMessages(state.messages.filter((message) => !message.isDeleted && !message.is_deleted))
    .map(renderMessageGroup)
    .join("");
  messages.innerHTML = messageHtml || `<div class="milxdy-chat-empty">No messages yet.</div>`;
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

function renderLoadOlderButton(): string {
  const disabled = state.loadingOlder ? " disabled" : "";
  const label = state.loadingOlder ? "Loading..." : "Show more";
  return `
    <div>
      <button type="button" data-chat-action="load-older"${disabled}>${label}</button>
    </div>
  `;
}

async function loadTheme(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(SETTINGS_THEME_KEY).catch(() => ({}));
  state.theme = normalizeThemeMode(stored[SETTINGS_THEME_KEY]);
  applyTheme();
}

async function loadLayoutSettings(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get([SIDE_KEY, HEIGHT_KEY, TOP_KEY]).catch(() => ({}));
  state.side = stored[SIDE_KEY] === "left" ? "left" : "right";
  const height = Number(stored[HEIGHT_KEY]);
  if (Number.isFinite(height)) state.frameHeight = clampFrameHeight(height);
  const top = Number(stored[TOP_KEY]);
  if (Number.isFinite(top)) state.topOffset = clampTopOffset(top, state.frameHeight);
  applyLayout();
  ensureRoot();
}

function normalizeThemeMode(value: unknown): "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function applyTheme(): void {
  const root = state.root;
  if (!root) return;
  const mode = state.theme === "system"
    ? window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : state.theme;
  root.dataset.theme = mode;
}

function applyLayout(): void {
  const root = state.root;
  if (!root) return;
  state.topOffset = clampTopOffset(state.topOffset, state.frameHeight);
  if (state.side === "left") {
    root.style.setProperty("--rn-left-top", `${state.topOffset}px`);
  } else {
    root.style.setProperty("--rn-rail-top", `${state.topOffset}px`);
    root.style.removeProperty("--rn-left-top");
  }
  state.frameHeight = clampFrameHeight(state.frameHeight);
  root.style.setProperty("--rn-frame-height", `${state.frameHeight}px`);
}

function leftDockTop(): number {
  const beetol = document.getElementById("beetol-hunter-root");
  if (!beetol) return 8;
  const rect = beetol.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return 8;
  return Math.max(8, Math.min(window.innerHeight - 120, rect.bottom + 8));
}

function defaultTopOffset(): number {
  if (state.side !== "left") return rightDockMinTop();
  return leftDockTop();
}

function startDrag(event: PointerEvent): void {
  if (event.button !== 0) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("button, a, input, textarea, select, [data-role='resize']")) return;
  const root = state.root;
  if (!root) return;
  event.preventDefault();
  const startY = event.clientY;
  const startTop = state.topOffset;
  const pointerId = event.pointerId;
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(pointerId);
  root.dataset.dragging = "true";

  const move = (moveEvent: PointerEvent) => {
    state.topOffset = clampTopOffset(startTop + moveEvent.clientY - startY, state.frameHeight);
    applyLayout();
  };
  const up = () => {
    root.dataset.dragging = "false";
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    void chrome.storage.local.set({ [TOP_KEY]: state.topOffset });
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function startResize(event: PointerEvent): void {
  if (event.button !== 0 || state.minimized) return;
  const root = state.root;
  if (!root) return;
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = state.frameHeight;
  const pointerId = event.pointerId;
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(pointerId);

  const move = (moveEvent: PointerEvent) => {
    state.frameHeight = clampFrameHeight(startHeight + moveEvent.clientY - startY);
    applyLayout();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    void chrome.storage.local.set({ [HEIGHT_KEY]: state.frameHeight });
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function clampFrameHeight(value: number): number {
  const top = clampTopOffset(state.topOffset || defaultTopOffset(), value);
  const max = Math.max(260, window.innerHeight - top - 12);
  return Math.max(260, Math.min(Math.floor(value), max));
}

function clampTopOffset(value: number, frameHeight = state.frameHeight): number {
  const min = state.side === "right" ? rightDockMinTop() : 8;
  const max = Math.max(min, window.innerHeight - Math.min(frameHeight, window.innerHeight - 16) - 8);
  return Math.max(min, Math.min(Math.floor(value), max));
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
  const color = user?.color && /^#[0-9a-f]{6}$/i.test(user.color) ? user.color : "";
  const profileUrl = handleValue ? `https://www.remilia.net/~${encodeURIComponent(handleValue)}` : "https://www.remilia.net";
  const xHandle = connectedXHandle(user) || cachedXHandleForRemiliaHandle(handleValue);
  return `
    <article class="milxdy-chat-message-group" data-remilia-handle="${escapeHtml(handleValue)}" data-x-handle="${escapeHtml(xHandle)}">
      <div class="milxdy-chat-user-column">
        <a class="milxdy-chat-avatar" href="${profileUrl}" target="_blank" rel="noopener noreferrer" title="Open RemiliaNET profile">${avatar ? `<img src="${escapeHtml(absoluteRemiliaUrl(avatar))}" alt="">` : ""}</a>
      </div>
      <div class="milxdy-chat-body">
        <div class="milxdy-chat-meta">
          <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="${color ? `color:${color}` : ""}">${escapeHtml(name)}</a>
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
  const cached = mediaDataUrlCache.get(url);
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img ${cached ? `src="${escapeHtml(cached)}"` : ""} data-media-url="${escapeHtml(url)}" alt="" loading="lazy"></a>`;
}

function renderVideoAttachment(media: MediaAttachment): string {
  const url = media.url || media.thumbnailUrl || media.thumbnail_url;
  if (!url) return "";
  const absolute = absoluteRemiliaUrl(url);
  const cached = mediaDataUrlCache.get(absolute);
  return `<video ${cached ? `src="${escapeHtml(cached)}"` : ""} data-media-url="${escapeHtml(absolute)}" controls playsinline preload="metadata"></video>`;
}

function hydrateInlineMedia(container: HTMLElement): void {
  const media = Array.from(container.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img[data-media-url], video[data-media-url]"));
  for (const element of media) {
    const url = element.dataset.mediaUrl || "";
    if (!url || element.currentSrc.startsWith("data:") || element.getAttribute("src")?.startsWith("data:")) continue;
    const cached = mediaDataUrlCache.get(url);
    if (cached) {
      setMediaSource(element, cached);
      continue;
    }
    if (mediaDataUrlPending.has(url)) continue;
    mediaDataUrlPending.add(url);
    void safeRuntimeMessage({ type: "reminetChat:fetchMedia", url })
      .then(asRecord)
      .then((response) => {
        const dataUrl = stringOrUndefined(response.dataUrl);
        if (!response.ok || !dataUrl) return;
        mediaDataUrlCache.set(url, dataUrl);
        for (const next of container.querySelectorAll<HTMLImageElement | HTMLVideoElement>(`img[data-media-url="${cssEscape(url)}"], video[data-media-url="${cssEscape(url)}"]`)) {
          setMediaSource(next, dataUrl);
        }
      })
      .finally(() => {
        mediaDataUrlPending.delete(url);
      });
  }
}

function setMediaSource(element: HTMLImageElement | HTMLVideoElement, dataUrl: string): void {
  element.src = dataUrl;
  if (element instanceof HTMLVideoElement) element.load();
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
}

function renderMessageActions(message: ApiMessage): string {
  return `
    <div class="milxdy-chat-message-actions">
      <button class="milxdy-chat-reply-action" type="button" data-chat-action="reply" data-message-id="${message.id}" title="Reply" aria-label="Reply">&#8625;</button>
      ${renderReactions(message)}
    </div>
  `;
}

function renderReactions(message: ApiMessage): string {
  const counts = new Map<string, number>();
  for (const reaction of message.reactions || []) {
    if (!reaction.emoji) continue;
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
  }
  return `
    <div class="milxdy-chat-reactions">
      ${REACTIONS.map((emoji) => {
        const count = counts.get(emoji) || 0;
        return `<button class="${count ? "has-reacts" : ""}" type="button" data-chat-action="react" data-message-id="${message.id}" data-emoji="${emoji}" title="${escapeHtml(reactionTooltip(message, emoji, count))}">${emoji}${count ? ` ${count}` : ""}</button>`;
      }).join("")}
    </div>
  `;
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
    .filter((reaction) => reaction.emoji === emoji)
    .map(reactionAuthorName)
    .filter(Boolean);
  if (!names.length) return `${count} reacted ${emoji}`;
  return `${names.join(", ")} reacted ${emoji}`;
}

function reactionAuthorName(reaction: Reaction): string {
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
  if (!Number.isFinite(messageId) || !emoji || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify({ type: "react", payload: { chat_id: CHAT_ID, message_id: messageId, emoji } }));
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
  const clean = cleanUsername(username);
  if (!clean) return;
  const key = clean.toLowerCase();
  const cooldownUntil = pokeCooldowns.get(key) || 0;
  const button = state.root?.querySelector<HTMLElement>(`.milxdy-chat-poke[data-username="${cssEscape(clean)}"]`) || null;
  if (cooldownUntil > Date.now()) {
    if (button) startPokeCooldown(button, clean, cooldownUntil - Date.now());
    return;
  }
  if (button) setPokeButtonState(button, "loading", `Poking ${clean}...`);
  renderStatus(`Poking ${clean}...`);
  const response = await safeRuntimeMessage({ type: "beetol:poke", username: clean }).then(asRecord).catch((error) => asRecord({ ok: false, error: String(error) }));
  const cooldownMs = extractPokeCooldownMs(response);
  if (response.ok || cooldownMs > 0) {
    startPokeCooldownForUser(clean, cooldownMs || DEFAULT_POKE_COOLDOWN_MS);
    renderStatus("Poke sent.");
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
  render();
}

function syncPokeCooldownButtons(root: HTMLElement): void {
  for (const button of Array.from(root.querySelectorAll<HTMLElement>(".milxdy-chat-poke"))) {
    const username = cleanUsername(button.dataset.username || "");
    if (!username) continue;
    const cooldownUntil = pokeCooldowns.get(username.toLowerCase()) || 0;
    if (cooldownUntil > Date.now()) startPokeCooldown(button, username, cooldownUntil - Date.now(), cooldownUntil);
  }
}

function startPokeCooldown(button: HTMLElement, username: string, cooldownMs: number, knownUntil?: number): void {
  const clean = cleanUsername(username);
  if (!clean) return;
  const until = knownUntil || Date.now() + Math.max(1000, Number(cooldownMs) || 0);
  if (button.dataset.pokeCooldownUntil === String(until) && pokeCountdownTimers.has(button)) return;
  pokeCooldowns.set(clean.toLowerCase(), until);
  clearPokeCountdown(button);
  setPokeButtonState(button, "cooldown", `Already poked ${clean}`);
  button.dataset.pokeCooldownUntil = String(until);

  const update = () => {
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
  };

  update();
  pokeCountdownTimers.set(button, window.setInterval(update, 1000));
}

function clearPokeCountdown(button: HTMLElement): void {
  const timer = pokeCountdownTimers.get(button);
  if (timer) window.clearInterval(timer);
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
    attachment.status = "uploading";
    render();
    const response = await safeRuntimeMessage({
      type: "reminetChat:uploadAttachment",
      name: attachment.name,
      mimeType: attachment.mimeType,
      dataUrl: attachment.dataUrl,
    }).then(asRecord).catch((error) => asRecord({ ok: false, error: String(error) }));
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
      if (cached) {
        const cachedXHandle = connectedXHandle(cached);
        if (cachedXHandle) xHandleByRemiliaHandle.set(cacheKey, cachedXHandle);
        profileLookupDone.add(cacheKey);
        state.users.set(authorId, { ...state.users.get(authorId), ...cached });
        render();
        return;
      }

      const profileResponse = await safeRuntimeMessage({ type: "reminetChat:getProfile", username: handleValue }).then(asRecord);
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
  const response = await safeRuntimeMessage({ type: "remistats:getUser", handle: handleKey }).then(asRecord).catch(() => asRecord({}));
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
  if (url.startsWith("/")) return `https://www.remilia.net${url}`;
  return url;
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
