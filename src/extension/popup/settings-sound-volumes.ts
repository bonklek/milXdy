import { normalizeCueVolume } from "../../platform/settings/audio-cue-volumes";

let refreshAll = () => {};
const refreshers = new WeakMap<Element, () => void>();
export function refreshSoundVolume(control: Element): void { refreshers.get(control)?.(); refreshAll(); }

const volumeControls: Record<string, string> = {
  "xSounds.enabled": "audioVolume.x",
  "xChatSounds.send": "audioVolume.xChatSend", "xChatSounds.message": "audioVolume.xChatMessage",
  "interfaceSounds.enabled": "interfaceSounds.volume", "milady.soundEnabled": "audioVolume.maxxer",
  "remistats.soundsEnabled": "remistats.soundVolume", "reminetChat.sounds.enabled": "reminetChat.sounds.volume",
  "reminetChat.sounds.message": "audioVolume.chatMessage", "reminetChat.sounds.send": "audioVolume.chatSend",
  "reminetChat.sounds.poke": "audioVolume.chatPoke", "reminetChat.sounds.react": "audioVolume.chatReact",
  "reminetChat.sounds.reactToMe": "audioVolume.chatReactToMe", visualPostSound: "audioVolume.post",
  visualSidebarSound: "audioVolume.sidebar", visualNewPostsSound: "audioVolume.newPosts",
};
/** Prepare before binding/loading controls so every generated entry participates in persistence. */
export function prepareSoundVolumes(): void {
  const root = document.querySelector(".audio-sounds");
  if (!root) return;
  for (const toggle of root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
    const control = toggle.dataset.volumeControl ?? volumeControls[toggle.dataset.control ?? toggle.id];
    if (!control) continue;
    const label = toggle.closest("label")!;
    const name = label.querySelector("strong")?.textContent ?? "Sound";
    const row = document.createElement("div");
    row.className = "sound-volume-row";
    const oldRow = label.parentElement?.classList.contains("audio-source-row") ? label.parentElement : null;
    (oldRow ?? label).before(row);
    row.append(label);
    oldRow?.remove();
    const slot = document.createElement("div");
    slot.className = "sound-volume-slot";
    const range = document.createElement("input");
    range.type = "range"; range.min = "0"; range.max = "2"; range.step = "0.01";
    range.setAttribute("aria-label", `${name} volume slider`);
    const number = document.createElement("input");
    number.type = "number"; number.min = "0"; number.max = "2"; number.step = "0.01";
    number.dataset.control = control;
    number.addEventListener("change", () => { number.value = String(normalizeCueVolume(number.value)); }, { capture: true });
    number.setAttribute("aria-label", `${name} volume`);
    slot.append(range, number); row.append(slot);
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("aria-hidden", "true");
    icon.classList.add("sound-state-icon");
    icon.innerHTML = '<path d="M11 4 6 8H2v8h4l5 4Z"/><path class="sound-unmuted" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-muted" d="m16 9 6 6m0-6-6 6"/>';
    label.append(icon);
  }
}
export function setupSoundVolumes(): void {
  const updates: Array<() => void> = [];
  for (const group of document.querySelectorAll<HTMLElement>(".sound-children[data-sound-parent]")) {
    updates.push(() => {
      const parent = document.querySelector<HTMLInputElement>(`[data-control="${group.dataset.soundParent}"]`);
      group.hidden = Boolean(parent && !parent.checked);
      group.inert = group.hidden;
    });
  }
  refreshAll = () => updates.forEach(update => update());
  for (const row of document.querySelectorAll<HTMLElement>(".sound-volume-row")) {
    const toggle = row.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const slot = row.querySelector<HTMLElement>(".sound-volume-slot")!;
    const range = slot.querySelector<HTMLInputElement>('input[type="range"]')!;
    const number = slot.querySelector<HTMLInputElement>('input[type="number"]')!;
    const refresh = () => {
      row.classList.toggle("sound-enabled", toggle.checked);
      const blocked: string[] = [];
      for (let node = row.parentElement; node; node = node.parentElement) {
        const parentId = node.dataset.soundParent;
        if (!parentId) continue;
        const parent = document.querySelector<HTMLInputElement>(`[data-control="${parentId}"]`);
        const masterVolume = parent?.closest(".sound-volume-row")?.querySelector<HTMLInputElement>('input[type="number"]');
        if (parent && (!parent.checked || (masterVolume && normalizeCueVolume(masterVolume.value) === 0))) blocked.push(parent.closest("label")?.querySelector("strong")?.textContent ?? parentId);
      }
      row.dataset.soundBlockedBy = blocked.join(", ");
      row.classList.toggle("sound-parent-muted", blocked.length > 0);
      row.classList.toggle("sound-muted-state", !toggle.checked || normalizeCueVolume(number.value) === 0 || blocked.length > 0);
      slot.inert = !toggle.checked;
      slot.setAttribute("aria-hidden", String(!toggle.checked));
      range.value = String(normalizeCueVolume(number.value));
    };
    range.addEventListener("input", () => {
      number.value = range.value;
      number.dispatchEvent(new Event("change", { bubbles: true }));
    });
    number.addEventListener("change", () => {
      number.value = String(normalizeCueVolume(number.value)); refreshAll();
    });
    updates.push(refresh);
    refreshers.set(toggle, refresh);
    toggle.addEventListener("change", refreshAll);
    // Preset/theme loads update checkbox properties and tile attributes without change events.
    new MutationObserver(refreshAll).observe(row.querySelector(".setting-tile")!, { attributes: true, attributeFilter: ["aria-pressed", "aria-checked", "class"] });
    refresh();
  }
  refreshAll();
}
