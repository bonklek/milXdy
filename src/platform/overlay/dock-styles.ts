import { DOCK_STYLE_ID } from "./dock-dom-contract";
import dockStyles from "./dock.css";

export function injectDockStyles(): void {
  if (document.getElementById(DOCK_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DOCK_STYLE_ID;
  style.textContent = `${dockStyles.replace(/\r?\n$/, "")}\n  `;
  document.documentElement.appendChild(style);
}
