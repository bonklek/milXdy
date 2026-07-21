/** @type {import("../../types/index.d.ts").MilxdyContentAppContext | null} */
let appContext = null;
/** @type {HTMLElement | null} */
let panel = null;

const openCountKey = "milxdy.local.docked-app.openCount";

/** @param {import("../../types/index.d.ts").MilxdyContentAppContext} context */
export function boot(context) {
  appContext = context;
  context.recordDiagnostic("docked-app.ready", true);
  context.addDisposable(removePanel);
}

export async function open() {
  if (!appContext || appContext.signal.aborted || panel) return;
  const stored = await appContext.storage.local.get({ [openCountKey]: 0 });
  if (!appContext || appContext.signal.aborted) return;
  await appContext.storage.local.set({ [openCountKey]: Number(stored[openCountKey]) + 1 });

  panel = document.createElement("aside");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Docked App starter");
  panel.style.cssText = "position:fixed;z-index:2147483000;right:16px;top:72px;width:280px;padding:18px;border:1px solid #536471;border-radius:16px;background:#000;color:#e7e9ea;font:14px/1.4 system-ui;box-shadow:0 8px 32px #0008";

  const icon = document.createElement("img");
  icon.src = appContext.resolveAssetUrl("assets/icon.svg");
  icon.alt = "";
  icon.width = 32;
  icon.height = 32;

  const heading = document.createElement("h2");
  heading.textContent = "Docked App";
  heading.style.cssText = "margin:8px 0;font-size:20px";

  const body = document.createElement("p");
  body.textContent = `Opened ${Number(stored[openCountKey]) + 1} time(s). State stays in declared local storage.`;
  body.style.margin = "0";

  panel.append(icon, heading, body);
  document.body.append(panel);
  appContext.recordDiagnostic("docked-app.open", true);
}

export function close() {
  removePanel();
  appContext?.recordDiagnostic("docked-app.open", false);
}

export function disable() {
  close();
}

export function dispose() {
  removePanel();
  appContext = null;
}

function removePanel() {
  panel?.remove();
  panel = null;
}
