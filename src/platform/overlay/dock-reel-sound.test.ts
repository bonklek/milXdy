import { describe, expect, it } from "vitest";
import { REEL_SOUND_MASTER_LEVEL, reelSoundVoices } from "./dock-reel-sound";

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
