import { AudioCueVolumes as SharedAudioCueVolumes } from "../../lib/audio-cue-volumes";
import type { AppStorageArea } from "../app-sdk/app-platform";
import { chromeAudioStorage } from "./audio-storage";
export { AUDIO_CUES, audioCueVolumeKey, normalizeCueVolume, type AudioCue } from "../../lib/audio-cue-volumes";
export class AudioCueVolumes extends SharedAudioCueVolumes {
  start(dispose: (dispose: () => void) => void, storage: AppStorageArea = chromeAudioStorage("local")): Promise<void> { return super.start(dispose, storage); }
}
