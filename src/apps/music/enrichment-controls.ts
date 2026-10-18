import { musicEnrichmentChoices, type MusicEnrichmentChoices, type MusicEnrichmentService } from "./enrichment-consent";
const descriptions: Record<MusicEnrichmentService, string> = {
  musicbrainz: "MusicBrainz (musicbrainz.org): title, artist, album and recording IDs. No audio files.",
  acoustid: "AcoustID (api.acoustid.org): audio fingerprint, duration and your client key. No audio files.",
};
let cancelReview: (() => void) | undefined;
export function cancelMusicEnrichmentReview(): void { cancelReview?.(); }
export function musicEnrichmentControls(options: { busy?: boolean; choices: MusicEnrichmentChoices; key: string; update: (choices: MusicEnrichmentChoices) => void | Promise<unknown>; saveKey: (key: string) => void | Promise<unknown>; }) {
  const section = document.createElement("div"); section.className = "milxdy-music-settings";
  const note = document.createElement("p"); note.textContent = "Folder add and rescan stay local. Choose services below, then use Enrich to review and start a batch. Uncheck either service to stop the current batch. Sent data cannot be recalled.";
  section.append(note);
  for (const service of ["musicbrainz", "acoustid"] as const) {
    const label = document.createElement("label"); label.className = "milxdy-music-setting milxdy-music-check-setting";
    const text = document.createElement("span"); text.textContent = descriptions[service];
    const input = document.createElement("input"); input.type = "checkbox"; input.dataset.role = `${service}-consent`; input.checked = options.choices[service]; input.disabled = options.busy === true || service === "acoustid" && !options.key;
    input.addEventListener("change", () => { void Promise.resolve(options.update({ ...options.choices, [service]: input.checked })).then(() => restoreSettingFocus(`${service}-consent`)); });
    label.append(text, input); section.append(label);
  }
  const label = document.createElement("label"); label.className = "milxdy-music-setting milxdy-music-setting-wide"; label.textContent = "AcoustID client key (saved locally; saving does not enable requests)";
  const input = document.createElement("input"); input.type = "password"; input.dataset.role = "acoustid-key"; input.autocomplete = "off"; input.placeholder = "Optional client key"; input.value = options.key; input.disabled = options.busy === true;
  const save = document.createElement("button"); save.type = "button"; save.disabled = options.busy === true; save.textContent = "Save key"; save.dataset.role = "acoustid-save"; save.addEventListener("click", () => { void Promise.resolve(options.saveKey(input.value.trim())).then(() => restoreSettingFocus("acoustid-save")); });
  if (options.busy) { const pending = document.createElement("p"); pending.setAttribute("role", "status"); pending.textContent = "Saving service choices… Enrich is paused until saving finishes."; section.append(pending); }
  label.append(input, save); section.append(label); return section;
}
function restoreSettingFocus(role: string): void { document.querySelector<HTMLElement>(`[data-role="${role}"]`)?.focus(); }
export function confirmMusicEnrichment(choices: MusicEnrichmentChoices, key: string): Promise<boolean> {
  cancelMusicEnrichmentReview();
  const selected = musicEnrichmentChoices(choices); selected.acoustid &&= !!key;
  const opener = document.activeElement;
  return new Promise(resolve => {
    const dialog = document.createElement("dialog"); dialog.setAttribute("aria-label", "Enrich local music"); dialog.style.cssText = "box-sizing:border-box;width:420px;max-width:calc(100vw - 32px);padding:20px;border-radius:12px;line-height:1.5;color:CanvasText;background:Canvas";
    const title = document.createElement("h2"); title.textContent = "Enrich local music";
    const note = document.createElement("p"); note.textContent = "This sends metadata for up to 40 pending tracks to your selected services. Folder scans never send these requests.";
    dialog.append(title, note);
    for (const service of ["musicbrainz", "acoustid"] as const) if (selected[service]) { const p = document.createElement("p"); p.textContent = descriptions[service]; dialog.append(p); }
    if (!selected.musicbrainz && !selected.acoustid) { const p = document.createElement("p"); p.textContent = "No services selected. Choose services in Music Settings; AcoustID also requires a client key."; dialog.append(p); }
    const finish = (accepted: boolean) => { cancelReview = undefined; dialog.close(); dialog.remove(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); resolve(accepted); };
    cancelReview = () => finish(false);
    const cancel = document.createElement("button"); cancel.textContent = "Cancel"; cancel.autofocus = true; cancel.addEventListener("click", () => finish(false)); dialog.append(cancel);
    const start = document.createElement("button"); start.textContent = "Enrich selected services"; start.disabled = !selected.musicbrainz && !selected.acoustid; start.addEventListener("click", () => finish(true)); dialog.append(start);
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); }); document.body.append(dialog); dialog.showModal(); cancel.focus();
  });
}
