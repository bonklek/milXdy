import { MiniPlayer } from "../../src/apps/post-reading/player";
import { SpeechController } from "../../src/apps/post-reading/speech";
import { DEFAULT_SETTINGS } from "../../src/apps/post-reading/shared/defaults";
import { injectStyles } from "../../src/apps/post-reading/styles";
import { configurePostReadingAssetResolver } from "../../src/apps/post-reading/assetUrl";
const result = { passed: false, checks: [] as string[], error: "", syntheticSpeech: true };
const check = (value: unknown, label: string) => { if (!value) throw new Error(label); result.checks.push(label); };
const wait = () => new Promise(resolve => setTimeout(resolve, 30));
const until = async (predicate: () => boolean) => { const deadline = Date.now() + 3000; while (!predicate()) { if (Date.now() > deadline) throw new Error("Timed out waiting for controlled speech queue"); await wait(); } };
class Utterance {
  voice: SpeechSynthesisVoice | null = null; rate = 1; volume = 1;
  onboundary: ((event: Partial<SpeechSynthesisEvent>) => void) | null = null;
  onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}
(async () => {
  let player: MiniPlayer | undefined;
  const voice = { voiceURI: "fixture-voice", name: "Fixture English", lang: "en-US", default: true, localService: true } as SpeechSynthesisVoice;
  let current: Utterance | null = null, probeCount = 0;
  const active = () => current as Utterance | null;
  const spoken: string[] = [];
  const synthesis = {
    speaking: false, pending: false, paused: false, getVoices: () => [voice],
    cancel() { const old = current; current = null; synthesis.speaking = false; old?.onerror?.(); },
    resume() { synthesis.paused = false; }, pause() { synthesis.paused = true; },
    speak(utterance: Utterance) {
      current = utterance; synthesis.speaking = true; spoken.push(utterance.text); utterance.onstart?.();
      if (utterance.text === "one two three four") queueMicrotask(() => { utterance.onboundary?.({ charIndex: 0 }); utterance.onboundary?.({ charIndex: 4 }); });
      if (utterance.text.startsWith("Post-reading checks")) probeCount++;
    },
  };
  try {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synthesis });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
    configurePostReadingAssetResolver(() => "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>'));
    injectStyles(); document.body.style.cssText = "background:#f3f1f6;font:16px system-ui;padding:20px";
    const heading = document.createElement("h1"); heading.textContent = "Voice recheck — controlled speech adapter"; document.body.append(heading);
    const controller = new SpeechController({ ...DEFAULT_SETTINGS, voiceURI: voice.voiceURI });
    player = new MiniPlayer({ ...DEFAULT_SETTINGS, voiceURI: voice.voiceURI }, {
      onPauseResume: () => controller.pauseOrResume(), onStop: () => controller.stop(), onNext() {}, onPrevious() {}, onNextChunk() {}, onPreviousChunk() {}, onSkipOcr() {},
      onSettingsChange: settings => controller.applySettings(settings), onBoundarySupportChange: () => {}, getVoices: () => controller.getVoices(), getPreferredVoice: () => controller.getPreferredVoice(),
      probeBoundarySupport: (selected, signal) => controller.probeBoundarySupport(selected, signal),
    }, (callback, delay) => { const id = window.setTimeout(callback, delay); return () => window.clearTimeout(id); });
    controller.subscribe(state => player!.updateState(state));
    controller.speak("First sentence. Second sentence.", "Example post"); await until(() => active()?.text === "First sentence. Second sentence." && controller.getState().hasStarted === true);
    active()?.onboundary?.({ charIndex: 16, charLength: 6 });
    document.querySelector<HTMLButtonElement>('[aria-label="Settings"]')!.click();
    const recheck = () => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === "Recheck selected voice")!;
    const finishProbe = () => { const probe = current!; for (const charIndex of [0, 5, 10]) probe.onboundary?.({ charIndex, name: "word" }); probe.onend?.(); };
    recheck().click(); await until(() => Boolean(active()?.text.startsWith("Post-reading checks"))); check(probeCount === 1, "Rendered Recheck starts an actual boundary probe");
    finishProbe(); await until(() => active()?.text === "Second sentence.");
    check(active()?.text === "Second sentence." && synthesis.speaking && controller.getState().status === "speaking", "Probe completion restores audible queue at saved reading boundary");
    recheck().click(); await until(() => Boolean(active()?.text.startsWith("Post-reading checks"))); check(probeCount === 2, "Explicit Recheck reruns a voice previously marked supported");
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent === "Stop rechecking voice")!.click(); await until(() => active()?.text === "Second sentence.");
    check(active()?.text === "Second sentence." && controller.getState().status === "speaking", "Stopping a recheck restores the existing reading request");
    recheck().click(); await until(() => Boolean(active()?.text.startsWith("Post-reading checks"))); controller.speak("New chosen post.", "New post"); await until(() => active()?.text === "New chosen post.");
    check(active()?.text === "New chosen post." && controller.getState().title === "New post", "New reading cancels probe without reviving the old post");
    recheck().click(); await until(() => Boolean(active()?.text.startsWith("Post-reading checks"))); controller.stop(); const count = spoken.length; await wait();
    check(current === null && spoken.length === count && controller.getState().status === "idle", "Stop during recheck never revives playback");
    controller.speak("Ready for another post.", "Reader ready"); await until(() => active()?.text === "Ready for another post.");
    check(active()?.text === "Ready for another post." && controller.getState().hasStarted, "Reader remains usable after cancelled recheck");
    result.passed = true;
  } catch (error) { result.error = String(error); player?.dispose(); }
  Object.assign(globalThis, { __voiceRecheckResult: result });
})();
