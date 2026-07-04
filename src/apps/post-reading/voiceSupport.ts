import type { BoundarySupport } from "./speech";

const KNOWN_BOUNDARY_SUPPORTED_VOICES = [
  /Microsoft (David|Mark|Zira)(?: Desktop)?/i,
  /Microsoft (Aria|Jenny|Guy|Ava|Andrew|Emma|Brian|Ana|Christopher|Eric|Michelle|Roger|Steffan)/i,
  /Google (US English|UK English)/i,
  /^Samantha$/i,
  /^Alex$/i,
];

export function knownVoiceBoundarySupport(voice: SpeechSynthesisVoice | null | undefined): BoundarySupport {
  if (!voice) return "unknown";
  const signature = `${voice.name} ${voice.voiceURI}`;
  return KNOWN_BOUNDARY_SUPPORTED_VOICES.some((pattern) => pattern.test(signature)) ? "supported" : "unknown";
}

export function hasKnownSyncedBoundaries(voice: SpeechSynthesisVoice | null | undefined): boolean {
  return knownVoiceBoundarySupport(voice) === "supported";
}
