import { DockReelSoundPlayer } from "../../platform/overlay/dock-reel-sound";

/** One gesture delegate covers ordinary buttons, checkbox tiles and choice pills. */
export function setupSettingsFeedback(): void {
  const player = new DockReelSoundPlayer();
  player.start();
  let lastPop = -Infinity;
  let pressed: HTMLElement | null = null;
  const targetFor = (target: EventTarget | null) => target instanceof Element
    ? target.closest<HTMLElement>(".app button, .app .setting-tile, .app .binary-pill") : null;
  const pop = (tab = false) => {
    const now = performance.now();
    // Label activation can also dispatch a checkbox click; play once per gesture.
    if (now - lastPop < 45) return;
    lastPop = now;
    if (tab) player.playTab();
    else player.playPop();
  };
  const release = () => { pressed?.classList.remove("is-soft-pressed"); pressed = null; };
  document.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const target = targetFor(event.target);
    if (!target || target.matches(":disabled, [aria-disabled=true]") || target.querySelector("input:disabled")) return;
    release();
    pressed = target;
    target.classList.add("is-soft-pressed");
  });
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
  window.addEventListener("blur", release);
  document.addEventListener("keydown", event => {
    if (event.repeat || !["Enter", " "].includes(event.key)) return;
    const target = targetFor(event.target);
    if (!target || target.matches(":disabled, [aria-disabled=true]")) return;
    pressed = target;
    target.classList.add("is-soft-pressed");
  });
  document.addEventListener("keyup", event => { if (["Enter", " "].includes(event.key)) release(); });
  document.addEventListener("click", event => {
    const target = targetFor(event.target);
    if (!event.isTrusted || !target || target.matches(":disabled, [aria-disabled=true]")) return;
    const tab = target.matches(".tab[data-panel]");
    if (tab && target.classList.contains("is-active")) return;
    pop(tab);
  }, { capture: true });
  document.addEventListener("change", event => {
    if (event.isTrusted && event.target instanceof HTMLSelectElement && event.target.closest(".app")) pop();
  });
  window.addEventListener("pagehide", () => { release(); player.dispose(); }, { once: true });
}
