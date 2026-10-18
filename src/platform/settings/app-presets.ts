import type { AppPreset, MilxdyAppManifest } from "../app-sdk/app-platform";
import type { PerformanceMode } from "./performance-mode";
import { DEFAULT_VISUAL_THEME, VISUAL_THEME_KEY, normalizeVisualTheme } from "../visuals/reskin-profile";
import { createPresetQueue, loadSavedPresets, planPreset, planSavedPreset, presetValue, readPresetTargets, type PresetStorage, type PresetTarget, type SavedPreset } from "./preset-transaction";
import { chooseSavedPreset, reviewPreset, showPresetResult } from "./preset-review";
const PIN = "milxdy.apps.railPinned", UNPIN = "milxdy.apps.railUnpinned";
const PERFORMANCE = "milxdy.performance.mode", FIRST_RUN = "milxdy.apps.firstRun.status";

export async function buildAppPresetTargets(storage: PresetStorage, apps: readonly MilxdyAppManifest[], preset: AppPreset, blocked: (app: MilxdyAppManifest, mode: PerformanceMode) => boolean): Promise<PresetTarget[]> {
  const mode = preset === "lite" ? "fast" : preset === "full" ? "full" : "balanced";
  const enabled = new Set(apps.filter(app => app.hub?.presets.includes(preset) && !blocked(app, mode)).map(app => app.id));
  const settings = apps.map(app => ({ app, setting: app.settings?.find(setting => setting.role === "enablement" || setting.id === `${app.id}.enabled`) }));
  if (settings.some(entry => !entry.setting)) throw new Error("An app does not declare its enablement setting.");
  const fields = settings.map(({ app, setting }) => ({ area: setting!.storage.area as "local" | "sync", key: setting!.storage.key, label: app.name }));
  fields.push({ area: "local", key: VISUAL_THEME_KEY, label: "Visual settings" });
  const current = await readPresetTargets(storage, fields);
  const targets = new Map<string, PresetTarget>();
  for (const [index, { app, setting }] of settings.entries()) {
    const target = { ...current[index], value: presetValue(current[index].value.value) };
    const desired = enabled.has(app.id);
    const value = app.id === "miladymaxxer" ? desired ? "milady" : "off" : desired;
    if (setting!.storage.property) target.value = presetValue({ ...(target.value.value as Record<string, unknown> || {}), [setting!.storage.property]: value });
    else target.value = presetValue(value);
    const id = `${target.area}:${target.key}`;
    const previous = targets.get(id);
    if (previous && setting!.storage.property) target.value = presetValue({ ...(previous.value.value as Record<string, unknown>), [setting!.storage.property]: value });
    targets.set(id, { ...target, label: previous ? `${previous.label}, ${app.name}` : app.name });
  }
  targets.set(`local:${VISUAL_THEME_KEY}`, current.at(-1)!);
  if (enabled.has("miladymaxxer")) {
    const theme = normalizeVisualTheme(current.at(-1)?.value.value || DEFAULT_VISUAL_THEME);
    if (theme.disableMaxxer) targets.set(`local:${VISUAL_THEME_KEY}`, { area: "local", key: VISUAL_THEME_KEY, label: "Visual settings (enable Maxxer)", value: presetValue({ ...theme, disableMaxxer: false }) });
  }
  const pinned = apps.filter(app => app.dock && app.hub?.rail.supported !== false && app.hub?.rail.defaultPinned && enabled.has(app.id)).map(app => app.id);
  const stored = await storage.local.get([UNPIN]);
  const unpinned = Array.isArray(stored[UNPIN]) ? (stored[UNPIN] as string[]).filter(id => !pinned.includes(id)) : [];
  return [...targets.values(),
    { area: "local", key: PIN, label: "Pinned apps", value: presetValue(pinned) },
    { area: "local", key: UNPIN, label: "Explicitly unpinned apps", value: presetValue(unpinned) },
    { area: "local", key: PERFORMANCE, label: "Performance mode", value: presetValue(mode) },
    { area: "local", key: FIRST_RUN, label: "Setup status", value: presetValue("complete") },
  ];
}
/** Only bounded app identifiers and counts enter runtime diagnostics. */
function presetTargetDiagnostics(apps: readonly MilxdyAppManifest[], targets: PresetTarget[], blockedApps: string[]) {
  const enabledTargetApps: string[] = [], disabledTargetApps: string[] = [];
  for (const app of apps) {
    const setting = app.settings?.find(item => item.role === "enablement" || item.id === `${app.id}.enabled`);
    const target = targets.find(item => item.area === setting?.storage.area && item.key === setting.storage.key);
    if (!setting || !target) continue;
    let value = target.value.value;
    if (setting.storage.property) value = (value as Record<string, unknown> | undefined)?.[setting.storage.property];
    const enabled = app.id === "miladymaxxer" ? value === "milady" || value === "max" : value === true;
    (enabled ? enabledTargetApps : disabledTargetApps).push(app.id);
  }
  return { enabledTargetApps: enabledTargetApps.slice(0, 200), enabledTargetCount: enabledTargetApps.length,
    disabledTargetApps: disabledTargetApps.slice(0, 200), disabledTargetCount: disabledTargetApps.length,
    blockedTargetApps: blockedApps.slice(0, 200), blockedTargetCount: blockedApps.length };
}
export function createAppPresetService(deps: {
  storage: PresetStorage;
  apps: () => readonly MilxdyAppManifest[];
  blocked: (app: MilxdyAppManifest, mode: PerformanceMode) => boolean;
  active: () => boolean;
  refresh: () => Promise<void>;
  prepare?: () => Promise<void>;
  release?: () => void;
  parent: () => HTMLElement;
  diagnostic?: (data: Record<string, unknown>) => void;
}) {
  const run = createPresetQueue(deps.storage);
  const targets = (preset: AppPreset) => buildAppPresetTargets(deps.storage, deps.apps(), preset, deps.blocked);
  const apply = async (preset: AppPreset, saved?: SavedPreset) => {
    let diagnostics = presetTargetDiagnostics([], [], []);
    const result = await run({ kind: "App setup", build: async () => {
      if (!deps.active()) throw new Error("Runtime closed.");
      const target = await targets(preset);
      // Include visual settings in the restore allowlist, even when the selected preset does not change them.
      const allowed = [...target, { area: "local" as const, key: VISUAL_THEME_KEY, label: "Visual settings", value: presetValue(DEFAULT_VISUAL_THEME) }];
      const changes = await (saved ? planSavedPreset(deps.storage, saved, allowed) : planPreset(deps.storage, target));
      const mode = preset === "lite" ? "fast" : preset === "full" ? "full" : "balanced";
      const blockedApps = saved ? [] : deps.apps().filter(app => app.hub?.presets.includes(preset) && deps.blocked(app, mode)).map(app => app.id);
      diagnostics = presetTargetDiagnostics(deps.apps(), changes, blockedApps);
      return changes;
    }, review: async changes => {
      const choice = await reviewPreset(saved ? `Restore ${saved.name}` : `Review ${preset} app setup`, changes);
      return deps.active() ? choice : "cancel";
    }, prepare: deps.prepare, release: deps.release, reconcile: deps.refresh, verify: async () => {
      if (saved) return;
      const mode = preset === "lite" ? "fast" : preset === "full" ? "full" : "balanced";
      for (const app of deps.apps()) {
        const expected = app.hub?.presets.includes(preset) === true && !deps.blocked(app, mode);
        if (await app.isEnabled() !== expected) throw new Error("App enablement did not converge.");
      }
    }, status: message => showPresetResult({ status: "applied", message }, deps.parent()) });
    deps.diagnostic?.({ preset: saved ? "saved" : preset, ...diagnostics, outcome: result.status, restored: result.restored ?? false });
    showPresetResult(result, deps.parent());
  };
  return {
    apply: (preset: AppPreset) => apply(preset),
    restore: async () => {
      const saved = await chooseSavedPreset((await loadSavedPresets(deps.storage)).filter(item => item.kind === "App setup"));
      if (saved) await apply("balanced", saved);
    },
  };
}
