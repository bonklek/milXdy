import { installNativeCheeseStreakFeedback } from "./reminet-cheese-streak";
import { startReminetLegacySocketBridge } from "./reminet-chat-legacy-socket";
import {
  beetleConnectorIsActive,
  createNativeBeetleAccelerationCss,
  createBeetleReducedMotionCss,
  nativeBeetleActionButtonFor,
  nativeBeetleOutcomeForElement,
  nativeBeetleStatusCopy,
  trustedNativeBeetleActionFor,
  type NativeBeetleAction,
} from "./reminet-beetle-fast-controls";

const BEETLE_REDUCED_MOTION_KEY = "milxdy.reminet.beetleReducedMotion";
const BEETLE_INSTANT_RESULTS_KEY = "milxdy.reminet.beetleInstantResults";
const BEETLE_REDUCED_MOTION_ATTRIBUTE = "data-milxdy-reminet-beetle-reduced-motion";
const BEETLE_REDUCED_MOTION_SETTING_ATTRIBUTE = "data-milxdy-reminet-beetle-reduced-motion-setting";
const BEETLE_REDUCED_MOTION_STYLE_ID = "milxdy-reminet-beetle-reduced-motion";
const BEETLE_INSTANT_RESULTS_ATTRIBUTE = "data-milxdy-reminet-beetle-instant-results";
const BEETLE_INSTANT_RESULTS_PREFERENCE_ATTRIBUTE = "data-milxdy-reminet-beetle-instant-results-preference";
const BEETLE_CONNECTOR_ACTIVE_ATTRIBUTE = "data-milxdy-reminet-beetle-connector-active";
const BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE = "data-milxdy-reminet-beetle-native-acceleration";
const BEETLE_INSTANT_RESULTS_STYLE_ID = "milxdy-reminet-beetle-instant-results";
const BEETLE_INSTANT_RESULTS_ID = "milxdy-reminet-beetle-native-status";
const BEETLE_NATIVE_ACTION_TIMEOUT_MS = 15_000;
const BEETLE_WELCOME_PENDING_KEY = "milxdy.reminet.beetleWelcomePending";
const BEETLE_WELCOME_ID = "milxdy-reminet-beetle-welcome";
const BEETLE_WELCOME_ANCHOR_SELECTOR = ".beetle-tab.beetleboy.active";
const BEETLE_CONNECTOR_STATUS_POLL_MS = 2_000;

let instantResultsEnabled = false;
let instantResultsPreferred = false;
let instantResultsConnectorActive = false;
let connectorStatusRefreshId = 0;
let instantResultListenerInstalled = false;
let nativeActionObserver: MutationObserver | null = null;
let nativeActionTimeout: ReturnType<typeof setTimeout> | null = null;
let nativeAccelerationRelease: ReturnType<typeof setTimeout> | null = null;
let beetleRouteObserverTimer: ReturnType<typeof setInterval> | null = null;
let beetleConnectorStatusTimer: ReturnType<typeof setInterval> | null = null;
let lastObservedBeetleRoute: boolean | null = null;
let craftingVideoAcceleratorInstalled = false;

async function syncBeetleWelcome(): Promise<void> {
  const existing = document.getElementById(BEETLE_WELCOME_ID);
  if (!isBeetleRoute()) {
    existing?.remove();
    return;
  }
  const stored = await chrome.storage.local.get({ [BEETLE_WELCOME_PENDING_KEY]: false });
  if (stored[BEETLE_WELCOME_PENDING_KEY] !== true || document.getElementById(BEETLE_WELCOME_ID)) return;

  const notice = document.createElement("aside");
  notice.id = BEETLE_WELCOME_ID;
  notice.setAttribute("role", "status");
  notice.innerHTML = `
    <button type="button" aria-label="Dismiss milXdy tip">×</button>
    <p>Did you know you can enable faster animations on RemiliaNET in the milXdy settings?</p>
  `;
  notice.querySelector("button")?.addEventListener("click", () => {
    notice.remove();
    void chrome.storage.local.set({ [BEETLE_WELCOME_PENDING_KEY]: false });
  });
  document.documentElement.append(notice);
  const positionNotice = () => {
    const anchor = document.querySelector<HTMLElement>(BEETLE_WELCOME_ANCHOR_SELECTOR);
    if (!notice.isConnected) return;
    if (!anchor) {
      notice.hidden = true;
      return;
    }
    const bounds = anchor.getBoundingClientRect();
    notice.hidden = false;
    // Start beneath the BeetleBoy tab/header, inside the cartridge surface.
    notice.style.left = `${Math.max(18, bounds.left + 18)}px`;
    notice.style.top = `${Math.max(18, bounds.bottom + 12)}px`;
  };
  positionNotice();
  const resizeObserver = new ResizeObserver(positionNotice);
  const anchor = document.querySelector<HTMLElement>(BEETLE_WELCOME_ANCHOR_SELECTOR);
  if (anchor) resizeObserver.observe(anchor);
  const tabObserver = new MutationObserver(positionNotice);
  tabObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });
  addEventListener("resize", positionNotice, { passive: true });
  const stopPositioning = () => {
    resizeObserver.disconnect();
    tabObserver.disconnect();
    removeEventListener("resize", positionNotice);
  };
  notice.querySelector("button")?.addEventListener("click", stopPositioning, { once: true });
  addEventListener("pagehide", stopPositioning, { once: true });

  const style = document.createElement("style");
  style.id = `${BEETLE_WELCOME_ID}-style`;
  style.textContent = `
    #${BEETLE_WELCOME_ID} {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 2147483647;
      width: min(282px, calc(100vw - 36px));
      margin: 0;
      padding: 12px 34px 12px 14px;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid rgba(91, 26, 55, 0.9);
      background: linear-gradient(125deg, rgba(255, 183, 211, 0.97), rgba(255, 213, 229, 0.98), rgba(248, 159, 198, 0.97));
      background-size: 220% 100%;
      box-shadow: 0 0 0 2px rgba(74, 18, 43, 0.82), 0 7px 22px rgba(103, 30, 62, 0.42), inset 0 0 18px rgba(255, 255, 255, 0.34);
      color: #fff;
      text-shadow: 0 0 7px rgba(255, 255, 255, 0.95), 0 1px 2px rgba(126, 27, 72, 0.48);
      font: 800 11px/1.45 ui-monospace, "Cascadia Mono", Menlo, monospace;
      letter-spacing: 0.035em;
      text-transform: uppercase;
      transform-origin: top left;
      animation: milxdy-beetle-welcome-shimmer 4.5s ease-in-out infinite, milxdy-beetle-welcome-breathe 5.5s ease-in-out infinite !important;
    }
    #${BEETLE_WELCOME_ID} p {
      margin: 0;
      -webkit-text-stroke: 1.25px rgba(91, 26, 55, 0.86);
      paint-order: stroke fill;
    }
    #${BEETLE_WELCOME_ID} button {
      position: absolute;
      top: 5px;
      right: 7px;
      width: 23px;
      height: 23px;
      border: 0;
      padding: 0;
      background: transparent;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font: 400 23px/20px ui-monospace, monospace;
    }
    #${BEETLE_WELCOME_ID} button:hover,
    #${BEETLE_WELCOME_ID} button:focus-visible { background: rgba(91, 26, 55, 0.42); color: #fff; text-shadow: 0 0 10px #fff, 0 0 15px #e45a91; outline: none; }
    @keyframes milxdy-beetle-welcome-shimmer {
      0%, 100% { background-position: 100% 50%; border-color: rgba(255, 255, 255, 0.65); }
      50% { background-position: 0% 50%; border-color: rgba(255, 255, 255, 1); }
    }
    @keyframes milxdy-beetle-welcome-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.018); }
    }
    @media (prefers-reduced-motion: reduce) { #${BEETLE_WELCOME_ID} { animation: none; } }
  `;
  if (!document.getElementById(style.id)) document.documentElement.append(style);
}

function isBeetleRoute(): boolean {
  // BeetleBoy can render inside a Remilia profile URL that does not include a
  // beetle cartridge/path segment. Its active tab is the authoritative signal.
  if (document.querySelector(BEETLE_WELCOME_ANCHOR_SELECTOR)) return true;
  const cartridge = new URLSearchParams(location.search).get("cartridge")?.toLowerCase();
  if (cartridge === "beetle" || cartridge === "beetol" || cartridge === "craft") return true;
  const locationText = `${location.pathname}${location.hash}${location.search}`.toLowerCase();
  return locationText.includes("beetle") || locationText.includes("beetol");
}

function applyBeetleReducedMotion(enabled: boolean): void {
  const root = document.documentElement;
  if (!root) return;
  const shouldReduce = enabled && isBeetleRoute();
  root.dataset.milxdyReminetBeetleReducedMotionSetting = String(enabled);
  root.toggleAttribute(BEETLE_REDUCED_MOTION_ATTRIBUTE, shouldReduce);
  if (shouldReduce) installCraftingVideoAccelerator();
  if (!shouldReduce || document.getElementById(BEETLE_REDUCED_MOTION_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = BEETLE_REDUCED_MOTION_STYLE_ID;
  style.textContent = createBeetleReducedMotionCss(BEETLE_REDUCED_MOTION_ATTRIBUTE);
  root.append(style);
}

function fastForwardCraftingTransition(video: HTMLVideoElement): void {
  if (!document.documentElement.hasAttribute(BEETLE_REDUCED_MOTION_ATTRIBUTE)) return;
  if (!video.closest(".module-main-screen.crafting-main-screen")) return;
  const source = video.currentSrc || video.src;
  // Only transition clips gate the controls. Idle clips intentionally loop.
  if (!/(?:assemblyto|smashto)/i.test(source)) return;
  if (video.dataset.milxdyFastForwardedSource === source) return;
  const finish = () => {
    if (video.dataset.milxdyFastForwardedSource === source) return;
    video.dataset.milxdyFastForwardedSource = source;
    try {
      if (Number.isFinite(video.duration)) video.currentTime = video.duration;
      video.pause();
      // Remilia enables the next Craft state from this normal callback.
      video.dispatchEvent(new Event("ended", { bubbles: true }));
    } catch {
      delete video.dataset.milxdyFastForwardedSource;
    }
  };
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) queueMicrotask(finish);
  else video.addEventListener("loadedmetadata", finish, { once: true });
}

function installCraftingVideoAccelerator(): void {
  if (craftingVideoAcceleratorInstalled) return;
  craftingVideoAcceleratorInstalled = true;
  const handleMedia = (event: Event) => {
    if (event.target instanceof HTMLVideoElement) fastForwardCraftingTransition(event.target);
  };
  document.addEventListener("loadedmetadata", handleMedia, true);
  document.addEventListener("play", handleMedia, true);
}

async function syncBeetleReducedMotion(): Promise<void> {
  const stored = await chrome.storage.sync.get({
    [BEETLE_REDUCED_MOTION_KEY]: false,
    [BEETLE_INSTANT_RESULTS_KEY]: false,
  });
  applyBeetleReducedMotion(stored[BEETLE_REDUCED_MOTION_KEY] === true);
  instantResultsPreferred = stored[BEETLE_INSTANT_RESULTS_KEY] === true;
  await refreshInstantBeetleAvailability();
  await syncBeetleWelcome();
}

function ensureInstantResultStyle(): void {
  if (document.getElementById(BEETLE_INSTANT_RESULTS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = BEETLE_INSTANT_RESULTS_STYLE_ID;
  style.textContent = `${createNativeBeetleAccelerationCss(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE)}
    #${BEETLE_INSTANT_RESULTS_ID} {
      position: absolute;
      right: 12px;
      bottom: 12px;
      z-index: 6;
      display: grid;
      gap: 3px;
      max-width: min(320px, calc(100% - 24px));
      padding: 9px 11px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 193, 105, 0.82);
      border-radius: 8px;
      background: rgba(8, 14, 10, 0.92);
      box-shadow: 0 5px 18px rgba(0, 0, 0, 0.36);
      color: #f7f1d0;
      font: 700 11px/1.35 ui-monospace, "Cascadia Mono", Menlo, monospace;
      pointer-events: none;
    }
    #${BEETLE_INSTANT_RESULTS_ID}[data-kind="success"] { border-color: rgba(212, 251, 137, 0.82); }
    #${BEETLE_INSTANT_RESULTS_ID}[data-kind="error"] { border-color: rgba(255, 117, 117, 0.82); }
    #${BEETLE_INSTANT_RESULTS_ID} strong { color: #d4fb89; font-size: 12px; }
    #${BEETLE_INSTANT_RESULTS_ID}[data-kind="error"] strong { color: #ffb4b4; }
  `;
  document.documentElement.append(style);
}

function applyInstantBeetleResults(preferred: boolean, connectorActive: boolean): void {
  const enabled = preferred && connectorActive;
  instantResultsPreferred = preferred;
  instantResultsConnectorActive = connectorActive;
  instantResultsEnabled = enabled;
  const root = document.documentElement;
  if (!root) return;
  root.dataset.milxdyReminetBeetleInstantResults = String(enabled);
  root.setAttribute(BEETLE_INSTANT_RESULTS_PREFERENCE_ATTRIBUTE, String(preferred));
  root.setAttribute(BEETLE_CONNECTOR_ACTIVE_ATTRIBUTE, String(connectorActive));
  if (enabled && isBeetleRoute()) {
    ensureInstantResultStyle();
    installInstantResultListener();
  } else if (!enabled) {
    stopNativeBeetleActionObservation();
    releaseNativeBeetleAcceleration();
    document.getElementById(BEETLE_INSTANT_RESULTS_ID)?.remove();
  }
}

async function refreshInstantBeetleAvailability(): Promise<void> {
  const refreshId = ++connectorStatusRefreshId;
  if (!isBeetleRoute()) {
    applyInstantBeetleResults(instantResultsPreferred, false);
    return;
  }
  const response = await chrome.runtime.sendMessage({ type: "beetol:authStatus" })
    .catch(() => null);
  if (refreshId !== connectorStatusRefreshId) return;
  applyInstantBeetleResults(instantResultsPreferred, beetleConnectorIsActive(response));
}

function showInstantResult(title: string, detail: string, kind: "pending" | "success" | "error"): void {
  const screen = document.querySelector<HTMLElement>(".module-main-screen.beetle-catch-main-screen");
  if (!screen) return;
  let pane = screen.querySelector<HTMLElement>(`#${BEETLE_INSTANT_RESULTS_ID}`);
  if (!pane) {
    pane = document.createElement("section");
    pane.id = BEETLE_INSTANT_RESULTS_ID;
    pane.setAttribute("aria-live", "polite");
    screen.append(pane);
  }
  pane.dataset.kind = kind;
  pane.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("span");
  copy.textContent = detail;
  pane.append(heading, copy);
}

function stopNativeBeetleActionObservation(): void {
  nativeActionObserver?.disconnect();
  nativeActionObserver = null;
  if (nativeActionTimeout !== null) clearTimeout(nativeActionTimeout);
  nativeActionTimeout = null;
}

function releaseNativeBeetleAcceleration(): void {
  if (nativeAccelerationRelease !== null) clearTimeout(nativeAccelerationRelease);
  nativeAccelerationRelease = null;
  document.documentElement.removeAttribute(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE);
}

function finishNativeBeetleActionObservation(
  action: NativeBeetleAction,
  outcome: "result" | "failure" | "timeout",
): void {
  stopNativeBeetleActionObservation();
  if (!instantResultsEnabled) return;
  const copy = nativeBeetleStatusCopy(action, outcome);
  showInstantResult(copy.title, copy.detail, copy.kind);
  if (nativeAccelerationRelease !== null) clearTimeout(nativeAccelerationRelease);
  nativeAccelerationRelease = setTimeout(() => {
    nativeAccelerationRelease = null;
    document.documentElement.removeAttribute(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE);
  }, 250);
}

function observeNativeBeetleAction(action: NativeBeetleAction): void {
  if (!instantResultsEnabled) return;
  const screen = document.querySelector<HTMLElement>(".module-main-screen.beetle-catch-main-screen");
  if (!screen) return;
  stopNativeBeetleActionObservation();
  if (nativeAccelerationRelease !== null) clearTimeout(nativeAccelerationRelease);
  nativeAccelerationRelease = null;
  document.documentElement.toggleAttribute(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE, true);
  nativeActionObserver = new MutationObserver((records) => {
    for (const record of records) {
      const targetOutcome = nativeBeetleOutcomeForElement(record.target);
      if (targetOutcome) {
        finishNativeBeetleActionObservation(action, targetOutcome);
        return;
      }
      for (const candidate of record.addedNodes) {
        const addedOutcome = nativeBeetleOutcomeForElement(candidate, true);
        if (!addedOutcome) continue;
        finishNativeBeetleActionObservation(action, addedOutcome);
        return;
      }
    }
  });
  nativeActionObserver.observe(screen, { attributes: true, childList: true, subtree: true });
  nativeActionTimeout = setTimeout(() => {
    finishNativeBeetleActionObservation(action, "timeout");
  }, BEETLE_NATIVE_ACTION_TIMEOUT_MS);
  queueMicrotask(() => {
    if (!instantResultsEnabled || !nativeActionObserver) return;
    const copy = nativeBeetleStatusCopy(action, "pending");
    showInstantResult(copy.title, copy.detail, copy.kind);
  });
}

function installInstantResultListener(): void {
  if (instantResultListenerInstalled) return;
  instantResultListenerInstalled = true;
  document.addEventListener("click", (event) => {
    if (!isBeetleRoute()) return;
    const action = trustedNativeBeetleActionFor(event, instantResultsEnabled);
    if (!action) return;
    const button = nativeBeetleActionButtonFor(event.target);
    if (!button || button.disabled) return;
    // Observe only. The trusted click continues to RemiliaNET's native handler,
    // which owns its website session and mutation request.
    observeNativeBeetleAction(action);
  }, true);
}

function observeBeetleRouteChanges(): void {
  const update = () => { void syncBeetleReducedMotion(); };
  addEventListener("popstate", update);
  addEventListener("hashchange", update);
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (...args: Parameters<History[typeof method]>): ReturnType<History[typeof method]> {
      const result = original.apply(this, args);
      queueMicrotask(update);
      return result;
    };
  }
  // Remilia's SPA changes cartridge query state from its page-world history object.
  // An isolated content script cannot observe that patched history call directly, so
  // watch the inexpensive URL state and only resync when the route actually changes.
  const observeCurrentRoute = () => {
    const next = isBeetleRoute();
    if (next === lastObservedBeetleRoute) return;
    lastObservedBeetleRoute = next;
    void syncBeetleReducedMotion();
  };
  observeCurrentRoute();
  beetleRouteObserverTimer = setInterval(observeCurrentRoute, 250);
}

window.addEventListener("pagehide", () => {
  stopNativeBeetleActionObservation();
  releaseNativeBeetleAcceleration();
  if (beetleRouteObserverTimer !== null) clearInterval(beetleRouteObserverTimer);
  beetleRouteObserverTimer = null;
  if (beetleConnectorStatusTimer !== null) clearInterval(beetleConnectorStatusTimer);
  beetleConnectorStatusTimer = null;
}, { once: true });

installNativeCheeseStreakFeedback(isBeetleRoute);
startReminetLegacySocketBridge();
observeBeetleRouteChanges();
void syncBeetleReducedMotion();
beetleConnectorStatusTimer = setInterval(() => {
  void refreshInstantBeetleAvailability();
}, BEETLE_CONNECTOR_STATUS_POLL_MS);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes[BEETLE_REDUCED_MOTION_KEY]) applyBeetleReducedMotion(changes[BEETLE_REDUCED_MOTION_KEY].newValue === true);
  if (changes[BEETLE_INSTANT_RESULTS_KEY]) {
    instantResultsPreferred = changes[BEETLE_INSTANT_RESULTS_KEY].newValue === true;
    void refreshInstantBeetleAvailability();
  }
});
