import { AudioGroups } from "../../lib/audio-groups";
import { AudioCueVolumes } from "../../lib/audio-cue-volumes";
import type { AppRuntimeScheduler } from "../../platform/app-sdk/app-platform";

const MESSAGE = '[data-testid^="message-"]:not([data-testid^="message-text-"])';
const REMICHAT = "#milxdy-reminet-chat-root";
const isChatRoute = () => /^\/(messages|i\/chat)(\/|$)/.test(location.pathname);
/** Native X messages belong to X audio, independent of Maxxer and the RemiChat app. */
export class XChatSounds {
  private context: AudioContext | null = null;
  private seen = new Set<string>();
  private quietUntil = 0;
  private lastSend = -Infinity;
  constructor(private groups: AudioGroups, private volumes: AudioCueVolumes, private scheduler: AppRuntimeScheduler) {}
  start(addDisposable: (dispose: () => void) => void): void {
    this.onRouteChange();
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(REMICHAT) || !isChatRoute()) return;
      if (this.level("xChatSend") > 0 || this.level("xChatMessage") > 0) this.audio();
      const button = target.closest<HTMLElement>('button, [role="button"]');
      if (!button) return;
      const testId = button.getAttribute("data-testid") ?? "";
      const label = button.getAttribute("aria-label") ?? "";
      const form = button.closest('[data-testid="dm-composer-form"]');
      if ((form && button.getAttribute("type") === "submit") || /send/i.test(testId) || /^send(?: message)?$/i.test(label)) this.playSend();
    };
    const keydown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || target.closest(REMICHAT) || !isChatRoute() || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      if (this.level("xChatSend") > 0 || this.level("xChatMessage") > 0) this.audio();
      if (target.matches('[data-testid="dm-composer-textarea"], [role="textbox"], textarea') || target.isContentEditable) this.playSend();
    };
    document.addEventListener("click", click, { capture: true, passive: true });
    document.addEventListener("keydown", keydown, { capture: true, passive: true });
    addDisposable(() => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keydown, true);
      void this.context?.close().catch(() => undefined);
      this.context = null; this.seen.clear();
    });
  }
  onRouteChange(): void { this.seen.clear(); this.quietUntil = Date.now() + 2000; }
  onSurface(element: HTMLElement): void {
    if (!isChatRoute() || element.closest(REMICHAT)) return;
    const message = element.matches(MESSAGE) ? element : element.querySelector<HTMLElement>(MESSAGE);
    const id = message?.getAttribute("data-testid");
    if (!id || this.seen.has(id)) return;
    this.seen.add(id);
    if (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value!);
    if (document.hidden || Date.now() < this.quietUntil) return;
    this.playMessage();
  }
  private level(kind: "xChatSend" | "xChatMessage"): number {
    if (!this.groups.enabled("x") || !this.groups.enabled(kind)) return 0;
    return this.volumes.get("x") * this.volumes.get(kind);
  }
  private playSend(): void {
    const now = Date.now();
    if (now - this.lastSend < 250) return;
    this.lastSend = now; this.quietUntil = now + 2000;
    this.tone(250, 0.025, "square", 0.06, this.level("xChatSend"));
  }
  private playMessage(): void {
    this.tone(1200, 0.08, "sine", 0.06, this.level("xChatMessage"));
    this.scheduler.timeout(() => this.tone(1500, 0.06, "sine", 0.04, this.level("xChatMessage")), 30);
  }
  private tone(frequency: number, duration: number, type: OscillatorType, gain: number, level: number): void {
    if (level <= 0) return;
    try {
      const ctx = this.audio();
      if (!ctx) return;
      const oscillator = ctx.createOscillator(), node = ctx.createGain(), now = ctx.currentTime;
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
      node.gain.setValueAtTime(0, now);
      node.gain.linearRampToValueAtTime(gain * level, now + 0.002);
      node.gain.linearRampToValueAtTime(0, now + duration);
      oscillator.connect(node); node.connect(ctx.destination);
      oscillator.onended = () => { oscillator.disconnect(); node.disconnect(); };
      oscillator.start(now); oscillator.stop(now + duration);
    } catch { /* Browser audio may be unavailable. */ }
  }
  private audio(): AudioContext | null {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    try {
      const ctx = this.context ??= new AudioContextCtor();
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      return ctx;
    } catch { return null; }
  }

}
