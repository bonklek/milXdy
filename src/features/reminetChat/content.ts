import { safeRuntimeMessage } from "../../shared/extensionRuntime";

const ROOT_ID = "milxdy-reminet-chat-root";
const CHAT_ID = 1;
const SOCKET_URL = "wss://www.remilia.net/api/ws";
const SETTINGS_THEME_KEY = "milxdy.settings.theme";
const MAX_MESSAGES = 100;
const REACTIONS = ["\u{1f639}", "\u{1f90d}", "\u{1f44d}", "\u{1faa2}"];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const POKE_ICON = "\u{1faf5}";
const DEFAULT_POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const mediaDataUrlCache = new Map<string, string>();
const mediaDataUrlPending = new Set<string>();
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
  emoji?: string;
};

type ApiMessage = {
  id: number;
  chatId?: number;
  chat_id?: number;
  authorId?: number;
  author_id?: number;
  body?: string;
  createdAt?: number;
  created_at?: number;
  isDeleted?: boolean;
  is_deleted?: boolean;
  images?: MediaAttachment[] | null;
  video?: MediaAttachment | null;
  reactions?: Reaction[] | null;
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
  sending: boolean;
  signedIn: boolean;
  enabled: boolean;
  currentUser: ApiUser | null;
  pendingAttachments: PendingAttachment[];
  composerError: string;
  minimized: boolean;
  theme: "light" | "dark" | "system";
};

const state: ChatState = {
  root: null,
  messages: [],
  users: new Map(),
  ws: null,
  reconnectTimer: null,
  loading: false,
  sending: false,
  signedIn: false,
  enabled: true,
  currentUser: null,
  pendingAttachments: [],
  composerError: "",
  minimized: false,
  theme: "system",
};

void boot();

function boot(): void {
  ensureRoot();
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
  state.signedIn = false;
  state.loading = false;
  state.sending = false;
  state.root?.remove();
  state.root = null;
}

function isChatRoute(): boolean {
  return location.pathname === "/"
    || location.pathname === "/home"
    || location.pathname === "/notifications"
    || /^\/[^/]+\/status\/\d+/.test(location.pathname);
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

  const rail = findRightRail();
  const existing = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (!rail) {
    if (existing) existing.remove();
    state.root = null;
    return;
  }

  const root = existing || createRoot();
  const changed = !existing || root.parentElement !== rail || root.dataset.mount !== "rail";
  if (root.parentElement !== rail) rail.insertBefore(root, rail.firstChild);
  root.dataset.mount = "rail";
  state.root = root;
  applyTheme();
  if (changed) render();
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
          <button type="button" data-role="minimize" title="Minimize chat" aria-label="Minimize chat">_</button>
        </div>
      </header>
      <div class="milxdy-chat-messages" data-role="messages"></div>
      <div class="milxdy-chat-attachment-preview" data-role="attachments" hidden></div>
      <div class="milxdy-chat-error" data-role="error" hidden></div>
      <form class="milxdy-chat-composer" data-role="form">
        <input data-role="file" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden>
        <button data-role="attach" data-chat-action="attach" type="button" title="Attach media">+</button>
        <input data-role="input" type="text" maxlength="500" autocomplete="off" placeholder="Say something">
        <button data-role="send" type="submit">Send</button>
      </form>
    </div>
  `;
  root.querySelector<HTMLButtonElement>('[data-role="refresh"]')?.addEventListener("click", () => {
    void refreshAuthAndHistory(true);
  });
  root.querySelector<HTMLButtonElement>('[data-role="minimize"]')?.addEventListener("click", () => {
    state.minimized = !state.minimized;
    render();
  });
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
    if (kind === "poke") void pokeUser(action.dataset.username || "");
  });
  return root;
}

async function refreshAuthAndHistory(force = false): Promise<void> {
  if (!state.enabled || !isChatRoute() || state.loading && !force) return;
  state.loading = true;
  renderStatus("Checking RemiNet session...");
  const auth = await safeRuntimeMessage({ type: "reminetChat:authStatus" }).then(asRecord).catch(() => null);
  state.signedIn = Boolean(auth?.signedIn);
  state.currentUser = state.signedIn ? normalizeCurrentUser(auth?.user) : null;
  if (!state.signedIn) {
    state.loading = false;
    closeSocket();
    renderStatus("Sign in from the RemiNet popup tab.");
    render();
    return;
  }

  const history = await safeRuntimeMessage({ type: "reminetChat:getHistory", limit: 30 })
    .then(asRecord)
    .catch((error) => asRecord({ ok: false, error: String(error) }));
  if (history.ok) {
    ingestApiPayload(history.data);
    sortAndTrimMessages();
    renderStatus("Live");
    connectSocket();
  } else {
    renderStatus(history.authRequired ? "Sign in from the RemiNet popup tab." : "Could not load chat.");
  }
  state.loading = false;
  render();
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
    ? value.map((user) => [String(objectValue(user).id ?? objectValue(user).user_id), user])
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
    const next = normalizeMessage(Number(id), message as RuntimeRecord);
    if (next) upsertMessage(next);
  }
}

function normalizeMessage(id: number, value: RuntimeRecord): ApiMessage | null {
  const messageId = Number(value.id ?? id);
  if (!Number.isFinite(messageId)) return null;
  return {
    id: messageId,
    chatId: numberOrUndefined(value.chatId ?? value.chat_id),
    chat_id: numberOrUndefined(value.chat_id ?? value.chatId),
    authorId: numberOrUndefined(value.authorId ?? value.author_id),
    author_id: numberOrUndefined(value.author_id ?? value.authorId),
    body: typeof value.body === "string" ? value.body : "",
    createdAt: numberOrUndefined(value.createdAt ?? value.created_at),
    created_at: numberOrUndefined(value.created_at ?? value.createdAt),
    isDeleted: Boolean(value.isDeleted ?? value.is_deleted),
    is_deleted: Boolean(value.is_deleted ?? value.isDeleted),
    images: normalizeImages(value.images),
    video: normalizeMedia(value.video),
    reactions: normalizeReactions(value.reactions),
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
    return {
      userId: numberOrUndefined(record.userId ?? record.user_id),
      user_id: numberOrUndefined(record.user_id ?? record.userId),
      emoji: stringOrUndefined(record.emoji),
    };
  }).filter((item) => item.emoji);
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
  ws.send(JSON.stringify({ type: "submit", payload: { chat_id: CHAT_ID, text, media_ids: mediaIds.length ? mediaIds : undefined } }));
  input.value = "";
  clearPendingAttachments();
  window.setTimeout(() => {
    state.sending = false;
    render();
  }, 350);
}

function render(): void {
  const root = state.root;
  if (!root) return;
  const messages = root.querySelector<HTMLElement>('[data-role="messages"]');
  const send = root.querySelector<HTMLButtonElement>('[data-role="send"]');
  const input = root.querySelector<HTMLInputElement>('[data-role="input"]');
  const attachments = root.querySelector<HTMLElement>('[data-role="attachments"]');
  const error = root.querySelector<HTMLElement>('[data-role="error"]');
  if (!messages || !send || !input || !attachments || !error) return;

  root.dataset.minimized = String(state.minimized);
  const minimize = root.querySelector<HTMLButtonElement>('[data-role="minimize"]');
  if (minimize) {
    minimize.textContent = state.minimized ? "+" : "_";
    minimize.title = state.minimized ? "Expand chat" : "Minimize chat";
    minimize.setAttribute("aria-label", minimize.title);
  }

  input.disabled = !state.signedIn;
  send.disabled = !state.signedIn || state.sending;

  if (!state.signedIn) {
    messages.innerHTML = `<div class="milxdy-chat-empty">Sign in from the extension popup's RemiNet tab.</div>`;
    attachments.hidden = true;
    error.hidden = true;
    return;
  }
  if (state.loading && state.messages.length === 0) {
    messages.innerHTML = `<div class="milxdy-chat-empty">Loading chat...</div>`;
    return;
  }

  const atBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 48;
  messages.innerHTML = groupMessages(state.messages.filter((message) => !message.isDeleted && !message.is_deleted))
    .map(renderMessageGroup)
    .join("") || `<div class="milxdy-chat-empty">No messages yet.</div>`;
  attachments.hidden = state.pendingAttachments.length === 0;
  attachments.innerHTML = state.pendingAttachments.map(renderPendingAttachment).join("");
  error.hidden = !state.composerError;
  error.textContent = state.composerError;
  if (atBottom) messages.scrollTop = messages.scrollHeight;
  hydrateInlineImages(messages);
  syncPokeCooldownButtons(root);
}

function renderStatus(text: string): void {
  const status = state.root?.querySelector<HTMLElement>('[data-role="status"]');
  if (status) status.textContent = text;
}

async function loadTheme(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(SETTINGS_THEME_KEY).catch(() => ({}));
  state.theme = normalizeThemeMode(stored[SETTINGS_THEME_KEY]);
  applyTheme();
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

function groupMessages(messages: ApiMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const authorId = message.authorId ?? message.author_id ?? 0;
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
  const xHandle = connectedXHandle(user);
  return `
    <article class="milxdy-chat-message-group">
      <div class="milxdy-chat-user-column">
        <a class="milxdy-chat-avatar" href="${profileUrl}" target="_blank" rel="noopener noreferrer" title="Open RemiliaNET profile">${avatar ? `<img src="${escapeHtml(absoluteRemiliaUrl(avatar))}" alt="">` : ""}</a>
      </div>
      <div class="milxdy-chat-body">
        <div class="milxdy-chat-meta">
          <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" style="${color ? `color:${color}` : ""}">${escapeHtml(name)}</a>
          ${handleValue ? `<span>~${escapeHtml(handleValue)}</span>` : ""}
          <time>${escapeHtml(formatTime(messageTime(first)))}</time>
          <span class="milxdy-chat-inline-actions">
            ${xHandle ? `<a class="milxdy-chat-x-link" href="https://x.com/${encodeURIComponent(xHandle)}" target="_blank" rel="noopener noreferrer" title="Open X profile" aria-label="Open X profile">X</a>` : ""}
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
      ${message.body ? `<div class="milxdy-chat-text">${formatBody(message.body)}</div>` : ""}
      ${renderAttachments(message)}
      ${renderReactions(message)}
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
  return `<video src="${escapeHtml(absoluteRemiliaUrl(url))}" controls playsinline preload="metadata"></video>`;
}

function hydrateInlineImages(container: HTMLElement): void {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img[data-media-url]"));
  for (const image of images) {
    const url = image.dataset.mediaUrl || "";
    if (!url || image.src.startsWith("data:")) continue;
    const cached = mediaDataUrlCache.get(url);
    if (cached) {
      image.src = cached;
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
        for (const next of container.querySelectorAll<HTMLImageElement>(`img[data-media-url="${cssEscape(url)}"]`)) {
          next.src = dataUrl;
        }
      })
      .finally(() => {
        mediaDataUrlPending.delete(url);
      });
  }
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
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
        return `<button class="${count ? "has-reacts" : ""}" type="button" data-chat-action="react" data-message-id="${message.id}" data-emoji="${emoji}">${emoji}${count ? ` ${count}` : ""}</button>`;
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
  if (!authorId || !handleValue || profileLookupPending.has(handleValue) || profileLookupDone.has(handleValue)) return;
  profileLookupPending.add(handleValue);
  void safeRuntimeMessage({ type: "reminetChat:getProfile", username: handleValue })
    .then(asRecord)
    .then((response) => {
      profileLookupDone.add(handleValue);
      const enriched = profileUserFromResponse(response);
      if (!response.ok || !enriched) return;
      state.users.set(authorId, { ...state.users.get(authorId), ...enriched });
      render();
    })
    .finally(() => {
      profileLookupPending.delete(handleValue);
    });
}

function profileUserFromResponse(response: RuntimeRecord): ApiUser | null {
  const data = objectValue(response.data);
  const user = data.user && typeof data.user === "object" ? data.user : data;
  return user && typeof user === "object" ? user as ApiUser : null;
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
  const serverAuthor = serverMessage.authorId ?? serverMessage.author_id ?? 0;
  const currentAuthor = currentUserId();
  state.messages = state.messages.filter((message) => {
    if (message.id >= 0) return true;
    if ((message.body || "") !== serverBody) return true;
    if (currentAuthor && serverAuthor && currentAuthor !== serverAuthor) return true;
    return Math.abs(messageTime(serverMessage) - messageTime(message)) > 60_000;
  });
}

function sortAndTrimMessages(): void {
  state.messages.sort((left, right) => messageTime(left) - messageTime(right));
  state.messages = state.messages.slice(-MAX_MESSAGES);
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
