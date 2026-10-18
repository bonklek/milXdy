import { samePresetValue, type PresetChange, type PresetDecision, type PresetResult, type SavedPreset } from "./preset-transaction";

function dialogShell(title: string): { dialog: HTMLDialogElement; content: HTMLElement; actions: HTMLElement; close: () => void } {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", title);
  dialog.style.cssText = "color-scheme:light dark;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:8px;padding:20px;width:min(620px,calc(100vw - 32px));max-height:85vh;box-sizing:border-box;overflow:auto;font:14px/1.5 system-ui;";
  const heading = document.createElement("h2"); heading.textContent = title; heading.style.cssText = "font-size:18px;margin:0 0 12px";
  const content = document.createElement("div");
  const actions = document.createElement("div"); actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:16px";
  dialog.append(heading, content, actions);
  const close = () => { dialog.close(); dialog.remove(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  document.documentElement.append(dialog);
  return { dialog, content, actions, close };
}
function button(label: string, action: () => void): HTMLButtonElement {
  const control = document.createElement("button"); control.type = "button"; control.textContent = label;
  control.style.cssText = "font:inherit;padding:7px 10px;min-height:36px;cursor:pointer;white-space:normal";
  control.onclick = action; return control;
}
function humanLabel(value: string): string {
  return value.replace(/^milxdy\./, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ").replace(/Remi Stats/g, "RemiStats").replace(/Remi Net/g, "RemiNet").replace(/\btts\b/ig, "TTS").replace(/^./, letter => letter.toUpperCase());
}
function describe(value: unknown, label = ""): string {
  if (value === undefined) return "default (not stored)";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number" && /volume/i.test(label) && value >= 0 && value <= 1) return `${Math.round(value * 100)}%`;
  if (Array.isArray(value)) return value.length ? value.map(item => humanLabel(item && typeof item === "object" && "name" in item ? String(item.name) : String(item))).join(", ") : "None";
  return typeof value === "string" ? humanLabel(value) : JSON.stringify(value);
}
export function presetPreviewLines(changes: PresetChange[]): string[] {
  const lines: string[] = [];
  for (const change of changes) {
    if (samePresetValue(change.before, change.value)) continue;
    const before = change.before.present ? change.before.value : undefined;
    const after = change.value.present ? change.value.value : undefined;
    if (after && typeof after === "object" && !Array.isArray(after)) {
      const a = before && typeof before === "object" && !Array.isArray(before) ? before as Record<string, unknown> : {};
      const b = after as Record<string, unknown>;
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) lines.push(`${humanLabel(change.label)} · ${humanLabel(key)}: ${describe(a[key], key)} → ${describe(b[key], key)}`);
      }
    } else lines.push(`${humanLabel(change.label)}: ${describe(before, change.label)} → ${describe(after, change.label)}`);
  }
  return lines.length ? lines : ["These settings already match. No value will change."];
}
export function reviewPreset(title: string, changes: PresetChange[]): Promise<PresetDecision> {
  const view = dialogShell(title);
  const notice = document.createElement("p");
  notice.textContent = "Review every affected setting below. You can save the current configuration before replacing it. Other settings are preserved.";
  const list = document.createElement("ul"); list.style.cssText = "padding-left:20px;overflow-wrap:anywhere";
  for (const line of presetPreviewLines(changes)) { const item = document.createElement("li"); item.textContent = line; list.append(item); }
  view.content.append(notice, list);
  return new Promise(resolve => {
    let settled = false;
    const finish = (choice: PresetDecision) => { if (settled) return; settled = true; view.close(); resolve(choice); };
    const cancel = button("Cancel — keep current settings", () => finish("cancel"));
    view.actions.append(cancel, button("Discard current choices and apply", () => finish("apply")), button("Save as custom and apply", () => finish("save")));
    view.dialog.addEventListener("cancel", event => { event.preventDefault(); finish("cancel"); });
    view.dialog.showModal(); cancel.focus();
  });
}
export function chooseSavedPreset(saved: SavedPreset[]): Promise<SavedPreset | null> {
  const view = dialogShell("Saved custom configurations");
  return new Promise(resolve => {
    const finish = (value: SavedPreset | null) => { view.close(); resolve(value); };
    const note = document.createElement("p"); note.textContent = saved.length ? "Choose a configuration to review its changes before restoring it." : "No saved configurations yet. Choose Save as custom when applying a preset.";
    view.content.append(note);
    for (const item of saved) view.content.append(button(item.name, () => finish(item)));
    const cancel = button("Cancel", () => finish(null)); view.actions.append(cancel);
    view.dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
    view.dialog.showModal(); cancel.focus();
  });
}
export function showPresetResult(result: PresetResult, parent: HTMLElement = document.querySelector<HTMLElement>(".panel.is-active") || document.body): void {
  let status = parent.querySelector<HTMLElement>('[data-preset-status]');
  if (!status) { status = document.createElement("div"); status.dataset.presetStatus = "true"; status.style.cssText = "padding:10px;border:1px solid GrayText;overflow-wrap:anywhere"; parent.append(status); }
  status.setAttribute("role", result.status === "failed" ? "alert" : "status"); status.replaceChildren(document.createTextNode(result.message));
  if (result.status !== "cancelled" && !/^(Applying|Restoring)/.test(result.message)) { status.tabIndex = -1; status.focus({ preventScroll: true }); }
  if (result.recovery) status.append(button("Download recovery settings", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "milxdy.presetRecovery", version: 1, settings: result.recovery }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "milxdy-preset-recovery.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }));
}
