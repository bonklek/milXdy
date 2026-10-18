import type { AppWindowCreateOptions } from "../app-sdk/app-window";
import { ensureOverlayAppChromeStyles, prepareOverlayAppRoot } from "../overlay/app-chrome";

const WINDOW_STYLE_ID = "milxdy-sdk-app-window-style";

export function createAppWindowView(options: AppWindowCreateOptions, windowId: string): { root: HTMLElement; header: HTMLElement; closeButton: HTMLButtonElement } {
  ensureStyles();
  ensureOverlayAppChromeStyles();
  const root = document.createElement("section");
  root.className = "milxdy-sdk-app-window milxdy-overlay-app-shell milxdy-overlay-app-card";
  root.dataset.windowId = windowId;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", options.title);
  root.tabIndex = -1;
  root.hidden = true;
  prepareOverlayAppRoot(root);
  const header = document.createElement("header");
  header.className = "milxdy-sdk-app-window-header milxdy-overlay-app-header";
  const title = document.createElement("strong");
  title.textContent = options.title;
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "milxdy-sdk-app-window-close";
  closeButton.setAttribute("aria-label", `Close ${options.title}`);
  closeButton.textContent = "×";
  header.append(title, closeButton);
  const contentHost = document.createElement("div");
  contentHost.className = "milxdy-sdk-app-window-content";
  contentHost.append(options.content);
  root.append(header, contentHost);
  return { root, header, closeButton };
}

function ensureStyles(): void {
  if (document.getElementById(WINDOW_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = WINDOW_STYLE_ID;
  style.textContent = `.milxdy-sdk-app-window { position: fixed; display: flex; flex-direction: column; overflow: hidden; min-width: 160px; min-height: 120px; }
    .milxdy-sdk-app-window[hidden] { display: none; }.milxdy-sdk-app-window-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; user-select: none; }
    .milxdy-sdk-app-window-content { min-height: 0; flex: 1; overflow: auto; }.milxdy-sdk-app-window-close { min-width: 28px; min-height: 26px; font-size: 20px; line-height: 1; }
    .milxdy-sdk-app-window-resize { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; border: 0; background: transparent; }`;
  document.documentElement.append(style);
}
