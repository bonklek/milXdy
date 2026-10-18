import { DEFAULT_VISUAL_THEME, RESKIN_PROFILE_KEY, VISUAL_THEME_KEY, normalizeVisualTheme } from "../visuals/reskin-profile";
import { samePresetValue, presetValue, type PresetTarget } from "./preset-transaction";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
/** Validate supplied fields without repairing an incompatible saved configuration. */
export function validRestoredPresetTarget(target: PresetTarget, expected: PresetTarget): boolean {
  if (!target.value.present) return true;
  const value = target.value.value;
  if (target.key === VISUAL_THEME_KEY) {
    if (!object(value) || !Object.keys(value).length) return false;
    const normalized = normalizeVisualTheme(value);
    return Object.entries(value).every(([key, item]) => Object.hasOwn(DEFAULT_VISUAL_THEME, key)
      && samePresetValue(presetValue(item), presetValue(normalized[key as keyof typeof normalized])));
  }
  if (target.key === RESKIN_PROFILE_KEY) return typeof value === "string" && ["min", "moderate", "max"].includes(value);
  if (target.key === "milxdy.performance.mode") return typeof value === "string" && ["fast", "balanced", "full", "developer"].includes(value);
  if (target.area === "sync" && target.key === "mode") return typeof value === "string" && ["off", "milady", "max"].includes(value);
  if (target.key === "milxdy.apps.firstRun.status") return typeof value === "string" && ["complete", "skipped"].includes(value);
  if (target.key === "milxdy.apps.railPinned" || target.key === "milxdy.apps.railUnpinned") return Array.isArray(value)
    && value.length <= 200 && value.every(item => typeof item === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(item)) && new Set(value).size === value.length;
  if (target.key === "remiliaWikiHyperlink.settings") return object(value)
    && Object.entries(value).every(([key, item]) => !["enabled", "sidebarEnabled"].includes(key) || typeof item === "boolean");
  if (target.key === "milxdy.settings.theme") return typeof value === "string" && ["light", "dark", "system"].includes(value);
  if (target.key === "soundVolume") return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
  if (!expected.value.present) return false;
  const template = expected.value.value;
  return typeof template === "boolean" ? typeof value === "boolean"
    : typeof template === "number" ? typeof value === "number" && Number.isFinite(value)
    : typeof template === "string" ? typeof value === "string" && value.length <= 200
    : object(template) ? object(value) : false;
}
