const allowedStates = new Set([
  "idle",
  "loading",
  "refreshing",
  "ready",
  "empty",
  "success",
  "error",
  "offline",
  "auth-required",
  "cooldown",
  "unsupported",
]);

const root = document.documentElement;
const windowElement = document.querySelector(".mx-window");
const statusElement = document.querySelector("#library-status");
const loadButton = document.querySelector("#simulate-load");
const retryButton = document.querySelector("#retry-button");
const themeSelect = document.querySelector("#theme-select");
const chromeSelect = document.querySelector("#chrome-select");
const tabButtons = [...document.querySelectorAll(".mx-tabs button")];
let activeRequest = null;

function setState(state, message) {
  if (!allowedStates.has(state)) throw new Error(`Unknown state: ${state}`);
  windowElement.dataset.state = state;
  statusElement.textContent = message;
  loadButton.disabled = state === "loading" || state === "refreshing";
  retryButton.hidden = state !== "error" && state !== "offline";
}

function abortActiveRequest() {
  activeRequest?.abort();
  activeRequest = null;
}

async function simulateRefresh() {
  abortActiveRequest();
  const controller = new AbortController();
  activeRequest = controller;
  setState("refreshing", "Refreshing 2 existing tracks…");

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, 650);
      controller.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(controller.signal.reason ?? new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
    if (controller.signal.aborted) return;
    setState("success", "Library refreshed");
  } catch (error) {
    if (error?.name !== "AbortError") setState("error", "Refresh failed");
  } finally {
    if (activeRequest === controller) activeRequest = null;
  }
}

function updateTheme() {
  const theme = themeSelect.value;
  if (theme === "system") {
    delete root.dataset.milxdyTheme;
  } else {
    root.dataset.milxdyTheme = theme;
  }
}

function updateChrome() {
  root.dataset.milxdyChrome = chromeSelect.value;
}

loadButton.addEventListener("click", simulateRefresh);
retryButton.addEventListener("click", simulateRefresh);
themeSelect.addEventListener("change", updateTheme);
chromeSelect.addEventListener("change", updateChrome);

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    for (const candidate of tabButtons) {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    }
    setState("ready", `${button.textContent.trim()} selected`);
  });
}

window.addEventListener("pagehide", abortActiveRequest, { once: true });
setState("ready", "Ready");
