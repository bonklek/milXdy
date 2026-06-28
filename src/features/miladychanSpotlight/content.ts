import { safeRuntimeMessage } from "../../shared/extensionRuntime";
import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../shared/overlayAppChrome";
import {
  createOverlayAppFrame,
  type OverlayAppFrame,
} from "../../shared/overlayAppFrame";
import {
  clampOverlayPanelBox,
  observeOverlayPanelTheme,
  resolveOverlayPanelTheme,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
  startOverlayPanelResize,
} from "../../shared/overlayPanelBase";
import { registerOverlayAppRoot } from "../../shared/overlayAppLayout";
import type { MilxdyContentAppContext } from "../../shared/appPlatform";
import type { OverlayDockSide } from "../../shared/overlayDock";

const ROOT_ID = "milxdy-miladychan-root";
const API_ROOT = "https://boards.miladychan.org";
const DOCK_ICON_PATH = "miladychanSpotlight/notification-icon.png";
const STYLE_THEME_KEY = "milxdy.settings.theme";
const WIDTH_KEY = "milxdy.miladychan.width";
const HEIGHT_KEY = "milxdy.miladychan.height";
const TOP_KEY = "milxdy.miladychan.top";
const DEFAULT_BOARDS = ["milady", "remilio", "a", "ai", "kpop", "pol", "v", "all"];
const BOARD_THEME_BY_BOARD: Record<string, BoardTheme> = {
  milady: "tea",
  all: "tea",
  remilio: "yotsuba",
  a: "yots_b",
  pol: "yots_b",
  v: "yots_b",
  ai: "console",
  kpop: "moon",
};
const FILE_TYPES = [
  "jpg", "png", "gif", "webm", "pdf", "svg", "mp4", "mp3", "ogg", "zip",
  "7z", "tar.gz", "tar.xz", "flac", "noFile", "txt", "webp", "rar", "cbz", "cbr",
] as const;

type BoardInfo = {
  id: string;
  title: string;
};

type ChanUser = {
  displayname?: string;
  username?: string;
  pfpUrl?: string;
};

type ChanImage = {
  spoiler?: boolean;
  audio?: boolean;
  video?: boolean;
  file_type: number;
  thumb_type: number;
  dims?: number[];
  size?: number;
  sha1: string;
  name?: string;
};

type ChanPost = {
  id: number;
  time: number;
  body: string;
  name?: string;
  image?: ChanImage | null;
  user?: ChanUser | null;
  op?: number;
  board?: string;
};

type ChanThread = ChanPost & {
  abbrev?: boolean;
  sticky?: boolean;
  locked?: boolean;
  post_count: number;
  image_count: number;
  update_time: number;
  bump_time: number;
  subject: string;
  board: string;
  activity?: number;
  connected?: number;
  unique_posters?: number;
  posts?: ChanPost[] | null;
};

type BoardPayload = {
  pages?: number;
  threads: ChanThread[];
};

type BoardSummary = BoardInfo & {
  loading: boolean;
  error: string;
  threads: ChanThread[];
  activeScore: number;
  connected: number;
  latestUpdate: number;
};

type ViewMode = "boards" | "threads" | "thread";
type BoardTheme = "tea" | "yotsuba" | "yots_b" | "console" | "moon";

type SpotlightState = {
  root: HTMLElement | null;
  appFrame: OverlayAppFrame | null;
  open: boolean;
  minimized: boolean;
  loadingBoards: boolean;
  loadingThreads: boolean;
  loadingThread: boolean;
  error: string;
  boards: BoardSummary[];
  selectedBoard: string;
  selectedThread: ChanThread | null;
  view: ViewMode;
  side: OverlayDockSide;
  x: number;
  width: number;
  height: number;
  topOffset: number;
  theme: "light" | "dark" | "system";
  lastLoadedAt: number;
  layoutReady: boolean;
};

const state: SpotlightState = {
  root: null,
  appFrame: null,
  open: false,
  minimized: true,
  loadingBoards: false,
  loadingThreads: false,
  loadingThread: false,
  error: "",
  boards: DEFAULT_BOARDS.map((id) => emptyBoard(id, id)),
  selectedBoard: "milady",
  selectedThread: null,
  view: "boards",
  side: "right",
  x: 0,
  width: 390,
  height: 620,
  topOffset: 16,
  theme: "system",
  lastLoadedAt: 0,
  layoutReady: false,
};
let booted = false;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;
let lifecycleSignal: AbortSignal | null = null;

export function boot(context?: MilxdyContentAppContext): void {
  if (booted) return;
  booted = true;
  lifecycleSignal = context?.signal || null;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  ensureOverlayAppChromeStyles();
  registerDockItem();
  void loadLayoutSettings();
  void loadTheme();
  observeSettings(addRuntimeDisposable);
}

export function open(): void {
  state.open = true;
  state.minimized = false;
  ensureRoot();
  render();
  void loadBoards();
}

export function close(): void {
  closePanel();
}

export function disable(): void {
  closePanel();
}

export function dispose(): void {
  disable();
  state.appFrame?.remove();
  state.appFrame = null;
  state.root?.remove();
  state.root = null;
  addRuntimeDisposable = () => undefined;
  lifecycleSignal = null;
  booted = false;
}

function lifecycleActive(): boolean {
  return booted && lifecycleSignal?.aborted !== true;
}

function registerDockItem(): void {
  state.appFrame = createOverlayAppFrame({
    id: "miladychanSpotlight",
    label: "Miladychan",
    icon: miladyChanDockIcon(),
    initialSide: state.side,
    isOpen: () => Boolean(state.root && state.open && !state.minimized),
    onOpen: () => {
      state.open = true;
      state.minimized = false;
      ensureRoot();
      render();
      void loadBoards();
    },
    onClose: () => {
      closePanel();
    },
    onSideChange: (side) => {
      state.side = side;
      applyLayout();
    },
  });
}

function miladyChanDockIcon(): string {
  return chrome.runtime.getURL(DOCK_ICON_PATH);
}

async function loadLayoutSettings(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get([WIDTH_KEY, HEIGHT_KEY, TOP_KEY]).catch(() => ({}));
  if (!lifecycleActive()) return;
  const width = Number(stored[WIDTH_KEY]);
  const height = Number(stored[HEIGHT_KEY]);
  const top = Number(stored[TOP_KEY]);
  const layout = await restoreOverlayPanelBox("miladychanSpotlight", {
    side: state.side,
    minWidth: 320,
    minHeight: 340,
    defaultWidth: state.width,
    defaultHeight: state.height,
    legacy: { width, height, topOffset: top },
  });
  state.x = layout.x ?? state.x;
  state.width = layout.width;
  state.height = layout.height;
  state.topOffset = layout.topOffset;
  state.layoutReady = true;
  applyLayout();
}

async function loadTheme(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get({ [STYLE_THEME_KEY]: "system" }).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.theme = normalizeTheme(stored[STYLE_THEME_KEY]);
  applyTheme();
}

function observeSettings(addDisposable: MilxdyContentAppContext["addDisposable"]): void {
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;
    if (changes[STYLE_THEME_KEY]) {
      state.theme = normalizeTheme(changes[STYLE_THEME_KEY].newValue);
      applyTheme();
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
  addDisposable(() => chrome.storage.onChanged.removeListener(storageListener));
  addDisposable(observeOverlayPanelTheme(applyTheme));
  const resizeListener = () => {
    state.width = clampWidth(state.width);
    state.height = clampHeight(state.height);
    state.topOffset = clampTopOffset(state.topOffset);
    applyLayout();
  };
  window.addEventListener("resize", resizeListener, { passive: true });
  addDisposable(() => window.removeEventListener("resize", resizeListener));
}

function ensureRoot(): void {
  if (!state.open) return;
  const existing = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (existing) {
    existing.classList.add("milxdy-overlay-app-shell");
    existing.querySelector(".milxdy-chan-card")?.classList.add("milxdy-overlay-app-card");
    existing.querySelector(".milxdy-chan-header")?.classList.add("milxdy-overlay-app-header");
    state.root = existing;
    return;
  }
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.className = "milxdy-overlay-app-shell";
  prepareOverlayAppRoot(root);
  root.setAttribute("aria-label", "Miladychan spotlight");
  root.innerHTML = `
    <div class="milxdy-chan-card milxdy-overlay-app-card">
      <header class="milxdy-chan-header milxdy-overlay-app-header">
        <div>
          <strong>Miladychan</strong>
          <span data-role="status">Boards</span>
        </div>
        <div class="milxdy-chan-header-actions">
          <button type="button" data-role="back" title="Back">‹</button>
          <button type="button" data-role="refresh" title="Refresh">↻</button>
          <button type="button" data-role="minimize" title="Minimize">_</button>
        </div>
      </header>
      <div class="milxdy-chan-error" data-role="error" hidden></div>
      <main class="milxdy-chan-body" data-role="body"></main>
      <div class="milxdy-chan-resize-grip" data-role="resize" data-resize-axis="both" title="Drag to resize"></div>
      <div class="milxdy-chan-resize-edge milxdy-chan-resize-edge-side" data-role="resize" data-resize-axis="x" title="Drag to resize width"></div>
      <div class="milxdy-chan-resize-edge milxdy-chan-resize-edge-bottom" data-role="resize" data-resize-axis="y" title="Drag to resize height"></div>
    </div>
  `;
  root.querySelector<HTMLButtonElement>('[data-role="minimize"]')?.addEventListener("click", () => {
    closePanel();
  });
  root.querySelector<HTMLButtonElement>('[data-role="refresh"]')?.addEventListener("click", () => {
    if (state.view === "thread" && state.selectedThread) void openThread(state.selectedThread.board, state.selectedThread.id, true);
    else if (state.view === "threads") void openBoard(state.selectedBoard, true);
    else void loadBoards(true);
  });
  root.querySelector<HTMLButtonElement>('[data-role="back"]')?.addEventListener("click", () => {
    if (state.view === "thread") {
      state.view = "threads";
      state.selectedThread = null;
    } else {
      state.view = "boards";
    }
    render();
  });
  for (const handle of Array.from(root.querySelectorAll<HTMLElement>('[data-role="resize"]'))) {
    handle.addEventListener("pointerdown", startResize);
  }
  root.querySelector<HTMLElement>(".milxdy-chan-header")?.addEventListener("pointerdown", startDrag);
  document.documentElement.append(root);
  state.root = root;
  applyTheme();
  applyLayout();
}

async function loadBoards(force = false): Promise<void> {
  if (!lifecycleActive()) return;
  if (state.loadingBoards) return;
  const fresh = Date.now() - state.lastLoadedAt < 45_000;
  if (!force && fresh && state.boards.some((board) => board.threads.length)) return;
  state.loadingBoards = true;
  state.error = "";
  render();
  try {
    const boardList = await fetchJson<BoardInfo[]>(`${API_ROOT}/json/board-list`);
    if (!lifecycleActive()) return;
    const boardInfos = boardList
      .filter((board) => DEFAULT_BOARDS.includes(board.id))
      .sort((a, b) => DEFAULT_BOARDS.indexOf(a.id) - DEFAULT_BOARDS.indexOf(b.id));
    state.boards = boardInfos.map((board) => {
      const previous = state.boards.find((item) => item.id === board.id);
      return { ...(previous || emptyBoard(board.id, board.title)), title: board.title, loading: true, error: "" };
    });
    render();
    const summaries = await Promise.all(state.boards.map(async (board) => {
      try {
        const payload = await fetchJson<BoardPayload>(`${API_ROOT}/json/boards/${board.id}/catalog`);
        const threads = sortThreads(payload.threads || []);
        return summarizeBoard({ ...board, loading: false, error: "", threads });
      } catch (error) {
        return { ...board, loading: false, error: errorMessage(error), threads: [] };
      }
    }));
    if (!lifecycleActive()) return;
    state.boards = summaries.sort((a, b) => {
      if (a.id === "all") return 1;
      if (b.id === "all") return -1;
      return b.activeScore - a.activeScore || DEFAULT_BOARDS.indexOf(a.id) - DEFAULT_BOARDS.indexOf(b.id);
    });
    state.lastLoadedAt = Date.now();
  } catch (error) {
    if (lifecycleActive()) state.error = errorMessage(error);
  } finally {
    state.loadingBoards = false;
    if (lifecycleActive()) render();
  }
}

async function openBoard(boardId: string, force = false): Promise<void> {
  if (!lifecycleActive()) return;
  state.selectedBoard = boardId;
  state.view = "threads";
  state.selectedThread = null;
  const summary = state.boards.find((board) => board.id === boardId);
  if (!force && summary?.threads.length) {
    render();
    return;
  }
  state.loadingThreads = true;
  state.error = "";
  render();
  try {
    const payload = await fetchJson<BoardPayload>(`${API_ROOT}/json/boards/${boardId}/catalog`);
    if (!lifecycleActive()) return;
    const threads = sortThreads(payload.threads || []);
    state.boards = upsertBoard(state.boards, summarizeBoard({
      ...(summary || emptyBoard(boardId, boardId)),
      loading: false,
      error: "",
      threads,
    }));
  } catch (error) {
    if (lifecycleActive()) state.error = errorMessage(error);
  } finally {
    state.loadingThreads = false;
    if (lifecycleActive()) render();
  }
}

async function openThread(boardId: string, threadId: number, force = false): Promise<void> {
  if (!lifecycleActive()) return;
  const existing = state.selectedThread?.id === threadId ? state.selectedThread : null;
  if (!force && existing?.posts !== null && existing?.posts !== undefined) {
    state.view = "thread";
    render();
    return;
  }
  state.view = "thread";
  state.loadingThread = true;
  state.error = "";
  const summary = state.boards.find((board) => board.id === boardId);
  state.selectedThread = summary?.threads.find((thread) => thread.id === threadId) || existing;
  render();
  try {
    const thread = await fetchJson<ChanThread>(`${API_ROOT}/json/boards/${boardId}/${threadId}`);
    if (!lifecycleActive()) return;
    state.selectedThread = thread;
  } catch (error) {
    if (lifecycleActive()) state.error = errorMessage(error);
  } finally {
    state.loadingThread = false;
    if (lifecycleActive()) render();
  }
}

function render(): void {
  const root = state.root;
  if (!root) {
    updateDockState();
    return;
  }
  root.dataset.side = state.side;
  root.dataset.minimized = String(state.minimized);
  root.dataset.boardTheme = activeBoardTheme();
  updateDockState();
  const status = root.querySelector<HTMLElement>('[data-role="status"]');
  const back = root.querySelector<HTMLButtonElement>('[data-role="back"]');
  const error = root.querySelector<HTMLElement>('[data-role="error"]');
  const body = root.querySelector<HTMLElement>('[data-role="body"]');
  const minimize = root.querySelector<HTMLButtonElement>('[data-role="minimize"]');
  if (!body || !status || !back || !error || !minimize) return;
  minimize.textContent = state.minimized ? "□" : "_";
  back.disabled = state.view === "boards" || state.minimized;
  status.textContent = statusText();
  error.hidden = !state.error;
  error.textContent = state.error;
  body.textContent = "";
  if (state.minimized) return;
  if (state.view === "thread") renderThread(body);
  else if (state.view === "threads") renderThreads(body);
  else renderBoards(body);
}

function closePanel(): void {
  state.open = false;
  state.minimized = true;
  const root = state.root;
  state.root = null;
  updateDockState();
  animateOverlayAppClose(root, () => root?.remove());
}

function updateDockState(): void {
  state.appFrame?.updateDock();
}

function renderBoards(body: HTMLElement): void {
  const list = document.createElement("div");
  list.className = "milxdy-chan-board-list";
  if (state.loadingBoards) list.append(loadingState("Loading boards"));
  for (const board of state.boards) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "milxdy-chan-board";
    button.dataset.boardTheme = boardTheme(board.id);
    button.disabled = board.loading;
    button.addEventListener("click", () => void openBoard(board.id));
    const title = document.createElement("strong");
    title.textContent = `/${board.id}/`;
    const subtitle = document.createElement("span");
    subtitle.textContent = board.loading
      ? "Loading..."
      : board.error
        ? board.error
        : `${board.threads.length} threads · ${board.connected} connected · ${board.activeScore} active`;
    const label = document.createElement("em");
    label.textContent = board.title;
    button.append(title, label, subtitle);
    list.append(button);
  }
  body.append(list);
}

function renderThreads(body: HTMLElement): void {
  const board = state.boards.find((item) => item.id === state.selectedBoard);
  const header = document.createElement("div");
  header.className = "milxdy-chan-section-header";
  header.dataset.boardTheme = boardTheme(state.selectedBoard);
  header.textContent = `/${state.selectedBoard}/ ${board?.title || ""}`;
  body.append(header);
  if (state.loadingThreads) body.append(loadingState(`Loading /${state.selectedBoard}/ threads`));
  if (state.loadingThreads && !board?.threads.length) {
    return;
  }
  const list = document.createElement("div");
  list.className = "milxdy-chan-thread-list";
  for (const thread of board?.threads || []) {
    list.append(createThreadButton(thread));
  }
  body.append(list.children.length ? list : emptyState("No threads returned."));
}

function createThreadButton(thread: ChanThread): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "milxdy-chan-thread";
  button.dataset.boardTheme = boardTheme(thread.board);
  button.addEventListener("click", () => void openThread(thread.board, thread.id));
  const thumb = imageUrl(thread.image, "thumb");
  if (thumb) {
    const image = document.createElement("img");
    image.src = thumb;
    image.alt = "";
    image.loading = "lazy";
    button.append(image);
  }
  const copy = document.createElement("span");
  copy.className = "milxdy-chan-thread-copy";
  const title = document.createElement("strong");
  title.textContent = thread.subject || `No. ${thread.id}`;
  const body = document.createElement("span");
  body.textContent = compactText(thread.body);
  const meta = document.createElement("em");
  meta.textContent = `${thread.post_count}p · ${thread.image_count}i · ${thread.unique_posters || 0} users · ${relativeTime(thread.update_time)}`;
  copy.append(title, body, meta);
  button.append(copy);
  return button;
}

function renderThread(body: HTMLElement): void {
  const thread = state.selectedThread;
  if (state.loadingThread && !thread) {
    body.append(loadingState("Loading thread"));
    return;
  }
  if (!thread) {
    body.append(emptyState("No thread selected."));
    return;
  }
  const header = document.createElement("div");
  header.className = "milxdy-chan-thread-title";
  header.dataset.boardTheme = boardTheme(thread.board);
  const title = document.createElement("strong");
  title.textContent = thread.subject || `No. ${thread.id}`;
  const link = document.createElement("a");
  link.href = `${API_ROOT}/${thread.board}/${thread.id}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = `/${thread.board}/${thread.id}`;
  header.append(title, link);
  body.append(header);
  if (state.loadingThread) body.append(loadingState("Loading posts"));
  const posts = [thread, ...(thread.posts || [])];
  const list = document.createElement("div");
  list.className = "milxdy-chan-post-list";
  for (const post of posts) list.append(createPost(post, thread.board));
  body.append(list);
}

function createPost(post: ChanPost, fallbackBoard: string): HTMLElement {
  const article = document.createElement("div");
  article.className = "milxdy-chan-post";
  article.dataset.boardTheme = boardTheme(post.board || fallbackBoard);
  const meta = document.createElement("header");
  const author = document.createElement("strong");
  author.textContent = post.user?.displayname || post.name || "milady";
  const id = document.createElement("span");
  id.textContent = `No. ${post.id} · ${relativeTime(post.time)}`;
  meta.append(author, id);
  article.append(meta);
  const media = createMedia(post.image, post.board || fallbackBoard, post.id);
  if (media) article.append(media);
  if (post.body) {
    const text = document.createElement("p");
    text.textContent = post.body;
    article.append(text);
  }
  return article;
}

function createMedia(image: ChanImage | null | undefined, board: string, postId: number): HTMLElement | null {
  const thumb = imageUrl(image, "thumb");
  const src = imageUrl(image, "src");
  if (!thumb && !src) return null;
  const link = document.createElement("a");
  link.className = "milxdy-chan-media";
  link.href = src || `${API_ROOT}/${board}/${postId}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  const fileType = fileExtension(image?.file_type);
  if (thumb && fileType !== "mp3" && fileType !== "flac") {
    const img = document.createElement("img");
    img.src = thumb;
    img.alt = "";
    img.loading = "lazy";
    link.append(img);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = fileType ? fileType.toUpperCase() : "FILE";
    link.append(fallback);
  }
  return link;
}

function emptyState(text: string): HTMLElement {
  const node = document.createElement("div");
  node.className = "milxdy-chan-empty";
  node.textContent = text;
  return node;
}

function loadingState(text: string): HTMLElement {
  const node = document.createElement("div");
  node.className = "milxdy-chan-loading";
  const indicator = document.createElement("span");
  indicator.setAttribute("aria-hidden", "true");
  const label = document.createElement("strong");
  label.textContent = text;
  node.append(indicator, label);
  return node;
}

function summarizeBoard(board: BoardSummary): BoardSummary {
  return {
    ...board,
    activeScore: board.threads.reduce((sum, thread) => sum + (thread.activity || 0), 0),
    connected: board.threads.reduce((sum, thread) => sum + (thread.connected || 0), 0),
    latestUpdate: Math.max(0, ...board.threads.map((thread) => thread.update_time || 0)),
  };
}

function emptyBoard(id: string, title: string): BoardSummary {
  return { id, title, loading: false, error: "", threads: [], activeScore: 0, connected: 0, latestUpdate: 0 };
}

function upsertBoard(boards: BoardSummary[], next: BoardSummary): BoardSummary[] {
  const found = boards.some((board) => board.id === next.id);
  return found ? boards.map((board) => board.id === next.id ? next : board) : [...boards, next];
}

function sortThreads(threads: ChanThread[]): ChanThread[] {
  return [...threads].sort((a, b) => {
    const stickyDelta = Number(Boolean(b.sticky)) - Number(Boolean(a.sticky));
    if (stickyDelta) return stickyDelta;
    return (b.activity || 0) - (a.activity || 0)
      || (b.connected || 0) - (a.connected || 0)
      || (b.update_time || 0) - (a.update_time || 0);
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await safeRuntimeMessage<{ ok?: boolean; status?: number; error?: string; data?: unknown }>({
    type: "miladychan:fetchJson",
    url,
  });
  if (!response) throw new Error("Extension fetch unavailable.");
  if (!response.ok) throw new Error(response.error || `HTTP ${response.status || 0}`);
  return response.data as T;
}

function imageUrl(image: ChanImage | null | undefined, kind: "thumb" | "src"): string {
  if (!image?.sha1) return "";
  const type = kind === "thumb" ? image.thumb_type : image.file_type;
  const extension = fileExtension(type);
  if (!extension || extension === "noFile") return "";
  return `${API_ROOT}/assets/images/${kind}/${image.sha1}.${extension}`;
}

function fileExtension(type: number | undefined): string {
  if (type === undefined || type < 0 || type >= FILE_TYPES.length) return "";
  return FILE_TYPES[type] || "";
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160) || "No body";
}

function relativeTime(seconds: number): string {
  if (!seconds) return "unknown";
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (delta < 60) return "now";
  const minute = Math.floor(delta / 60);
  if (minute < 60) return `${minute}m`;
  const hour = Math.floor(minute / 60);
  if (hour < 24) return `${hour}h`;
  return `${Math.floor(hour / 24)}d`;
}

function statusText(): string {
  if (state.loadingBoards) return "Loading boards";
  if (state.loadingThreads) return `Loading /${state.selectedBoard}/`;
  if (state.loadingThread) return "Loading thread";
  if (state.view === "thread" && state.selectedThread) return `/${state.selectedThread.board}/ No. ${state.selectedThread.id}`;
  if (state.view === "threads") return `/${state.selectedBoard}/`;
  return "Active boards";
}

function activeBoardTheme(): BoardTheme {
  if (state.view === "thread" && state.selectedThread) return boardTheme(state.selectedThread.board);
  if (state.view === "threads") return boardTheme(state.selectedBoard);
  return "tea";
}

function boardTheme(boardId: string): BoardTheme {
  return BOARD_THEME_BY_BOARD[boardId] || "tea";
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Request timed out.";
  return error instanceof Error ? error.message : "Request failed.";
}

function normalizeTheme(value: unknown): SpotlightState["theme"] {
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
  registerOverlayAppRoot("miladychanSpotlight", root);
  const box = clampOverlayPanelBox(panelBox(), { minWidth: 320, minHeight: 340, dockSide: state.side });
  state.x = box.x ?? state.x;
  state.width = box.width;
  state.height = box.height;
  state.topOffset = box.topOffset;
  root.style.left = `${state.x}px`;
  root.style.right = "auto";
  root.style.setProperty("--mc-width", `${state.width}px`);
  root.style.setProperty("--mc-height", `${state.height}px`);
  root.style.setProperty("--mc-top", `${state.topOffset}px`);
  markOverlayAppLayoutReady(root, state.layoutReady);
}

function startDrag(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("button, a, input, textarea, select, [data-role='resize']")) return;
  const root = state.root;
  if (!root) return;
  root.dataset.dragging = "true";
  startOverlayPanelDrag(event, {
    ...panelPointerOptions(),
    appId: "miladychanSpotlight",
    root,
    disabled: () => state.minimized,
    persist: (box) => {
      root.dataset.dragging = "false";
      void chrome.storage.local.set({ [TOP_KEY]: box.topOffset });
    },
  });
}

function startResize(event: PointerEvent): void {
  const root = state.root;
  if (!root) return;
  const axis = resizeAxis(event.currentTarget);
  startOverlayPanelResize(event, {
    ...panelPointerOptions(),
    appId: "miladychanSpotlight",
    root,
    disabled: () => state.minimized,
    persist: (box) => {
      void chrome.storage.local.set({ [WIDTH_KEY]: box.width, [HEIGHT_KEY]: box.height });
    },
  }, axis);
}

function resizeAxis(target: EventTarget | null): "both" | "x" | "y" {
  if (!(target instanceof HTMLElement)) return "both";
  return target.dataset.resizeAxis === "x" || target.dataset.resizeAxis === "y" ? target.dataset.resizeAxis : "both";
}

function panelPointerOptions() {
  return {
    minWidth: 320,
    minHeight: 340,
    side: () => state.side,
    box: panelBox,
    setBox: (box: Partial<ReturnType<typeof panelBox>>) => {
      if (box.x !== undefined) state.x = box.x;
      if (box.width !== undefined) state.width = box.width;
      if (box.height !== undefined) state.height = box.height;
      if (box.topOffset !== undefined) state.topOffset = box.topOffset;
    },
    apply: applyLayout,
    persist: () => undefined,
  };
}

function clampTopOffset(value: number): number {
  return clampOverlayPanelBox({ ...panelBox(), topOffset: value }, { minWidth: 320, minHeight: 340, dockSide: state.side }).topOffset;
}

function clampWidth(value: number): number {
  return clampOverlayPanelBox({ ...panelBox(), width: value }, { minWidth: 320, minHeight: 340, dockSide: state.side }).width;
}

function clampHeight(value: number): number {
  return clampOverlayPanelBox({ ...panelBox(), height: value }, { minWidth: 320, minHeight: 340, dockSide: state.side }).height;
}

function panelBox() {
  return { x: state.x, width: state.width, height: state.height, topOffset: state.topOffset };
}
