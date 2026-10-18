import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostReadingSettings } from "./shared/types";
import { WebSpeechEngine, probeVoiceBoundarySupport } from "./ttsEngines";

class FakeUtterance {
  rate = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("WebSpeechEngine", () => {
  it("clears a stale global pause before queueing speech", async () => {
    const calls: string[] = [];
    const speechSynthesis = {
      cancel: vi.fn(() => calls.push("cancel")),
      getVoices: vi.fn(() => []),
      pause: vi.fn(() => calls.push("pause")),
      resume: vi.fn(() => calls.push("resume")),
      speak: vi.fn(() => calls.push("speak")),
    };
    vi.stubGlobal("window", {
      speechSynthesis,
      SpeechSynthesisUtterance: FakeUtterance,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    const engine = new WebSpeechEngine(() => null);
    await engine.speak({
      text: "Reader playback should start.",
      settings: { speed: 1, volume: 1, voiceURI: null, autoVoice: true } as PostReadingSettings,
      onBoundary: vi.fn(),
      onStart: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    });

    expect(calls).toEqual(["resume", "speak"]);
  });
});

function nativeFlagFixture() {
  let queued: FakeUtterance | undefined;
  const synthesis = { speaking: true, pending: false, paused: false, cancel: vi.fn(), resume: vi.fn(), pause: vi.fn(), getVoices: () => [], speak: vi.fn((utterance: FakeUtterance) => { queued = utterance; }) };
  vi.stubGlobal("window", { speechSynthesis: synthesis, SpeechSynthesisUtterance: FakeUtterance, setTimeout, clearTimeout });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  const request = { text: "Synthetic native speech.", settings: { speed: 1, volume: 1, voiceURI: null, autoVoice: true } as PostReadingSettings, onStart: vi.fn(), onBoundary: vi.fn(), onEnd: vi.fn(), onError: vi.fn() };
  return { engine: new WebSpeechEngine(() => null), request, synthesis, utterance: () => queued! };
}

describe("native utterance playback acknowledgment", () => {
  it("never treats queue-wide speaking as proof this utterance started", async () => {
    vi.useFakeTimers(); const fixture = nativeFlagFixture(); await fixture.engine.speak(fixture.request);
    await vi.advanceTimersByTimeAsync(500); expect(fixture.request.onStart).not.toHaveBeenCalled();
  });
  it("rejects the native immediate-end-without-start failure instead of silently completing", async () => {
    const fixture = nativeFlagFixture(); await fixture.engine.speak(fixture.request); fixture.utterance().onend?.();
    expect(fixture.request.onEnd).not.toHaveBeenCalled(); expect(fixture.request.onError).toHaveBeenCalledWith(expect.stringContaining("ended before playback started"));
    expect(fixture.request.onError.mock.calls[0]?.[0]).not.toMatch(/restart/i);
  });
  it("accepts a valid boundary before onstart as this utterance's playback acknowledgment", async () => {
    const fixture = nativeFlagFixture(); await fixture.engine.speak(fixture.request);
    fixture.utterance().onboundary?.({charIndex:0,charLength:5,elapsedTime:0.2} as SpeechSynthesisEvent); fixture.utterance().onend?.();
    expect(fixture.request.onStart).toHaveBeenCalledOnce(); expect(fixture.request.onEnd).toHaveBeenCalledOnce(); expect(fixture.request.onError).not.toHaveBeenCalled();
  });
  it("exercises real-browser priming flags and bounds a silent priming utterance", async () => {
    vi.useFakeTimers(); const fixture = nativeFlagFixture(); const primed = fixture.engine.primeSelectedVoice(fixture.request.settings);
    expect(fixture.synthesis.speak).toHaveBeenCalledOnce(); expect(fixture.utterance().text).toBe("one two three four");
    await vi.advanceTimersByTimeAsync(751); await primed; expect(fixture.synthesis.cancel).toHaveBeenCalled();
  });
});


describe("shared native speech queue ownership", () => {
  function fixture() {
    const native = nativeFlagFixture(); const queue: FakeUtterance[] = [];
    native.synthesis.cancel.mockImplementation(() => { queue.length = 0; });
    native.synthesis.speak.mockImplementation((utterance: FakeUtterance) => { queue.push(utterance); });
    return { ...native, queue };
  }
  it("old stop, abort, pause and resume cannot control a newer session", async () => {
    const f=fixture(); const abort=new AbortController(); const first=await f.engine.speak({...f.request,text:"Synthetic first",signal:abort.signal});
    const second=await f.engine.speak({...f.request,text:"Synthetic second"}); const cancels=f.synthesis.cancel.mock.calls.length, resumes=f.synthesis.resume.mock.calls.length;
    first.stop(); first.stop(); abort.abort(); first.pause(); first.resume();
    expect(f.queue.map(item=>item.text)).toEqual(["Synthetic second"]); expect(f.synthesis.cancel).toHaveBeenCalledTimes(cancels);expect(f.synthesis.resume).toHaveBeenCalledTimes(resumes); expect(f.synthesis.pause).not.toHaveBeenCalled(); second.stop();
  });
  it("an ended peer's retained session cannot cancel new speech", async () => {
    const f=fixture(); const first=await f.engine.speak({...f.request,text:"Synthetic ended peer"});const utterance=f.queue[0]!;utterance.onstart?.();f.queue.length=0;utterance.onend?.();
    const second=await f.engine.speak({...f.request,text:"Synthetic current"}); const cancels=f.synthesis.cancel.mock.calls.length;first.stop();
    expect(f.queue.map(item=>item.text)).toEqual(["Synthetic current"]);expect(f.synthesis.cancel).toHaveBeenCalledTimes(cancels);second.stop();
  });
  it("stopping and aborting the same live utterance cancels once", async () => {
    const f=fixture();const abort=new AbortController();const session=await f.engine.speak({...f.request,signal:abort.signal});session.stop();abort.abort();session.stop();expect(f.synthesis.cancel).toHaveBeenCalledOnce();
  });
  it("late priming cleanup cannot cancel newer owned speech", async () => {
    vi.useFakeTimers();const f=fixture();const prime=f.engine.primeSelectedVoice(f.request.settings);const utterance=f.queue[0]!;
    const current=await f.engine.speak({...f.request,text:"Synthetic after priming"});const cancels=f.synthesis.cancel.mock.calls.length;const rejected=expect(prime).rejects.toMatchObject({name:"AbortError"});utterance.onend?.();await vi.advanceTimersByTimeAsync(1);await rejected;
    expect(f.queue.map(item=>item.text)).toEqual(["Synthetic after priming"]);expect(f.synthesis.cancel).toHaveBeenCalledTimes(cancels);current.stop();
  });
  it("late voice-probe abort cannot cancel newer speech", async () => {
    const f=fixture();const abort=new AbortController();const probe=probeVoiceBoundarySupport({voiceURI:"synthetic-probe"} as SpeechSynthesisVoice,abort.signal);
    const current=await f.engine.speak({...f.request,text:"Synthetic after probe"});const cancels=f.synthesis.cancel.mock.calls.length;abort.abort();expect(await probe).toBe(false);
    expect(f.queue.map(item=>item.text)).toEqual(["Synthetic after probe"]);expect(f.synthesis.cancel).toHaveBeenCalledTimes(cancels);current.stop();
  });
});
