import { describe, expect, it } from "vitest";
import { REEL_SOUND_MASTER_LEVEL, reelSoundVoices, softPopVoices, tabSwitchVoices } from "./dock-reel-sound";

describe("dock reel sound", () => {
  it("combines a low thud with a descending three-tooth gear crank", () => {
    const voices = reelSoundVoices(1);
    const gearTeeth = voices.filter((voice) => voice.type === "square");
    expect(voices).toHaveLength(5);
    expect(voices[0]).toMatchObject({ type: "triangle", startHz: 76, endHz: 38, delay: 0 });
    expect(gearTeeth).toHaveLength(3);
    expect(gearTeeth.map((voice) => voice.delay)).toEqual([0.006, 0.048, 0.09]);
    expect(gearTeeth.map((voice) => voice.startHz)).toEqual([164, 138, 116]);
    expect(voices.every((voice) => voice.startHz < 220 && voice.endHz < voice.startHz)).toBe(true);
    expect(Math.max(...voices.map((voice) => voice.duration))).toBeLessThanOrEqual(0.17);
  });

  it("slightly lifts the reverse cue while keeping it low", () => {
    const down = reelSoundVoices(1);
    const up = reelSoundVoices(-1);
    expect(up[0].startHz).toBeGreaterThan(down[0].startHz);
    expect(up.every((voice) => voice.startHz < 240)).toBe(true);
  });

  it("mixes the cue at an audible level without allowing the layers to clip", () => {
    const combinedVoiceLevel = reelSoundVoices(1).reduce((sum, voice) => sum + voice.level, 0);
    expect(REEL_SOUND_MASTER_LEVEL).toBeGreaterThanOrEqual(0.4);
    expect(REEL_SOUND_MASTER_LEVEL * combinedVoiceLevel).toBeLessThan(0.5);
  });
});


describe("soft settings pops", () => {
  it("cycles C-major pentatonic notes with octave-only layers", () => {
    const base = 261.625565;
    const semitones = [0, 2, 4, 7, 9];
    for (let index = 0; index < 10; index++) {
      const voices = softPopVoices(index);
      expect(12 * Math.log2(voices[0]!.endHz / base)).toBeCloseTo(semitones[index % 5]!, 8);
      expect(voices[0]!.startHz / voices[0]!.endHz).toBe(2);
      expect(voices[1]!.endHz / voices[0]!.endHz).toBe(2);
    }
  });
  it("keeps the pop brief and uses only soft sine/triangle layers", () => {
    const voices = softPopVoices(0);
    expect(voices.every(voice => ["sine", "triangle"].includes(voice.type))).toBe(true);
    expect(Math.max(...voices.map(voice => voice.delay + voice.duration))).toBeLessThan(0.1);
    expect(voices.reduce((sum, voice) => sum + voice.level, 0) * 0.18).toBeLessThan(0.11);
  });
});

describe("tab navigation cue", () => {
  it("uses two light high-register pops and a quiet shimmer", () => {
    const voices = tabSwitchVoices();
    const pops = voices.filter(voice => voice.type === "sine");
    expect(pops).toHaveLength(2);
    expect(pops[1]!.delay).toBeGreaterThan(pops[0]!.duration);
    expect(pops[1]!.endHz).toBeGreaterThan(pops[0]!.endHz);
    expect(voices.every(voice => voice.endHz >= 1000 && voice.endHz < voice.startHz)).toBe(true);
    expect(voices.some(voice => voice.type === "triangle" && voice.level < 0.03)).toBe(true);
    expect(Math.max(...voices.map(voice => voice.delay + voice.duration))).toBeLessThan(0.15);
    expect(voices.reduce((sum, voice) => sum + voice.level, 0) * 0.18).toBeLessThan(0.12);
    expect(voices).not.toEqual(softPopVoices(0));
  });
});
