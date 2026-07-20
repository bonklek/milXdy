import { normalizePerformanceMode, type PerformanceMode } from "./performance-mode";
import { ignoredProfilePackSections, type ProfilePackSection } from "./profile-pack-sections";
import {
  VISUAL_THEME_CONTROL_GROUPS,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type ReskinProfile,
  type VisualThemeSettings,
} from "../visuals/reskin-profile";

export const PROFILE_PACK_KIND = "milxdy.profilePack";
export const PROFILE_PACK_VERSION = 1;
export { ignoredProfilePackSections, type ProfilePackSection } from "./profile-pack-sections";

export type VisualThemePackPayload = {
  kind: "milxdy.visualTheme";
  version: 1;
  name: string;
  settings: VisualThemeSettings;
};

export type MilxdyProfilePack = {
  kind: typeof PROFILE_PACK_KIND;
  version: typeof PROFILE_PACK_VERSION;
  exportedAt: string;
  name: string;
  sections: ProfilePackSection[];
  appearance?: {
    reskinProfile?: ReskinProfile;
    visualTheme?: VisualThemePackPayload;
  };
  performance?: {
    mode?: PerformanceMode;
  };
  apps?: {
    enabled?: Record<string, boolean>;
  };
  rail?: {
    pinned?: string[];
    side?: "left" | "right";
  };
  layout?: {
    appChromeOverrides?: Record<string, string>;
  };
};

export const PROFILE_PACK_INCLUDED_CLASSES = [
  "declared visual theme settings",
  "declared appearance profile",
  "declared performance mode",
  "declared app enablement",
  "declared rail and layout preferences",
] as const;

export const PROFILE_PACK_EXCLUDED_CLASSES = [
  "auth tokens",
  "session cookies",
  "API keys",
  "private account data",
  "local absolute file paths",
  "large caches",
  "diagnostic payloads",
] as const;

export function createProfilePack(input: {
  name: string;
  visualTheme: VisualThemeSettings;
  performanceMode: PerformanceMode;
  exportedAt?: string;
}): MilxdyProfilePack {
  const visualTheme = normalizeVisualTheme(input.visualTheme);
  const name = input.name.trim() || "milXdy profile pack";
  return {
    kind: PROFILE_PACK_KIND,
    version: PROFILE_PACK_VERSION,
    exportedAt: input.exportedAt || new Date().toISOString(),
    name,
    sections: ["appearance", "performance"],
    appearance: {
      reskinProfile: visualTheme.profile,
      visualTheme: {
        kind: "milxdy.visualTheme",
        version: 1,
        name,
        settings: visualTheme,
      },
    },
    performance: {
      mode: normalizePerformanceMode(input.performanceMode),
    },
  };
}

export function normalizeProfilePack(value: unknown): MilxdyProfilePack | null {
  const record = objectValue(value);
  if (record.kind !== PROFILE_PACK_KIND || record.version !== PROFILE_PACK_VERSION) return null;
  const sections = sectionList(record.sections);
  const pack: MilxdyProfilePack = {
    kind: PROFILE_PACK_KIND,
    version: PROFILE_PACK_VERSION,
    exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Imported profile pack",
    sections,
  };

  const appearance = objectValue(record.appearance);
  const visualTheme = objectValue(appearance.visualTheme);
  const visualThemeSettings = visualTheme.settings || appearance.visualTheme;
  if (visualThemeSettings) {
    const settings = normalizeVisualTheme(visualThemeSettings, normalizeReskinProfile(appearance.reskinProfile));
    pack.appearance = {
      reskinProfile: normalizeReskinProfile(appearance.reskinProfile ?? settings.profile),
      visualTheme: {
        kind: "milxdy.visualTheme",
        version: 1,
        name: typeof visualTheme.name === "string" && visualTheme.name.trim() ? visualTheme.name.trim() : pack.name,
        settings,
      },
    };
  } else if (appearance.reskinProfile) {
    pack.appearance = {
      reskinProfile: normalizeReskinProfile(appearance.reskinProfile),
    };
  }

  const performance = objectValue(record.performance);
  if (performance.mode) {
    pack.performance = {
      mode: normalizePerformanceMode(performance.mode),
    };
  }

  const apps = objectValue(record.apps);
  const enabled = booleanRecord(apps.enabled);
  if (enabled) pack.apps = { enabled };

  const rail = objectValue(record.rail);
  const pinned = stringList(rail.pinned);
  const side = rail.side === "left" || rail.side === "right" ? rail.side : undefined;
  if (pinned || side) pack.rail = { pinned, side };

  const layout = objectValue(record.layout);
  const appChromeOverrides = stringRecord(layout.appChromeOverrides);
  if (appChromeOverrides) pack.layout = { appChromeOverrides };

  const actualSections = inferredSections(pack);
  pack.sections = sectionList(pack.sections.length
    ? pack.sections.filter((section) => actualSections.includes(section))
    : actualSections);
  return pack.sections.length ? pack : null;
}

export function profilePackPreviewLines(pack: MilxdyProfilePack): string[] {
  const lines = [`Import "${pack.name}"?`];
  if (pack.appearance?.visualTheme) {
    lines.push(`Appearance: ${pack.appearance.visualTheme.name}`);
    lines.push(`Fine controls: ${VISUAL_THEME_CONTROL_GROUPS.map((group) => group.label).join(", ")}.`);
  } else if (pack.appearance?.reskinProfile) {
    lines.push(`Appearance profile: ${pack.appearance.reskinProfile}`);
  }
  if (pack.performance?.mode) {
    lines.push(`Performance: ${pack.performance.mode}`);
  }
  if (pack.apps?.enabled) {
    lines.push(`Ignored apps: ${Object.keys(pack.apps.enabled).length} enablement value(s)`);
  }
  if (pack.rail?.pinned) {
    lines.push(`Ignored rail: ${pack.rail.pinned.length} pinned app(s)`);
  }
  if (pack.layout?.appChromeOverrides) {
    lines.push(`Ignored layout: ${Object.keys(pack.layout.appChromeOverrides).length} chrome override(s)`);
  }
  const ignoredSections = ignoredProfilePackSections(pack);
  if (ignoredSections.length > 0) {
    lines.push(`Only appearance and performance are imported today; ignored section(s): ${ignoredSections.join(", ")}.`);
  }
  lines.push("Auth, sessions, API keys, private data, file paths, caches, and diagnostics are never imported from profile packs.");
  return lines;
}

function inferredSections(pack: MilxdyProfilePack): ProfilePackSection[] {
  return [
    pack.appearance ? "appearance" : null,
    pack.performance ? "performance" : null,
    pack.apps ? "apps" : null,
    pack.rail ? "rail" : null,
    pack.layout ? "layout" : null,
  ].filter((section): section is ProfilePackSection => Boolean(section));
}

function sectionList(value: unknown): ProfilePackSection[] {
  return stringList(value)
    ?.filter((section): section is ProfilePackSection =>
      section === "appearance"
      || section === "performance"
      || section === "apps"
      || section === "rail"
      || section === "layout",
    ) || [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return values.length ? values : undefined;
}

function booleanRecord(value: unknown): Record<string, boolean> | undefined {
  const record = objectValue(value);
  const entries = Object.entries(record).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  const record = objectValue(value);
  const entries = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length ? Object.fromEntries(entries) : undefined;
}
