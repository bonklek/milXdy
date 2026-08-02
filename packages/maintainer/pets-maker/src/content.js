/** Authored against the public milXdy App SDK and bundled for local review. */
import { buildCustomPetExport } from "./custom-pet-ui.js";

let appContext = null;
let panel = null;
let panelController = null;
let previousFocus = null;

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

  const header = document.createElement("header");
  header.className = "pets-maker-app__header";
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
  closeButton.setAttribute("aria-label", "Close Pets Maker");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", close, { signal });
  header.append(iconFrame, heading, closeButton);

  const body = document.createElement("div");
  body.className = "pets-maker-app__body";
  body.append(buildCustomPetExport({ signal }));
  panel.append(header, body);
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
