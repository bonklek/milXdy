import { createSoundManager, disposeSoundManager } from "./sounds.js";

type SoundHost = Window & { reminetSounds?: ReturnType<typeof createSoundManager> };

/** Creates an inert lifecycle owner. No browser work happens until install. */
export function createRemiStatsEffects() {
  let fontStyle: HTMLStyleElement | null = null;
  let soundManager: ReturnType<typeof createSoundManager> | null = null;
  let version: string | null = null;
  return { install, dispose };

  function install(contentVersion: string, resolveAssetUrl: (path: string) => string) {
    if (fontStyle) return;
    if (typeof resolveAssetUrl !== "function") throw new Error("RemiStats requires SDK asset resolution");
    const fontUrl = resolveAssetUrl("remistats/RemiliaMincho-Regular.otf");
    const style = document.createElement("style");
    style.dataset.milxdyRemistatsFont = "true";
    style.textContent = `@font-face { font-family: 'Remilia Mincho'; src: url('${fontUrl}') format('opentype'); font-weight: normal; font-style: normal; font-display: swap; }`;
    document.head?.appendChild(style);
    fontStyle = style;
    version = contentVersion;
    document.documentElement.dataset.milxdyReminetContentVersion = version;
    soundManager = createSoundManager();
    (window as SoundHost).reminetSounds = soundManager;
  }

  function dispose() {
    fontStyle?.remove();
    fontStyle = null;
    if ((window as SoundHost).reminetSounds === soundManager) delete (window as SoundHost).reminetSounds;
    if (soundManager) void disposeSoundManager();
    soundManager = null;
    if (document.documentElement.dataset.milxdyReminetContentVersion === version) {
      delete document.documentElement.dataset.milxdyReminetContentVersion;
    }
    version = null;
  }
}
