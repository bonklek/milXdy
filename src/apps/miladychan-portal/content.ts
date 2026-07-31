import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../platform/overlay/app-chrome";
import {
  createOverlayAppFrame,
  type OverlayAppFrame,
} from "../../platform/overlay/app-frame";
import {
  clampOverlayPanelBox,
  observeOverlayPanelTheme,
  resolveOverlayPanelTheme,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
  startOverlayPanelResize,
} from "../../platform/overlay/panel-base";
import { registerOverlayAppRoot } from "../../platform/overlay/app-layout";
import type { MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";
import type { OverlayDockSide } from "../../platform/overlay/dock";
import {
  DEFAULT_MEDIA_DISCOVERY_BOARDS,
  IDENTITY_PROVENANCE_POLICY,
  MEDIA_POST_MARKER,
  parseTaggedMediaPost,
} from "./media-post-schema";

const ROOT_ID = "milxdy-miladychan-root";
const API_ROOT = "https://boards.miladychan.org";
const DOCK_ICON_PATH = "miladychanSpotlight/notification-icon.png";
const STYLE_THEME_KEY = "milxdy.settings.theme";
const WIDTH_KEY = "milxdy.miladychan.width";
const HEIGHT_KEY = "milxdy.miladychan.height";
const TOP_KEY = "milxdy.miladychan.top";
const DRAFT_KEY = "milxdy.miladychan.postDraft";
const WATCHED_THREADS_KEY = "milxdy.miladychan.watchedThreads";
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
const MEDIA_POST_GROUNDWORK = Object.freeze({
  marker: MEDIA_POST_MARKER,
  defaultBoards: DEFAULT_MEDIA_DISCOVERY_BOARDS,
  identityPolicy: IDENTITY_PROVENANCE_POLICY,
  parse: parseTaggedMediaPost,
});

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

type PostDraft = {
  board: string;
  threadId: number | null;
  name: string;
  subject: string;
  body: string;
  updatedAt: number;
};

type WatchedThread = {
  board: string;
  threadId: number;
  title: string;
  watchedAt: number;
  seenPostCount: number | null;
  latestPostCount: number | null;
};

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
  drafts: PostDraft[];
  watchedThreads: WatchedThread[];
  draftNotice: string;
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
  drafts: [],
  watchedThreads: [],
  draftNotice: "",
};
let booted = false;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;
let lifecycleSignal: AbortSignal | null = null;
let appSdkSendMessage: MilxdyContentAppContext["sendMessage"] | null = null;
let boardsGeneration = 0;
let boardGeneration = 0;
let threadGeneration = 0;
let highlightedPost: HTMLElement | null = null;
let postHighlightTimer: number | null = null;

export function boot(context?: MilxdyContentAppContext): void {
  if (booted) return;
  booted = true;
  lifecycleSignal = context?.signal || null;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  appSdkSendMessage = context?.sendMessage || null;
  ensureOverlayAppChromeStyles();
  registerDockItem();
  void loadLayoutSettings();
  void loadTheme();
  void loadDraft();
  void loadWatchedThreads();
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
  boardsGeneration += 1;
  boardGeneration += 1;
  threadGeneration += 1;
  disable();
  state.appFrame?.remove();
  state.appFrame = null;
  state.root?.remove();
  state.root = null;
  addRuntimeDisposable = () => undefined;
  appSdkSendMessage = null;
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

async function loadDraft(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(DRAFT_KEY).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.drafts = normalizeDrafts(stored[DRAFT_KEY]);
  render();
}

async function loadWatchedThreads(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(WATCHED_THREADS_KEY).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.watchedThreads = normalizeWatchedThreads(stored[WATCHED_THREADS_KEY]);
  render();
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
  root.dataset.mediaPostSchema = MEDIA_POST_GROUNDWORK.marker;
  root.dataset.mediaDiscoveryBoards = String(MEDIA_POST_GROUNDWORK.defaultBoards.length);
  root.dataset.mediaIdentityProvenance = MEDIA_POST_GROUNDWORK.identityPolicy.publicPost;
  root.dataset.mediaPostParser = String(typeof MEDIA_POST_GROUNDWORK.parse === "function");
  root.innerHTML = `
    <div class="milxdy-chan-card milxdy-overlay-app-card">
      <header class="milxdy-chan-header milxdy-overlay-app-header">
        <div>
          <strong>Miladychan</strong>
          <span data-role="status">Boards</span>
        </div>
        <div class="milxdy-chan-header-actions">
          <button type="button" data-role="back" title="Back">‹</button>
          <button type="button" data-role="open-native" title="Open in new tab" aria-label="Open Miladychan in new tab">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h6v6M10 14 20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg>
          </button>
          <button type="button" data-role="refresh" title="Refresh">↻</button>
          <button type="button" data-role="minimize" title="Minimize">_</button>
        </div>
      </header>
      <div class="milxdy-chan-error" data-role="error" hidden></div>
      <main class="milxdy-chan-body" data-role="body"></main>
      <div class="milxdy-chan-resize-grip milxdy-chan-resize-grip-left" data-role="resize" data-resize-axis="both" data-resize-side="left" title="Drag to resize"></div>
      <div class="milxdy-chan-resize-grip milxdy-chan-resize-grip-right" data-role="resize" data-resize-axis="both" data-resize-side="right" title="Drag to resize"></div>
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
  root.querySelector<HTMLButtonElement>('[data-role="open-native"]')?.addEventListener("click", () => {
    window.open(currentNativePageUrl(), "_blank", "noopener,noreferrer");
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
  const generation = ++boardsGeneration;
  state.error = "";
  render();
  try {
    const boardList = await fetchJson<BoardInfo[]>(`${API_ROOT}/json/board-list`);
    if (!lifecycleActive() || generation !== boardsGeneration) return;
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
    if (!lifecycleActive() || generation !== boardsGeneration) return;
    state.boards = summaries.sort((a, b) => {
      if (a.id === "all") return 1;
      if (b.id === "all") return -1;
      return b.activeScore - a.activeScore || DEFAULT_BOARDS.indexOf(a.id) - DEFAULT_BOARDS.indexOf(b.id);
    });
    if (reconcileWatchedThreads(summaries.flatMap((board) => board.threads))) void saveWatchedThreads();
    state.lastLoadedAt = Date.now();
  } catch (error) {
    if (lifecycleActive() && generation === boardsGeneration) state.error = errorMessage(error);
  } finally {
    if (generation === boardsGeneration) state.loadingBoards = false;
    if (lifecycleActive() && generation === boardsGeneration) render();
  }
}

async function openBoard(boardId: string, force = false): Promise<void> {
  if (!lifecycleActive()) return;
  const generation = ++boardGeneration;
  threadGeneration += 1;
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
    if (!lifecycleActive() || generation !== boardGeneration || state.selectedBoard !== boardId) return;
    const threads = sortThreads(payload.threads || []);
    state.boards = upsertBoard(state.boards, summarizeBoard({
      ...(summary || emptyBoard(boardId, boardId)),
      loading: false,
      error: "",
      threads,
    }));
    if (reconcileWatchedThreads(threads)) void saveWatchedThreads();
  } catch (error) {
    if (lifecycleActive() && generation === boardGeneration) state.error = errorMessage(error);
  } finally {
    if (generation === boardGeneration) state.loadingThreads = false;
    if (lifecycleActive() && generation === boardGeneration) render();
  }
}

async function openThread(boardId: string, threadId: number, force = false): Promise<void> {
  if (!lifecycleActive()) return;
  const generation = ++threadGeneration;
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
    if (!lifecycleActive() || generation !== threadGeneration || state.selectedThread?.id !== threadId) return;
    state.selectedThread = thread;
    if (markWatchedThreadRead(boardId, threadId, thread.post_count)) void saveWatchedThreads();
  } catch (error) {
    if (lifecycleActive() && generation === threadGeneration) state.error = errorMessage(error);
  } finally {
    if (generation === threadGeneration) state.loadingThread = false;
    if (lifecycleActive() && generation === threadGeneration) render();
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
  const backBoard = state.view === "thread" && state.selectedThread ? state.selectedThread.board : null;
  back.textContent = backBoard ? `← /${backBoard}/` : "‹";
  back.title = backBoard ? `Back to /${backBoard}/` : "Back";
  back.setAttribute("aria-label", back.title);
  back.classList.toggle("milxdy-chan-board-back", Boolean(backBoard));
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
  const freshPosts = freshWatchedPostCount();
  state.appFrame?.updateDock({
    badgeText: freshPosts ? String(freshPosts) : "",
    title: freshPosts === 1 ? "Miladychan: 1 fresh watched post" : freshPosts ? `Miladychan: ${freshPosts} fresh watched posts` : "Miladychan",
  });
}

function currentNativePageUrl(): string {
  if (state.view === "thread" && state.selectedThread) return nativeDestinationUrl(state.selectedThread.board, state.selectedThread.id);
  if (state.view === "threads") return nativeDestinationUrl(state.selectedBoard, null);
  return API_ROOT;
}

function renderBoards(body: HTMLElement): void {
  if (state.watchedThreads.length) {
    const watched = document.createElement("section");
    watched.className = "milxdy-chan-watched";
    const heading = document.createElement("strong");
    heading.textContent = "Watched threads";
    const list = document.createElement("div");
    list.className = "milxdy-chan-watched-list";
    for (const thread of state.watchedThreads) {
      const item = document.createElement("div");
      item.className = "milxdy-chan-watched-item";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "milxdy-chan-watched-open";
      open.textContent = `/${thread.board}/ ${thread.title || `No. ${thread.threadId}`}`;
      open.title = `Open /${thread.board}/ No. ${thread.threadId}`;
      open.addEventListener("click", () => void openThread(thread.board, thread.threadId));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "milxdy-chan-watched-remove";
      remove.textContent = "Unwatch";
      remove.setAttribute("aria-label", `Unwatch /${thread.board}/ No. ${thread.threadId}`);
      remove.addEventListener("click", () => void unwatchThread(thread.board, thread.threadId));
      item.append(open, remove);
      list.append(item);
    }
    watched.append(heading, list);
    body.append(watched);
  }
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
  body.append(createPostHandoff(state.selectedBoard, null));
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
  const titleRow = document.createElement("div");
  titleRow.className = "milxdy-chan-thread-title-row";
  const link = document.createElement("a");
  link.href = `${API_ROOT}/${thread.board}/${thread.id}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = `/${thread.board}/${thread.id}`;
  const jumpToBottom = document.createElement("button");
  jumpToBottom.type = "button";
  jumpToBottom.className = "milxdy-chan-jump-bottom";
  jumpToBottom.title = "Jump to bottom";
  jumpToBottom.setAttribute("aria-label", "Jump to bottom");
  const jumpArrow = document.createElement("span");
  jumpArrow.textContent = "↓";
  jumpArrow.setAttribute("aria-hidden", "true");
  const jumpLabel = document.createElement("span");
  jumpLabel.textContent = "JUMP";
  jumpToBottom.append(jumpArrow, jumpLabel);
  jumpToBottom.addEventListener("click", () => body.scrollTo({ top: body.scrollHeight, behavior: "smooth" }));
  const controls = document.createElement("div");
  controls.className = "milxdy-chan-thread-controls";
  const watch = document.createElement("button");
  watch.type = "button";
  watch.className = "milxdy-chan-watch-thread";
  const isWatched = watchedThread(thread.board, thread.id) !== null;
  watch.textContent = isWatched ? "Watching" : "Watch this thread";
  watch.setAttribute("aria-pressed", String(isWatched));
  watch.addEventListener("click", () => void toggleWatchedThread(thread));
  const boardBack = document.createElement("button");
  boardBack.type = "button";
  boardBack.className = "milxdy-chan-thread-board-back";
  boardBack.textContent = "↖";
  boardBack.title = `Back to /${thread.board}/`;
  boardBack.setAttribute("aria-label", boardBack.title);
  boardBack.addEventListener("click", () => void openBoard(thread.board));
  controls.append(watch, boardBack, jumpToBottom);
  titleRow.append(title, controls);
  header.append(titleRow, link);
  body.append(header);
  body.append(createPostHandoff(thread.board, thread.id));
  if (state.loadingThread) body.append(loadingState("Loading posts"));
  const posts = [thread, ...(thread.posts || [])];
  const list = document.createElement("div");
  list.className = "milxdy-chan-post-list";
  for (const post of posts) list.append(createPost(post, thread.board));
  body.append(list);
  body.append(createPostHandoff(thread.board, thread.id, "bottom"));
  const jumpToTop = document.createElement("button");
  jumpToTop.type = "button";
  jumpToTop.className = "milxdy-chan-jump-top";
  jumpToTop.title = "Jump to top";
  jumpToTop.setAttribute("aria-label", "Jump to top");
  const topArrow = document.createElement("span");
  topArrow.textContent = "↑";
  topArrow.setAttribute("aria-hidden", "true");
  const topLabel = document.createElement("span");
  topLabel.textContent = "JUMP";
  jumpToTop.append(topArrow, topLabel);
  jumpToTop.addEventListener("click", () => body.scrollTo({ top: 0, behavior: "smooth" }));
  body.append(jumpToTop);
}

function createPostHandoff(board: string, threadId: number | null, position: "top" | "bottom" = "top"): HTMLElement {
  const form = document.createElement("section");
  form.className = "milxdy-chan-compose";
  form.dataset.boardTheme = boardTheme(board);
  form.dataset.threadId = threadId === null ? "" : String(threadId);
  form.dataset.composePosition = position;
  const destination = threadId === null ? `New thread in /${board}/` : `Reply in /${board}/ No. ${threadId}`;
  const heading = document.createElement("strong");
  heading.textContent = "Post to Miladychan";
  const target = document.createElement("span");
  target.className = "milxdy-chan-compose-target";
  target.textContent = `Destination: ${destination}`;
  const note = document.createElement("p");
  note.textContent = "Submit text anonymously without using a Miladychan, RemiNet, wallet, or extension session. Media, CAPTCHA, and unsupported board requirements stay on native Miladychan.";
  const name = document.createElement("input");
  name.type = "text";
  name.className = "milxdy-chan-compose-subject";
  name.placeholder = "Poster name";
  name.value = draftForDestination(board, threadId)?.name || "milXdy";
  name.maxLength = 100;
  name.setAttribute("aria-label", `Poster name for ${destination}`);
  const subject = document.createElement("input");
  subject.type = "text";
  subject.className = "milxdy-chan-compose-subject";
  subject.placeholder = "Thread subject";
  subject.value = draftForDestination(board, threadId)?.subject || "";
  subject.maxLength = 200;
  subject.hidden = threadId !== null;
  subject.setAttribute("aria-label", `Subject for ${destination}`);
  const textarea = document.createElement("textarea");
  textarea.placeholder = "Write a post…";
  textarea.value = draftForDestination(board, threadId)?.body || "";
  textarea.rows = 1;
  textarea.setAttribute("aria-label", `Post for ${destination}`);
  const actions = document.createElement("div");
  actions.className = "milxdy-chan-compose-actions";
  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "milxdy-chan-compose-submit";
  submit.textContent = "Post";
  const notice = document.createElement("span");
  notice.className = "milxdy-chan-compose-notice";
  notice.textContent = state.draftNotice;
  const updateActions = () => {
    submit.disabled = !textarea.value.trim() || (threadId === null && !subject.value.trim());
  };
  textarea.addEventListener("input", () => {
    resizePostTextarea(textarea);
    updateActions();
  });
  name.addEventListener("input", updateActions);
  subject.addEventListener("input", updateActions);
  submit.addEventListener("click", () => {
    const poster = name.value.trim() || "anonymous";
    if (!window.confirm(`Post as ${poster} to ${destination}?`)) return;
    void submitDraft({ board, threadId, name: name.value, subject: subject.value, body: textarea.value }, submit, notice);
  });
  actions.append(submit);
  form.append(heading, target, note, name, subject, textarea, actions, notice);
  updateActions();
  requestAnimationFrame(() => resizePostTextarea(textarea));
  return form;
}

function resizePostTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  const styles = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 18;
  const verticalChrome = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    + Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);
  const tenLineHeight = Math.ceil((lineHeight * 10) + verticalChrome);
  const panelHeight = textarea.closest<HTMLElement>(".milxdy-chan-body")?.clientHeight || tenLineHeight;
  const maxHeight = Math.max(38, Math.min(tenLineHeight, Math.floor(panelHeight * 0.45)));
  const desiredHeight = Math.max(38, textarea.scrollHeight);
  textarea.style.height = `${Math.min(desiredHeight, maxHeight)}px`;
  textarea.style.overflowY = desiredHeight > maxHeight ? "auto" : "hidden";
}

async function submitDraft(draft: Omit<PostDraft, "updatedAt">, submit: HTMLButtonElement, notice: HTMLElement): Promise<void> {
  if (!appSdkSendMessage) {
    await saveFailedDraft(draft);
    notice.textContent = "Extension posting is unavailable. Your local post was kept.";
    return;
  }
  submit.disabled = true;
  notice.textContent = "Posting to the confirmed destination…";
  const response = await appSdkSendMessage<{ ok?: boolean; status?: number; error?: string }>({
    type: "miladychan:postText",
    destination: { board: draft.board, threadId: draft.threadId },
    name: draft.name,
    subject: draft.threadId === null ? draft.subject : undefined,
    body: draft.body,
  }, "miladychan:postText").catch(() => undefined);
  if (response?.ok) {
    state.draftNotice = "Posted. Refresh the board or thread to see the result.";
    await clearFailedDraft(draft.board, draft.threadId);
    render();
    return;
  }
  await saveFailedDraft(draft);
  state.draftNotice = response?.error || "Submission failed. Your local draft was kept.";
  notice.textContent = state.draftNotice;
  submit.disabled = false;
}

function draftForDestination(board: string, threadId: number | null): PostDraft | null {
  return state.drafts.find((draft) => draft.board === board && draft.threadId === threadId) || null;
}

async function saveFailedDraft(draft: Omit<PostDraft, "updatedAt">): Promise<void> {
  state.drafts = [...state.drafts.filter((current) => current.board !== draft.board || current.threadId !== draft.threadId), { ...draft, updatedAt: Date.now() }];
  await chrome.storage.local.set({ [DRAFT_KEY]: { version: 1, drafts: state.drafts } }).catch(() => undefined);
}

async function clearFailedDraft(board: string, threadId: number | null): Promise<void> {
  if (!draftForDestination(board, threadId)) return;
  state.drafts = state.drafts.filter((draft) => draft.board !== board || draft.threadId !== threadId);
  if (state.drafts.length) await chrome.storage.local.set({ [DRAFT_KEY]: { version: 1, drafts: state.drafts } }).catch(() => undefined);
  else await chrome.storage.local.remove(DRAFT_KEY).catch(() => undefined);
}

function watchedThread(board: string, threadId: number): WatchedThread | null {
  return state.watchedThreads.find((thread) => thread.board === board && thread.threadId === threadId) || null;
}

async function toggleWatchedThread(thread: ChanThread): Promise<void> {
  if (watchedThread(thread.board, thread.id)) {
    await unwatchThread(thread.board, thread.id);
    return;
  }
  state.watchedThreads = [{
    board: thread.board,
    threadId: thread.id,
    title: thread.subject || `No. ${thread.id}`,
    watchedAt: Date.now(),
    seenPostCount: thread.post_count,
    latestPostCount: thread.post_count,
  }, ...state.watchedThreads];
  await saveWatchedThreads();
  render();
}

async function unwatchThread(board: string, threadId: number): Promise<void> {
  state.watchedThreads = state.watchedThreads.filter((thread) => thread.board !== board || thread.threadId !== threadId);
  await saveWatchedThreads();
  render();
}

async function saveWatchedThreads(): Promise<void> {
  if (state.watchedThreads.length) {
    await chrome.storage.local.set({ [WATCHED_THREADS_KEY]: { version: 1, threads: state.watchedThreads } }).catch(() => undefined);
  } else {
    await chrome.storage.local.remove(WATCHED_THREADS_KEY).catch(() => undefined);
  }
}

function normalizeWatchedThreads(value: unknown): WatchedThread[] {
  const candidates = value && typeof value === "object" && Array.isArray((value as { threads?: unknown }).threads)
    ? (value as { threads: unknown[] }).threads
    : [];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Partial<WatchedThread>;
    const threadId = raw.threadId;
    if (typeof raw.board !== "string" || !DEFAULT_BOARDS.includes(raw.board) || !Number.isInteger(threadId) || threadId === undefined || threadId <= 0) return [];
    const key = `${raw.board}/${threadId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      board: raw.board,
      threadId,
      title: typeof raw.title === "string" ? raw.title.slice(0, 200) : `No. ${threadId}`,
      watchedAt: Number.isFinite(raw.watchedAt) ? Number(raw.watchedAt) : 0,
      seenPostCount: nonNegativeInteger(raw.seenPostCount),
      latestPostCount: nonNegativeInteger(raw.latestPostCount),
    }];
  }).sort((left, right) => right.watchedAt - left.watchedAt);
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function reconcileWatchedThreads(threads: ChanThread[]): boolean {
  let changed = false;
  const counts = new Map(threads.map((thread) => [`${thread.board}/${thread.id}`, thread.post_count]));
  state.watchedThreads = state.watchedThreads.map((watched) => {
    const postCount = counts.get(`${watched.board}/${watched.threadId}`);
    if (postCount === undefined) return watched;
    if (watched.latestPostCount === null || watched.seenPostCount === null) {
      changed = true;
      return { ...watched, seenPostCount: postCount, latestPostCount: postCount };
    }
    if (watched.latestPostCount === postCount) return watched;
    changed = true;
    return { ...watched, latestPostCount: postCount };
  });
  return changed;
}

function markWatchedThreadRead(board: string, threadId: number, postCount: number): boolean {
  let changed = false;
  state.watchedThreads = state.watchedThreads.map((watched) => {
    if (watched.board !== board || watched.threadId !== threadId) return watched;
    if (watched.seenPostCount === postCount && watched.latestPostCount === postCount) return watched;
    changed = true;
    return { ...watched, seenPostCount: postCount, latestPostCount: postCount };
  });
  return changed;
}

function freshWatchedPostCount(): number {
  return state.watchedThreads.reduce((total, watched) => total + Math.max(0, (watched.latestPostCount ?? 0) - (watched.seenPostCount ?? 0)), 0);
}

function nativeDestinationUrl(board: string, threadId: number | null): string {
  return threadId === null ? `${API_ROOT}/${board}/` : `${API_ROOT}/${board}/${threadId}`;
}

function normalizeDrafts(value: unknown): PostDraft[] {
  if (Array.isArray(value)) return value.map(normalizeDraft).filter((draft): draft is PostDraft => draft !== null);
  if (value && typeof value === "object" && Array.isArray((value as { drafts?: unknown }).drafts)) {
    return (value as { drafts: unknown[] }).drafts.map(normalizeDraft).filter((draft): draft is PostDraft => draft !== null);
  }
  const legacyDraft = normalizeDraft(value);
  return legacyDraft ? [legacyDraft] : [];
}

function normalizeDraft(value: unknown): PostDraft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PostDraft>;
  if (typeof raw.board !== "string" || !raw.board || typeof raw.body !== "string") return null;
  const candidateThreadId = raw.threadId;
  const threadId: number | null = candidateThreadId === null
    ? null
    : typeof candidateThreadId === "number" && Number.isInteger(candidateThreadId) && candidateThreadId > 0
      ? candidateThreadId
      : null;
  return {
    board: raw.board,
    threadId,
    name: typeof raw.name === "string" ? raw.name.slice(0, 100) : "milXdy",
    subject: typeof raw.subject === "string" ? raw.subject.slice(0, 200) : "",
    body: raw.body,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : 0,
  };
}

function createPost(post: ChanPost, fallbackBoard: string): HTMLElement {
  const article = document.createElement("div");
  article.className = "milxdy-chan-post";
  article.dataset.boardTheme = boardTheme(post.board || fallbackBoard);
  article.dataset.postId = String(post.id);
  const meta = document.createElement("header");
  const author = document.createElement("strong");
  author.textContent = post.user?.displayname || post.name || "milady";
  const id = document.createElement("button");
  id.type = "button";
  id.className = "milxdy-chan-post-reply";
  id.textContent = `No. ${post.id} · ${relativeTime(post.time)}`;
  id.setAttribute("aria-label", `Reply to post ${post.id}`);
  id.addEventListener("click", () => focusReplyComposer(post.id));
  meta.append(author, id);
  article.append(meta);
  const media = createMedia(post.image, post.board || fallbackBoard, post.id);
  if (media) article.append(media);
  if (post.body) {
    article.append(createPostBody(post.body));
  }
  return article;
}

function createPostBody(body: string): HTMLElement {
  const text = document.createElement("p");
  const referencePattern = /(?<!>)>>(\d+)/gu;
  let cursor = 0;
  for (const match of body.matchAll(referencePattern)) {
    const index = match.index ?? cursor;
    if (index > cursor) text.append(document.createTextNode(body.slice(cursor, index)));
    const postId = Number(match[1]);
    const reference = document.createElement("button");
    reference.type = "button";
    reference.className = "milxdy-chan-post-reference";
    reference.textContent = match[0];
    reference.title = `Jump to No. ${postId}`;
    reference.setAttribute("aria-label", `Jump to post ${postId}`);
    reference.addEventListener("click", () => jumpToPost(postId));
    text.append(reference);
    cursor = index + match[0].length;
  }
  if (cursor < body.length) text.append(document.createTextNode(body.slice(cursor)));
  return text;
}

function jumpToPost(postId: number): void {
  if (!Number.isSafeInteger(postId) || postId <= 0) return;
  const post = state.root?.querySelector<HTMLElement>(`.milxdy-chan-post[data-post-id="${postId}"]`);
  if (!post) return;
  post.scrollIntoView({ block: "center", behavior: "smooth" });
  if (postHighlightTimer !== null) window.clearTimeout(postHighlightTimer);
  highlightedPost?.classList.remove("milxdy-chan-post-highlight");
  highlightedPost = post;
  post.classList.remove("milxdy-chan-post-highlight");
  void post.offsetWidth;
  post.classList.add("milxdy-chan-post-highlight");
  postHighlightTimer = window.setTimeout(() => {
    post.classList.remove("milxdy-chan-post-highlight");
    if (highlightedPost === post) highlightedPost = null;
    postHighlightTimer = null;
  }, 1_600);
}

function focusReplyComposer(postId: number): void {
  const compose = state.root?.querySelector<HTMLElement>(".milxdy-chan-compose[data-compose-position='bottom']")
    || state.root?.querySelector<HTMLElement>(".milxdy-chan-compose[data-thread-id]");
  const textarea = compose?.querySelector<HTMLTextAreaElement>("textarea");
  if (!compose || !textarea) return;
  const quote = `>>${postId}`;
  if (!textarea.value.split(/\r?\n/u).includes(quote)) {
    textarea.value = textarea.value.trim() ? `${textarea.value}\n${quote}\n` : `${quote}\n`;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  compose.scrollIntoView({ block: "center", behavior: "smooth" });
  textarea.focus();
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
  if (!appSdkSendMessage) throw new Error("Extension fetch unavailable.");
  const response = await appSdkSendMessage<{ ok?: boolean; status?: number; error?: string; data?: unknown }>({
    type: "miladychan:fetchJson",
    url,
  }, "miladychan:fetchJson");
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
  requestAnimationFrame(() => root.querySelectorAll<HTMLTextAreaElement>(".milxdy-chan-compose textarea").forEach(resizePostTextarea));
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
