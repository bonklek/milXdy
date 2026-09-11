import type { MilxdyAppManifest } from "../app-sdk/app-platform";
export function appChromeSummary(app: MilxdyAppManifest): string {
    if (!app.chrome)
        return "Not declared.";
    const supported = app.chrome.supportedStyles.map(chromeStyleLabel).join(", ");
    const notes = listText(app.chrome.notes);
    return [
        `Native ${chromeStyleLabel(app.chrome.nativeStyle)}.`,
        supported ? `Supports ${supported}.` : "",
        notes,
    ].filter(Boolean).join(" ");
}
export function chromeStyleLabel(style: string): string {
    switch (style) {
        case "native":
            return "app defaults";
        case "reminet":
            return "RemiNet";
        case "classic":
            return "Classic bevel";
        case "maxxer":
            return "Maxxer";
        case "reader":
            return "Reader";
        case "miladychan":
            return "Miladychan";
        case "music":
            return "Music";
        case "wiki":
            return "Wiki";
        default:
            return style;
    }
}
export function appSettingsSummary(app: MilxdyAppManifest): string {
    if (!app.settings?.length)
        return "No settings schema declared.";
    const byLocation = app.settings.reduce<Record<string, number>>((summary, setting) => {
        summary[setting.location] = (summary[setting.location] || 0) + 1;
        return summary;
    }, {});
    const locationText = Object.entries(byLocation)
        .map(([location, count]) => `${settingsLocationLabel(location)} ${count}`)
        .join("; ");
    const presetText = Array.from(new Set(app.settings.flatMap((setting) => setting.presets || [])))
        .map(settingsPresetLabel)
        .join(", ");
    return [
        locationText,
        presetText ? `Preset participation: ${presetText}.` : "",
    ].filter(Boolean).join(" ");
}
export function settingsLocationLabel(location: string): string {
    switch (location) {
        case "appearance":
            return "Appearance";
        case "appsAndFeatures":
            return "Apps & Features";
        case "appSurface":
            return "App surface";
        case "advanced":
            return "Advanced";
        default:
            return location;
    }
}
export function settingsPresetLabel(preset: string): string {
    switch (preset) {
        case "firstRun":
            return "first run";
        case "profilePack":
            return "profile packs";
        default:
            return preset;
    }
}
export function appHubNote(text: string): HTMLElement {
    const note = document.createElement("span");
    note.className = "milxdy-app-hub-note";
    note.textContent = text;
    return note;
}
export function listText(values: readonly string[] | undefined): string {
    return values?.filter(Boolean).join("; ") || "";
}
export function appStorageKeys(app: MilxdyAppManifest): {
    local: readonly string[];
    sync: readonly string[];
} {
    return {
        local: app.storageKeys.local || [],
        sync: app.storageKeys.sync || [],
    };
}
export function storageKeySummary(app: MilxdyAppManifest): string {
    const storageKeys = appStorageKeys(app);
    const keys = [
        ...storageKeys.local.map((key) => `local:${key}`),
        ...storageKeys.sync.map((key) => `sync:${key}`),
    ];
    return keys.join("; ");
}
