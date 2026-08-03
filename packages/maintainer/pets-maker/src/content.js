/** Authored against the public milXdy App SDK and bundled for local review. */
import { buildCustomPetExport } from "./custom-pet-ui.js";

let appContext = null;
let panel = null;
let panelController = null;
let previousFocus = null;
let dragState = null;

export function boot(context) {
  appContext = context;
  context.recordDiagnostic("pets-maker.ready", { capability: "local-pet-bundle-maker" });
  context.addDisposable(removePanel);
}

export function open() {
  if (!appContext || appContext.signal.aborted || panel) return;
  panelController = new AbortController();
  const { signal } = panelController;
  panel = document.createElement("aside");
  panel.className = "pets-maker-app";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "pets-maker-title");
  panel.tabIndex = -1;
  panel.addEventListener("keydown", onPanelKeydown, { signal });

  const wipBanner = document.createElement("div");
  wipBanner.className = "pets-maker-app__wip";
  wipBanner.setAttribute("role", "note");
  const wipLabel = document.createElement("strong");
  wipLabel.textContent = "WORK IN PROGRESS";
  const wipDetail = document.createElement("span");
  wipDetail.textContent = "Preview build — controls and output may change.";
  wipBanner.append(wipLabel, wipDetail);

  const header = document.createElement("header");
  header.className = "pets-maker-app__header";
  header.setAttribute("aria-label", "Drag Pets Maker window");
  header.addEventListener("pointerdown", onPanelPointerDown, { signal });
  header.addEventListener("pointermove", onPanelPointerMove, { signal });
  header.addEventListener("pointerup", onPanelPointerEnd, { signal });
  header.addEventListener("pointercancel", onPanelPointerEnd, { signal });
  const iconFrame = document.createElement("div");
  iconFrame.className = "pets-maker-app__icon-frame";
  const icon = document.createElement("img");
  icon.className = "pets-maker-app__icon";
  icon.src = appContext.resolveAssetUrl("assets/remy.png");
  icon.alt = "";
  iconFrame.append(icon);
  const heading = document.createElement("div");
  heading.className = "pets-maker-app__heading";
  const eyebrow = document.createElement("p");
  eyebrow.className = "pets-maker-app__eyebrow";
  eyebrow.textContent = "Remilia pet lab / 01";
  const title = document.createElement("h2");
  title.id = "pets-maker-title";
  title.className = "pets-maker-app__title";
  title.textContent = "Pets Maker";
  const subtitle = document.createElement("p");
  subtitle.className = "pets-maker-app__subtitle";
  subtitle.textContent = "Maker avatar → validated Codex handoff";
  heading.append(eyebrow, title, subtitle);
  const closeButton = document.createElement("button");
  closeButton.className = "pets-maker-app__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Minimize Pets Maker");
  closeButton.title = "Minimize";
  closeButton.textContent = "−";
  closeButton.addEventListener("click", close, { signal });
  header.append(iconFrame, heading, closeButton);

  const body = document.createElement("div");
  body.className = "pets-maker-app__body";
  body.append(buildCustomPetExport({ signal }));
  panel.append(wipBanner, header, body);
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.append(panel);
  panel.focus();
  appContext.recordDiagnostic("pets-maker.open", true);
}

export function close() {
  removePanel();
  appContext?.recordDiagnostic("pets-maker.open", false);
}

export function disable() {
  close();
}

export function dispose() {
  removePanel();
  appContext = null;
}

function removePanel() {
  dragState = null;
  panelController?.abort();
  panelController = null;
  panel?.remove();
  panel = null;
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
}

function onPanelKeydown(event) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  close();
}

function onPanelPointerDown(event) {
  if (!panel || event.button !== 0 || event.target.closest("button, a, input, select, textarea")) return;
  const handle = event.currentTarget;
  const bounds = panel.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX - bounds.left,
    offsetY: event.clientY - bounds.top,
  };
  panel.style.inset = "auto";
  panel.style.left = `${bounds.left}px`;
  panel.style.top = `${bounds.top}px`;
  panel.dataset.dragging = "true";
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPanelPointerMove(event) {
  if (!panel || !dragState || dragState.pointerId !== event.pointerId) return;
  const margin = 8;
  const bounds = panel.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - bounds.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - bounds.height - margin);
  const left = Math.min(maxLeft, Math.max(margin, event.clientX - dragState.offsetX));
  const top = Math.min(maxTop, Math.max(margin, event.clientY - dragState.offsetY));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function onPanelPointerEnd(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const handle = event.currentTarget;
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  delete panel?.dataset.dragging;
  dragState = null;
}
