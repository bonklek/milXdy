import { afterEach, describe, expect, it, vi } from "vitest";
import { XChatSounds } from "./x-chat-sounds";
import type { AudioGroups } from "../../platform/settings/audio-groups";
import type { AudioCueVolumes } from "../../platform/settings/audio-cue-volumes";
import type { AppRuntimeScheduler } from "../../platform/app-sdk/app-platform";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture() {
  vi.useFakeTimers();
  const enabled: Record<string, boolean> = { x: true, xChat: true, xChatSend: true, xChatMessage: true };
  const volume: Record<string, number> = { x: .5, xChat: .4, xChatSend: .25, xChatMessage: .75 };
  const peaks: number[] = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const dispose: Array<() => void> = [];
  const close = vi.fn(async () => {});
  class Audio {
    state = "running"; currentTime = 0; destination = {}; close = close;
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime(value: number) { if (value) peaks.push(value); } }, connect() {}, disconnect() {} }; }
    createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {} }; }
  }
  class Target {
    constructor(readonly id = "send", readonly overlay = false) {}
    closest(selector: string) { if (selector.includes("milxdy-reminet")) return this.overlay ? this : null; return selector.includes("button") ? this : null; }
    getAttribute(name: string) { return name === "data-testid" ? this.id : name === "aria-label" ? "Send" : null; }
    matches() { return this.id.startsWith("message-"); }
  }
  vi.stubGlobal("Element", Target); vi.stubGlobal("HTMLElement", Target);
  vi.stubGlobal("location", { pathname: "/messages/123" });
  vi.stubGlobal("window", { AudioContext: Audio });
  vi.stubGlobal("document", { hidden: false, addEventListener: (name: string, fn: never) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name) });
  const groups = { enabled: (key: string) => enabled[key] } as AudioGroups;
  const volumes = { get: (key: string) => volume[key] } as AudioCueVolumes;
  const scheduler = { timeout: (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); } } as AppRuntimeScheduler;
  const sound = new XChatSounds(groups, volumes, scheduler);
  sound.start(fn => dispose.push(fn));
  return { sound, enabled, volume, peaks, listeners, close, dispose, Target };
}
describe("native X chat sound hierarchy", () => {
  it("multiplies X and event gains and suppresses duplicate send events", () => {
    const f = fixture();
    f.listeners.get("click")!({ target: new f.Target() });
    expect(f.peaks).toEqual([.06 * .5 * .25]);
    f.listeners.get("click")!({ target: new f.Target() });
    expect(f.peaks).toHaveLength(1);
  });
  it.each(["x", "xChatSend"])("mutes sends under disabled %s without changing child preferences", parent => {
    const f = fixture(); f.enabled[parent] = false;
    f.listeners.get("click")!({ target: new f.Target() });
    expect(f.peaks).toEqual([]); expect(f.volume.xChatSend).toBe(.25);
  });
  it("ignores historical messages and RemiChat elements, then applies live native message gain", () => {
    const f = fixture();
    f.sound.onSurface(new f.Target("message-old") as unknown as HTMLElement);
    expect(f.peaks).toEqual([]);
    vi.advanceTimersByTime(2100);
    f.sound.onSurface(new f.Target("message-overlay", true) as unknown as HTMLElement);
    expect(f.peaks).toEqual([]);
    f.sound.onSurface(new f.Target("message-new") as unknown as HTMLElement);
    vi.advanceTimersByTime(40);
    expect(f.peaks).toHaveLength(2);
    expect(f.peaks[0]).toBeCloseTo(.06 * .5 * .75);
    expect(f.peaks[1]).toBeCloseTo(.04 * .5 * .75);
    f.sound.onSurface(new f.Target("message-new") as unknown as HTMLElement);
    expect(f.peaks).toHaveLength(2);
    f.volume.xChatMessage = 0;
    f.sound.onSurface(new f.Target("message-zero") as unknown as HTMLElement);
    vi.advanceTimersByTime(40); expect(f.peaks).toHaveLength(2);
  });
  it("removes native event handlers and closes audio on disposal", () => {
    const f = fixture(); f.listeners.get("click")!({ target: new f.Target() });
    f.dispose.forEach(fn => fn()); expect(f.listeners.size).toBe(0); expect(f.close).toHaveBeenCalledOnce();
  });
});
