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
import { animateOverlayAppClose, ensureOverlayAppChromeStyles, markOverlayAppLayoutReady, prepareOverlayAppRoot } from "../../shared/overlayAppChrome";
import { registerOverlayAppRoot } from "../../shared/overlayAppLayout";
import type { MilxdyContentAppContext } from "../../shared/appPlatform";
import type { OverlayDockSide } from "../../shared/overlayDock";

const ROOT_ID = "milxdy-wiki-sidebar-root";
const STYLE_ID = "milxdy-wiki-sidebar-style";
const HOME_URL = "https://wiki.remilia.org/";
const APP_LABEL = "Remilia Wiki";
const WIKI_ICON_PATH = "wikiSidebar/remilia-wiki-favicon.png";
const WIDTH_KEY = "milxdy.wikiSidebar.width";
const HEIGHT_KEY = "milxdy.wikiSidebar.height";
const TOP_KEY = "milxdy.wikiSidebar.top";
const LAST_URL_KEY = "milxdy.wikiSidebar.lastUrl";
const PENDING_URL_KEY = "__milxdyPendingWikiSidebarUrl";

type SidebarState = {
  root: HTMLElement | null;
  frame: OverlayAppFrame | null;
  open: boolean;
  minimized: boolean;
  side: OverlayDockSide;
  x: number;
  width: number;
  height: number;
  topOffset: number;
  currentUrl: string;
  backStack: string[];
  forwardStack: string[];
  iframeLoaded: boolean;
  loadTimer: number | null;
  layoutReady: boolean;
  readerActive: boolean;
  openedAt: number;
};

type WikiSidebarNavigatedMessage = {
  type: "wikiSidebar:navigated";
  url: string;
};

type WikiSidebarNavigateMessage = {
  type: "wikiSidebar:navigate";
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

type WikiReaderHighlightMessage = {
  type: "wikiSidebar:highlightBoundary" | "wikiSidebar:clearReadHighlight";
  articleId?: string;
  charIndex?: number;
  charLength?: number | null;
  boundaryElapsedTime?: number | null;
  mode?: "off" | "word" | "smooth";
  hasSyncedBoundaries?: boolean;
  autoScroll?: boolean;
  speechRate?: number;
  status?: string;
};

const state: SidebarState = {
  root: null,
  frame: null,
  open: false,
  minimized: true,
  side: "right",
  x: 0,
  width: 430,
  height: 640,
  topOffset: 16,
  currentUrl: HOME_URL,
  backStack: [],
  forwardStack: [],
  iframeLoaded: false,
  loadTimer: null,
  layoutReady: false,
  readerActive: false,
  openedAt: 0,
};

let booted = false;
let lifecycleSignal: AbortSignal | null = null;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;

export function boot(context?: MilxdyContentAppContext): void {
  if (booted) return;
  booted = true;
  lifecycleSignal = context?.signal || null;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  injectStyles();
  ensureOverlayAppChromeStyles();
  registerDockItem();
  registerNavigationSync();
  const pendingUrl = consumePendingWikiSidebarUrl();
  if (pendingUrl) void openWikiUrl(pendingUrl);
  void loadStoredState(pendingUrl);
  const eventListener = (event: Event) => {
    const detail = (event as CustomEvent<{ url?: string }>).detail;
    void openWikiUrl(detail?.url);
  };
  document.addEventListener("milxdy:wiki-sidebar-open", eventListener);
  addRuntimeDisposable(() => document.removeEventListener("milxdy:wiki-sidebar-open", eventListener));
}

function registerNavigationSync(): void {
  const listener = (message: unknown) => {
    if (isWikiSidebarHistoryMessage(message)) {
      navigateHistory(message.direction);
      return false;
    }
    if (isWikiSidebarNavigateMessage(message)) {
      void openWikiUrl(message.url);
      return false;
    }
    if (isWikiSidebarNavigatedMessage(message)) {
      syncCurrentUrl(message.url);
      return false;
    }
    if (isWikiSidebarReadAloudRequestMessage(message)) {
      handleReadAloudRequest(message);
      return false;
    }
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  addRuntimeDisposable(() => chrome.runtime.onMessage.removeListener(listener));

  const readerStateListener = (event: Event) => {
    const detail = (event as CustomEvent<{ active?: boolean }>).detail;
    state.readerActive = detail?.active === true;
    const slot = state.root?.querySelector<HTMLElement>(".milxdy-wiki-sidebar-reader-slot");
    if (slot) slot.hidden = !state.readerActive;
    if (state.root) state.root.dataset.readerActive = String(state.readerActive);
    applyLayout();
  };
  const highlightListener = (event: Event) => {
    const detail = (event as CustomEvent<WikiReaderHighlightMessage>).detail;
    postToWikiFrame(detail);
  };
  document.addEventListener("post-reading:wiki-reading-state", readerStateListener);
  document.addEventListener("wikiSidebar:reader-highlight", highlightListener);
  addRuntimeDisposable(() => {
    document.removeEventListener("post-reading:wiki-reading-state", readerStateListener);
    document.removeEventListener("wikiSidebar:reader-highlight", highlightListener);
  });
}

export function open(): void {
  void openWikiUrl(state.currentUrl || HOME_URL);
}

export async function openWikiUrl(value?: string): Promise<void> {
  await navigateToWikiUrl(value, { recordHistory: true });
}

async function navigateToWikiUrl(value: unknown, options: { recordHistory: boolean }): Promise<void> {
  if (!lifecycleActive()) return;
  const url = normalizeWikiUrl(value) || HOME_URL;
  if (options.recordHistory && state.open && state.currentUrl !== url) {
    state.backStack.push(state.currentUrl);
    state.forwardStack = [];
  }
  state.currentUrl = url;
  state.open = true;
  state.minimized = false;
  state.iframeLoaded = false;
  state.openedAt = Date.now();
  updateDisplayedUrl(url);
  await chrome.storage.local.set({ [LAST_URL_KEY]: url });
  ensureRoot();
  render();
  state.frame?.updateDock({ title: `Wiki: ${wikiPageLabel(url)}` });
}

export function close(): void {
  closePanel();
}

export function disable(): void {
  closePanel();
}

export function dispose(): void {
  disable();
  clearLoadTimer();
  state.frame?.remove();
  state.frame = null;
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
  state.frame = createOverlayAppFrame({
    id: "wikiSidebar",
    label: APP_LABEL,
    icon: wikiIconUrl(),
    initialSide: state.side,
    isOpen: () => Boolean(state.root && state.open && !state.minimized),
    onOpen: () => void openWikiUrl(state.currentUrl || HOME_URL),
    onClose: closePanel,
    onSideChange: (side) => {
      state.side = side;
      applyLayout();
    },
  });
}

async function loadStoredState(initialPendingUrl?: string | null): Promise<void> {
  const startedAt = Date.now();
  const stored = await chrome.storage.local.get({
    [WIDTH_KEY]: state.width,
    [HEIGHT_KEY]: state.height,
    [TOP_KEY]: state.topOffset,
    [LAST_URL_KEY]: state.currentUrl,
  });
  const layout = await restoreOverlayPanelBox("wikiSidebar", {
    side: state.side,
    minWidth: 340,
    minHeight: 420,
    defaultWidth: state.width,
    defaultHeight: state.height,
    legacy: {
      width: stored[WIDTH_KEY],
      height: stored[HEIGHT_KEY],
      topOffset: stored[TOP_KEY],
    },
  });
  state.x = layout.x ?? state.x;
  state.width = layout.width;
  state.height = layout.height;
  state.topOffset = layout.topOffset;
  const pendingUrl = normalizeWikiUrl(initialPendingUrl) || consumePendingWikiSidebarUrl();
  if (pendingUrl) {
    state.currentUrl = pendingUrl;
  } else if (!state.open && state.openedAt <= startedAt) {
    state.currentUrl = normalizeWikiUrl(stored[LAST_URL_KEY]) || HOME_URL;
  }
  state.layoutReady = true;
  state.frame?.updateDock({ title: `Wiki: ${wikiPageLabel(state.currentUrl)}` });
  state.frame?.setSide(state.side);
  applyLayout();
}

function consumePendingWikiSidebarUrl(): string | null {
  const host = window as unknown as Record<string, unknown>;
  const value = host[PENDING_URL_KEY];
  if (typeof value === "string") {
    delete host[PENDING_URL_KEY];
    return normalizeWikiUrl(value);
  }
  return null;
}

function ensureRoot(): HTMLElement {
  if (state.root?.isConnected) return state.root;
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.className = "milxdy-overlay-app-shell milxdy-overlay-app-card";
  prepareOverlayAppRoot(root);
  root.dataset.theme = resolveOverlayPanelTheme();
  root.setAttribute("aria-label", "Remilia Wiki sidebar");

  const stopPropagation = (event: Event) => event.stopPropagation();
  for (const type of ["click", "mousedown", "mouseup", "pointerdown", "pointerup"]) {
    root.addEventListener(type, stopPropagation);
  }
  root.addEventListener("mousedown", handleMouseHistoryButton, true);
  root.addEventListener("auxclick", handleMouseHistoryButton, true);

  addRuntimeDisposable(observeOverlayPanelTheme(() => {
    root.dataset.theme = resolveOverlayPanelTheme();
  }));
  document.body.appendChild(root);
  state.root = root;
  return root;
}

function render(): void {
  const root = ensureRoot();
  root.textContent = "";
  root.dataset.open = String(state.open && !state.minimized);

  const header = document.createElement("header");
  header.className = "milxdy-wiki-sidebar-header milxdy-overlay-app-header";

  const title = document.createElement("div");
  title.className = "milxdy-wiki-sidebar-title";
  const logo = document.createElement("img");
  logo.className = "milxdy-wiki-sidebar-logo";
  logo.src = wikiIconUrl();
  logo.alt = "";
  logo.decoding = "async";
  const strong = document.createElement("strong");
  strong.textContent = APP_LABEL;
  const current = document.createElement("span");
  current.textContent = wikiPageLabel(state.currentUrl);
  const titleText = document.createElement("div");
  titleText.className = "milxdy-wiki-sidebar-title-text";
  titleText.append(strong, current);
  title.append(logo, titleText);

  const actions = document.createElement("div");
  actions.className = "milxdy-wiki-sidebar-actions";
  actions.append(
    iconButton("Back", "back", () => navigateHistory("back"), !canGoBack()),
    iconButton("Forward", "forward", () => navigateHistory("forward"), !canGoForward()),
    iconButton("Home", "home", () => void openWikiUrl(HOME_URL)),
    iconButton("Refresh", "refresh", reloadFrame),
    iconButton("Open in new tab", "external", openCurrentInTab),
    iconButton("Minimize", "minimize", closePanel),
  );

  header.append(title, actions);

  const urlRow = document.createElement("form");
  urlRow.className = "milxdy-wiki-sidebar-url";
  const input = document.createElement("input");
  input.type = "url";
  input.value = state.currentUrl;
  input.setAttribute("aria-label", "Wiki URL");
  const go = document.createElement("button");
  go.type = "submit";
  go.textContent = "Go";
  urlRow.append(input, go);
  urlRow.addEventListener("submit", (event) => {
    event.preventDefault();
    void openWikiUrl(input.value);
  });

  const viewer = document.createElement("div");
  viewer.className = "milxdy-wiki-sidebar-viewer";
  const iframe = document.createElement("iframe");
  iframe.className = "milxdy-wiki-sidebar-frame";
  iframe.title = APP_LABEL;
  iframe.src = embeddedWikiUrl(state.currentUrl);
  iframe.referrerPolicy = "no-referrer";
  iframe.sandbox.add(
    "allow-forms",
    "allow-popups",
    "allow-same-origin",
    "allow-scripts",
    "allow-top-navigation-by-user-activation",
  );
  iframe.addEventListener("load", () => {
    state.iframeLoaded = true;
    clearLoadTimer();
    viewer.dataset.loaded = "true";
  });
  viewer.appendChild(iframe);

  const fallback = document.createElement("div");
  fallback.className = "milxdy-wiki-sidebar-fallback";
  const fallbackText = document.createElement("p");
  fallbackText.textContent = "If the wiki blocks embedded display, open the same page in a normal tab.";
  const fallbackButton = document.createElement("button");
  fallbackButton.type = "button";
  fallbackButton.textContent = "Open page";
  fallbackButton.addEventListener("click", openCurrentInTab);
  fallback.append(fallbackText, fallbackButton);
  viewer.appendChild(fallback);

  const readerSlot = document.createElement("div");
  readerSlot.className = "milxdy-wiki-sidebar-reader-slot";
  readerSlot.hidden = !state.readerActive;

  const resize = document.createElement("button");
  resize.className = "milxdy-wiki-sidebar-resize";
  resize.type = "button";
  resize.setAttribute("aria-label", "Resize Wiki sidebar");
  resize.dataset.resizeAxis = "both";
  resize.addEventListener("pointerdown", startResize);

  const resizeSide = document.createElement("button");
  resizeSide.className = "milxdy-wiki-sidebar-resize-edge milxdy-wiki-sidebar-resize-edge-side";
  resizeSide.type = "button";
  resizeSide.dataset.resizeAxis = "x";
  resizeSide.setAttribute("aria-label", "Resize Wiki sidebar width");
  resizeSide.addEventListener("pointerdown", startResize);

  const resizeBottom = document.createElement("button");
  resizeBottom.className = "milxdy-wiki-sidebar-resize-edge milxdy-wiki-sidebar-resize-edge-bottom";
  resizeBottom.type = "button";
  resizeBottom.dataset.resizeAxis = "y";
  resizeBottom.setAttribute("aria-label", "Resize Wiki sidebar height");
  resizeBottom.addEventListener("pointerdown", startResize);

  function startResize(event: PointerEvent): void {
    const axis = resizeAxis(event.currentTarget);
    startOverlayPanelResize(event, {
      minWidth: 340,
      minHeight: 420,
      appId: "wikiSidebar",
      root,
      side: () => state.side,
      box: () => ({ x: state.x, width: state.width, height: state.height, topOffset: state.topOffset }),
      setBox: (box) => {
        state.x = box.x ?? state.x;
        state.width = box.width ?? state.width;
        state.height = box.height ?? state.height;
        state.topOffset = box.topOffset ?? state.topOffset;
      },
      apply: applyLayout,
      persist: (box) => {
        state.width = box.width;
        state.height = box.height;
        state.topOffset = box.topOffset;
        state.x = box.x ?? state.x;
        void chrome.storage.local.set({
          [WIDTH_KEY]: state.width,
          [HEIGHT_KEY]: state.height,
          [TOP_KEY]: state.topOffset,
        });
      },
    }, axis);
  }

  header.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement | null)?.closest("button, input")) return;
    root.dataset.dragging = "true";
    startOverlayPanelDrag(event, {
      minWidth: 340,
      minHeight: 420,
      appId: "wikiSidebar",
      root,
      side: () => state.side,
      box: () => ({ x: state.x, width: state.width, height: state.height, topOffset: state.topOffset }),
      setBox: (box) => {
        state.x = box.x ?? state.x;
        state.width = box.width ?? state.width;
        state.height = box.height ?? state.height;
        state.topOffset = box.topOffset ?? state.topOffset;
      },
      apply: applyLayout,
      persist: (box) => {
        state.width = box.width;
        state.height = box.height;
        state.topOffset = box.topOffset;
        state.x = box.x ?? state.x;
        root.dataset.dragging = "false";
        void chrome.storage.local.set({ [TOP_KEY]: state.topOffset });
      },
    });
  });

  root.append(header, urlRow, viewer, readerSlot, resize, resizeSide, resizeBottom);
  applyLayout();
  scheduleFrameFallback(viewer);
  state.frame?.updateDock({ active: true, title: `Wiki: ${wikiPageLabel(state.currentUrl)}` });
}

type IconName = "back" | "forward" | "home" | "refresh" | "external" | "minimize";

function iconButton(label: string, iconName: IconName, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.append(createIcon(iconName));
  button.addEventListener("click", onClick);
  return button;
}

function createIcon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const paths: Record<IconName, string[]> = {
    back: [
      "M15 18l-6-6 6-6",
    ],
    forward: [
      "M9 6l6 6-6 6",
    ],
    home: [
      "M3 10.5 12 3l9 7.5",
      "M5 9.5V21h5v-6h4v6h5V9.5",
    ],
    refresh: [
      "M20 6v5h-5",
      "M19 11a7 7 0 1 0-2.05 4.95",
    ],
    external: [
      "M14 4h6v6",
      "M10 14 20 4",
      "M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5",
    ],
    minimize: [
      "M6 18h12",
    ],
  };
  for (const d of paths[name]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function reloadFrame(): void {
  state.iframeLoaded = false;
  render();
}

function navigateHistory(direction: "back" | "forward"): void {
  const from = state.currentUrl;
  const target = direction === "back" ? state.backStack.pop() : state.forwardStack.pop();
  if (!target) return;
  if (direction === "back") state.forwardStack.push(from);
  else state.backStack.push(from);
  void navigateToWikiUrl(target, { recordHistory: false });
}

function canGoBack(): boolean {
  return state.backStack.length > 0;
}

function canGoForward(): boolean {
  return state.forwardStack.length > 0;
}

function handleMouseHistoryButton(event: MouseEvent): void {
  if (event.button !== 3 && event.button !== 4) return;
  event.preventDefault();
  event.stopPropagation();
  navigateHistory(event.button === 3 ? "back" : "forward");
}

function openCurrentInTab(): void {
  window.open(state.currentUrl, "_blank", "noopener,noreferrer");
}

function syncCurrentUrl(value: string): void {
  if (!state.open || state.minimized) return;
  const url = normalizeWikiUrl(value);
  if (!url || url === state.currentUrl) return;
  stopWikiReading();
  state.currentUrl = url;
  void chrome.storage.local.set({ [LAST_URL_KEY]: url });
  state.frame?.updateDock({ title: `Wiki: ${wikiPageLabel(url)}` });
  updateDisplayedUrl(url);
}

function updateDisplayedUrl(url: string): void {
  const input = state.root?.querySelector<HTMLInputElement>(".milxdy-wiki-sidebar-url input");
  if (input && document.activeElement !== input) input.value = url;
  const label = state.root?.querySelector<HTMLElement>(".milxdy-wiki-sidebar-title-text span");
  if (label) label.textContent = wikiPageLabel(url);
}

function closePanel(): void {
  stopWikiReading();
  state.open = false;
  state.minimized = true;
  clearLoadTimer();
  const root = state.root;
  state.root = null;
  state.frame?.updateDock({ active: false });
  animateOverlayAppClose(root, () => root?.remove());
}

function applyLayout(): void {
  if (!state.root) return;
  registerOverlayAppRoot("wikiSidebar", state.root);
  state.width = clampNumber(state.width, 340, Math.min(760, window.innerWidth - 120), 430);
  const effectiveHeight = clampNumber(
    state.readerActive ? Math.max(state.height, 520) : state.height,
    state.readerActive ? 520 : 420,
    Math.max(460, window.innerHeight - 24),
    state.readerActive ? 720 : 640,
  );
  state.root.dataset.side = state.side;
  const clamped = clampOverlayPanelBox({
    x: state.x,
    width: state.width,
    height: effectiveHeight,
    topOffset: state.topOffset,
  }, { minWidth: 340, minHeight: state.readerActive ? 520 : 420, dockSide: state.side });
  state.x = clamped.x ?? state.x;
  state.width = clamped.width;
  state.topOffset = clamped.topOffset;
  state.root.style.left = `${state.x}px`;
  state.root.style.right = "auto";
  state.root.style.width = `${state.width}px`;
  state.root.style.height = `${clamped.height}px`;
  state.root.style.top = `${state.topOffset}px`;
  state.root.dataset.readerActive = String(state.readerActive);
  markOverlayAppLayoutReady(state.root, state.layoutReady);
}

function handleReadAloudRequest(message: WikiSidebarReadAloudRequestMessage): void {
  state.readerActive = true;
  const slot = state.root?.querySelector<HTMLElement>(".milxdy-wiki-sidebar-reader-slot");
  if (slot) slot.hidden = false;
  if (state.root) state.root.dataset.readerActive = "true";
  applyLayout();
  document.dispatchEvent(new CustomEvent("post-reading:read-document", {
    detail: {
      id: message.articleId,
      title: message.title,
      text: message.text,
      source: "wiki",
    },
  }));
}

function stopWikiReading(): void {
  if (!state.readerActive) return;
  state.readerActive = false;
  postToWikiFrame({ type: "wikiSidebar:clearReadHighlight" });
  document.dispatchEvent(new CustomEvent("post-reading:stop-wiki-document"));
  const slot = state.root?.querySelector<HTMLElement>(".milxdy-wiki-sidebar-reader-slot");
  if (slot) slot.hidden = true;
  if (state.root) state.root.dataset.readerActive = "false";
  applyLayout();
}

function postToWikiFrame(message: WikiReaderHighlightMessage): void {
  const frame = state.root?.querySelector<HTMLIFrameElement>(".milxdy-wiki-sidebar-frame");
  frame?.contentWindow?.postMessage(message, "https://wiki.remilia.org");
}

function scheduleFrameFallback(viewer: HTMLElement): void {
  clearLoadTimer();
  state.loadTimer = window.setTimeout(() => {
    if (state.iframeLoaded || !viewer.isConnected) return;
    viewer.dataset.loaded = "false";
    viewer.dataset.slow = "true";
  }, 2200);
}

function clearLoadTimer(): void {
  if (state.loadTimer === null) return;
  window.clearTimeout(state.loadTimer);
  state.loadTimer = null;
}

function normalizeWikiUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, HOME_URL);
    if (url.protocol !== "https:" || !["remilia.wiki", "wiki.remilia.org"].includes(url.hostname)) return null;
    if (url.hostname === "remilia.wiki") url.hostname = "wiki.remilia.org";
    url.searchParams.delete("mobileaction");
    url.searchParams.delete("useskin");
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isWikiSidebarNavigatedMessage(message: unknown): message is WikiSidebarNavigatedMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:navigated" && typeof record.url === "string";
}

function isWikiSidebarNavigateMessage(message: unknown): message is WikiSidebarNavigateMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:navigate" && typeof record.url === "string";
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

function embeddedWikiUrl(value: string): string {
  const url = new URL(normalizeWikiUrl(value) || HOME_URL);
  url.searchParams.set("useskin", "minerva");
  url.searchParams.set("mobileaction", "toggle_view_mobile");
  return url.toString();
}

function wikiPageLabel(value: string): string {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, "") || "Home");
    return path.replace(/_/g, " ").slice(0, 64) || "Home";
  } catch {
    return "Home";
  }
}

function clampTopOffset(value: number): number {
  return clampNumber(value, 8, Math.max(8, window.innerHeight - 160), 16);
}

function resizeAxis(target: EventTarget | null): "both" | "x" | "y" {
  if (!(target instanceof HTMLElement)) return "both";
  return target.dataset.resizeAxis === "x" || target.dataset.resizeAxis === "y" ? target.dataset.resizeAxis : "both";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function wikiIconUrl(): string {
  return chrome.runtime.getURL(WIKI_ICON_PATH);
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      z-index: 2147483001;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
      color: #eef0ff;
      background: rgba(14, 15, 19, 0.96);
      border: 1px solid rgba(252, 224, 150, 0.26);
      border-radius: 8px;
      box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.28);
      font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      contain: layout style paint;
    }
    #${ROOT_ID}[data-theme="light"] {
      color: #202336;
      background: rgba(247, 248, 250, 0.98);
      border-color: rgba(70, 74, 108, 0.22);
      box-shadow: 4px 4px 0 rgba(15, 23, 42, 0.16);
    }
    #${ROOT_ID}.milxdy-overlay-app-card {
      border: 1px solid var(--milxdy-overlay-app-border) !important;
      border-right: 1px solid var(--milxdy-overlay-app-border) !important;
      border-bottom: 1px solid var(--milxdy-overlay-app-border) !important;
    }
    .milxdy-wiki-sidebar-header {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 10px 0;
      cursor: grab;
    }
    #${ROOT_ID}[data-dragging="true"] .milxdy-wiki-sidebar-header {
      cursor: grabbing;
    }
    .milxdy-wiki-sidebar-title {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .milxdy-wiki-sidebar-logo {
      flex: 0 0 30px;
      width: 30px;
      height: 30px;
      border-radius: 7px;
      object-fit: cover;
      box-shadow: 0 0 0 1px rgba(252, 224, 150, 0.22);
    }
    .milxdy-wiki-sidebar-title-text {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .milxdy-wiki-sidebar-title strong {
      font-size: 14px;
      line-height: 1.2;
    }
    .milxdy-wiki-sidebar-title span {
      overflow: hidden;
      color: rgba(238, 240, 255, 0.58);
      font-size: 11px;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${ROOT_ID}[data-theme="light"] .milxdy-wiki-sidebar-title span {
      color: rgba(32, 35, 54, 0.58);
    }
    .milxdy-wiki-sidebar-actions {
      flex: 0 0 auto;
      display: flex;
      gap: 5px;
    }
    .milxdy-wiki-sidebar-actions button,
    .milxdy-wiki-sidebar-url button,
    .milxdy-wiki-sidebar-fallback button {
      border: 1px solid rgba(252, 224, 150, 0.22);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: inherit;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      min-width: 30px;
      padding: 7px 8px;
      cursor: pointer;
    }
    .milxdy-wiki-sidebar-actions button {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .milxdy-wiki-sidebar-actions button:disabled {
      cursor: default;
      opacity: 0.42;
    }
    .milxdy-wiki-sidebar-actions svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }
    .milxdy-wiki-sidebar-url {
      flex: 0 0 auto;
      display: flex;
      gap: 6px;
      padding: 0 10px;
    }
    .milxdy-wiki-sidebar-url input {
      min-width: 0;
      flex: 1 1 auto;
      box-sizing: border-box;
      border: 1px solid rgba(252, 224, 150, 0.18);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: inherit;
      font: inherit;
      font-size: 12px;
      line-height: 1.2;
      padding: 7px 8px;
    }
    .milxdy-wiki-sidebar-viewer {
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      margin: 0 10px 5px;
      overflow: hidden;
      border: 1px solid rgba(252, 224, 150, 0.16);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.04);
    }
    #${ROOT_ID}[data-reader-active="true"] .milxdy-wiki-sidebar-viewer {
      min-height: 220px;
      margin-bottom: 0;
    }
    .milxdy-wiki-sidebar-reader-slot {
      flex: 0 0 auto;
      max-height: none;
      overflow: visible;
      margin: 0 10px 6px;
    }
    .milxdy-wiki-sidebar-reader-slot[hidden] {
      display: none;
    }
    .milxdy-wiki-sidebar-frame {
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
    }
    .milxdy-wiki-sidebar-fallback {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px;
      border: 1px solid rgba(252, 224, 150, 0.2);
      border-radius: 8px;
      background: rgba(14, 15, 19, 0.9);
      color: #eef0ff;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }
    .milxdy-wiki-sidebar-viewer[data-slow="true"] .milxdy-wiki-sidebar-fallback {
      display: flex;
    }
    .milxdy-wiki-sidebar-fallback p {
      margin: 0;
      font-size: 12px;
      line-height: 1.35;
    }
    .milxdy-wiki-sidebar-resize {
      position: absolute !important;
      z-index: 4;
      right: 3px;
      bottom: 3px;
      width: 18px;
      height: 18px;
      border: 0;
      background: transparent;
      cursor: nwse-resize;
    }
    .milxdy-wiki-sidebar-resize::before {
      content: "";
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 8px;
      height: 8px;
      border-right: 2px solid rgba(252, 224, 150, 0.56);
      border-bottom: 2px solid rgba(252, 224, 150, 0.56);
    }
    #${ROOT_ID}[data-side="right"] .milxdy-wiki-sidebar-resize {
      right: auto;
      left: 3px;
      cursor: nesw-resize;
    }
    #${ROOT_ID}[data-side="right"] .milxdy-wiki-sidebar-resize::before {
      right: auto;
      left: 3px;
      border-right: 0;
      border-left: 2px solid rgba(252, 224, 150, 0.56);
    }
    .milxdy-wiki-sidebar-resize-edge {
      position: absolute !important;
      z-index: 2;
      border: 0;
      background: transparent;
    }
    .milxdy-wiki-sidebar-resize-edge-side {
      top: 0;
      right: 0;
      bottom: 0;
      width: 8px;
      cursor: ew-resize;
    }
    #${ROOT_ID}[data-side="right"] .milxdy-wiki-sidebar-resize-edge-side {
      right: auto;
      left: 0;
    }
    .milxdy-wiki-sidebar-resize-edge-bottom {
      right: 0;
      bottom: 0;
      left: 0;
      height: 8px;
      cursor: ns-resize;
    }
  `;
  document.documentElement.appendChild(style);
}
