/** @type {import("../../types/index.d.ts").MilxdyContentAppContext | null} */
let appContext = null;
/** @type {HTMLElement | null} */
let panel = null;
/** @type {HTMLElement | null} */
let previousFocus = null;
let openOperation = 0;

const openCountKey = "milxdy.local.docked-app.openCount";

/** @param {import("../../types/index.d.ts").MilxdyContentAppContext} context */
export function boot(context) {
  appContext = context;
  context.recordDiagnostic("docked-app.ready", true);
  context.addDisposable(removePanel);
}

export async function open() {
  if (!appContext || appContext.signal.aborted || panel) return;
  const context = appContext;
  const operation = ++openOperation;
  const isCurrentOpen = () => appContext === context && !context.signal.aborted && openOperation === operation && !panel;

  const stored = await context.storage.local.get({ [openCountKey]: 0 });
  if (!isCurrentOpen()) return;
  await context.storage.local.set({ [openCountKey]: Number(stored[openCountKey]) + 1 });
  if (!isCurrentOpen()) return;

  panel = document.createElement("aside");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "milxdy-docked-app-title");
  panel.tabIndex = -1;
  panel.className = "milxdy-sdk-overlay";
  panel.addEventListener("keydown", onPanelKeydown);

  const header = document.createElement("header");
  header.className = "milxdy-sdk-overlay__header";

  const icon = document.createElement("img");
  icon.src = context.resolveAssetUrl("assets/icon.svg");
  icon.alt = "";
  icon.width = 32;
  icon.height = 32;
  icon.className = "milxdy-sdk-overlay__icon";

  const heading = document.createElement("h2");
  heading.id = "milxdy-docked-app-title";
  heading.textContent = "Docked App";
  heading.className = "milxdy-sdk-overlay__title";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "milxdy-sdk-overlay__button";
  closeButton.setAttribute("aria-label", "Close Docked App");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", close);

  const content = document.createElement("div");
  content.className = "milxdy-sdk-overlay__body";

  const body = document.createElement("p");
  body.textContent = `Opened ${Number(stored[openCountKey]) + 1} time(s). State stays in declared local storage.`;

  header.append(icon, heading, closeButton);
  content.append(body);
  panel.append(header, content);
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.append(panel);
  panel.focus();
  context.recordDiagnostic("docked-app.open", true);
}

export function close() {
  // Invalidate an in-flight open before removing the visible panel.
  openOperation += 1;
  removePanel();
  appContext?.recordDiagnostic("docked-app.open", false);
}

export function disable() {
  close();
}

export function dispose() {
  openOperation += 1;
  removePanel();
  appContext = null;
}

function removePanel() {
  panel?.remove();
  panel = null;
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
}

/** @param {KeyboardEvent} event */
function onPanelKeydown(event) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  close();
}
