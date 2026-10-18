import { MUSIC_ACOUSTID_KEY, MUSIC_ENRICHMENT_SERVICES_KEY, type MusicEnrichmentChoices } from "./enrichment-consent";
type Preferences = { choices: MusicEnrichmentChoices; key: string };
/** A failed write never replaces the last saved choices or key in the UI. */
export function createMusicEnrichmentPreferences(deps: {
  current: () => Preferences; persist: (values: Record<string, unknown>) => Promise<void>;
  changed: (value: Preferences) => void; pending: (busy: boolean) => void;
  stop: () => void; failure: () => void; active: () => boolean;
}) {
  let busy = false;
  return {
    pending: () => busy,
    async save(patch: Partial<Preferences>): Promise<boolean> {
      if (busy || !deps.active()) return false;
      busy = true; deps.stop(); deps.pending(true);
      const current = deps.current();
      const next = { ...current, ...patch, choices: { ...(patch.choices || current.choices), revision: crypto.randomUUID() } };
      try {
        await deps.persist({ [MUSIC_ENRICHMENT_SERVICES_KEY]: next.choices, [MUSIC_ACOUSTID_KEY]: next.key });
        if (deps.active()) deps.changed(next);
        return true;
      } catch { if (deps.active()) deps.failure(); return false; }
      finally { busy = false; if (deps.active()) deps.pending(false); }
    },
  };
}

/** Bind the saved-state boundary without letting UI controls own persistence. */
export function bindMusicEnrichmentPreferences(
  state: { enrichmentServices: MusicEnrichmentChoices; acoustIdClientKey: string; enrichCancel: boolean; error: string },
  services: () => { writeLocal: (values: Record<string, unknown>) => Promise<void> },
  active: () => boolean,
  session: { stop: () => void; update: (value: unknown) => void },
  render: () => void,
) {
  return createMusicEnrichmentPreferences({
    current: () => ({ choices: state.enrichmentServices, key: state.acoustIdClientKey }),
    persist: values => services().writeLocal(values), active,
    stop: () => { session.stop(); state.enrichCancel = true; },
    changed: next => { state.enrichmentServices = next.choices; state.acoustIdClientKey = next.key; session.update(next.choices); state.error = ""; },
    pending: render,
    failure: () => { state.error = "Could not save service choices or key. Your previously saved settings are still in use. Try saving again."; },
  });
}
