export const MUSIC_ENRICHMENT_SERVICES_KEY = "milxdy.music.enrichmentServices";
export const MUSIC_ACOUSTID_KEY = "milxdy.music.acoustIdClientKey";
export type MusicEnrichmentService = "musicbrainz" | "acoustid";
export type MusicEnrichmentChoices = Record<MusicEnrichmentService, boolean> & { revision: string };
/** A legacy blanket grant never authorizes either service. Existing keys remain local. */
export function musicEnrichmentChoices(value: unknown): MusicEnrichmentChoices {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const revision = typeof item.revision === "string" && item.revision.length <= 100 ? item.revision : "";
  return { musicbrainz: !!revision && item.musicbrainz === true, acoustid: !!revision && item.acoustid === true, revision };
}
export function createMusicEnrichmentSession() {
  let generation = 0;
  let choices = musicEnrichmentChoices(null);
  let running = false;
  return {
    update(value: unknown) { choices = musicEnrichmentChoices(value); generation++; running = false; },
    start() { running = true; return ++generation; },
    stop() { running = false; generation++; },
    allowed(service?: MusicEnrichmentService, token = generation) { return running && token === generation && (service ? choices[service] : choices.musicbrainz || choices.acoustid); },
    token() { return generation; },
  };
}
