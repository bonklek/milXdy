import { AudioGroups as SharedAudioGroups, migrateXChatSoundPreference as migrate } from "../../lib/audio-groups";
import type { AppStorageArea } from "../app-sdk/app-platform";
import { chromeAudioStorage } from "./audio-storage";
export { AUDIO_GROUP_KEYS, type AudioGroup } from "../../lib/audio-groups";
export const migrateXChatSoundPreference = () => migrate(chromeAudioStorage("local"), chromeAudioStorage("sync"));
export class AudioGroups extends SharedAudioGroups {
  start(dispose: (dispose: () => void) => void, storage: AppStorageArea = chromeAudioStorage("local")): Promise<void> { return super.start(dispose, storage); }
}
