import QRCode from "qrcode";
import jsQR from "jsqr";
import { ARTWORK_METADATA_VERSION, shouldReadEmbeddedArtwork } from "./artwork-cache";
import { PlaybackHistoryTracker } from "./playback-history";
import {
  createOverlayAppFrame,
  type OverlayAppFrame,
} from "../../platform/overlay/app-frame";
import {
  clampOverlayPanelBox,
  observeOverlayPanelTheme,
  type OverlayPanelBox,
  resolveOverlayPanelTheme,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
  startOverlayPanelResize,
} from "../../platform/overlay/panel-base";
import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../platform/overlay/app-chrome";
import { registerOverlayAppRoot } from "../../platform/overlay/app-layout";
import type { MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";
import type { OverlayDockSide } from "../../platform/overlay/dock";

const ROOT_ID = "milxdy-music-root";
const MUSIC_LOGO_PATH = "music/milxdy-music-logo.png";
const STYLE_THEME_KEY = "milxdy.settings.theme";
const WIDTH_KEY = "milxdy.music.width";
const HEIGHT_KEY = "milxdy.music.height";
const TOP_KEY = "milxdy.music.top";
const LIBRARY_MINIMIZED_KEY = "milxdy.music.libraryMinimized";
const AUTO_ACCEPT_ISRC_KEY = "milxdy.music.autoAcceptHighConfidenceIsrc";
const VOLUME_KEY = "milxdy.music.volume";
const DB_NAME = "milxdy-music";
const DB_VERSION = 1;
const SUPPORTED_EXTENSIONS = [".mp3", ".flac", ".m4a", ".ogg", ".wav"];
const KEYBOARD_ACTIVE_MS = 30_000;
const DUPLICATE_CONFIDENCE_MS = 2500;
const FULL_MIN_WIDTH = 340;
const FULL_MIN_HEIGHT = 350;
const COMPACT_MIN_WIDTH = 260;
const COMPACT_MIN_HEIGHT = 112;
const COMPACT_MAX_WIDTH = 340;
const COMPACT_DEFAULT_HEIGHT = 198;
const COMPACT_MAX_HEIGHT = COMPACT_DEFAULT_HEIGHT;
const COMPACT_HIDE_NOW_HEIGHT = 142;
const COMPACT_TIGHT_HEIGHT = 172;

type MusicTab = "library" | "queue" | "playlists" | "radio" | "settings";
type MusicSortKey = "default" | "artist" | "title" | "album" | "added";
type RepeatMode = "off" | "one" | "all";
type EnrichmentStatus = "pending" | "review" | "matched" | "unresolved" | "error";
const DEFAULT_REPEAT_MODE: RepeatMode = "all";

type MusicFolder = {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  addedAt: number;
  lastScannedAt: number | null;
  lastStatus?: "ready" | "permission-needed" | "missing" | "limited" | "error";
  lastError?: string;
};

type IsrcCandidate = {
  isrc: string;
  confidence: number;
  sources: Array<"embedded" | "musicbrainz" | "manual">;
  musicBrainzRecordingId?: string;
  title?: string;
  artist?: string;
  album?: string;
  durationDeltaMs?: number;
};

type IsrcEnrichmentState = {
  status: EnrichmentStatus;
  attempts: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  candidates: IsrcCandidate[];
  error?: string;
};

type MusicTrack = {
  id: string;
  source: "local" | "bundled";
  fileName: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
  artworkDataUrl?: string;
  artworkCheckedAt?: number;
  artworkMetadataVersion?: number;
  artworkFileLastModified?: number;
  artworkFileSize?: number;
  isrc: string | null;
  isrcConfidence: number;
  fileHandleKey: string;
  folderId: string;
  path: string;
  addedAt: number;
  lastIndexedAt: number;
  unavailable?: boolean;
  duplicateKey?: string;
  duplicateGroupSize?: number;
  enrichment: IsrcEnrichmentState;
};

const DEFAULT_ACHIEVEMENT_TRACK: MusicTrack = {
  id: "default-achievements-gods-remix",
  source: "bundled",
  fileName: "achievements-remilia-music.ogg",
  title: "God's Remix",
  artist: "Remilia",
  album: "Achievements",
  durationMs: null,
  artworkDataUrl: chrome.runtime.getURL("music/achievements-remilia-artwork-square.png"),
  isrc: null,
  isrcConfidence: 0,
  fileHandleKey: "achievements.remilia.org:gods-remix",
  folderId: "achievements.remilia.org",
  path: "music/achievements-remilia-music.ogg",
  addedAt: 0,
  lastIndexedAt: 0,
  enrichment: {
    status: "matched",
    attempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    candidates: [],
  },
};

type ParsedAudioMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  isrc?: string;
  artworkDataUrl?: string;
};

type MusicPlaylist = {
  id: string;
  name: string;
  description: string;
  trackRefs: Array<{
    localTrackId?: string;
    isrc?: string;
    title?: string;
    artist?: string;
    album?: string;
    durationMs?: number | null;
  }>;
  createdAt: number;
  updatedAt: number;
};

type PlaybackState = {
  queueTrackIds: string[];
  currentIndex: number;
  currentTimeMs: number;
  playing: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
  volume: number;
};

type RadioSession = {
  id: string;
  name: string;
  playlist: MusicPlaylist;
  start: string;
  createdAt: number;
};

type LibraryState = {
  tracks: MusicTrack[];
  folders: MusicFolder[];
  playlists: MusicPlaylist[];
  radioSessions: RadioSession[];
};

type MusicState = LibraryState & {
  root: HTMLElement | null;
  appFrame: OverlayAppFrame | null;
  open: boolean;
  tab: MusicTab;
  side: OverlayDockSide;
  x: number;
  width: number;
  height: number;
  topOffset: number;
  theme: "light" | "dark" | "system";
  search: string;
  sortKey: MusicSortKey;
  status: string;
  error: string;
  scanActive: boolean;
  scanCancel: boolean;
  enrichActive: boolean;
  enrichCancel: boolean;
  playback: PlaybackState;
  currentTrackId: string | null;
  selectedTrackId: string | null;
  lastPanelInteractionAt: number;
  selectedPlaylistId: string | null;
  activeRadioSessionId: string | null;
  lastQrDataUrl: string;
  autoAcceptHighConfidenceIsrc: boolean;
  libraryMinimized: boolean;
  layoutReady: boolean;
};

const state: MusicState = {
  root: null,
  appFrame: null,
  open: false,
  tab: "library",
  side: "right",
  x: 0,
  width: 420,
  height: 650,
  topOffset: 16,
  theme: "system",
  search: "",
  sortKey: "default",
  status: "Ready",
  error: "",
  scanActive: false,
  scanCancel: false,
  enrichActive: false,
  enrichCancel: false,
  playback: {
    queueTrackIds: [],
    currentIndex: -1,
    currentTimeMs: 0,
    playing: false,
    repeatMode: DEFAULT_REPEAT_MODE,
    shuffle: false,
    volume: 0.78,
  },
  currentTrackId: null,
  selectedTrackId: null,
  lastPanelInteractionAt: 0,
  selectedPlaylistId: null,
  activeRadioSessionId: null,
  tracks: [],
  folders: [],
  playlists: [],
  radioSessions: [],
  lastQrDataUrl: "",
  autoAcceptHighConfidenceIsrc: true,
  libraryMinimized: false,
  layoutReady: false,
};

let dbPromise: Promise<IDBDatabase> | null = null;
let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let renderQueued = false;
let librarySortRenderDeferred = false;
let lastMusicBrainzLookupAt = 0;
let lastAudibleVolume = state.playback.volume;
let playbackGeneration = 0;
const playbackHistory = new PlaybackHistoryTracker();
let artworkHydrationActive = false;
let libraryLoadPromise: Promise<void> | null = null;
let booted = false;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;
let appSdkSendMessage: MilxdyContentAppContext["sendMessage"] | null = null;
let lifecycleSignal: AbortSignal | null = null;

export function boot(context?: MilxdyContentAppContext): void {
  if (booted) return;
  booted = true;
  state.playback.repeatMode = DEFAULT_REPEAT_MODE;
  lifecycleSignal = context?.signal || null;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  appSdkSendMessage = context?.sendMessage || null;
  ensureOverlayAppChromeStyles();
  registerDockItem();
  void loadLayoutSettings();
  void loadMusicSettings();
  void loadTheme();
  observeSettings(addRuntimeDisposable);
  void loadLibrary();
}

export function open(): void {
  state.open = true;
  ensureRoot();
  render();
  void loadLibrary();
}

export function close(): void {
  closePanel();
}

export function disable(): void {
  playbackGeneration += 1;
  state.scanCancel = true;
  state.enrichCancel = true;
  closePanel();
  if (audio) {
    audio.pause();
    state.playback.playing = false;
  }
  updateDockState();
}

export function dispose(): void {
  disable();
  playbackHistory.clear();
  state.appFrame?.remove();
  state.appFrame = null;
  state.root?.remove();
  state.root = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  audio = null;
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
    id: "music",
    label: "Music",
    icon: chrome.runtime.getURL(MUSIC_LOGO_PATH),
    initialSide: state.side,
    isOpen: () => Boolean(state.root && state.open),
    onOpen: () => {
      state.open = true;
      ensureRoot();
      render();
      void loadLibrary();
    },
    onClose: closePanel,
    onSideChange: (side) => {
      state.side = side;
      applyLayout();
    },
  });
}

async function loadLayoutSettings(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get([WIDTH_KEY, HEIGHT_KEY, TOP_KEY, LIBRARY_MINIMIZED_KEY]).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.libraryMinimized = stored[LIBRARY_MINIMIZED_KEY] === true;
  const width = Number(stored[WIDTH_KEY]);
  const height = Number(stored[HEIGHT_KEY]);
  const top = Number(stored[TOP_KEY]);
  const minimum = panelMinimums();
  const layout = await restoreOverlayPanelBox("music", {
    side: state.side,
    minWidth: minimum.minWidth,
    minHeight: minimum.minHeight,
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
  render();
}

async function loadTheme(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get({ [STYLE_THEME_KEY]: "system" }).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.theme = normalizeTheme(stored[STYLE_THEME_KEY]);
  applyTheme();
}

async function loadMusicSettings(): Promise<void> {
  const stored: Record<string, unknown> = await chrome.storage.local.get({
    [AUTO_ACCEPT_ISRC_KEY]: true,
    [VOLUME_KEY]: state.playback.volume,
  }).catch(() => ({}));
  if (!lifecycleActive()) return;
  state.autoAcceptHighConfidenceIsrc = stored[AUTO_ACCEPT_ISRC_KEY] !== false;
  const volume = Number(stored[VOLUME_KEY]);
  if (Number.isFinite(volume)) state.playback.volume = Math.max(0, Math.min(1, volume));
}

function observeSettings(addDisposable: MilxdyContentAppContext["addDisposable"]): void {
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;
    if (changes[STYLE_THEME_KEY]) {
      state.theme = normalizeTheme(changes[STYLE_THEME_KEY].newValue);
      applyTheme();
    }
    if (changes[AUTO_ACCEPT_ISRC_KEY]) {
      state.autoAcceptHighConfidenceIsrc = changes[AUTO_ACCEPT_ISRC_KEY].newValue !== false;
      render();
    }
    if (changes[VOLUME_KEY]) {
      const volume = Number(changes[VOLUME_KEY].newValue);
      if (Number.isFinite(volume)) {
        state.playback.volume = Math.max(0, Math.min(1, volume));
        if (audio) audio.volume = state.playback.volume;
        render();
      }
    }
    if (changes[LIBRARY_MINIMIZED_KEY]) {
      state.libraryMinimized = changes[LIBRARY_MINIMIZED_KEY].newValue === true;
      state.width = clampWidth(state.width);
      state.height = clampHeight(state.height);
      applyLayout();
      render();
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
  window.addEventListener("keydown", handleKeyboardShortcut);
  addDisposable(() => window.removeEventListener("keydown", handleKeyboardShortcut));
}

function handleKeyboardShortcut(event: KeyboardEvent): void {
  if (!state.open || !state.root) return;
  if (!isMusicKeyboardActive()) return;
  if (isEditableTarget(event.target)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const key = event.key.toLowerCase();
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelectedTrack(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelectedTrack(-1);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    playSelectedTrack();
    return;
  }
  if (event.key === " " || key === "k") {
    event.preventDefault();
    togglePlayback();
    return;
  }
  if (event.key === "ArrowRight" || key === "l") {
    event.preventDefault();
    seekBy(10_000);
    return;
  }
  if (event.key === "ArrowLeft" || key === "j") {
    event.preventDefault();
    seekBy(-10_000);
    return;
  }
  if (key === "n") {
    event.preventDefault();
    void playNext();
    return;
  }
  if (key === "p") {
    event.preventDefault();
    void playPrevious();
    return;
  }
  if (key === "m") {
    event.preventDefault();
    toggleMute();
    return;
  }
  if (key === "s") {
    event.preventDefault();
    toggleShuffle();
    return;
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    setVolume(state.playback.volume + 0.05);
    return;
  }
  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    setVolume(state.playback.volume - 0.05);
  }
}

function isMusicKeyboardActive(): boolean {
  if (!state.root) return false;
  if (state.root.contains(document.activeElement)) return true;
  return Date.now() - state.lastPanelInteractionAt < KEYBOARD_ACTIVE_MS;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function ensureRoot(): void {
  const existing = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (existing) {
    existing.classList.add("milxdy-overlay-app-shell");
    existing.querySelector(".milxdy-music-card")?.classList.add("milxdy-overlay-app-card");
    existing.querySelector(".milxdy-music-header")?.classList.add("milxdy-overlay-app-header");
    state.root = existing;
    return;
  }
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.className = "milxdy-overlay-app-shell";
  prepareOverlayAppRoot(root);
  root.setAttribute("aria-label", "milXdy music player");
  root.innerHTML = `
    <div class="milxdy-music-card milxdy-overlay-app-card">
      <header class="milxdy-music-header milxdy-overlay-app-header">
        <div class="milxdy-music-title">
          <span class="milxdy-music-app-icon" aria-hidden="true"><img src="${chrome.runtime.getURL(MUSIC_LOGO_PATH)}" alt=""></span>
          <span class="milxdy-music-compact-title" data-role="compact-title"></span>
          <strong>Music</strong>
          <span data-role="status">Ready</span>
        </div>
        <div class="milxdy-music-header-actions">
          <button type="button" class="milxdy-music-icon-button" data-action="rescan" title="Rescan folders" aria-label="Rescan folders">
            <svg class="milxdy-music-refresh-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 7.5A8 8 0 0 0 5.8 5.2L4 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 3.5V7h3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 16.5a8 8 0 0 0 13.2 2.3L20 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20 20.5V17h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button type="button" class="milxdy-music-action-icon-label" data-action="minimize-library" data-role="library-toggle" title="Compact to player controls"><span class="milxdy-music-ui-icon" data-icon="compact" aria-hidden="true"></span><span>Compact</span></button>
          <button type="button" class="milxdy-music-icon-button" data-action="close" title="Minimize" aria-label="Minimize"><span class="milxdy-music-ui-icon" data-icon="minimize" aria-hidden="true"></span></button>
        </div>
      </header>
      <nav class="milxdy-music-tabs" aria-label="Music sections">
        <button type="button" data-tab="library">Library</button>
        <button type="button" data-tab="queue">Queue</button>
        <button type="button" data-tab="playlists">Playlists</button>
        <button type="button" data-tab="radio">Radio</button>
        <button type="button" data-tab="settings">Settings</button>
      </nav>
      <div class="milxdy-music-error" data-role="error" hidden></div>
      <main class="milxdy-music-body" data-role="body"></main>
      <footer class="milxdy-music-player" data-role="player"></footer>
      <div class="milxdy-music-resize-grip milxdy-music-resize-grip-left" data-role="resize" data-resize-axis="both" data-resize-side="left" title="Drag to resize"></div>
      <div class="milxdy-music-resize-grip milxdy-music-resize-grip-right" data-role="resize" data-resize-axis="both" data-resize-side="right" title="Drag to resize"></div>
      <div class="milxdy-music-resize-edge milxdy-music-resize-edge-side" data-role="resize" data-resize-axis="x" title="Drag to resize width"></div>
      <div class="milxdy-music-resize-edge milxdy-music-resize-edge-bottom" data-role="resize" data-resize-axis="y" title="Drag to resize height"></div>
    </div>
  `;
  root.querySelector<HTMLButtonElement>('[data-action="close"]')?.addEventListener("click", closePanel);
  root.querySelector<HTMLButtonElement>('[data-action="rescan"]')?.addEventListener("click", () => void rescanFolders());
  root.querySelector<HTMLButtonElement>('[data-action="minimize-library"]')?.addEventListener("click", toggleLibraryMinimized);
  root.querySelector<HTMLElement>('[data-role="player"]')?.addEventListener("click", handlePlayerClick);
  for (const handle of Array.from(root.querySelectorAll<HTMLElement>('[data-role="resize"]'))) {
    handle.addEventListener("pointerdown", startResize);
  }
  root.querySelector<HTMLElement>(".milxdy-music-header")?.addEventListener("pointerdown", startDrag);
  root.addEventListener("pointerdown", notePanelInteraction);
  root.addEventListener("focusin", notePanelInteraction);
  for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-tab]"))) {
    button.addEventListener("click", () => {
      state.tab = normalizeTab(button.dataset.tab);
      render();
    });
  }
  document.documentElement.append(root);
  state.root = root;
  applyTheme();
  applyLayout();
}

function notePanelInteraction(): void {
  state.lastPanelInteractionAt = Date.now();
}

function handlePlayerClick(event: MouseEvent): void {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-player-action]") : null;
  if (!button) return;
  event.preventDefault();
  notePanelInteraction();
  const action = button.dataset.playerAction;
  if (action === "shuffle") toggleShuffle();
  if (action === "previous") void playPrevious();
  if (action === "playpause" || action === "compact-playpause") togglePlayback();
  if (action === "next") void playNext();
  if (action === "repeat") cycleRepeat();
  if (action === "mute") toggleMute();
}

function toggleLibraryMinimized(): void {
  state.libraryMinimized = !state.libraryMinimized;
  state.width = clampWidth(state.width);
  state.height = state.libraryMinimized
    ? clampHeight(Math.min(state.height, COMPACT_DEFAULT_HEIGHT))
    : clampHeight(state.height);
  notePanelInteraction();
  void chrome.storage.local.set({ [LIBRARY_MINIMIZED_KEY]: state.libraryMinimized, [WIDTH_KEY]: state.width, [HEIGHT_KEY]: state.height });
  applyLayout();
  render();
}

function closePanel(): void {
  state.open = false;
  const root = state.root;
  state.root = null;
  updateDockState();
  animateOverlayAppClose(root, () => root?.remove());
}

function loadLibrary(): Promise<void> {
  if (libraryLoadPromise) return libraryLoadPromise;
  libraryLoadPromise = loadLibraryOnce().finally(() => {
    libraryLoadPromise = null;
  });
  return libraryLoadPromise;
}

async function loadLibraryOnce(): Promise<void> {
  let folders: MusicFolder[];
  let tracks: MusicTrack[];
  let playlists: MusicPlaylist[];
  let radioSessions: RadioSession[];
  try {
    const db = await openDb();
    [folders, tracks, playlists, radioSessions] = await Promise.all([
      getAll<MusicFolder>(db, "folders"),
      getAll<MusicTrack>(db, "tracks"),
      getAll<MusicPlaylist>(db, "playlists"),
      getAll<RadioSession>(db, "radio"),
    ]);
  } catch (error) {
    if (lifecycleActive()) {
      state.error = `Music library could not be opened: ${errorMessage(error)}`;
      state.status = "Library unavailable";
      render();
    }
    return;
  }
  if (!lifecycleActive()) return;
  state.folders = folders.sort((a, b) => a.name.localeCompare(b.name));
  state.tracks = withDefaultAchievementTrack(tracks.sort(compareTracks));
  state.playlists = playlists.sort((a, b) => b.updatedAt - a.updatedAt);
  state.radioSessions = radioSessions.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  await hydrateMissingArtwork();
  if (lifecycleActive()) render();
}

async function addFolder(): Promise<void> {
  if (!lifecycleActive()) return;
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  if (!picker || !supportsDirectoryPicker()) {
    state.error = "Local folder access is not available in this browser. Use a Chromium browser for local music folders.";
    render();
    return;
  }
  try {
    const handle = await picker.call(window);
    if (!lifecycleActive()) return;
    const folder: MusicFolder = {
      id: crypto.randomUUID(),
      name: handle.name,
      handle,
      addedAt: Date.now(),
      lastScannedAt: null,
    };
    const db = await openDb();
    if (!lifecycleActive()) return;
    await putItem(db, "folders", folder);
    if (!lifecycleActive()) return;
    state.folders.push(folder);
    render();
    state.scanCancel = false;
    await scanFolder(folder);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    state.error = folderAccessErrorMessage(error);
    render();
  }
}

async function rescanFolders(): Promise<void> {
  if (!lifecycleActive()) return;
  if (state.scanActive) {
    state.scanCancel = true;
    state.status = "Stopping scan...";
    render();
    return;
  }
  state.scanCancel = false;
  try {
    for (const folder of state.folders) {
      if (state.scanCancel || !lifecycleActive()) break;
      await scanFolder(folder);
    }
  } finally {
    state.scanCancel = false;
  }
}

async function scanFolder(folder: MusicFolder): Promise<void> {
  if (state.scanActive || !lifecycleActive()) return;
  state.scanActive = true;
  state.error = "";
  let indexed = 0;
  const seenPaths = new Set<string>();
  try {
    const allowed = await requestReadPermission(folder.handle);
    if (!allowed) {
      folder.lastStatus = "permission-needed";
      folder.lastError = state.error || "Folder permission is needed before indexing can continue.";
      const db = await openDb();
      await putItem(db, "folders", folder);
      state.status = `Permission needed for ${folder.name}`;
      return;
    }
    const db = await openDb();
    for await (const entry of walkDirectory(folder.handle)) {
      if (state.scanCancel || !lifecycleActive()) break;
      if (!isSupportedAudio(entry.file.name)) continue;
      seenPaths.add(entry.path);
      state.status = `Indexing ${entry.file.name}`;
      renderSoon();
      const track = await buildTrack(folder, entry);
      if (state.scanCancel || !lifecycleActive()) break;
      await putItem(db, "tracks", track);
      if (state.scanCancel || !lifecycleActive()) break;
      upsertTrack(track);
      indexed += 1;
      if (indexed % 8 === 0) render();
    }
    if (lifecycleActive() && !state.scanCancel) {
      const removed = await markRemovedTracks(db, folder, seenPaths);
      await refreshDuplicateGroups(db);
      folder.lastScannedAt = Date.now();
      folder.lastStatus = "ready";
      folder.lastError = "";
      await putItem(db, "folders", folder);
      const duplicates = state.tracks.filter((track) => (track.duplicateGroupSize ?? 0) > 1).length;
      state.status = `Indexed ${indexed} tracks; ${removed} missing; ${duplicates} duplicates`;
    } else if (lifecycleActive()) {
      state.status = `Scan stopped after ${indexed} tracks; existing tracks were preserved`;
    }
  } catch (error) {
    if (lifecycleActive()) {
      folder.lastStatus = "error";
      folder.lastError = folderAccessErrorMessage(error);
      const db = await openDb();
      await putItem(db, "folders", folder).catch(() => undefined);
      state.error = folder.lastError;
    }
  } finally {
    state.scanActive = false;
    if (lifecycleActive()) {
      render();
      void runEnrichmentQueue();
    }
  }
}

async function buildTrack(folder: MusicFolder, entry: { file: File; handle: FileSystemFileHandle; path: string }): Promise<MusicTrack> {
  const metadata = await readMetadata(entry.file);
  const existing = state.tracks.find((track) => track.folderId === folder.id && track.path === entry.path);
  const inferred = inferMetadataFromFilename(entry.file.name);
  const title = normalizeMetadataText(metadata.title) || inferred.title || stripExtension(entry.file.name);
  const artist = normalizeMetadataText(metadata.artist) || inferred.artist || "Unknown Artist";
  const album = normalizeMetadataText(metadata.album) || "Unknown Album";
  const isrc = normalizeIsrc(metadata.isrc);
  const now = Date.now();
  const duplicateKey = duplicateKeyFor({ title, artist, album, durationMs: metadata.durationMs, isrc });
  return {
    id: existing?.id || crypto.randomUUID(),
    source: "local",
    fileName: entry.file.name,
    title,
    artist,
    album,
    durationMs: metadata.durationMs,
    artworkDataUrl: metadata.artworkDataUrl || existing?.artworkDataUrl,
    artworkCheckedAt: now,
    artworkMetadataVersion: ARTWORK_METADATA_VERSION,
    artworkFileLastModified: entry.file.lastModified,
    artworkFileSize: entry.file.size,
    isrc,
    isrcConfidence: isrc ? 1 : 0,
    fileHandleKey: `${folder.id}:${entry.path}`,
    folderId: folder.id,
    path: entry.path,
    addedAt: existing?.addedAt || now,
    lastIndexedAt: now,
    unavailable: false,
    duplicateKey,
    duplicateGroupSize: existing?.duplicateGroupSize,
    enrichment: isrc
      ? {
        status: "matched",
        attempts: existing?.enrichment.attempts || 0,
        lastAttemptAt: existing?.enrichment.lastAttemptAt || null,
        nextRetryAt: null,
        candidates: [{ isrc, confidence: 1, sources: ["embedded"], title, artist, album }],
      }
      : existing?.enrichment || {
        status: "pending",
        attempts: 0,
        lastAttemptAt: null,
        nextRetryAt: null,
        candidates: [],
      },
  };
}

async function readMetadata(file: File): Promise<{ title: string; artist: string; album: string; isrc: string | null; durationMs: number | null; artworkDataUrl?: string }> {
  const tags = await readEmbeddedTags(file);
  const durationMs = await readDuration(file).catch(() => null);
  return {
    title: tags.title || "",
    artist: tags.artist || "",
    album: tags.album || "",
    isrc: tags.isrc || null,
    durationMs,
    artworkDataUrl: tags.artworkDataUrl,
  };
}

async function readEmbeddedTags(file: File): Promise<ParsedAudioMetadata> {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".mp3")
    ? await readId3v2(file)
    : lower.endsWith(".flac")
      ? await readFlacMetadata(file)
      : lower.endsWith(".m4a") || lower.endsWith(".mp4") || lower.endsWith(".alac")
        ? await readMp4Metadata(file)
        : {};
}

async function readId3v2(file: File): Promise<ParsedAudioMetadata> {
  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) return {};
  const major = header[3];
  const tagSize = syncSafe(header.subarray(6, 10));
  const bytes = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
  const out: ParsedAudioMetadata = {};
  let offset = 0;
  while (offset + 10 <= bytes.length) {
    const id = ascii(bytes.subarray(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = major === 4 ? syncSafe(bytes.subarray(offset + 4, offset + 8)) : uint32(bytes.subarray(offset + 4, offset + 8));
    if (size <= 0 || offset + 10 + size > bytes.length) break;
    const frame = bytes.subarray(offset + 10, offset + 10 + size);
    if (id === "TIT2") out.title = decodeTextFrame(frame);
    if (id === "TPE1") out.artist = decodeTextFrame(frame);
    if (id === "TALB") out.album = decodeTextFrame(frame);
    if (id === "TSRC") out.isrc = decodeTextFrame(frame);
    if (id === "APIC" && !out.artworkDataUrl) out.artworkDataUrl = parseApicFrame(frame);
    offset += 10 + size;
  }
  if (!out.artworkDataUrl) out.artworkDataUrl = findId3Artwork(bytes, major);
  if (!out.artworkDataUrl) out.artworkDataUrl = findArtworkBySignature(bytes);
  return out;
}

function findId3Artwork(bytes: Uint8Array, major: number): string | undefined {
  for (let offset = 0; offset + 10 <= bytes.length; offset += 1) {
    if (bytes[offset] !== 0x41 || bytes[offset + 1] !== 0x50 || bytes[offset + 2] !== 0x49 || bytes[offset + 3] !== 0x43) continue;
    const size = major === 4
      ? syncSafe(bytes.subarray(offset + 4, offset + 8))
      : uint32(bytes.subarray(offset + 4, offset + 8));
    if (size <= 0 || offset + 10 + size > bytes.length) continue;
    const artwork = parseApicFrame(bytes.subarray(offset + 10, offset + 10 + size));
    if (artwork) return artwork;
  }
  return undefined;
}

function findArtworkBySignature(bytes: Uint8Array): string | undefined {
  const jpegStart = findByteSequence(bytes, [0xff, 0xd8, 0xff]);
  if (jpegStart >= 0) {
    const jpegEnd = findByteSequence(bytes, [0xff, 0xd9], jpegStart + 3);
    if (jpegEnd >= jpegStart && jpegEnd + 2 - jpegStart <= 1_500_000) {
      return `data:image/jpeg;base64,${base64Bytes(bytes.subarray(jpegStart, jpegEnd + 2))}`;
    }
  }

  const pngStart = findByteSequence(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (pngStart >= 0) {
    const iend = findByteSequence(bytes, [0x49, 0x45, 0x4e, 0x44], pngStart + 8);
    const pngEnd = iend >= 4 ? iend + 8 : -1;
    if (pngEnd > pngStart && pngEnd - pngStart <= 1_500_000) {
      return `data:image/png;base64,${base64Bytes(bytes.subarray(pngStart, pngEnd))}`;
    }
  }
  return undefined;
}

function findByteSequence(bytes: Uint8Array, sequence: number[], from = 0): number {
  for (let offset = Math.max(0, from); offset + sequence.length <= bytes.length; offset += 1) {
    if (sequence.every((byte, index) => bytes[offset + index] === byte)) return offset;
  }
  return -1;
}

async function readFlacMetadata(file: File): Promise<ParsedAudioMetadata> {
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (ascii(header) !== "fLaC") return {};
  let offset = 4;
  while (offset + 4 <= file.size && offset < 2_000_000) {
    const blockHeader = new Uint8Array(await file.slice(offset, offset + 4).arrayBuffer());
    const isLast = Boolean(blockHeader[0] & 0x80);
    const type = blockHeader[0] & 0x7f;
    const size = (blockHeader[1] << 16) | (blockHeader[2] << 8) | blockHeader[3];
    offset += 4;
    if (size <= 0 || offset + size > file.size) break;
    if (type === 6) {
      const block = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
      const artworkDataUrl = parseFlacPictureBlock(block);
      if (artworkDataUrl) return { artworkDataUrl };
    }
    offset += size;
    if (isLast) break;
  }
  return {};
}

function parseFlacPictureBlock(bytes: Uint8Array): string | undefined {
  if (bytes.length < 32) return undefined;
  let offset = 4;
  const mimeLength = uint32(bytes.subarray(offset, offset + 4));
  offset += 4;
  if (mimeLength <= 0 || offset + mimeLength > bytes.length) return undefined;
  const mime = ascii(bytes.subarray(offset, offset + mimeLength)).toLowerCase();
  offset += mimeLength;
  if (offset + 4 > bytes.length) return undefined;
  const descriptionLength = uint32(bytes.subarray(offset, offset + 4));
  offset += 4 + descriptionLength;
  offset += 16;
  if (offset + 4 > bytes.length) return undefined;
  const imageLength = uint32(bytes.subarray(offset, offset + 4));
  offset += 4;
  if (imageLength <= 0 || offset + imageLength > bytes.length || imageLength > 1_500_000) return undefined;
  const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(normalizedMime)) return undefined;
  return `data:${normalizedMime};base64,${base64Bytes(bytes.subarray(offset, offset + imageLength))}`;
}

async function readMp4Metadata(file: File): Promise<ParsedAudioMetadata> {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 4_000_000)).arrayBuffer());
  const covr = findMp4Atom(bytes, "covr");
  if (!covr) return {};
  const data = findMp4Atom(covr, "data");
  if (!data || data.length <= 16) return {};
  const typeCode = uint32(data.subarray(8, 12));
  const mime = typeCode === 13 ? "image/jpeg" : typeCode === 14 ? "image/png" : "image/jpeg";
  const image = data.subarray(16);
  if (!image.length || image.length > 1_500_000) return {};
  return { artworkDataUrl: `data:${mime};base64,${base64Bytes(image)}` };
}

function findMp4Atom(bytes: Uint8Array, target: string): Uint8Array | null {
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    let size = uint32(bytes.subarray(offset, offset + 4));
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    let headerSize = 8;
    if (size === 1 && offset + 16 <= bytes.length) {
      const large = Number(uint64(bytes.subarray(offset + 8, offset + 16)));
      if (!Number.isSafeInteger(large)) return null;
      size = large;
      headerSize = 16;
    }
    if (size < headerSize || offset + size > bytes.length) break;
    const body = bytes.subarray(offset + headerSize, offset + size);
    if (type === target) return body;
    const nested = ["moov", "udta", "meta", "ilst", "covr"].includes(type)
      ? findMp4Atom(type === "meta" ? body.subarray(4) : body, target)
      : null;
    if (nested) return nested;
    offset += size;
  }
  return null;
}

function uint64(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function syncSafe(bytes: Uint8Array): number {
  return ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f);
}

function uint32(bytes: Uint8Array): number {
  return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
}

function decodeTextFrame(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  const encoding = bytes[0];
  const data = bytes.subarray(1);
  const label = encoding === 1 || encoding === 2 ? "utf-16" : "utf-8";
  return new TextDecoder(label).decode(data).replace(/\0+$/g, "").trim();
}

function parseApicFrame(bytes: Uint8Array): string | undefined {
  if (bytes.length < 8) return undefined;
  let offset = 1;
  const mimeEnd = bytes.indexOf(0, offset);
  if (mimeEnd <= offset) return undefined;
  const mime = ascii(bytes.subarray(offset, mimeEnd)).toLowerCase();
  offset = mimeEnd + 1;
  offset += 1;
  const descriptionEnd = findTextTerminator(bytes, offset, bytes[0]);
  if (descriptionEnd < 0) return undefined;
  const imageStart = descriptionEnd + (bytes[0] === 1 || bytes[0] === 2 ? 2 : 1);
  if (imageStart >= bytes.length) return undefined;
  const image = bytes.subarray(imageStart);
  if (!image.length || image.length > 1_500_000) return undefined;
  const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(normalizedMime)) return undefined;
  return `data:${normalizedMime};base64,${base64Bytes(image)}`;
}

function findTextTerminator(bytes: Uint8Array, offset: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let index = offset; index + 1 < bytes.length; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) return index;
    }
    return -1;
  }
  return bytes.indexOf(0, offset);
}

function base64Bytes(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function ascii(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => String.fromCharCode(byte)).join("");
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      probe.removeAttribute("src");
      probe.load();
      resolve(value);
    };
    probe.preload = "metadata";
    probe.addEventListener("loadedmetadata", () => done(Number.isFinite(probe.duration) ? Math.round(probe.duration * 1000) : null), { once: true });
    probe.addEventListener("error", () => done(null), { once: true });
    probe.src = url;
  });
}

async function runEnrichmentQueue(): Promise<void> {
  if (!lifecycleActive()) return;
  if (state.enrichActive) {
    state.enrichCancel = true;
    state.status = "Stopping ISRC enrichment...";
    render();
    return;
  }
  state.enrichActive = true;
  state.enrichCancel = false;
  try {
    const db = await openDb();
    const pending = state.tracks.filter((track) => shouldEnrich(track)).slice(0, 40);
    for (const track of pending) {
      if (state.enrichCancel || !lifecycleActive()) break;
      if (audio && !audio.paused) await sleep(450);
      if (state.enrichCancel || !lifecycleActive()) break;
      track.enrichment = await enrichTrack(track);
      if (state.enrichCancel || !lifecycleActive()) break;
      if (track.enrichment.status === "matched" && track.enrichment.candidates[0]) {
        track.isrc = track.enrichment.candidates[0].isrc;
        track.isrcConfidence = track.enrichment.candidates[0].confidence;
      }
      await putItem(db, "tracks", track);
      if (state.enrichCancel || !lifecycleActive()) break;
      upsertTrack(track);
      renderSoon();
    }
    if (state.enrichCancel) state.status = "ISRC enrichment stopped";
  } finally {
    state.enrichActive = false;
    state.enrichCancel = false;
    if (lifecycleActive()) render();
  }
}

function shouldEnrich(track: MusicTrack): boolean {
  if (isDefaultAchievementTrack(track)) return false;
  if (track.isrc && track.isrcConfidence >= 0.92) return false;
  if (track.enrichment.status === "matched" || track.enrichment.status === "review") return false;
  if (track.enrichment.nextRetryAt && track.enrichment.nextRetryAt > Date.now()) return false;
  return true;
}

async function enrichTrack(track: MusicTrack): Promise<IsrcEnrichmentState> {
  const now = Date.now();
  try {
    const candidates = [
      ...inferIsrcCandidates(track),
      ...await lookupMusicBrainzCandidates(track),
    ].sort((left, right) => right.confidence - left.confidence);
    if (candidates.length > 0 && candidates[0].confidence >= 0.92 && state.autoAcceptHighConfidenceIsrc) {
      return {
        status: "matched",
        attempts: track.enrichment.attempts + 1,
        lastAttemptAt: now,
        nextRetryAt: null,
        candidates,
      };
    }
    if (candidates.length > 0) {
      return {
        status: "review",
        attempts: track.enrichment.attempts + 1,
        lastAttemptAt: now,
        nextRetryAt: null,
        candidates,
      };
    }
    return {
      status: "unresolved",
      attempts: track.enrichment.attempts + 1,
      lastAttemptAt: now,
      nextRetryAt: now + 7 * 24 * 60 * 60 * 1000,
      candidates: [],
    };
  } catch (error) {
    return {
      status: "error",
      attempts: track.enrichment.attempts + 1,
      lastAttemptAt: now,
      nextRetryAt: now + 24 * 60 * 60 * 1000,
      candidates: track.enrichment.candidates,
      error: errorMessage(error),
    };
  }
}

function inferIsrcCandidates(track: MusicTrack): IsrcCandidate[] {
  const fromName = normalizeIsrc([track.fileName, track.title, track.album].join(" "));
  if (!fromName) return [];
  return [{
    isrc: fromName,
    confidence: 0.74,
    sources: ["manual"],
    title: track.title,
    artist: track.artist,
    album: track.album,
  }];
}

async function lookupMusicBrainzCandidates(track: MusicTrack): Promise<IsrcCandidate[]> {
  if (!track.title || track.title === "Unknown Title") return [];
  const elapsed = Date.now() - lastMusicBrainzLookupAt;
  if (elapsed < 1100) await sleep(1100 - elapsed);
  lastMusicBrainzLookupAt = Date.now();
  const query = [
    `recording:${quoteLucene(track.title)}`,
    track.artist && track.artist !== "Unknown Artist" ? `artist:${quoteLucene(track.artist)}` : "",
    track.album && track.album !== "Unknown Album" ? `release:${quoteLucene(track.album)}` : "",
  ].filter(Boolean).join(" AND ");
  const url = new URL("https://musicbrainz.org/ws/2/recording");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "8");
  const response = await runtimeMessage<{ ok?: boolean; data?: unknown; error?: string }>({
    type: "music:fetchJson",
    url: url.href,
  });
  if (!response?.ok) return [];
  const records = objectArray((response.data as Record<string, unknown> | null)?.recordings);
  return records.flatMap((record) => candidatesFromMusicBrainzRecord(record, track));
}

function candidatesFromMusicBrainzRecord(
  record: Record<string, unknown>,
  track: MusicTrack,
): IsrcCandidate[] {
  const isrcs = stringArray(record.isrcs ?? record["isrc-list"]);
  if (!isrcs.length) return [];
  const title = typeof record.title === "string" ? record.title : "";
  const score = typeof record.score === "number" ? record.score : Number(record.score ?? 0);
  const length = typeof record.length === "number" ? record.length : Number(record.length ?? 0);
  const durationDeltaMs = Number.isFinite(length) && track.durationMs ? Math.abs(length - track.durationMs) : undefined;
  const titleMatch = looseEqual(title, track.title);
  const durationScore = durationDeltaMs === undefined ? 0.04 : durationDeltaMs < 2500 ? 0.12 : durationDeltaMs < 8000 ? 0.06 : 0;
  const metadataBase = Math.min(0.88, Math.max(0.58, score / 100));
  const confidence = Math.min(0.94, metadataBase + (titleMatch ? 0.04 : 0) + durationScore);
  const sources: IsrcCandidate["sources"] = ["musicbrainz"];
  return isrcs
    .map(normalizeIsrc)
    .filter((isrc): isrc is string => Boolean(isrc))
    .map((isrc) => ({
      isrc,
      confidence,
      sources,
      musicBrainzRecordingId: typeof record.id === "string" ? record.id : undefined,
      title: title || track.title,
      artist: track.artist,
      album: track.album,
      durationDeltaMs,
    }));
}

function quoteLucene(value: string): string {
  return `"${value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim()}"`;
}

function looseEqual(left: string, right: string): boolean {
  return normalizeLoose(left) === normalizeLoose(right);
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry))) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function runtimeMessage<T>(message: unknown): Promise<T | null> {
  const label = runtimeMessageLabel(message);
  const send = appSdkSendMessage;
  const pending = send ? send<T>(message, label) : Promise.resolve(null);
  return pending.catch(() => null);
}

function runtimeMessageLabel(message: unknown): string {
  if (message && typeof message === "object" && "type" in message) {
    const type = (message as { type?: unknown }).type;
    if (typeof type === "string" && type) return type;
  }
  return "music:message";
}

async function playTrack(trackId: string, queueIds?: string[], historyMode: "record" | "preserve" = "record"): Promise<boolean> {
  const generation = ++playbackGeneration;
  const track = state.tracks.find((candidate) => candidate.id === trackId);
  if (!track) return false;
  state.selectedTrackId = trackId;
  state.error = "";
  state.status = `Loading ${track.title}`;
  render();
  const source = await resolveTrackAudioSource(track);
  if (!source) return false;
  if (!lifecycleActive() || generation !== playbackGeneration) {
    if (source.revoke) URL.revokeObjectURL(source.url);
    return false;
  }
  if (!audio) setupAudio();
  if (!audio) return false;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = source.revoke ? source.url : null;
  audio.src = source.url;
  audio.volume = state.playback.volume;
  const ids = queueIds ?? (state.playback.queueTrackIds.length
    ? state.playback.queueTrackIds
    : filteredTracks().map((entry) => entry.id));
  state.playback.queueTrackIds = ids.includes(trackId) ? ids : [trackId, ...ids];
  state.playback.currentIndex = Math.max(0, state.playback.queueTrackIds.indexOf(trackId));
  state.currentTrackId = trackId;
  await audio.play().catch((error) => {
    if (generation === playbackGeneration) state.error = errorMessage(error);
  });
  if (!lifecycleActive() || generation !== playbackGeneration) return false;
  state.playback.playing = !audio.paused;
  if (state.playback.playing && historyMode === "record") playbackHistory.record(trackId);
  state.status = state.playback.playing ? `Playing ${track.title}` : "Playback blocked";
  render();
  return state.playback.playing;
}

async function resolveTrackAudioSource(track: MusicTrack): Promise<{ url: string; revoke: boolean } | null> {
  if (track.source === "bundled") {
    return { url: chrome.runtime.getURL(track.path), revoke: false };
  }
  const folder = state.folders.find((candidate) => candidate.id === track.folderId);
  const allowed = folder ? await requestReadPermission(folder.handle) : false;
  if (!allowed) {
    state.error = "Folder access was not granted. Click the track again and approve the browser permission prompt, or remove and re-add the folder.";
    state.status = "Track unavailable";
    render();
    return null;
  }
  const file = await getTrackFile(track, folder);
  if (!file) {
    track.unavailable = true;
    upsertTrack(track);
    state.error ||= `Could not open ${track.fileName} from ${folder?.name || "the selected folder"}.`;
    state.status = "Track unavailable";
    render();
    return null;
  }
  if (!track.artworkDataUrl) {
    await hydrateTrackArtworkFromFile(track, file);
  }
  return { url: URL.createObjectURL(file), revoke: true };
}

function setupAudio(): void {
  audio = new Audio();
  const currentAudio = audio;
  const onTimeUpdate = () => {
    if (!audio) return;
    state.playback.currentTimeMs = Math.round(audio.currentTime * 1000);
    updatePlayerOnly();
  };
  const onLoadedMetadata = () => {
    if (!audio || !state.currentTrackId || !Number.isFinite(audio.duration)) return;
    const track = state.tracks.find((candidate) => candidate.id === state.currentTrackId);
    if (!track) return;
    track.durationMs = Math.round(audio.duration * 1000);
    upsertTrack(track);
    renderPlayer();
  };
  const onEnded = () => void playNext();
  const onPlay = () => {
    state.playback.playing = true;
    render();
  };
  const onPause = () => {
    state.playback.playing = false;
    render();
  };
  currentAudio.addEventListener("timeupdate", onTimeUpdate);
  currentAudio.addEventListener("loadedmetadata", onLoadedMetadata);
  currentAudio.addEventListener("ended", onEnded);
  currentAudio.addEventListener("play", onPlay);
  currentAudio.addEventListener("pause", onPause);
  addRuntimeDisposable(() => {
    currentAudio.removeEventListener("timeupdate", onTimeUpdate);
    currentAudio.removeEventListener("loadedmetadata", onLoadedMetadata);
    currentAudio.removeEventListener("ended", onEnded);
    currentAudio.removeEventListener("play", onPlay);
    currentAudio.removeEventListener("pause", onPause);
  });
}

async function getTrackFile(track: MusicTrack, folder?: MusicFolder, reportError = true): Promise<File | null> {
  folder ??= state.folders.find((candidate) => candidate.id === track.folderId);
  if (!folder) return null;
  try {
    let current: FileSystemDirectoryHandle = folder.handle;
    let parts = track.path.split("/").filter(Boolean);
    if (parts[0] === folder.name) parts = parts.slice(1);
    if (!parts.length) return null;
    for (const part of parts.slice(0, -1)) {
      current = await current.getDirectoryHandle(part);
    }
    const handle = await current.getFileHandle(parts[parts.length - 1]);
    return handle.getFile();
  } catch (error) {
    if (reportError) state.error = `Could not open ${track.path}: ${errorMessage(error)}`;
    return null;
  }
}

async function hydrateMissingArtwork(): Promise<void> {
  if (artworkHydrationActive || !lifecycleActive()) return;
  const candidates = state.tracks.filter((track) => (
    track.source === "local"
    && !track.artworkDataUrl
  ));
  if (!candidates.length) return;

  artworkHydrationActive = true;
  try {
    const db = await openDb();
    const readableFolders = new Map<string, boolean>();
    let hydrated = 0;
    let checked = 0;
    for (const candidate of candidates) {
      if (!lifecycleActive()) break;
      const track = state.tracks.find((entry) => entry.id === candidate.id);
      if (!track || track.artworkDataUrl) continue;
      const folder = state.folders.find((entry) => entry.id === track.folderId);
      if (!folder) continue;

      let readable = readableFolders.get(folder.id);
      if (readable === undefined) {
        readable = await hasReadPermission(folder.handle);
        readableFolders.set(folder.id, readable);
      }
      if (!readable) continue;

      const file = await getTrackFile(track, folder, false);
      if (!file) continue;
      if (!shouldReadEmbeddedArtwork(track, file)) continue;
      const artworkRestored = await hydrateTrackArtworkFromFile(track, file, db);
      checked += 1;
      if (artworkRestored) hydrated += 1;
      if (artworkRestored) renderSoon();
      if (checked % 8 === 0) await yieldArtworkHydration();
    }
    if (hydrated > 0 && lifecycleActive()) {
      state.status = `Restored artwork for ${hydrated} track${hydrated === 1 ? "" : "s"}`;
      render();
    }
  } finally {
    artworkHydrationActive = false;
  }
}

async function hydrateTrackArtworkFromFile(track: MusicTrack, file: File, db?: IDBDatabase): Promise<boolean> {
  let tags: ParsedAudioMetadata;
  try {
    tags = await readEmbeddedTags(file);
  } catch {
    return false;
  }
  track.artworkCheckedAt = Date.now();
  track.artworkMetadataVersion = ARTWORK_METADATA_VERSION;
  track.artworkFileLastModified = file.lastModified;
  track.artworkFileSize = file.size;
  if (tags.artworkDataUrl) track.artworkDataUrl = tags.artworkDataUrl;
  await putItem(db || await openDb(), "tracks", track);
  return Boolean(tags.artworkDataUrl);
}

function yieldArtworkHydration(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function hasReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const permissionHandle = handle as FileSystemDirectoryHandle & {
    queryPermission?: (descriptor?: { mode: "read" }) => Promise<PermissionState>;
  };
  if (!permissionHandle.queryPermission) return true;
  try {
    return await permissionHandle.queryPermission({ mode: "read" }) === "granted";
  } catch {
    return false;
  }
}

async function requestReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const permissionHandle = handle as FileSystemDirectoryHandle & {
    requestPermission?: (descriptor?: { mode: "read" }) => Promise<PermissionState>;
  };
  if (!permissionHandle.requestPermission) return true;
  try {
    const requested = await permissionHandle.requestPermission({ mode: "read" });
    return requested === "granted";
  } catch (error) {
    state.error = errorMessage(error);
    return false;
  }
}

async function playNext(): Promise<void> {
  if (!state.playback.queueTrackIds.length) return;
  if (state.playback.repeatMode === "one" && state.currentTrackId) {
    await playTrack(state.currentTrackId, undefined, "preserve");
    return;
  }
  if (state.playback.shuffle) {
    const forward = playbackHistory.peek(1);
    if (forward) {
      if (await playTrack(forward.trackId, undefined, "preserve")) playbackHistory.commit(forward.cursor);
      return;
    }
  }
  let next = state.playback.shuffle && state.playback.queueTrackIds.length > 1
    ? randomQueueIndexExcept(state.playback.currentIndex, state.playback.queueTrackIds.length)
    : state.playback.currentIndex + 1;
  if (next >= state.playback.queueTrackIds.length) {
    if (state.playback.repeatMode !== "all") {
      state.playback.playing = false;
      render();
      return;
    }
    next = 0;
  }
  await playTrack(state.playback.queueTrackIds[next]);
}

async function playPrevious(): Promise<void> {
  if (!state.playback.queueTrackIds.length) return;
  if (state.playback.shuffle) {
    const previous = playbackHistory.peek(-1);
    if (previous && await playTrack(previous.trackId, undefined, "preserve")) playbackHistory.commit(previous.cursor);
    return;
  }
  const prev = Math.max(0, state.playback.currentIndex - 1);
  await playTrack(state.playback.queueTrackIds[prev]);
}

function randomQueueIndexExcept(current: number, length: number): number {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  if (next === current) next = (next + 1) % length;
  return next;
}

function togglePlayback(): void {
  const selected = selectedVisibleTrack();
  if (!audio && selected) {
    void playTrack(selected.id, filteredTracks().map((track) => track.id));
    return;
  }
  if (!audio) return;
  if (audio.paused) {
    void audio.play().catch((error) => {
      state.error = errorMessage(error);
      render();
    });
  }
  else audio.pause();
}

function seekBy(deltaMs: number): void {
  if (!audio) return;
  const durationMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : null;
  const nextMs = Math.max(0, Math.min(durationMs ?? Number.MAX_SAFE_INTEGER, audio.currentTime * 1000 + deltaMs));
  audio.currentTime = nextMs / 1000;
  state.playback.currentTimeMs = Math.round(nextMs);
  renderPlayer();
}

function setVolume(value: number): void {
  state.playback.volume = Math.max(0, Math.min(1, value));
  if (state.playback.volume > 0.01) lastAudibleVolume = state.playback.volume;
  if (audio) audio.volume = state.playback.volume;
  void chrome.storage.local.set({ [VOLUME_KEY]: state.playback.volume });
  renderPlayer();
}

function toggleMute(): void {
  if (state.playback.volume > 0.01) {
    lastAudibleVolume = state.playback.volume;
    setVolume(0);
    return;
  }
  setVolume(lastAudibleVolume > 0.01 ? lastAudibleVolume : 0.78);
}

function toggleShuffle(): void {
  state.playback.shuffle = !state.playback.shuffle;
  render();
}

function queueTrack(trackId: string): void {
  const track = state.tracks.find((candidate) => candidate.id === trackId);
  if (!track) return;
  state.playback.queueTrackIds = [
    ...state.playback.queueTrackIds.filter((id) => id !== trackId),
    trackId,
  ];
  if (state.playback.currentIndex < 0 && state.currentTrackId) {
    state.playback.currentIndex = state.playback.queueTrackIds.indexOf(state.currentTrackId);
  }
  state.status = `Queued ${track.title}`;
  render();
}

function shuffleQueue(): void {
  const currentId = state.currentTrackId;
  const ids = [...state.playback.queueTrackIds];
  if (ids.length <= 1) return;
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  if (currentId && ids.includes(currentId)) {
    const withoutCurrent = ids.filter((id) => id !== currentId);
    state.playback.queueTrackIds = [currentId, ...withoutCurrent];
    state.playback.currentIndex = 0;
  } else {
    state.playback.queueTrackIds = ids;
    state.playback.currentIndex = Math.min(Math.max(0, state.playback.currentIndex), ids.length - 1);
  }
  state.status = "Queue shuffled";
  render();
}

function moveQueueTrack(index: number, delta: number): void {
  const next = index + delta;
  if (next < 0 || next >= state.playback.queueTrackIds.length) return;
  const [id] = state.playback.queueTrackIds.splice(index, 1);
  state.playback.queueTrackIds.splice(next, 0, id);
  if (state.currentTrackId) {
    state.playback.currentIndex = state.playback.queueTrackIds.indexOf(state.currentTrackId);
  }
  state.status = "Queue reordered";
  render();
}

function cycleRepeat(): void {
  state.playback.repeatMode = state.playback.repeatMode === "off"
    ? "all"
    : state.playback.repeatMode === "all"
      ? "one"
      : "off";
  render();
}

async function createPlaylistFromSelection(trackIds: string[]): Promise<void> {
  const name = window.prompt("Playlist name", "milXdy playlist")?.trim();
  if (!name) return;
  const now = Date.now();
  const playlist: MusicPlaylist = {
    id: crypto.randomUUID(),
    name,
    description: "",
    trackRefs: trackIds.map((id) => {
      const track = state.tracks.find((candidate) => candidate.id === id);
      return {
        localTrackId: id,
        isrc: track?.isrc ?? undefined,
        title: track?.title,
        artist: track?.artist,
        album: track?.album,
        durationMs: track?.durationMs,
      };
    }),
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDb();
  await putItem(db, "playlists", playlist);
  state.playlists.unshift(playlist);
  state.selectedPlaylistId = playlist.id;
  state.tab = "playlists";
  render();
}

async function importPlaylistPayload(payloadText: string): Promise<void> {
  const payload = parsePlaylistPayload(payloadText);
  if (!payload) {
    state.error = "Playlist payload not recognized.";
    render();
    return;
  }
  const matchedCount = payload.tracks.filter((track) => Boolean(matchImportedTrack(track))).length;
  const unresolvedCount = payload.tracks.length - matchedCount;
  const duplicateCount = payload.tracks.filter((track) => matchingTrackCandidates(track).length > 1).length;
  if (!window.confirm([
    `Import "${payload.name || "Imported playlist"}"?`,
    `${matchedCount} matched locally`,
    `${unresolvedCount} unresolved`,
    `${duplicateCount} duplicate local candidates`,
  ].join("\n"))) return;
  const now = Date.now();
  const playlist: MusicPlaylist = {
    id: crypto.randomUUID(),
    name: payload.name || "Imported playlist",
    description: "Imported into milXdy Music",
    trackRefs: payload.tracks.map((track) => {
      const match = matchImportedTrack(track);
      return {
        localTrackId: match?.id,
        isrc: track.isrc,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationMs: track.durationMs,
      };
    }),
    createdAt: now,
    updatedAt: now,
  };
  const db = await openDb();
  await putItem(db, "playlists", playlist);
  state.playlists.unshift(playlist);
  state.selectedPlaylistId = playlist.id;
  if (payload.kind === "radio" && payload.start) {
    const session: RadioSession = {
      id: crypto.randomUUID(),
      name: playlist.name,
      playlist,
      start: payload.start,
      createdAt: now,
    };
    await putItem(db, "radio", session);
    state.radioSessions.unshift(session);
    state.activeRadioSessionId = session.id;
    state.tab = "radio";
    state.status = `Imported radio ${playlist.name}`;
    render();
    return;
  }
  state.status = `Imported ${playlist.name}`;
  state.tab = "playlists";
  render();
}

function playlistPayload(playlist: MusicPlaylist, radioStart?: string): Record<string, unknown> {
  return {
    v: 1,
    app: "milxdy",
    kind: radioStart ? "radio" : "playlist",
    url: "https://github.com/bonklek/milXdy",
    name: playlist.name,
    start: radioStart,
    tracks: playlist.trackRefs.map((ref) => ({
      isrc: ref.isrc || undefined,
      title: ref.title,
      artist: ref.artist,
      album: ref.album,
      durationMs: ref.durationMs ?? undefined,
    })),
  };
}

async function exportPlaylistQr(playlist: MusicPlaylist, radioStart?: string): Promise<void> {
  const payload = JSON.stringify(playlistPayload(playlist, radioStart));
  state.lastQrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    color: {
      dark: "#263016",
      light: "#f4ffee",
    },
    width: 320,
  });
  state.status = "QR ready";
  render();
}

async function scanQrFile(file: File): Promise<void> {
  const image = await loadBitmap(file);
  await scanQrImage(image);
}

async function scanVisiblePageImages(): Promise<void> {
  const images = Array.from(document.images)
    .filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width >= 80 && rect.height >= 80 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
    })
    .map((image) => image.currentSrc || image.src)
    .filter((src) => /^https:\/\/(pbs\.twimg\.com|boards\.miladychan\.org)\//i.test(src))
    .slice(0, 20);
  for (const src of images) {
    const response = await runtimeMessage<{ ok?: boolean; dataUrl?: string; error?: string }>({
      type: "music:fetchImageDataUrl",
      url: src,
    });
    if (!response?.ok || !response.dataUrl) continue;
    const image = await loadImage(response.dataUrl).catch(() => null);
    if (!image) continue;
    const data = decodeQrImage(image);
    if (data) {
      await importPlaylistPayload(data);
      return;
    }
  }
  state.error = "No visible playlist QR found.";
  render();
}

async function scanQrImage(image: HTMLImageElement): Promise<void> {
  const result = decodeQrImage(image);
  if (!result) {
    state.error = "No playlist QR found.";
    render();
    return;
  }
  await importPlaylistPayload(result);
}

function decodeQrImage(image: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(data.data, canvas.width, canvas.height);
  return result?.data || null;
}

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    image.src = url;
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });
}

async function createRadioSession(playlist: MusicPlaylist): Promise<void> {
  const defaultStart = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16);
  const input = window.prompt("Radio start time (local, YYYY-MM-DDTHH:mm)", defaultStart)?.trim();
  if (!input) return;
  const start = new Date(input).toISOString();
  const session: RadioSession = {
    id: crypto.randomUUID(),
    name: playlist.name,
    playlist,
    start,
    createdAt: Date.now(),
  };
  const db = await openDb();
  await putItem(db, "radio", session);
  state.radioSessions.unshift(session);
  state.activeRadioSessionId = session.id;
  await exportPlaylistQr(playlist, start);
  state.tab = "radio";
  render();
}

function currentRadioPosition(session: RadioSession): { label: string; track: MusicTrack | null; offsetMs: number } {
  const start = new Date(session.start).getTime();
  const elapsed = Date.now() - start;
  if (elapsed < 0) return { label: `Starts in ${formatDuration(-elapsed)}`, track: null, offsetMs: 0 };
  const timeline = session.playlist.trackRefs
    .map((ref) => ({ ref, durationMs: Number(ref.durationMs) || resolveTrackRef(ref)?.durationMs || 0 }))
    .filter((entry) => entry.durationMs > 0);
  const total = timeline.reduce((sum, entry) => sum + entry.durationMs, 0);
  if (!timeline.length || total <= 0) return { label: "No timed tracks", track: null, offsetMs: 0 };
  let cursor = elapsed % total;
  for (const entry of timeline) {
    if (cursor <= entry.durationMs) {
      const track = resolveTrackRef(entry.ref);
      const title = track?.title || entry.ref.title || "Unavailable track";
      return { label: `${title} +${formatDuration(cursor)}`, track, offsetMs: cursor };
    }
    cursor -= entry.durationMs;
  }
  return { label: "Ready", track: resolveTrackRef(timeline[0].ref), offsetMs: 0 };
}

async function joinRadio(session: RadioSession): Promise<void> {
  const position = currentRadioPosition(session);
  if (!position.track) return;
  state.activeRadioSessionId = session.id;
  await playTrack(position.track.id, resolvePlaylistTrackIds(session.playlist));
  if (audio) {
    audio.currentTime = position.offsetMs / 1000;
    state.playback.currentTimeMs = position.offsetMs;
  }
  state.status = `Joined ${session.name} at ${position.label}`;
  render();
}

function render(): void {
  const root = state.root;
  updateDockState();
  if (!root) return;
  const activeSort = root.querySelector<HTMLSelectElement>('[data-role="library-sort"]');
  if (activeSort && document.activeElement === activeSort) {
    librarySortRenderDeferred = true;
    renderPlayer();
    return;
  }
  librarySortRenderDeferred = false;
  root.dataset.side = state.side;
  root.dataset.minimized = String(state.libraryMinimized);
  root.dataset.playerSize = compactPlayerSize();
  const status = root.querySelector<HTMLElement>('[data-role="status"]');
  const compactTitle = root.querySelector<HTMLElement>('[data-role="compact-title"]');
  const error = root.querySelector<HTMLElement>('[data-role="error"]');
  const body = root.querySelector<HTMLElement>('[data-role="body"]');
  const libraryToggle = root.querySelector<HTMLButtonElement>('[data-role="library-toggle"]');
  if (!status || !error || !body) return;
  const currentTrack = state.tracks.find((candidate) => candidate.id === state.currentTrackId);
  status.textContent = state.status;
  if (compactTitle) {
    compactTitle.textContent = currentTrack?.title || "Music";
    compactTitle.title = currentTrack?.title || "Music";
  }
  error.hidden = !state.error;
  error.textContent = state.error;
  if (libraryToggle) {
    libraryToggle.title = state.libraryMinimized ? "Expand library view" : "Compact to player controls";
    libraryToggle.setAttribute("aria-label", libraryToggle.title);
    libraryToggle.dataset.active = String(state.libraryMinimized);
    const icon = state.libraryMinimized ? "expand" : "compact";
    const label = state.libraryMinimized ? "Expand" : "Compact";
    libraryToggle.replaceChildren(uiIcon(icon));
    if (!state.libraryMinimized) {
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      libraryToggle.append(labelNode);
    }
  }
  for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-tab]"))) {
    button.dataset.active = String(button.dataset.tab === state.tab);
  }
  body.textContent = "";
  if (!state.libraryMinimized) {
    if (state.tab === "library") renderLibrary(body);
    if (state.tab === "queue") renderQueue(body);
    if (state.tab === "playlists") renderPlaylists(body);
    if (state.tab === "radio") renderRadio(body);
    if (state.tab === "settings") renderSettings(body);
  }
  renderPlayer();
}

function renderSoon(): void {
  if (renderQueued) return;
  renderQueued = true;
  window.setTimeout(() => {
    renderQueued = false;
    render();
  }, 80);
}

function renderLibrary(body: HTMLElement): void {
  const toolbar = document.createElement("div");
  toolbar.className = "milxdy-music-toolbar";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search library";
  search.value = state.search;
  search.addEventListener("input", () => {
    state.search = search.value;
    render();
  });
  const sort = document.createElement("select");
  sort.title = "Sort library";
  sort.dataset.role = "library-sort";
  for (const [value, label] of [
    ["default", "Default"],
    ["artist", "Artist"],
    ["title", "Title"],
    ["album", "Album"],
    ["added", "Added"],
  ] as Array<[MusicSortKey, string]>) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = state.sortKey === value;
    sort.append(option);
  }
  sort.addEventListener("change", () => {
    state.sortKey = normalizeSortKey(sort.value);
    sort.blur();
    render();
  });
  sort.addEventListener("blur", () => {
    if (!librarySortRenderDeferred) return;
    window.requestAnimationFrame(render);
  });
  const filterGroup = document.createElement("div");
  filterGroup.className = "milxdy-music-toolbar-group milxdy-music-toolbar-filter";
  const actionGroup = document.createElement("div");
  actionGroup.className = "milxdy-music-toolbar-group milxdy-music-toolbar-actions";
  const add = actionButton("Add folder", () => void addFolder());
  add.title = "Add folder";
  add.setAttribute("aria-label", "Add folder");
  const enrich = actionButton(state.enrichActive ? "Stop" : "ISRC", () => void runEnrichmentQueue(), state.enrichActive ? "stop" : "tag");
  enrich.title = state.enrichActive ? "Stop enrichment" : "Enrich ISRC";
  enrich.setAttribute("aria-label", enrich.title);
  filterGroup.append(search, sort);
  actionGroup.append(add, enrich);
  toolbar.append(filterGroup, actionGroup);
  body.append(toolbar);

  if (!supportsDirectoryPicker()) {
    body.append(emptyState("Local folder indexing is limited in this browser. Chromium supports persistent music folders; playlists, QR import, radio metadata, and settings remain available."));
  }

  if (!state.folders.length && !filteredTracks().length) {
    body.append(libraryEmptyState());
    return;
  }

  const list = document.createElement("div");
  list.className = "milxdy-music-track-list";
  const tracks = filteredTracks();
  if (!state.selectedTrackId || !tracks.some((track) => track.id === state.selectedTrackId)) {
    state.selectedTrackId = tracks[0]?.id || null;
  }
  for (const track of tracks.slice(0, 500)) {
    list.append(trackRow(track));
  }
  body.append(list.children.length ? list : emptyState("No matching tracks."));
}

function trackRow(track: MusicTrack): HTMLElement {
  const row = document.createElement("div");
  row.className = "milxdy-music-track milxdy-music-library-track";
  row.dataset.active = String(state.currentTrackId === track.id);
  row.dataset.selected = String(state.selectedTrackId === track.id);
  row.dataset.unavailable = String(track.unavailable === true);
  row.dataset.demo = String(isDefaultAchievementTrack(track));
  row.dataset.duplicate = String((track.duplicateGroupSize ?? 0) > 1);
  if ((track.duplicateGroupSize ?? 0) > 1) row.title = `Possible duplicate group: ${track.duplicateGroupSize} tracks`;
  row.dataset.trackId = track.id;
  const visibleQueue = () => filteredTracks().map((entry) => entry.id);
  const main = document.createElement("button");
  main.type = "button";
  main.title = "Play track";
  main.addEventListener("click", () => {
    state.selectedTrackId = track.id;
    notePanelInteraction();
    void playTrack(track.id, visibleQueue());
  });
  const title = document.createElement("strong");
  title.textContent = track.title;
  const meta = document.createElement("span");
  meta.textContent = `${track.artist} · ${track.album}`;
  main.append(title, meta);
  const right = document.createElement("div");
  right.className = "milxdy-music-track-side";
  const isrcIndicator = trackIsrcIndicator(track);
  if (isrcIndicator) right.append(isrcIndicator);
  const duration = document.createElement("span");
  duration.className = "milxdy-music-track-duration";
  duration.textContent = formatDuration(track.durationMs);
  right.append(duration);
  const overflow = document.createElement("details");
  overflow.className = "milxdy-music-track-overflow";
  const overflowToggle = document.createElement("summary");
  overflowToggle.textContent = "⋯";
  overflowToggle.title = "Track actions";
  overflowToggle.setAttribute("aria-label", `Actions for ${track.title}`);
  const overflowMenu = document.createElement("div");
  overflowMenu.className = "milxdy-music-track-overflow-menu";
  const menuAction = (label: string, onClick: () => void): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      overflow.removeAttribute("open");
      onClick();
    });
    return button;
  };
  const isCurrentTrack = state.currentTrackId === track.id;
  const isPlayingTrack = isCurrentTrack && state.playback.playing;
  overflowMenu.append(menuAction(isPlayingTrack ? "Pause" : "Play", () => {
    state.selectedTrackId = track.id;
    notePanelInteraction();
    if (isCurrentTrack) togglePlayback();
    else void playTrack(track.id, visibleQueue());
  }));
  overflowMenu.append(menuAction("Add to queue", () => queueTrack(track.id)));
  if (!isDefaultAchievementTrack(track) && track.enrichment.status === "review" && track.enrichment.candidates.length) {
    overflowMenu.append(menuAction("Review ISRC candidates", () => void reviewTrackCandidates(track)));
  }
  if (!isDefaultAchievementTrack(track)) {
    overflowMenu.append(menuAction("Edit ISRC", () => void editTrackIsrc(track)));
  }
  overflow.append(overflowToggle, overflowMenu);
  overflow.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node) || !overflow.contains(event.relatedTarget)) overflow.removeAttribute("open");
  });
  row.append(trackThumbnail(track), main, right, overflow);
  return row;
}

function trackThumbnail(track: MusicTrack): HTMLElement {
  const thumb = document.createElement("div");
  thumb.className = "milxdy-music-track-thumb";
  thumb.setAttribute("aria-hidden", "true");
  if (track.artworkDataUrl) {
    const image = document.createElement("img");
    image.src = track.artworkDataUrl;
    image.alt = "";
    thumb.append(image);
    return thumb;
  }
  thumb.textContent = "♪";
  return thumb;
}

function trackIsrcIndicator(track: MusicTrack): HTMLElement | null {
  if (isDefaultAchievementTrack(track)) return null;
  let tone: "green" | "yellow" | "red";
  let label: string;
  if (track.isrc || track.enrichment.status === "matched") {
    tone = "green";
    label = track.isrc ? `ISRC resolved: ${track.isrc}` : "ISRC resolved";
  } else if (track.enrichment.status === "review") {
    tone = "yellow";
    label = "ISRC candidates need review";
  } else if (track.enrichment.status === "pending") {
    tone = "yellow";
    label = "ISRC lookup pending";
  } else if (track.enrichment.status === "error") {
    tone = "red";
    label = "ISRC lookup failed; retry is available";
  } else {
    tone = "red";
    label = "No ISRC match found";
  }
  const indicator = document.createElement("span");
  indicator.className = "milxdy-music-isrc-indicator";
  indicator.dataset.tone = tone;
  indicator.title = label;
  indicator.setAttribute("role", "img");
  indicator.setAttribute("aria-label", label);
  indicator.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18h6M10 21h4M8.4 14.5A6 6 0 1 1 15.6 14.5C14.7 15.2 14.2 16 14 17h-4c-.2-1-.7-1.8-1.6-2.5Z"></path>
    </svg>
  `;
  return indicator;
}

async function editTrackIsrc(track: MusicTrack): Promise<void> {
  const current = track.isrc || "";
  const input = window.prompt("ISRC (blank clears)", current);
  if (input === null) return;
  const isrc = normalizeIsrc(input);
  if (input.trim() && !isrc) {
    state.error = "That ISRC was not recognized.";
    render();
    return;
  }
  track.isrc = isrc;
  track.isrcConfidence = isrc ? 1 : 0;
  track.enrichment = isrc
    ? {
      status: "matched",
      attempts: track.enrichment.attempts,
      lastAttemptAt: Date.now(),
      nextRetryAt: null,
      candidates: [{
        isrc,
        confidence: 1,
        sources: ["manual"],
        title: track.title,
        artist: track.artist,
        album: track.album,
      }],
    }
    : {
      ...track.enrichment,
      status: "pending",
      nextRetryAt: null,
      candidates: [],
    };
  await saveTrack(track);
  state.status = isrc ? "ISRC saved" : "ISRC cleared";
  render();
}

async function reviewTrackCandidates(track: MusicTrack): Promise<void> {
  const candidates = track.enrichment.candidates.slice(0, 6);
  const lines = candidates.map((candidate, index) => {
    const sources = candidate.sources.join("+");
    return `${index + 1}. ${candidate.isrc} ${Math.round(candidate.confidence * 100)}% ${sources}`;
  });
  const input = window.prompt([
    "Choose ISRC candidate number.",
    "Use m to edit manually, r to retry lookup, x to reject all.",
    ...lines,
  ].join("\n"));
  if (!input) return;
  const value = input.trim().toLowerCase();
  if (value === "m") {
    await editTrackIsrc(track);
    return;
  }
  if (value === "r") {
    track.enrichment.status = "pending";
    track.enrichment.nextRetryAt = null;
    await saveTrack(track);
    await runEnrichmentQueue();
    return;
  }
  if (value === "x") {
    track.enrichment = {
      ...track.enrichment,
      status: "unresolved",
      nextRetryAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      candidates: [],
    };
    await saveTrack(track);
    render();
    return;
  }
  const selected = candidates[Number(value) - 1];
  if (!selected) return;
  track.isrc = selected.isrc;
  track.isrcConfidence = selected.confidence;
  track.enrichment = {
    ...track.enrichment,
    status: "matched",
    lastAttemptAt: Date.now(),
    nextRetryAt: null,
    candidates,
  };
  await saveTrack(track);
  state.status = "ISRC candidate accepted";
  render();
}

function renderQueue(body: HTMLElement): void {
  const toolbar = document.createElement("div");
  toolbar.className = "milxdy-music-toolbar milxdy-music-toolbar-compact";
  toolbar.append(
    actionButton("Play queue", () => {
      const ids = state.playback.queueTrackIds;
      if (ids[0]) void playTrack(ids[Math.max(0, state.playback.currentIndex)], ids);
    }),
    actionButton("Shuffle queue", shuffleQueue),
    actionButton("Clear queue", () => {
      state.playback.queueTrackIds = [];
      state.playback.currentIndex = -1;
      render();
    }),
  );
  body.append(toolbar);
  const list = document.createElement("div");
  list.className = "milxdy-music-track-list";
  const ids = state.playback.queueTrackIds;
  for (const [index, id] of ids.entries()) {
    const track = state.tracks.find((candidate) => candidate.id === id);
    if (!track) continue;
    const row = document.createElement("div");
    row.className = "milxdy-music-track";
    row.dataset.active = String(index === state.playback.currentIndex);
    const main = document.createElement("button");
    main.type = "button";
    main.addEventListener("click", () => void playTrack(track.id, ids));
    const title = document.createElement("strong");
    title.textContent = track.title;
    const meta = document.createElement("span");
    meta.textContent = `${index + 1} · ${track.artist} · ${formatDuration(track.durationMs)}`;
    main.append(title, meta);
    const right = document.createElement("span");
    right.className = "milxdy-music-track-side";
    right.textContent = index === state.playback.currentIndex ? "Now" : index > state.playback.currentIndex ? "Next" : "Played";
    const actions = document.createElement("div");
    actions.className = "milxdy-music-track-actions";
    actions.append(
      iconButton("Up", "Move earlier", () => moveQueueTrack(index, -1)),
      iconButton("Dn", "Move later", () => moveQueueTrack(index, 1)),
      transportButton("remove", "Remove from queue", () => {
        state.playback.queueTrackIds.splice(index, 1);
        if (state.playback.currentIndex >= state.playback.queueTrackIds.length) {
          state.playback.currentIndex = state.playback.queueTrackIds.length - 1;
        }
        render();
      }),
    );
    row.append(main, right, actions);
    list.append(row);
  }
  body.append(list.children.length ? list : emptyState("Queue is empty."));
}

function renderPlaylists(body: HTMLElement): void {
  const toolbar = document.createElement("div");
  toolbar.className = "milxdy-music-toolbar";
  toolbar.append(
    actionButton("New from visible", () => void createPlaylistFromSelection(filteredTracks().map((track) => track.id))),
    actionButton("Scan page QR", () => void scanVisiblePageImages()),
    fileButton("Import JSON/QR", ".json,image/*", async (file) => {
      if (file.type.startsWith("image/")) await scanQrFile(file);
      else await importPlaylistPayload(await file.text());
    }),
  );
  body.append(toolbar);
  const list = document.createElement("div");
  list.className = "milxdy-music-playlist-list";
  for (const playlist of state.playlists) list.append(playlistCard(playlist));
  body.append(list.children.length ? list : emptyState("No playlists yet."));
  const selected = state.playlists.find((playlist) => playlist.id === state.selectedPlaylistId);
  if (selected) body.append(playlistEditor(selected));
  if (state.lastQrDataUrl) body.append(qrPreview());
}

function playlistCard(playlist: MusicPlaylist): HTMLElement {
  const card = document.createElement("article");
  card.className = "milxdy-music-playlist";
  const matched = playlist.trackRefs.filter((ref) => Boolean(resolveTrackRef(ref))).length;
  const title = document.createElement("strong");
  title.textContent = playlist.name;
  const meta = document.createElement("span");
  meta.textContent = `${playlist.trackRefs.length} tracks · ${matched} matched`;
  const actions = document.createElement("div");
  actions.append(iconButton("E", "Edit playlist", () => {
    state.selectedPlaylistId = playlist.id;
    render();
  }));
  actions.append(
    iconButton("▶", "Play playlist", () => void playPlaylist(playlist)),
    iconButton("▣", "Export QR", () => void exportPlaylistQr(playlist)),
    iconButton("⏱", "Start radio", () => void createRadioSession(playlist)),
    iconButton("⇩", "Download JSON", () => downloadText(`${slug(playlist.name)}.json`, JSON.stringify(playlistPayload(playlist), null, 2))),
  );
  card.append(title, meta, actions);
  return card;
}

function playlistEditor(playlist: MusicPlaylist): HTMLElement {
  const wrap = document.createElement("section");
  wrap.className = "milxdy-music-editor";
  const header = document.createElement("div");
  header.className = "milxdy-music-editor-header";
  const title = document.createElement("strong");
  title.textContent = playlist.name;
  header.append(
    title,
    actionButton("Add visible", () => void addTracksToPlaylist(playlist, filteredTracks().map((track) => track.id))),
    actionButton("Rename", () => void renamePlaylist(playlist)),
    actionButton("Done", () => {
      state.selectedPlaylistId = null;
      render();
    }),
  );
  wrap.append(header);
  const list = document.createElement("div");
  list.className = "milxdy-music-track-list";
  playlist.trackRefs.forEach((ref, index) => {
    const local = resolveTrackRef(ref);
    const row = document.createElement("div");
    row.className = "milxdy-music-track";
    row.dataset.unresolved = String(!local);
    const main = document.createElement("button");
    main.type = "button";
    main.addEventListener("click", () => {
      if (local) void playTrack(local.id, resolvePlaylistTrackIds(playlist));
    });
    const rowTitle = document.createElement("strong");
    rowTitle.textContent = ref.title || local?.title || "Unresolved track";
    const meta = document.createElement("span");
    meta.textContent = local
      ? `${local.artist} - ${ref.isrc || "metadata match"}`
      : `${ref.artist || "Unknown Artist"} - unresolved${ref.isrc ? ` - ${ref.isrc}` : ""}`;
    main.append(rowTitle, meta);
    const actions = document.createElement("div");
    actions.className = "milxdy-music-track-actions";
    actions.append(
      iconButton("Up", "Move up", () => void movePlaylistTrack(playlist, index, -1)),
      iconButton("Dn", "Move down", () => void movePlaylistTrack(playlist, index, 1)),
      iconButton("Match", "Try matching this track again", () => void relinkPlaylistTrack(playlist, index)),
      iconButton("X", "Remove from playlist", () => void removePlaylistTrack(playlist, index)),
    );
    row.append(main, actions);
    list.append(row);
  });
  wrap.append(list.children.length ? list : emptyState("Playlist has no tracks."));
  return wrap;
}

async function renamePlaylist(playlist: MusicPlaylist): Promise<void> {
  const name = window.prompt("Playlist name", playlist.name)?.trim();
  if (!name) return;
  playlist.name = name;
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  render();
}

async function addTracksToPlaylist(playlist: MusicPlaylist, trackIds: string[]): Promise<void> {
  const existing = new Set(playlist.trackRefs.map((ref) => ref.localTrackId).filter(Boolean));
  let added = 0;
  for (const id of trackIds) {
    if (existing.has(id)) continue;
    const track = state.tracks.find((candidate) => candidate.id === id);
    if (!track) continue;
    playlist.trackRefs.push({
      localTrackId: track.id,
      isrc: track.isrc ?? undefined,
      title: track.title,
      artist: track.artist,
      album: track.album,
      durationMs: track.durationMs,
    });
    existing.add(id);
    added += 1;
  }
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  state.status = added ? `Added ${added} tracks to ${playlist.name}` : "Playlist already has those tracks";
  render();
}

async function relinkPlaylistTrack(playlist: MusicPlaylist, index: number): Promise<void> {
  const ref = playlist.trackRefs[index];
  if (!ref) return;
  const match = matchImportedTrack(ref);
  if (!match) {
    state.error = "No local match found for that playlist track.";
    render();
    return;
  }
  playlist.trackRefs[index] = {
    ...ref,
    localTrackId: match.id,
    isrc: ref.isrc || match.isrc || undefined,
    title: ref.title || match.title,
    artist: ref.artist || match.artist,
    album: ref.album || match.album,
    durationMs: ref.durationMs ?? match.durationMs,
  };
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  state.status = `Matched ${match.title}`;
  state.error = "";
  render();
}

async function movePlaylistTrack(playlist: MusicPlaylist, index: number, delta: number): Promise<void> {
  const next = index + delta;
  if (next < 0 || next >= playlist.trackRefs.length) return;
  const [entry] = playlist.trackRefs.splice(index, 1);
  playlist.trackRefs.splice(next, 0, entry);
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  render();
}

async function removePlaylistTrack(playlist: MusicPlaylist, index: number): Promise<void> {
  playlist.trackRefs.splice(index, 1);
  playlist.updatedAt = Date.now();
  await savePlaylist(playlist);
  render();
}

async function playPlaylist(playlist: MusicPlaylist): Promise<void> {
  const ids = resolvePlaylistTrackIds(playlist);
  if (ids[0]) await playTrack(ids[0], ids);
}

function resolvePlaylistTrackIds(playlist: MusicPlaylist): string[] {
  return playlist.trackRefs
    .map((ref) => resolveTrackRef(ref)?.id)
    .filter((id): id is string => Boolean(id));
}

function resolveTrackRef(ref: MusicPlaylist["trackRefs"][number]): MusicTrack | null {
  const local = ref.localTrackId ? state.tracks.find((track) => track.id === ref.localTrackId && !track.unavailable) : null;
  if (local) return local;
  return matchImportedTrack(ref);
}

function matchImportedTrack(ref: MusicPlaylist["trackRefs"][number]): MusicTrack | null {
  return matchingTrackCandidates(ref)[0] || null;
}

function matchingTrackCandidates(ref: MusicPlaylist["trackRefs"][number]): MusicTrack[] {
  const candidates = state.tracks
    .filter((track) => !track.unavailable)
    .map((track) => ({ track, score: trackMatchScore(track, ref) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.track.addedAt - b.track.addedAt);
  if (candidates.length) return candidates.map((entry) => entry.track);
  if (!ref.isrc) return [];
  return state.tracks.filter((track) => track.isrc === ref.isrc);
}

function trackMatchScore(track: MusicTrack, ref: MusicPlaylist["trackRefs"][number]): number {
  if (ref.localTrackId && track.id === ref.localTrackId) return 1;
  if (ref.isrc && track.isrc === ref.isrc) return 0.98;
  if (!ref.title || !looseEqual(track.title, ref.title)) return 0;
  let score = 0.54;
  if (ref.artist && looseEqual(track.artist, ref.artist)) score += 0.24;
  if (ref.album && looseEqual(track.album, ref.album)) score += 0.06;
  if (ref.durationMs && track.durationMs) {
    const delta = Math.abs(ref.durationMs - track.durationMs);
    if (delta <= DUPLICATE_CONFIDENCE_MS) score += 0.14;
    else if (delta <= 8000) score += 0.06;
  }
  return score >= 0.72 ? score : 0;
}

function qrPreview(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "milxdy-music-qr";
  const image = document.createElement("img");
  image.src = state.lastQrDataUrl;
  image.alt = "Playlist QR";
  wrap.append(image, actionButton("Download QR", () => downloadDataUrl("milxdy-playlist-qr.png", state.lastQrDataUrl)));
  return wrap;
}

function renderRadio(body: HTMLElement): void {
  const hint = document.createElement("div");
  hint.className = "milxdy-music-hint";
  hint.textContent = "Radio sessions use playlist metadata and a shared start time. Join computes the current track and offset locally.";
  body.append(hint);
  const list = document.createElement("div");
  list.className = "milxdy-music-playlist-list";
  for (const session of state.radioSessions) {
    const card = document.createElement("article");
    card.className = "milxdy-music-playlist";
    card.dataset.active = String(state.activeRadioSessionId === session.id);
    const title = document.createElement("strong");
    title.textContent = session.name;
    const position = currentRadioPosition(session);
    const meta = document.createElement("span");
    meta.textContent = `${state.activeRadioSessionId === session.id ? "Joined - " : ""}${new Date(session.start).toLocaleString()} - ${position.label}`;
    const actions = document.createElement("div");
    actions.append(iconButton("Sync", "Manual resync", () => void joinRadio(session)));
    actions.append(
      iconButton("▶", "Join radio", () => void joinRadio(session)),
      iconButton("▣", "Export radio QR", () => void exportPlaylistQr(session.playlist, session.start)),
    );
    card.append(title, meta, actions);
    list.append(card);
  }
  body.append(list.children.length ? list : emptyState("No radio sessions yet. Start one from a playlist."));
  if (state.lastQrDataUrl) body.append(qrPreview());
}

function renderSettings(body: HTMLElement): void {
  const settings = document.createElement("div");
  settings.className = "milxdy-music-settings";
  settings.append(
    settingLine("Folders", `${state.folders.length}`, actionButton("Add folder", () => void addFolder())),
    settingLine("Tracks", `${state.tracks.length}`, actionButton("Rescan", () => void rescanFolders())),
    settingLine("Missing files", `${state.tracks.filter((track) => track.unavailable).length}`, actionButton("Repair", () => void repairMissingTracks())),
    settingLine("ISRC matched", `${state.tracks.filter((track) => track.isrc).length}`, actionButton("Enrich", () => void runEnrichmentQueue())),
    autoAcceptSettingLine(),
    settingLine("Library index", "Local IndexedDB", actionButton("Clear", () => void clearLibrary())),
  );
  body.append(settings);
  body.append(folderListPanel());
  body.append(reviewQueuePanel());
}

function folderListPanel(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "milxdy-music-editor";
  const title = document.createElement("strong");
  title.textContent = "Music folders";
  wrap.append(title);
  if (!state.folders.length) {
    wrap.append(emptyState("No folders added."));
    return wrap;
  }
  const list = document.createElement("div");
  list.className = "milxdy-music-playlist-list";
  for (const folder of state.folders) {
    const row = document.createElement("article");
    row.className = "milxdy-music-playlist";
    const name = document.createElement("strong");
    name.textContent = folder.name;
    const count = state.tracks.filter((track) => track.folderId === folder.id).length;
    const meta = document.createElement("span");
    const folderStatus = folder.lastStatus && folder.lastStatus !== "ready" ? ` - ${folder.lastStatus}` : "";
    const scanned = folder.lastScannedAt ? ` - scanned ${new Date(folder.lastScannedAt).toLocaleString()}` : "";
    meta.textContent = `${count} tracks${folderStatus}${scanned}`;
    if (folder.lastError) meta.title = folder.lastError;
    const actions = document.createElement("div");
    actions.append(
      actionButton("Test", () => void testFolder(folder)),
      actionButton("Remove", () => void removeFolder(folder)),
    );
    row.append(name, meta, actions);
    list.append(row);
  }
  wrap.append(list);
  return wrap;
}

async function testFolder(folder: MusicFolder): Promise<void> {
  state.error = "";
  state.status = `Testing ${folder.name}`;
  render();
  const allowed = await requestReadPermission(folder.handle);
  if (!allowed) {
    state.status = "Folder test failed";
    state.error ||= "Folder access was not granted.";
    render();
    return;
  }
  try {
    for await (const entry of walkDirectory(folder.handle)) {
      if (!isSupportedAudio(entry.file.name)) continue;
      state.status = `Folder OK · found ${entry.file.name}`;
      render();
      return;
    }
    state.status = "Folder OK · no supported audio found";
    render();
  } catch (error) {
    state.status = "Folder test failed";
    state.error = folderAccessErrorMessage(error);
    render();
  }
}

function renderPlayer(): void {
  const root = state.root;
  const player = root?.querySelector<HTMLElement>('[data-role="player"]');
  if (!player) return;
  player.textContent = "";
  const track = state.tracks.find((candidate) => candidate.id === state.currentTrackId);

  const info = document.createElement("div");
  info.className = "milxdy-music-now";
  const art = document.createElement("div");
  art.className = "milxdy-music-art";
  if (!track) art.dataset.empty = "true";
  if (track?.artworkDataUrl) {
    const image = document.createElement("img");
    image.src = track.artworkDataUrl;
    image.alt = "";
    art.append(image);
  } else {
    if (track) art.textContent = initialsForTrack(track);
  }
  const text = document.createElement("div");
  text.className = "milxdy-music-now-text";
  const title = document.createElement("strong");
  title.dataset.role = "player-title";
  title.textContent = track?.title || "No track";
  const meta = document.createElement("span");
  meta.dataset.role = "player-meta";
  const queueLabel = track && state.playback.queueTrackIds.length
    ? ` · ${Math.max(0, state.playback.currentIndex) + 1}/${state.playback.queueTrackIds.length}`
    : "";
  meta.textContent = track ? `${track.artist} · ${track.album}${queueLabel}` : "Add music to start";
  text.append(title, meta);
  info.append(art, text);

  const controls = document.createElement("div");
  controls.className = "milxdy-music-controls";
  const shuffle = transportButton("shuffle", `Shuffle ${state.playback.shuffle ? "on" : "off"}`, toggleShuffle);
  shuffle.dataset.playerAction = "shuffle";
  shuffle.dataset.active = String(state.playback.shuffle);
  const repeat = transportButton(
    state.playback.repeatMode === "one" ? "repeat-one" : "repeat",
    `Repeat ${state.playback.repeatMode}`,
    cycleRepeat,
  );
  repeat.dataset.playerAction = "repeat";
  repeat.dataset.active = String(state.playback.repeatMode !== "off");
  const previous = transportButton("previous", "Previous", () => void playPrevious());
  previous.dataset.playerAction = "previous";
  const playPause = transportButton(state.playback.playing ? "pause" : "play", "Play/pause", togglePlayback, true);
  playPause.dataset.playerAction = "playpause";
  const next = transportButton("next", "Next", () => void playNext());
  next.dataset.playerAction = "next";
  controls.append(
    shuffle,
    previous,
    playPause,
    next,
    repeat,
  );

  const seek = document.createElement("input");
  seek.type = "range";
  seek.dataset.role = "player-seek";
  seek.min = "0";
  seek.max = String(track?.durationMs || 1);
  seek.value = String(state.playback.currentTimeMs);
  seek.addEventListener("input", () => {
    if (audio) audio.currentTime = Number(seek.value) / 1000;
  });
  const volume = document.createElement("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "1";
  volume.step = "0.01";
  volume.value = String(state.playback.volume);
  volume.title = "Volume";
  volume.addEventListener("input", () => {
    setVolume(Number(volume.value));
  });

  const progress = document.createElement("div");
  progress.className = "milxdy-music-progress";
  const compactPlayPause = transportButton(state.playback.playing ? "pause" : "play", "Play/pause", togglePlayback, true);
  compactPlayPause.classList.add("milxdy-music-progress-play");
  compactPlayPause.dataset.playerAction = "compact-playpause";
  const elapsed = document.createElement("span");
  elapsed.dataset.role = "player-elapsed";
  elapsed.textContent = formatDuration(state.playback.currentTimeMs);
  const total = document.createElement("span");
  total.dataset.role = "player-total";
  total.textContent = formatDuration(track?.durationMs);
  progress.append(compactPlayPause, elapsed, seek, total);

  const volumeRow = document.createElement("div");
  volumeRow.className = "milxdy-music-volume";
  const speaker = transportButton(state.playback.volume <= 0.01 ? "speaker-muted" : "speaker", state.playback.volume <= 0.01 ? "Unmute" : "Mute", toggleMute);
  speaker.dataset.playerAction = "mute";
  speaker.dataset.active = String(state.playback.volume <= 0.01);
  volumeRow.append(speaker, volume);

  player.append(info, progress, controls, volumeRow);
}

function updatePlayerOnly(): void {
  const root = state.root;
  if (!root) return;
  const track = state.tracks.find((candidate) => candidate.id === state.currentTrackId);
  const seek = root.querySelector<HTMLInputElement>('[data-role="player-seek"]');
  const elapsed = root.querySelector<HTMLElement>('[data-role="player-elapsed"]');
  const total = root.querySelector<HTMLElement>('[data-role="player-total"]');
  const meta = root.querySelector<HTMLElement>('[data-role="player-meta"]');
  const compactTitle = root.querySelector<HTMLElement>('[data-role="compact-title"]');
  if (seek) {
    seek.max = String(track?.durationMs || 1);
    seek.value = String(state.playback.currentTimeMs);
  }
  if (elapsed) elapsed.textContent = formatDuration(state.playback.currentTimeMs);
  if (total) total.textContent = formatDuration(track?.durationMs);
  if (compactTitle) {
    compactTitle.textContent = track?.title || "Music";
    compactTitle.title = track?.title || "Music";
  }
  if (meta && track) {
    const queueLabel = state.playback.queueTrackIds.length
      ? ` · ${Math.max(0, state.playback.currentIndex) + 1}/${state.playback.queueTrackIds.length}`
      : "";
    meta.textContent = `${track.artist} · ${track.album}${queueLabel}`;
  }
}

function emptyState(text: string): HTMLElement {
  const node = document.createElement("div");
  node.className = "milxdy-music-empty";
  node.textContent = text;
  return node;
}

function libraryEmptyState(): HTMLElement {
  const node = document.createElement("div");
  node.className = "milxdy-music-empty milxdy-music-empty-library";
  const title = document.createElement("strong");
  title.textContent = "No local music indexed";
  const copy = document.createElement("span");
  copy.textContent = "Choose a folder to build your library.";
  const button = actionButton("Add folder", () => void addFolder());
  button.title = "Add folder";
  button.setAttribute("aria-label", "Add folder");
  node.append(title, copy, button);
  return node;
}

function actionButton(label: string, onClick: () => void, icon?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  if (icon) {
    button.className = "milxdy-music-action-icon-label";
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    button.append(uiIcon(icon), labelNode);
  } else {
    button.textContent = label;
  }
  button.addEventListener("click", onClick);
  return button;
}

function uiIcon(icon: string): HTMLSpanElement {
  const iconNode = document.createElement("span");
  iconNode.className = "milxdy-music-ui-icon";
  iconNode.dataset.icon = icon;
  iconNode.setAttribute("aria-hidden", "true");
  return iconNode;
}

function iconButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = actionButton(label, onClick);
  button.title = title;
  button.setAttribute("aria-label", title);
  return button;
}

function transportButton(icon: string, title: string, onClick: () => void, primary = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `milxdy-music-transport milxdy-music-transport-${icon}`;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.dataset.primary = String(primary);
  button.addEventListener("click", (event) => {
    if (button.dataset.playerAction) return;
    event.preventDefault();
    onClick();
  });
  if (icon === "speaker" || icon === "speaker-muted") {
    button.append(speakerIcon(icon === "speaker-muted"));
    return button;
  }
  button.append(transportShape(icon));
  return button;
}

function transportShape(icon: string): HTMLSpanElement {
  const shape = document.createElement("span");
  shape.setAttribute("aria-hidden", "true");
  shape.textContent = transportGlyph(icon);
  return shape;
}

function speakerIcon(muted: boolean): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("milxdy-music-speaker-svg");

  const body = document.createElementNS("http://www.w3.org/2000/svg", "path");
  body.setAttribute("d", "M4 9h4l5-4v14l-5-4H4z");
  body.setAttribute("fill", "currentColor");
  svg.append(body);

  if (muted) {
    const left = document.createElementNS("http://www.w3.org/2000/svg", "path");
    left.setAttribute("d", "M17 9l4 4m0-4l-4 4");
    left.setAttribute("fill", "none");
    left.setAttribute("stroke", "currentColor");
    left.setAttribute("stroke-width", "2");
    left.setAttribute("stroke-linecap", "round");
    svg.append(left);
  } else {
    const wave = document.createElementNS("http://www.w3.org/2000/svg", "path");
    wave.setAttribute("d", "M16 8.5c1.2 1 1.8 2.2 1.8 3.5s-.6 2.5-1.8 3.5M18.8 6c1.8 1.6 2.7 3.6 2.7 6s-.9 4.4-2.7 6");
    wave.setAttribute("fill", "none");
    wave.setAttribute("stroke", "currentColor");
    wave.setAttribute("stroke-width", "2");
    wave.setAttribute("stroke-linecap", "round");
    svg.append(wave);
  }

  return svg;
}

function transportGlyph(icon: string): string {
  if (icon === "play") return "▶";
  if (icon === "pause") return "";
  if (icon === "previous") return "⏮";
  if (icon === "next") return "⏭";
  if (icon === "shuffle") return "⇄";
  if (icon === "repeat") return "↻";
  if (icon === "repeat-one") return "↻1";
  if (icon === "speaker") return "VOL";
  if (icon === "speaker-muted") return "MUTE";
  if (icon === "queue-add") return "+";
  if (icon === "remove") return "×";
  return "";
}

function initialsForTrack(track: MusicTrack): string {
  const words = [track.artist, track.title]
    .flatMap((value) => value.split(/\s+/))
    .map((word) => word.trim())
    .filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "♪";
}

function fileButton(label: string, accept: string, onFile: (file: File) => Promise<void>): HTMLButtonElement {
  const button = actionButton(label, () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void onFile(file);
    });
    input.click();
  });
  return button;
}

function settingLine(label: string, value: string, action: HTMLElement): HTMLElement {
  const row = document.createElement("div");
  row.className = "milxdy-music-setting";
  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = label;
  const small = document.createElement("small");
  small.textContent = value;
  copy.append(strong, small);
  row.append(copy, action);
  return row;
}

function autoAcceptSettingLine(): HTMLElement {
  const row = document.createElement("label");
  row.className = "milxdy-music-setting milxdy-music-check-setting";
  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = "Auto-match ISRC";
  const small = document.createElement("small");
  small.textContent = "Accept high-confidence metadata matches";
  copy.append(strong, small);
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = state.autoAcceptHighConfidenceIsrc;
  input.addEventListener("change", () => {
    state.autoAcceptHighConfidenceIsrc = input.checked;
    void chrome.storage.local.set({ [AUTO_ACCEPT_ISRC_KEY]: state.autoAcceptHighConfidenceIsrc });
  });
  row.append(copy, input);
  return row;
}

async function removeFolder(folder: MusicFolder): Promise<void> {
  const count = state.tracks.filter((track) => track.folderId === folder.id).length;
  if (!window.confirm(`Remove ${folder.name} from the music library index? ${count} indexed tracks will be removed. Local files are not touched.`)) return;
  const db = await openDb();
  await deleteItem(db, "folders", folder.id);
  const trackIds = state.tracks.filter((track) => track.folderId === folder.id).map((track) => track.id);
  await Promise.all(trackIds.map((id) => deleteItem(db, "tracks", id)));
  state.folders = state.folders.filter((candidate) => candidate.id !== folder.id);
  state.tracks = state.tracks.filter((track) => track.folderId !== folder.id);
  state.playback.queueTrackIds = state.playback.queueTrackIds.filter((id) => !trackIds.includes(id));
  playbackHistory.remove(trackIds);
  if (state.currentTrackId && trackIds.includes(state.currentTrackId)) {
    audio?.pause();
    state.currentTrackId = null;
    state.playback.playing = false;
  }
  state.status = `Removed ${folder.name}`;
  state.error = "";
  render();
}

function reviewQueuePanel(): HTMLElement {
  const wrap = document.createElement("section");
  wrap.className = "milxdy-music-editor";
  const header = document.createElement("div");
  header.className = "milxdy-music-editor-header";
  const title = document.createElement("strong");
  const reviewTracks = state.tracks.filter((track) => track.enrichment.status === "review" && track.enrichment.candidates.length);
  const unresolvedTracks = state.tracks.filter((track) => track.enrichment.status === "unresolved" || track.enrichment.status === "error");
  title.textContent = `ISRC review · ${reviewTracks.length} review · ${unresolvedTracks.length} unresolved`;
  header.append(title, actionButton("Retry unresolved", () => void retryUnresolvedTracks()));
  wrap.append(header);
  const list = document.createElement("div");
  list.className = "milxdy-music-track-list";
  for (const track of [...reviewTracks, ...unresolvedTracks].slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "milxdy-music-track";
    const main = document.createElement("button");
    main.type = "button";
    main.addEventListener("click", () => void reviewTrackCandidates(track));
    const rowTitle = document.createElement("strong");
    rowTitle.textContent = track.title;
    const best = track.enrichment.candidates[0];
    const meta = document.createElement("span");
    meta.textContent = best
      ? `${track.enrichment.status} · ${best.isrc} · ${Math.round(best.confidence * 100)}%`
      : `${track.enrichment.status} · ${track.enrichment.error || "no match"}`;
    main.append(rowTitle, meta);
    const actions = document.createElement("div");
    actions.className = "milxdy-music-track-actions";
    actions.append(iconButton("Review", "Review ISRC candidates", () => void reviewTrackCandidates(track)));
    row.append(main, actions);
    list.append(row);
  }
  wrap.append(list.children.length ? list : emptyState("No ISRC review items."));
  return wrap;
}

async function retryUnresolvedTracks(): Promise<void> {
  const db = await openDb();
  for (const track of state.tracks) {
    if (isDefaultAchievementTrack(track)) continue;
    if (track.enrichment.status !== "unresolved" && track.enrichment.status !== "error") continue;
    track.enrichment.status = "pending";
    track.enrichment.nextRetryAt = null;
    await putItem(db, "tracks", track);
  }
  await runEnrichmentQueue();
}

async function clearLibrary(): Promise<void> {
  if (!window.confirm("Clear music library index? Local audio files are not touched.")) return;
  const db = await openDb();
  await Promise.all([
    clearStore(db, "tracks"),
    clearStore(db, "folders"),
    clearStore(db, "playlists"),
    clearStore(db, "radio"),
  ]);
  state.tracks = [];
  state.folders = [];
  state.playlists = [];
  state.radioSessions = [];
  state.tracks = withDefaultAchievementTrack([]);
  render();
}

async function repairMissingTracks(): Promise<void> {
  const db = await openDb();
  let repaired = 0;
  let missing = 0;
  for (const track of state.tracks) {
    if (isDefaultAchievementTrack(track)) continue;
    const file = await getTrackFile(track);
    const unavailable = !file;
    if (track.unavailable !== unavailable) {
      track.unavailable = unavailable;
      await putItem(db, "tracks", track);
      if (!unavailable) repaired += 1;
    }
    if (unavailable) missing += 1;
  }
  state.status = `Repair checked ${state.tracks.length} tracks · ${repaired} restored · ${missing} missing`;
  render();
}

async function saveTrack(track: MusicTrack): Promise<void> {
  if (isDefaultAchievementTrack(track)) {
    upsertTrack(track);
    return;
  }
  const db = await openDb();
  await putItem(db, "tracks", track);
  upsertTrack(track);
}

async function savePlaylist(playlist: MusicPlaylist): Promise<void> {
  const db = await openDb();
  await putItem(db, "playlists", playlist);
  const index = state.playlists.findIndex((candidate) => candidate.id === playlist.id);
  if (index >= 0) state.playlists[index] = playlist;
  else state.playlists.unshift(playlist);
  state.playlists.sort((a, b) => b.updatedAt - a.updatedAt);
}

function filteredTracks(): MusicTrack[] {
  const query = state.search.trim().toLowerCase();
  const tracks = query
    ? state.tracks.filter((track) => [track.title, track.artist, track.album, track.isrc || ""].join(" ").toLowerCase().includes(query))
    : [...state.tracks];
  return tracks.sort(compareTracksByActiveSort);
}

function selectedVisibleTrack(): MusicTrack | null {
  const tracks = filteredTracks();
  return tracks.find((track) => track.id === state.selectedTrackId) || tracks[0] || null;
}

function moveSelectedTrack(delta: number): void {
  if (state.tab !== "library") state.tab = "library";
  const tracks = filteredTracks();
  if (!tracks.length) return;
  const currentIndex = Math.max(0, tracks.findIndex((track) => track.id === state.selectedTrackId));
  const nextIndex = Math.max(0, Math.min(tracks.length - 1, currentIndex + delta));
  state.selectedTrackId = tracks[nextIndex].id;
  state.status = `${tracks[nextIndex].title}`;
  render();
  scrollSelectedTrackIntoView();
}

function playSelectedTrack(): void {
  if (state.tab !== "library") state.tab = "library";
  const track = selectedVisibleTrack();
  if (!track) return;
  state.selectedTrackId = track.id;
  void playTrack(track.id, filteredTracks().map((entry) => entry.id));
}

function scrollSelectedTrackIntoView(): void {
  window.requestAnimationFrame(() => {
    const id = cssEscape(state.selectedTrackId);
    if (!id) return;
    state.root?.querySelector<HTMLElement>(`.milxdy-music-track[data-track-id="${id}"]`)?.scrollIntoView({
      block: "nearest",
    });
  });
}

function upsertTrack(track: MusicTrack): void {
  const index = state.tracks.findIndex((candidate) => candidate.id === track.id);
  if (index >= 0) state.tracks[index] = track;
  else state.tracks.push(track);
  state.tracks.sort(compareTracks);
}

function withDefaultAchievementTrack(tracks: MusicTrack[]): MusicTrack[] {
  const withoutDefault = tracks.filter((track) => !isDefaultAchievementTrack(track));
  return [DEFAULT_ACHIEVEMENT_TRACK, ...withoutDefault].sort(compareTracksByActiveSort);
}

function isDefaultAchievementTrack(track: MusicTrack): boolean {
  return track.source === "bundled" || track.id === DEFAULT_ACHIEVEMENT_TRACK.id;
}

async function markRemovedTracks(db: IDBDatabase, folder: MusicFolder, seenPaths: Set<string>): Promise<number> {
  let removed = 0;
  for (const track of state.tracks.filter((candidate) => candidate.folderId === folder.id)) {
    if (seenPaths.has(track.path)) continue;
    if (track.unavailable !== true) {
      track.unavailable = true;
      track.lastIndexedAt = Date.now();
      await putItem(db, "tracks", track);
      removed += 1;
    }
  }
  return removed;
}

async function refreshDuplicateGroups(db: IDBDatabase): Promise<void> {
  const groups = new Map<string, MusicTrack[]>();
  for (const track of state.tracks) {
    track.duplicateKey ||= duplicateKeyFor(track);
    const key = track.duplicateKey;
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(track);
    groups.set(key, group);
  }
  for (const track of state.tracks) {
    const size = track.duplicateKey ? groups.get(track.duplicateKey)?.length ?? 1 : 1;
    if (track.duplicateGroupSize !== size) {
      track.duplicateGroupSize = size;
      await putItem(db, "tracks", track);
    }
  }
}

function compareTracks(a: MusicTrack, b: MusicTrack): number {
  return a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || a.title.localeCompare(b.title);
}

function compareTracksByActiveSort(a: MusicTrack, b: MusicTrack): number {
  if (state.sortKey === "default") {
    const bundledOrder = Number(isDefaultAchievementTrack(b)) - Number(isDefaultAchievementTrack(a));
    if (bundledOrder) return bundledOrder;
    return compareTracks(a, b);
  }
  if (state.sortKey === "title") return a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist);
  if (state.sortKey === "album") return a.album.localeCompare(b.album) || compareTracks(a, b);
  if (state.sortKey === "added") return b.addedAt - a.addedAt || compareTracks(a, b);
  return compareTracks(a, b);
}

function duplicateKeyFor(track: Pick<MusicTrack, "title" | "artist" | "album" | "durationMs" | "isrc">): string {
  if (track.isrc) return `isrc:${track.isrc}`;
  const durationBucket = track.durationMs ? Math.round(track.durationMs / DUPLICATE_CONFIDENCE_MS) : 0;
  return [
    "meta",
    normalizeLoose(track.artist || ""),
    normalizeLoose(track.title || ""),
    durationBucket,
    normalizeLoose(track.album || ""),
  ].join(":");
}

async function* walkDirectory(handle: FileSystemDirectoryHandle, prefix = ""): AsyncGenerator<{ file: File; handle: FileSystemFileHandle; path: string }> {
  const iterable = handle as FileSystemDirectoryHandle & {
    entries: () => AsyncIterable<[string, FileSystemHandle]>;
  };
  for await (const [name, child] of iterable.entries()) {
    if (child.kind === "file") {
      const fileHandle = child as FileSystemFileHandle;
      yield { file: await fileHandle.getFile(), handle: fileHandle, path: prefix ? `${prefix}/${name}` : name };
    } else if (child.kind === "directory") {
      yield* walkDirectory(child as FileSystemDirectoryHandle, prefix ? `${prefix}/${name}` : name);
    }
  }
}

function isSupportedAudio(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function supportsDirectoryPicker(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function inferMetadataFromFilename(name: string): { title?: string; artist?: string } {
  const clean = stripExtension(name)
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = clean.match(/^(.{1,80}?)\s+-\s+(.{1,120})$/);
  if (!match) return { title: clean };
  return {
    artist: normalizeMetadataText(match[1]),
    title: normalizeMetadataText(match[2]),
  };
}

function normalizeMetadataText(value: string | null | undefined): string {
  return (value || "")
    .replace(/\0+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIsrc(value: string | null | undefined): string | null {
  const match = (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").match(/[A-Z]{2}[A-Z0-9]{3}\d{7}/);
  return match?.[0] || null;
}

function formatDuration(value: number | null | undefined): string {
  if (!value || value < 0) return "0:00";
  const total = Math.floor(value / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parsePlaylistPayload(value: string): { kind: "playlist" | "radio"; name?: string; start?: string; tracks: Array<{ isrc?: string; title?: string; artist?: string; album?: string; durationMs?: number | null }> } | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (record.app !== "milxdy" || !Array.isArray(record.tracks)) return null;
    const start = typeof record.start === "string" && Number.isFinite(new Date(record.start).getTime())
      ? new Date(record.start).toISOString()
      : undefined;
    return {
      kind: record.kind === "radio" && start ? "radio" : "playlist",
      name: typeof record.name === "string" ? record.name : undefined,
      start,
      tracks: record.tracks.map((entry) => {
        const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
        return {
          isrc: typeof item.isrc === "string" ? normalizeIsrc(item.isrc) ?? undefined : undefined,
          title: typeof item.title === "string" ? normalizeMetadataText(item.title) : undefined,
          artist: typeof item.artist === "string" ? normalizeMetadataText(item.artist) : undefined,
          album: typeof item.album === "string" ? normalizeMetadataText(item.album) : undefined,
          durationMs: typeof item.durationMs === "number" && Number.isFinite(item.durationMs) ? item.durationMs : undefined,
        };
      }),
    };
  } catch {
    return null;
  }
}

function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  downloadUrl(name, url);
}

function downloadDataUrl(name: string, dataUrl: string): void {
  downloadUrl(name, dataUrl);
}

function downloadUrl(name: string, url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "playlist";
}

function updateDockState(): void {
  const badge = state.playback.playing ? "♪" : state.tracks.length ? String(state.tracks.length) : undefined;
  state.appFrame?.updateDock({ badgeText: badge, active: state.open, title: state.playback.playing ? "Music playing" : "Music" });
}

function normalizeTab(value: string | undefined): MusicTab {
  return value === "queue" || value === "playlists" || value === "radio" || value === "settings" ? value : "library";
}

function normalizeSortKey(value: string | undefined): MusicSortKey {
  return value === "artist" || value === "title" || value === "album" || value === "added" ? value : "default";
}

function normalizeTheme(value: unknown): MusicState["theme"] {
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
  registerOverlayAppRoot("music", root);
  const minimum = panelMinimums();
  const box = constrainPanelBox(clampOverlayPanelBox(panelBox(), { minWidth: minimum.minWidth, minHeight: minimum.minHeight, dockSide: state.side }));
  state.x = box.x ?? state.x;
  state.width = box.width;
  state.height = box.height;
  state.topOffset = box.topOffset;
  root.dataset.minimized = String(state.libraryMinimized);
  root.dataset.playerSize = compactPlayerSize();
  root.style.left = `${state.x}px`;
  root.style.right = "auto";
  root.style.setProperty("--music-width", `${state.width}px`);
  root.style.setProperty("--music-height", `${state.height}px`);
  root.style.setProperty("--music-top", `${state.topOffset}px`);
  markOverlayAppLayoutReady(root, state.layoutReady);
}

function startDrag(event: PointerEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("button, input, textarea, select, [data-role='resize']")) return;
  const root = state.root;
  if (!root) return;
  root.dataset.dragging = "true";
  startOverlayPanelDrag(event, {
    ...panelPointerOptions(),
    appId: "music",
    root,
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
    appId: "music",
    root,
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
  const minimum = panelMinimums();
  return {
    minWidth: minimum.minWidth,
    minHeight: minimum.minHeight,
    side: () => state.side,
    box: panelBox,
    setBox: (box: Partial<ReturnType<typeof panelBox>>) => {
      const next = constrainPanelBox({ ...panelBox(), ...box });
      state.x = next.x;
      state.width = next.width;
      state.height = next.height;
      state.topOffset = next.topOffset;
    },
    apply: applyLayout,
    persist: () => undefined,
  };
}

function clampTopOffset(value: number): number {
  const minimum = panelMinimums();
  return constrainPanelBox(clampOverlayPanelBox({ ...panelBox(), topOffset: value }, { minWidth: minimum.minWidth, minHeight: minimum.minHeight, dockSide: state.side })).topOffset;
}

function clampWidth(value: number): number {
  const minimum = panelMinimums();
  return constrainPanelBox(clampOverlayPanelBox({ ...panelBox(), width: value }, { minWidth: minimum.minWidth, minHeight: minimum.minHeight, dockSide: state.side })).width;
}

function clampHeight(value: number): number {
  const minimum = panelMinimums();
  return constrainPanelBox(clampOverlayPanelBox({ ...panelBox(), height: value }, { minWidth: minimum.minWidth, minHeight: minimum.minHeight, dockSide: state.side })).height;
}

function panelMinimums(): { minWidth: number; minHeight: number } {
  return state.libraryMinimized
    ? { minWidth: COMPACT_MIN_WIDTH, minHeight: COMPACT_MIN_HEIGHT }
    : { minWidth: FULL_MIN_WIDTH, minHeight: FULL_MIN_HEIGHT };
}

function compactPlayerSize(): "normal" | "tight" | "micro" {
  if (!state.libraryMinimized) {
    return state.height <= 360 || state.width <= 330 ? "tight" : "normal";
  }
  if (state.height <= COMPACT_HIDE_NOW_HEIGHT || state.width <= 280) return "micro";
  if (state.height <= COMPACT_TIGHT_HEIGHT || state.width <= 310) return "tight";
  return "normal";
}

function panelBox() {
  return { x: state.x, width: state.width, height: state.height, topOffset: state.topOffset };
}

function constrainPanelBox(box: OverlayPanelBox): ReturnType<typeof panelBox> {
  if (!state.libraryMinimized) return { ...box, x: box.x ?? state.x };
  return {
    ...box,
    x: box.x ?? state.x,
    width: Math.min(COMPACT_MAX_WIDTH, Math.max(COMPACT_MIN_WIDTH, box.width)),
    height: Math.min(COMPACT_MAX_HEIGHT, Math.max(COMPACT_MIN_HEIGHT, box.height)),
  };
}

function cssEscape(value: string | null): string {
  if (!value) return "";
  const css = window.CSS as unknown as { escape?: (input: string) => string };
  return css.escape ? css.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Music action failed.";
}

function folderAccessErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("system file") || lower.includes("system files") || lower.includes("appdata")) {
    return "The browser blocked that folder because it is inside a protected/system area. Move the music downloads to a normal Music or Downloads folder, then add that folder.";
  }
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Folder access was blocked by the browser. Choose a normal user folder, not AppData, Program Files, Windows, or a browser profile folder.";
  }
  if (error instanceof DOMException && error.name === "DataCloneError") {
    return "This browser cannot persist local folder handles for the music library. Use a Chromium browser for local music folders.";
  }
  return errorMessage(error);
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ["folders", "tracks", "playlists", "radio"]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB failed"));
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  dbPromise = pending;
  return pending;
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function putItem<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readwrite").objectStore(store).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteItem(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readwrite").objectStore(store).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clearStore(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readwrite").objectStore(store).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
