import { refreshSettingsChoice } from "./settings-tiles";

const accountSettings = new Set([
  "visualUseRemiliaProfileColor", "visualPokePlacement", "visualIncomingPokeGold", "visualReminetChatOverlay",
  "beetolColor", "beetolMode", "remistats.likeAutoPoke", "remistats.pokeAutoLike",
  "remistats.beetol.enabled", "reminet.beetleReducedMotion", "reminet.beetleInstantResults",
  "pokes.autoLike", "pokes.incomingGold", "pokes.placement",
]);

/** Public profile decoration and Wiki settings do not require a connection. */
export function requiresRemiliaLogin(setting: string): boolean {
  return accountSettings.has(setting) || setting.startsWith("reminetChat.") || setting.startsWith("beetol.")
    || setting.startsWith("remistats.sounds.");
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
let entries: { label: HTMLElement; lock: HTMLElement; controls: { control: Control; disabled: boolean }[] }[] = [];
let signedIn = true;

export function setupRemiliaSettingLocks(): void {
  const labels = new Set<HTMLElement>();
  for (const control of document.querySelectorAll<HTMLElement>("input, select, textarea")) {
    if (!requiresRemiliaLogin(control.dataset.bundledSetting ?? control.dataset.control ?? control.id)) continue;
    const label = control.closest<HTMLElement>("label");
    if (label) labels.add(label);
  }
  entries = [...labels].map(label => {
    const lock = document.createElement("span");
    lock.className = "remilia-setting-lock";
    lock.tabIndex = 0;
    lock.setAttribute("role", "img");
    lock.setAttribute("aria-label", "Log into RemiliaNET");
    lock.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z"/><path d="M12 14v3"/></svg>';
    label.append(lock);
    label.classList.add("has-settings-help");
    label.addEventListener("click", event => {
      if (!label.classList.contains("remilia-setting-locked")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      lock.focus();
    }, true);
    return { label, lock, controls: [...label.querySelectorAll<Control>("input, select, textarea, button")].map(control => ({ control, disabled: control.disabled })) };
  });
  updateRemiliaSettingLocks(false);
}

export function updateRemiliaSettingLocks(connected: boolean): void {
  if (signedIn === connected) return;
  signedIn = connected;
  for (const entry of entries) {
    entry.label.classList.toggle("remilia-setting-locked", !connected);
    entry.lock.hidden = connected;
    for (const item of entry.controls) {
      // Preserve controls disabled for build availability or other requirements.
      if (!connected) item.disabled = item.control.disabled;
      item.control.disabled = connected ? item.disabled : true;
      refreshSettingsChoice(item.control);
    }
  }
}
