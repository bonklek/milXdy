const SOCKET_URL = "wss://www.remilia.net/api/ws";
const SOCKET_PORT_NAME = "reminetChat:site-socket";
const CHAT_ID = 1;
const HEARTBEAT_MS = 25_000;
const BEETLE_REDUCED_MOTION_KEY = "milxdy.reminet.beetleReducedMotion";
const BEETLE_INSTANT_RESULTS_KEY = "milxdy.reminet.beetleInstantResults";
const BEETLE_REDUCED_MOTION_ATTRIBUTE = "data-milxdy-reminet-beetle-reduced-motion";
const BEETLE_REDUCED_MOTION_SETTING_ATTRIBUTE = "data-milxdy-reminet-beetle-reduced-motion-setting";
const BEETLE_REDUCED_MOTION_STYLE_ID = "milxdy-reminet-beetle-reduced-motion";
const BEETLE_INSTANT_RESULTS_ATTRIBUTE = "data-milxdy-reminet-beetle-instant-results";
const BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE = "data-milxdy-reminet-beetle-instant-results-active";
const BEETLE_INSTANT_RESULTS_STYLE_ID = "milxdy-reminet-beetle-instant-results";
const BEETLE_INSTANT_RESULTS_ID = "milxdy-reminet-beetle-result";
const BEETLE_WELCOME_PENDING_KEY = "milxdy.reminet.beetleWelcomePending";
const BEETLE_WELCOME_ID = "milxdy-reminet-beetle-welcome";

let socket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let port: chrome.runtime.Port | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let active = true;
let instantResultsEnabled = false;
let instantResultRunning = false;
let instantResultListenerInstalled = false;
const instantResultCompletedActions = new Set<"catchBeetle" | "beetleHunt">();
let beetleRouteObserverTimer: ReturnType<typeof setInterval> | null = null;
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

  const style = document.createElement("style");
  style.id = `${BEETLE_WELCOME_ID}-style`;
  style.textContent = `
    #${BEETLE_WELCOME_ID} {
      position: fixed;
      top: 18px;
      left: 18px;
      z-index: 2147483647;
      width: min(282px, calc(100vw - 36px));
      margin: 0;
      padding: 12px 34px 12px 14px;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.88);
      background: linear-gradient(125deg, rgba(255, 183, 211, 0.97), rgba(255, 213, 229, 0.98), rgba(248, 159, 198, 0.97));
      background-size: 220% 100%;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.45), 0 7px 22px rgba(103, 30, 62, 0.34), inset 0 0 18px rgba(255, 255, 255, 0.34);
      color: #fff;
      text-shadow: 0 0 7px rgba(255, 255, 255, 0.95), 0 1px 2px rgba(126, 27, 72, 0.48);
      font: 800 11px/1.45 ui-monospace, "Cascadia Mono", Menlo, monospace;
      letter-spacing: 0.035em;
      text-transform: uppercase;
      animation: milxdy-beetle-welcome-shimmer 4.5s ease-in-out infinite;
    }
    #${BEETLE_WELCOME_ID} p { margin: 0; }
    #${BEETLE_WELCOME_ID} button {
      position: absolute;
      top: 5px;
      right: 7px;
      width: 23px;
      height: 23px;
      border: 0;
      padding: 0;
      background: transparent;
      color: #fff;
      cursor: pointer;
      font: 400 23px/20px ui-monospace, monospace;
    }
    #${BEETLE_WELCOME_ID} button:hover,
    #${BEETLE_WELCOME_ID} button:focus-visible { color: #fff; text-shadow: 0 0 10px #fff, 0 0 15px #e45a91; outline: none; }
    @keyframes milxdy-beetle-welcome-shimmer {
      0%, 100% { background-position: 100% 50%; border-color: rgba(255, 255, 255, 0.65); }
      50% { background-position: 0% 50%; border-color: rgba(255, 255, 255, 1); }
    }
    @media (prefers-reduced-motion: reduce) { #${BEETLE_WELCOME_ID} { animation: none; } }
  `;
  if (!document.getElementById(style.id)) document.documentElement.append(style);
}

function isBeetleRoute(): boolean {
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
  style.textContent = `
    /* Remilia changes class names often and nests most movement inside the
       cartridge tree. The explicit setting is intentionally route-wide. */
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}],
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] *,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] *::before,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] *::after {
      animation-duration: 0.001ms !important;
      animation-delay: 0ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      transition-delay: 0ms !important;
    }
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] :is(
      .beetle-console, .beetleModule, .beetle-catch-module,
      .beetle-catch-module__buttons-container, .beetle-catch-module__beetle-item,
      .beetle-header, .beetle-tab, .beetle-logo, .beetle-vignette,
      .beetle-game-nav, .crafting-module, .carousel, .claim-button,
      .crafting-module__beetle-item, .cheeseman,
      .toggle-bar, .toggle-knob, .toggle-text,
      [class*="rarity-shadow" i]) {
      animation: none !important;
      transition: none !important;
    }
    /* Crafting and assembly render their result layer in a sibling main screen,
       rather than inside .crafting-module. Keep that result layer immediate too. */
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] .carousel,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] .beetleModule,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] .crafting-module,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] .crafting-module *,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] .module-main-screen.crafting-main-screen,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] .module-main-screen.crafting-main-screen *,
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] .crafting-logo {
      animation: none !important;
      transition: none !important;
    }
    html[${BEETLE_REDUCED_MOTION_ATTRIBUTE}] { scroll-behavior: auto !important; }
  `;
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
  applyInstantBeetleResults(stored[BEETLE_INSTANT_RESULTS_KEY] === true);
  await syncBeetleWelcome();
}

function ensureInstantResultStyle(): void {
  if (document.getElementById(BEETLE_INSTANT_RESULTS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = BEETLE_INSTANT_RESULTS_STYLE_ID;
  style.textContent = `
    html[${BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE}] .module-main-screen.beetle-catch-main-screen > video {
      visibility: hidden !important;
    }
    #${BEETLE_INSTANT_RESULTS_ID} {
      position: absolute;
      inset: 0;
      z-index: 4;
      display: grid;
      align-content: center;
      gap: 10px;
      padding: 24px;
      box-sizing: border-box;
      overflow: auto;
      background: radial-gradient(circle at 50% 30%, rgba(212, 251, 137, 0.18), rgba(8, 14, 10, 0.96) 70%);
      color: #f7f1d0;
      font: 800 15px/1.35 ui-monospace, "Cascadia Mono", Menlo, monospace;
      letter-spacing: 0.04em;
      text-align: center;
      text-transform: uppercase;
    }
    #${BEETLE_INSTANT_RESULTS_ID}[data-kind="success"] { box-shadow: inset 0 0 0 2px rgba(212, 251, 137, 0.82); }
    #${BEETLE_INSTANT_RESULTS_ID}[data-kind="error"] { box-shadow: inset 0 0 0 2px rgba(255, 117, 117, 0.82); }
    #${BEETLE_INSTANT_RESULTS_ID}[data-kind="pending"] { box-shadow: inset 0 0 0 2px rgba(255, 193, 105, 0.82); }
    #${BEETLE_INSTANT_RESULTS_ID} strong { color: #d4fb89; font-size: 19px; }
    #${BEETLE_INSTANT_RESULTS_ID}[data-kind="error"] strong { color: #ffb4b4; }
  `;
  document.documentElement.append(style);
}

function applyInstantBeetleResults(enabled: boolean): void {
  instantResultsEnabled = enabled;
  const root = document.documentElement;
  if (!root) return;
  root.dataset.milxdyReminetBeetleInstantResults = String(enabled);
  if (enabled && isBeetleRoute()) {
    ensureInstantResultStyle();
    installInstantResultListener();
  }
}

function instantResultActionFor(target: EventTarget | null): "catchBeetle" | "beetleHunt" | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest<HTMLButtonElement>(".beetle-catch-module__catch-button, .beetle-catch-module__hunt-button");
  if (!button) return null;
  return button.classList.contains("beetle-catch-module__catch-button") ? "catchBeetle" : "beetleHunt";
}

function nativeActionButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(
    ".beetle-catch-module__catch-button, .beetle-catch-module__hunt-button",
  ));
}

function formatBeetleItem(value: unknown): string {
  return String(value ?? "reward")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function resultCopy(action: "catchBeetle" | "beetleHunt", response: Record<string, unknown>): { title: string; detail: string; kind: "success" | "error" } {
  const result = recordValue(response.actionResult);
  const payload = recordValue(result.result);
  const message = typeof result.message === "string"
    ? result.message
    : (typeof payload.message === "string" ? payload.message : "");
  if (response.ok !== true || result.success === false || payload.success === false) {
    return {
      title: action === "catchBeetle" ? "Claim unavailable" : "Hunt unavailable",
      detail: message || String(response.error || "RemiliaNET did not complete this action."),
      kind: "error",
    };
  }
  const beetleCard = recordValue(payload.beetleCard);
  const beetleName = typeof beetleCard.beetle_name === "string" ? beetleCard.beetle_name : "";
  const secondaryDrops = Array.isArray(payload.secondaryItemDrops)
    ? payload.secondaryItemDrops
      .map((entry) => recordValue(entry).beetle_name)
      .filter((name): name is string => typeof name === "string" && name.length > 0)
    : [];
  const xp = Number(payload.xp);
  if (beetleName) {
    const rewards = [formatBeetleItem(beetleName), ...secondaryDrops.map(formatBeetleItem)];
    return {
      title: action === "catchBeetle" ? "Beetle claimed" : "Hunt resolved",
      detail: `Found: ${rewards.join(", ")}${Number.isFinite(xp) ? ` · +${xp} XP` : ""}`,
      kind: "success",
    };
  }
  const gained = Array.isArray(response.gained)
    ? response.gained.map((entry) => recordValue(entry)).map((entry) => {
      const quantity = Number(entry.diff);
      const item = formatBeetleItem(entry.key);
      return Number.isFinite(quantity) && quantity > 1 ? `${item} ×${quantity}` : item;
    }).filter(Boolean)
    : [];
  return {
    title: action === "catchBeetle" ? "Beetle claimed" : "Hunt resolved",
    detail: gained.length > 0 ? `Received: ${gained.join(", ")}` : (message || "Result received from RemiliaNET."),
    kind: "success",
  };
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
  document.documentElement.toggleAttribute(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE, true);
}

function lockNativeActionButtons(): void {
  for (const button of nativeActionButtons()) {
    const action = button.classList.contains("beetle-catch-module__catch-button") ? "catchBeetle" : "beetleHunt";
    if (instantResultRunning || instantResultCompletedActions.has(action)) {
      button.disabled = true;
      button.dataset.milxdyInstantResultLocked = "true";
    } else if (button.dataset.milxdyInstantResultLocked) {
      button.disabled = false;
      delete button.dataset.milxdyInstantResultLocked;
    }
  }
}

async function runInstantBeetleAction(action: "catchBeetle" | "beetleHunt"): Promise<void> {
  if (instantResultRunning) return;
  if (instantResultCompletedActions.has(action)) {
    showInstantResult("Action already resolved", "Reload the Beetle page to refresh its native inventory and cooldown display.", "success");
    return;
  }
  instantResultRunning = true;
  lockNativeActionButtons();
  showInstantResult(action === "catchBeetle" ? "Claiming Beetle…" : "Hunting Beetle…", "Resolving directly with RemiliaNET.", "pending");
  try {
    const response = await chrome.runtime.sendMessage({ type: "beetol:action", action }) as Record<string, unknown>;
    const copy = resultCopy(action, response);
    if (copy.kind === "success") instantResultCompletedActions.add(action);
    showInstantResult(copy.title, copy.detail, copy.kind);
  } catch {
    showInstantResult("Action could not complete", "Reload the Beetle page and try again.", "error");
  } finally {
    instantResultRunning = false;
    lockNativeActionButtons();
  }
}

function installInstantResultListener(): void {
  if (instantResultListenerInstalled) return;
  instantResultListenerInstalled = true;
  document.addEventListener("click", (event) => {
    if (!instantResultsEnabled || !isBeetleRoute() || !event.isTrusted) return;
    const action = instantResultActionFor(event.target);
    if (!action) return;
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>(".beetle-catch-module__catch-button, .beetle-catch-module__hunt-button")
      : null;
    if (button?.disabled && !button.dataset.milxdyInstantResultLocked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void runInstantBeetleAction(action);
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

function post(message: Record<string, unknown>): void {
  try {
    port?.postMessage(message);
  } catch {
    closeSocket();
  }
}

function connectPort(): void {
  if (!active || port) return;
  const nextPort = chrome.runtime.connect({ name: SOCKET_PORT_NAME });
  port = nextPort;
  nextPort.onMessage.addListener(handlePortMessage);
  nextPort.onDisconnect.addListener(() => {
    if (port !== nextPort) return;
    port = null;
    closeSocket();
    if (active) reconnectTimer = setTimeout(connectPort, 1_000);
  });
}

function connectSocket(): void {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  const nextSocket = new WebSocket(SOCKET_URL);
  socket = nextSocket;
  post({ type: "socket:connecting" });
  nextSocket.addEventListener("open", () => {
    if (socket !== nextSocket) return;
    nextSocket.send(JSON.stringify({ type: "subscribe", payload: { chat_id: CHAT_ID } }));
    startHeartbeat(nextSocket);
    post({ type: "socket:open", at: Date.now() });
  });
  nextSocket.addEventListener("message", (event) => {
    if (socket !== nextSocket || typeof event.data !== "string") return;
    post({ type: "socket:frame", data: event.data });
  });
  nextSocket.addEventListener("close", (event) => {
    stopHeartbeat();
    if (socket === nextSocket) socket = null;
    post({ type: "socket:close", code: event.code, reason: event.reason, wasClean: event.wasClean });
  });
  nextSocket.addEventListener("error", () => {
    post({ type: "socket:error", error: "Connection interrupted.", reason: "site-socket-error" });
  });
}

function closeSocket(): void {
  stopHeartbeat();
  const current = socket;
  socket = null;
  if (current && current.readyState !== WebSocket.CLOSED && current.readyState !== WebSocket.CLOSING) current.close();
}

function startHeartbeat(target: WebSocket): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket !== target || target.readyState !== WebSocket.OPEN) {
      stopHeartbeat();
      return;
    }
    post({ type: "socket:heartbeat", ok: true, readyState: target.readyState, at: Date.now() });
  }, HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function handlePortMessage(message: unknown): void {
  const record = message && typeof message === "object" ? message as Record<string, unknown> : {};
  if (record.type === "connect") {
    connectSocket();
    return;
  }
  if (record.type === "close") {
    closeSocket();
    return;
  }
  if (record.type === "send") {
    if (!socket || socket.readyState !== WebSocket.OPEN || !record.payload || typeof record.payload !== "object") {
      post({ type: "socket:error", error: "Socket is not open.", reason: "site-socket-not-open" });
      return;
    }
    socket.send(JSON.stringify(record.payload));
  }
}

window.addEventListener("pagehide", () => {
  active = false;
  if (beetleRouteObserverTimer !== null) clearInterval(beetleRouteObserverTimer);
  beetleRouteObserverTimer = null;
  if (reconnectTimer !== null) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  closeSocket();
  port?.disconnect();
  port = null;
}, { once: true });

connectPort();
observeBeetleRouteChanges();
void syncBeetleReducedMotion();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes[BEETLE_REDUCED_MOTION_KEY]) applyBeetleReducedMotion(changes[BEETLE_REDUCED_MOTION_KEY].newValue === true);
  if (changes[BEETLE_INSTANT_RESULTS_KEY]) applyInstantBeetleResults(changes[BEETLE_INSTANT_RESULTS_KEY].newValue === true);
});
