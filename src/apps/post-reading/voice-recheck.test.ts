import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpeechController } from "./speech";
import { DEFAULT_SETTINGS } from "./shared/defaults";
import { WebSpeechEngine, type TtsEngine, type TtsRequest } from "./ttsEngines";
const voice = { voiceURI: "test-voice" } as SpeechSynthesisVoice;
const tick = async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); };
function reader() {
  let finish!: (result: boolean) => void;
  const requests: TtsRequest[] = [], sessions: { pause: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const engine: TtsEngine = {
    id: "web-speech", label: "Test", capabilities: { voices: true, boundaryEvents: true, seek: false },
    speak: vi.fn(async request => { requests.push(request); request.onStart(); const session = { pause: vi.fn(), stop: vi.fn(), resume: vi.fn(), hasSyncedBoundaries: true }; sessions.push(session); return session; }),
    probeBoundarySupport: vi.fn((_voice, signal) => new Promise<boolean>(resolve => { finish = resolve; signal?.addEventListener("abort", () => resolve(false), { once: true }); })),
  };
  const controller = new SpeechController({ ...DEFAULT_SETTINGS });
  (controller as unknown as { engine: TtsEngine }).engine = engine;
  return { controller, engine, requests, sessions, finish: (result: boolean) => finish(result) };
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", { setTimeout, clearTimeout }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("voice recheck playback custody", () => {
  it.each([true, false])("restores active speech at its boundary after probe result %s", async result => {
    const r = reader(); r.controller.speak("First sentence. Second sentence.", "Post"); await tick();
    r.requests[0]!.onBoundary({ charIndex: 16, charLength: 6 });
    const checked = r.controller.probeBoundarySupport(voice); await tick();
    expect(r.sessions[0]!.stop).toHaveBeenCalledOnce(); expect(r.controller.getState().isPriming).toBe(true);
    r.finish(result); expect(await checked).toBe(result); await tick();
    expect(r.requests.map(request => request.text)).toEqual(["First sentence. Second sentence.", "Second sentence."]);
    expect(r.controller.getState()).toMatchObject({ status: "speaking", isPriming: false, hasStarted: true }); r.controller.stop();
  });
  it("keeps a paused reader paused after the probe", async () => {
    const r = reader(); r.controller.speak("A paused post.", "Post"); await tick(); r.controller.pauseOrResume();
    const checked = r.controller.probeBoundarySupport(voice); await tick(); r.finish(true); await checked; await tick();
    expect(r.controller.getState().status).toBe("paused"); expect(r.sessions.at(-1)!.pause).toHaveBeenCalledOnce(); r.controller.stop();
  });
  it("Stop cancels the probe without reviving speech", async () => {
    const r = reader(); r.controller.speak("Never revive this post.", "Post"); await tick();
    const checked = r.controller.probeBoundarySupport(voice); await tick(); r.controller.stop(); await checked; await tick();
    expect(r.requests).toHaveLength(1); expect(r.controller.getState().status).toBe("idle");
  });
  it("new reading cancels the probe and preserves the new request", async () => {
    const r = reader(); r.controller.speak("Old post.", "Old"); await tick();
    const checked = r.controller.probeBoundarySupport(voice); await tick(); r.controller.speak("New post.", "New"); await checked; await tick();
    expect(r.requests.map(request => request.text)).toEqual(["Old post.", "New post."]); expect(r.controller.getState().title).toBe("New"); r.controller.stop();
  });
  it("a recheck from the other player restores the active shared-synthesis peer", async () => {
    const tweet = reader(), wiki = reader(); wiki.controller.speak("Article remains readable.", "Article"); await tick();
    const checked = tweet.controller.probeBoundarySupport(voice, undefined, [wiki.controller]); await tick();
    expect(wiki.sessions[0]!.stop).toHaveBeenCalledOnce(); tweet.finish(true); await checked; await tick();
    expect(tweet.requests).toHaveLength(0); expect(wiki.requests).toHaveLength(2); expect(wiki.controller.getState().status).toBe("speaking"); wiki.controller.stop();
  });
  it("Pause during recheck cancels the check and preserves the latest pause intent", async () => {
    const r = reader(); r.controller.speak("Pause at this point.", "Post"); await tick();
    const checked = r.controller.probeBoundarySupport(voice); await tick(); r.controller.pauseOrResume(); await checked; await tick();
    expect(r.controller.getState().status).toBe("paused"); expect(r.requests).toHaveLength(1);
    r.controller.pauseOrResume(); await tick(); expect(r.requests).toHaveLength(2); r.controller.stop();
  });
  it("a peer Stop/new-read preparation invalidates the entire probe restoration", async () => {
    const tweet = reader(), wiki = reader(); tweet.controller.speak("Do not revive while preparing another post.", "Old"); await tick();
    const checked = tweet.controller.probeBoundarySupport(voice, undefined, [wiki.controller]); await tick();
    wiki.controller.stop(); await checked; await tick();
    expect(tweet.requests).toHaveLength(1); expect(tweet.controller.getState().status).toBe("idle");
    wiki.controller.speak("New article.", "New"); await tick();
    expect(wiki.requests).toHaveLength(1); wiki.controller.stop();
  });

});


describe("paused peer with production WebSpeechEngine and a shared browser queue", () => {
  it.each(["active", "paused"])("restores only active speech when the %s player owns the probe", async owner => {
    class Utterance {
      onstart: (() => void) | null = null; onend: (() => void) | null = null;
      constructor(readonly text: string) {}
    }
    const queue: Utterance[] = [];
    let paused = false, finish!: (result: boolean) => void;
    const synthesis = {
      get speaking() { return queue.length > 0 && !paused; }, get pending() { return queue.length > 0; },
      getVoices: () => [], cancel: () => { queue.length = 0; },
      pause: vi.fn(() => { paused = true; }), resume: () => { paused = false; },
      speak: (utterance: Utterance) => { queue.push(utterance); if (queue.length === 1) utterance.onstart?.(); },
    };
    vi.stubGlobal("window", { setTimeout, clearTimeout, speechSynthesis: synthesis, SpeechSynthesisUtterance: Utterance });
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    const controller = () => {
      const reader = new SpeechController({ ...DEFAULT_SETTINGS });
      const engine: TtsEngine = new WebSpeechEngine(() => null);
      engine.primeSelectedVoice = undefined;
      engine.probeBoundarySupport = () => new Promise(resolve => { finish = resolve; });
      (reader as unknown as { engine: TtsEngine }).engine = engine;
      return reader;
    };
    const tweet = controller(), wiki = controller();
    tweet.speak("Paused tweet must stay silent.", "Tweet"); await tick(); tweet.pauseOrResume();
    synthesis.cancel(); wiki.speak("Active article must resume.", "Wiki"); await tick();
    const pauses = synthesis.pause.mock.calls.length;
    const pending = owner === "active" ? wiki.probeBoundarySupport(voice, undefined, [tweet]) : tweet.probeBoundarySupport(voice, undefined, [wiki]);
    await tick(); finish(true); await pending; await tick();
    expect(queue.map(utterance => utterance.text)).toEqual(["Active article must resume."]);
    expect(paused).toBe(false); expect(synthesis.pause).toHaveBeenCalledTimes(pauses);
    expect(tweet.getState()).toMatchObject({ status: "paused", hasStarted: false });
    const active = queue.shift()!; active.onend?.(); await tick();
    expect(wiki.getState().status).toBe("idle"); expect(queue).toHaveLength(0); expect(tweet.getState().status).toBe("paused");
    tweet.pauseOrResume(); await tick();
    expect(queue.map(utterance => utterance.text)).toEqual(["Paused tweet must stay silent."]);
    expect(paused).toBe(false); expect(tweet.getState().status).toBe("speaking");
    tweet.stop(); wiki.stop();
  });
});
