import { describe, expect, it } from "vitest";
import { REEL_SOUND_MASTER_LEVEL, reelSoundVoices } from "./dock-reel-sound";

describe("dock reel sound", () => {
  it("uses three short low-pitched mechanical layers", () => {
    const voices = reelSoundVoices(1);
    expect(voices).toHaveLength(3);
    expect(voices.map((voice) => voice.type)).toEqual(["triangle", "square", "sawtooth"]);
    expect(voices.every((voice) => voice.startHz < 220 && voice.endHz < voice.startHz)).toBe(true);
    expect(Math.max(...voices.map((voice) => voice.duration))).toBeLessThanOrEqual(0.16);
  });

  it("slightly lifts the reverse cue while keeping it low", () => {
    const down = reelSoundVoices(1);
    const up = reelSoundVoices(-1);
    expect(up[0].startHz).toBeGreaterThan(down[0].startHz);
    expect(up.every((voice) => voice.startHz < 220)).toBe(true);
  });

  it("mixes the cue at an audible level without allowing the layers to clip", () => {
    const combinedVoiceLevel = reelSoundVoices(1).reduce((sum, voice) => sum + voice.level, 0);
    expect(REEL_SOUND_MASTER_LEVEL).toBeGreaterThanOrEqual(0.5);
    expect(REEL_SOUND_MASTER_LEVEL * combinedVoiceLevel).toBeLessThan(0.5);
  });
});
