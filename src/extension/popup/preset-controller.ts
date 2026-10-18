import { createPresetQueue, loadSavedPresets, planPreset, planSavedPreset, type PresetStorage, type PresetTarget } from "../../platform/settings/preset-transaction";
import { chooseSavedPreset, reviewPreset, showPresetResult } from "../../platform/settings/preset-review";

export function createPopupPresetController(storage: PresetStorage, afterApply: () => Promise<void>) {
  const run = createPresetQueue(storage);
  const status = (message: string) => showPresetResult({ status: "applied", message });
  const refresh = async (result: { message: string; status: string }) => {
    if (result.status === "cancelled") return;
    try { await afterApply(); }
    catch { result.message += " The display could not refresh. Reopen Settings to load the stored configuration."; }
  };
  return {
    async apply(title: string, build: () => Promise<PresetTarget[]>): Promise<boolean> {
      const result = await run({ kind: "Appearance and setup", build: async () => planPreset(storage, await build()), review: changes => reviewPreset(title, changes), status });
      await refresh(result);
      showPresetResult(result);
      return result.status === "applied";
    },
    async restore(allowed: PresetTarget[]): Promise<void> {
      const saved = await chooseSavedPreset((await loadSavedPresets(storage)).filter(item => item.kind === "Appearance and setup"));
      if (!saved) return;
      const result = await run({ kind: "Appearance and setup", build: () => planSavedPreset(storage, saved, allowed), review: changes => reviewPreset(`Restore ${saved.name}`, changes), status });
      await refresh(result);
      showPresetResult(result);
    },
  };
}
