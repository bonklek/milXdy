import { createOverlayAppFrame, type OverlayAppFrame } from "../../platform/overlay/app-frame";
import { observeOverlayPanelTheme, resolveOverlayPanelTheme } from "../../platform/overlay/panel-base";
import { ensureOverlayAppChromeStyles, prepareOverlayAppRoot } from "../../platform/overlay/app-chrome";
import type { AppStorageFacade, MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";
import type { OverlayDockSide } from "../../platform/overlay/dock";

const ROOT_ID = "milxdy-link-browser-root";
const STYLE_ID = "milxdy-link-browser-style";
const WIDTH_KEY = "milxdy.linkBrowser.width";
const HEIGHT_KEY = "milxdy.linkBrowser.height";
const TOP_KEY = "milxdy.linkBrowser.top";
const LAST_URL_KEY = "milxdy.linkBrowser.lastUrl";

type LinkBrowserState = {
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
  iframeLoaded: boolean;
  layoutReady: boolean;
  loadTimer: number | null;
};

const state: LinkBrowserState = {
  root: null,
  frame: null,
  open: false,
  minimized: true,
  side: "right",
  x: 0,
  width: 520,
  height: 680,
  topOffset: 20,
  currentUrl: "about:blank",
  iframeLoaded: false,
  layoutReady: false,
  loadTimer: null,
};

let booted = false;
let lifecycleSignal: AbortSignal | null = null;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;
let appStorage: AppStorageFacade | null = null;
let activationGeneration = 0;
let managedWindow: { open(): void; close(): void; focus(): void; dispose(): void; readonly element: HTMLElement; readonly isOpen: boolean } | null = null;

export async function boot(context?: MilxdyContentAppContext): Promise<void> {
  if (booted) return;
  if (!context?.windows || !context.storage) throw new Error("Link Browser requires an SDK app context");
  booted = true;
  const generation = ++activationGeneration;
  lifecycleSignal = context?.signal || null;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  appStorage = context?.storage || null;
  const stored = await appStorage.local.get({
    [WIDTH_KEY]: state.width,
    [HEIGHT_KEY]: state.height,
    [TOP_KEY]: state.topOffset,
    [LAST_URL_KEY]: state.currentUrl,
  });
  if (!lifecycleActive() || generation !== activationGeneration) return;
  state.width = numberOr(stored[WIDTH_KEY], state.width);
  state.height = numberOr(stored[HEIGHT_KEY], state.height);
  state.topOffset = numberOr(stored[TOP_KEY], state.topOffset);
  state.currentUrl = normalizeLinkUrl(stored[LAST_URL_KEY]) || state.currentUrl;
  injectStyles();
  ensureOverlayAppChromeStyles();
  registerDockItem();
  registerLinkInterceptor();
  const content = ensureRoot();
  managedWindow = context.windows.create({
    id: "link-browser",
    title: "Link Browser",
    content,
    initialBounds: { width: state.width, height: state.height, top: state.topOffset, side: state.side },
    minWidth: 360,
    minHeight: 420,
    resizable: true,
    persistKey: "main",
    onClose: handleManagedClose,
  });
}

export function open(): void {
  if (state.currentUrl === "about:blank") return;
  openUrl(state.currentUrl);
}

export function close(): void {
  closePanel();
}

export function disable(): void {
  closePanel();
}

export function dispose(): void {
  ++activationGeneration;
  disable();
  clearLoadTimer();
  managedWindow?.dispose();
  managedWindow = null;
  state.frame?.remove();
  state.frame = null;
  state.root?.remove();
  state.root = null;
  lifecycleSignal = null;
  addRuntimeDisposable = () => undefined;
  appStorage = null;
  booted = false;
}

function lifecycleActive(): boolean {
  return booted && lifecycleSignal?.aborted !== true;
}

function registerDockItem(): void {
  state.frame = createOverlayAppFrame({
    id: "linkBrowser",
    label: "Link Browser",
    icon: linkBrowserIcon(),
    initialSide: state.side,
    isOpen: () => Boolean(state.root && state.open && !state.minimized),
    onOpen: () => open(),
    onClose: closePanel,
    onSideChange: (side) => {
      state.side = side;
    },
  });
}

function registerLinkInterceptor(): void {
  const listener = (event: MouseEvent) => {
    if (!lifecycleActive() || !event.altKey || shouldUseNativeLink(event)) return;
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !anchor.isConnected || anchor.closest(`#${ROOT_ID}`)) return;
    const url = normalizeLinkUrl(anchor.getAttribute("href"));
    if (!url || shouldIgnoreAnchor(anchor, url)) return;
    event.preventDefault();
    event.stopPropagation();
    openUrl(url);
  };
  document.addEventListener("click", listener, true);
  addRuntimeDisposable(() => document.removeEventListener("click", listener, true));
}

function openUrl(url: string): void {
  if (!lifecycleActive()) return;
  state.currentUrl = url;
  state.open = true;
  state.minimized = false;
  state.iframeLoaded = false;
  void appStorage?.local.set({ [LAST_URL_KEY]: url });
  managedWindow?.open();
  ensureRoot();
  render();
  state.frame?.updateDock({ active: true, title: `Link: ${urlLabel(url)}` });
}

function ensureRoot(): HTMLElement {
  if (state.root?.isConnected) return state.root;
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.className = "milxdy-overlay-app-shell milxdy-overlay-app-card";
  prepareOverlayAppRoot(root);
  root.dataset.theme = resolveOverlayPanelTheme();
  root.setAttribute("aria-label", "Link browser");
  for (const type of ["click", "mousedown", "mouseup", "pointerdown", "pointerup"]) {
    root.addEventListener(type, (event) => event.stopPropagation());
  }
  addRuntimeDisposable(observeOverlayPanelTheme(() => {
    root.dataset.theme = resolveOverlayPanelTheme();
  }));
  state.root = root;
  return root;
}

function render(): void {
  const root = ensureRoot();
  root.textContent = "";
  root.dataset.open = String(state.open && !state.minimized);

  const iframe = document.createElement("iframe");
  iframe.className = "milxdy-link-browser-frame";
  iframe.title = "Link Browser";
  iframe.src = state.currentUrl;
  iframe.referrerPolicy = "no-referrer";
  iframe.sandbox.add("allow-forms", "allow-popups", "allow-scripts", "allow-top-navigation-by-user-activation");
  iframe.addEventListener("load", () => {
    state.iframeLoaded = true;
    clearLoadTimer();
    root.dataset.loaded = "true";
  });

  const fallback = document.createElement("div");
  fallback.className = "milxdy-link-browser-fallback";
  const fallbackText = document.createElement("p");
  fallbackText.textContent = "If this page blocks embedded display, open it in a normal tab.";
  const fallbackButton = document.createElement("button");
  fallbackButton.type = "button";
  fallbackButton.textContent = "Open page";
  fallbackButton.addEventListener("click", openCurrentInTab);
  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh";
  refreshButton.addEventListener("click", () => {
    state.iframeLoaded = false;
    render();
  });
  fallback.append(fallbackText, refreshButton, fallbackButton);

  root.append(iframe, fallback);
  scheduleFrameFallback(root);
}

function closePanel(): void {
  managedWindow?.close();
}

function handleManagedClose(): void {
  state.open = false;
  state.minimized = true;
  clearLoadTimer();
  state.frame?.updateDock({ active: false });
}

function openCurrentInTab(): void {
  window.open(state.currentUrl, "_blank", "noopener,noreferrer");
}

function normalizeLinkUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, location.href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function shouldIgnoreAnchor(anchor: HTMLAnchorElement, url: string): boolean {
  if (anchor.hasAttribute("download")) return true;
  if (/^(button|menuitem|tab)$/i.test(anchor.getAttribute("role") || "")) return true;
  const parsed = new URL(url);
  if (parsed.href === location.href || (parsed.origin === location.origin && parsed.pathname === location.pathname && parsed.search === location.search && parsed.hash)) return true;
  return false;
}

function shouldUseNativeLink(event: MouseEvent): boolean {
  return event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey;
}

function scheduleFrameFallback(root: HTMLElement): void {
  clearLoadTimer();
  state.loadTimer = window.setTimeout(() => {
    if (state.iframeLoaded || !root.isConnected) return;
    root.dataset.slow = "true";
  }, 2200);
}

function clearLoadTimer(): void {
  if (state.loadTimer === null) return;
  window.clearTimeout(state.loadTimer);
  state.loadTimer = null;
}

function urlLabel(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${decodeURIComponent(url.pathname)}`.slice(0, 80);
  } catch {
    return "No page selected";
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}


function linkBrowserIcon(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">',
    '<rect x="6" y="8" width="36" height="32" rx="7" fill="#f8d35d" opacity=".2"/>',
    '<path d="M17 25a7 7 0 0 1 7-7h5" fill="none" stroke="#f8d35d" stroke-width="4" stroke-linecap="round"/>',
    '<path d="M31 18l5 5-5 5" fill="none" stroke="#f8d35d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M31 30h-7a7 7 0 0 1-7-7" fill="none" stroke="#f8d35d" stroke-width="4" stroke-linecap="round"/>',
    '</svg>',
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
    .milxdy-link-browser-header {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 10px 0;
      cursor: grab;
    }
    #${ROOT_ID}[data-dragging="true"] .milxdy-link-browser-header {
      cursor: grabbing;
    }
    .milxdy-link-browser-title {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .milxdy-link-browser-title strong {
      font-size: 14px;
      line-height: 1.2;
    }
    .milxdy-link-browser-title span {
      overflow: hidden;
      color: rgba(238, 240, 255, 0.58);
      font-size: 11px;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${ROOT_ID}[data-theme="light"] .milxdy-link-browser-title span {
      color: rgba(32, 35, 54, 0.58);
    }
    .milxdy-link-browser-actions {
      flex: 0 0 auto;
      display: flex;
      gap: 5px;
    }
    .milxdy-link-browser-actions button,
    .milxdy-link-browser-fallback button {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(252, 224, 150, 0.22);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.06);
      color: inherit;
      font: inherit;
      padding: 0;
      cursor: pointer;
    }
    .milxdy-link-browser-actions svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }
    .milxdy-link-browser-frame {
      flex: 1 1 auto;
      min-height: 0;
      margin: 0 10px 10px;
      border: 1px solid rgba(252, 224, 150, 0.16);
      border-radius: 7px;
      background: #fff;
    }
    .milxdy-link-browser-fallback {
      position: absolute;
      left: 20px;
      right: 20px;
      bottom: 20px;
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
    #${ROOT_ID}[data-slow="true"] .milxdy-link-browser-fallback {
      display: flex;
    }
    .milxdy-link-browser-fallback p {
      margin: 0;
      font-size: 12px;
      line-height: 1.35;
    }
    .milxdy-link-browser-fallback button {
      width: auto;
      min-width: 72px;
      padding: 0 10px;
      font-size: 12px;
    }
    .milxdy-link-browser-resize-edge {
      position: absolute !important;
      z-index: 2;
      border: 0;
      background: transparent;
    }
    .milxdy-link-browser-resize-edge-side {
      top: 0;
      right: 0;
      bottom: 0;
      width: 8px;
      cursor: ew-resize;
    }
    #${ROOT_ID}[data-side="right"] .milxdy-link-browser-resize-edge-side {
      right: auto;
      left: 0;
    }
    .milxdy-link-browser-resize-edge-bottom {
      right: 0;
      bottom: 0;
      left: 0;
      height: 8px;
      cursor: ns-resize;
    }
  `;
  document.documentElement.appendChild(style);
}
