import type { AppSettingDefinition, MilxdyAppManifest } from "../app-sdk/app-platform";
import { appStorageKeys } from "./hub-metadata-format";
export type ResetStorageArea = "local" | "sync";
export type AppResetPlan = {
    localKeys: string[];
    syncKeys: string[];
    settingDefaults: Array<{
        area: ResetStorageArea;
        key: string;
        value: unknown;
        settingId: string;
        behavior: string;
    }>;
    propertyDefaults: Array<{
        area: ResetStorageArea;
        key: string;
        property: string;
        value: unknown;
        settingId: string;
        behavior: string;
    }>;
    propertyRemovals: Array<{
        area: ResetStorageArea;
        key: string;
        property: string;
        settingId: string;
        behavior: string;
    }>;
    skippedSharedKeys: Array<{
        area: ResetStorageArea;
        key: string;
        owners: string[];
        reason: string;
    }>;
    skippedSettings: Array<{
        settingId: string;
        area: ResetStorageArea;
        key: string;
        property?: string;
        behavior: string;
        reason: string;
    }>;
    preservedResources: Array<{
        area: ResetStorageArea;
        key: string;
        kind: "settings" | "cache" | "authoredData" | "sensitiveData";
        reason: string;
    }>;
    authoredData: Array<{
        area: ResetStorageArea;
        key: string;
        reset: boolean;
    }>;
};
export function createAppResetPlan(app: MilxdyAppManifest, apps: readonly MilxdyAppManifest[]): AppResetPlan {
    const plan: AppResetPlan = { localKeys: [], syncKeys: [], settingDefaults: [], propertyDefaults: [], propertyRemovals: [], skippedSharedKeys: [], skippedSettings: [], preservedResources: [], authoredData: [] };
    const represented = new Set<string>();
    for (const setting of app.settings || []) {
        represented.add(keyId(setting.storage.area, setting.storage.key));
        appendSetting(plan, app, setting);
    }
    for (const key of appStorageKeys(app).local)
        appendWhole(plan, app, apps, "local", key, represented);
    for (const key of appStorageKeys(app).sync)
        appendWhole(plan, app, apps, "sync", key, represented);
    return plan;
}
export function hasResetWork(plan: AppResetPlan): boolean {
    return plan.localKeys.length + plan.syncKeys.length + plan.settingDefaults.length + plan.propertyDefaults.length + plan.propertyRemovals.length + plan.skippedSharedKeys.length + plan.skippedSettings.length + plan.preservedResources.length > 0;
}
export function resetConfirmationMessage(app: MilxdyAppManifest, plan: AppResetPlan): string {
    const deletesAuthoredData = plan.authoredData.some((entry) => entry.reset);
    const preservesAuthoredData = plan.authoredData.some((entry) => !entry.reset);
    return `Reset ${app.name} settings to their defaults?${deletesAuthoredData ? " This also deletes saved app data you created." : ""}${preservesAuthoredData ? " Your other saved app data is preserved." : ""}`;
}
function appendSetting(plan: AppResetPlan, app: MilxdyAppManifest, setting: AppSettingDefinition): void {
    const { area, key, property } = setting.storage;
    const behavior = setting.reset.behavior;
    if (!settingResets(app, area, key))
        return preserve(plan, app, area, key, "preservedByResourcePolicy");
    if (behavior === "custom")
        return void plan.skippedSettings.push({ settingId: setting.id, area, key, property, behavior, reason: "customResetBehavior" });
    if (property) {
        if (behavior === "removeKey") {
            plan.propertyRemovals.push({ area, key, property, settingId: setting.id, behavior });
            recordAuthored(plan, app, area, key, true);
            return;
        }
        if (setting.defaultValue !== undefined) {
            plan.propertyDefaults.push({ area, key, property, value: setting.defaultValue, settingId: setting.id, behavior });
            recordAuthored(plan, app, area, key, true);
            return;
        }
    }
    else if (behavior === "removeKey") {
        appendKey(plan, area, key);
        recordAuthored(plan, app, area, key, true);
        return;
    }
    else if (setting.defaultValue !== undefined) {
        plan.settingDefaults.push({ area, key, value: setting.defaultValue, settingId: setting.id, behavior });
        recordAuthored(plan, app, area, key, true);
        return;
    }
    plan.skippedSettings.push({ settingId: setting.id, area, key, property, behavior, reason: "missingDefaultValue" });
}
function appendWhole(plan: AppResetPlan, app: MilxdyAppManifest, apps: readonly MilxdyAppManifest[], area: ResetStorageArea, key: string, represented: Set<string>): void {
    if (represented.has(keyId(area, key)))
        return;
    if (!wholeResets(app, area, key))
        return preserve(plan, app, area, key, "noDestructiveResetPolicy");
    const owners = apps.filter((candidate) => appStorageKeys(candidate)[area].includes(key) || candidate.settings?.some((setting) => setting.storage.area === area && setting.storage.key === key)).map((candidate) => candidate.id).sort();
    if (owners.length > 1)
        return void plan.skippedSharedKeys.push({ area, key, owners, reason: "sharedStorageKey" });
    appendKey(plan, area, key);
    recordAuthored(plan, app, area, key, true);
}
function settingResets(app: MilxdyAppManifest, area: ResetStorageArea, key: string): boolean { const resource = app.storageResources?.find((entry) => entry.area === area && entry.key === key); return !resource || resource.kind === "settings" ? resource?.reset !== "preserve" : resource.reset === "reset"; }
function wholeResets(app: MilxdyAppManifest, area: ResetStorageArea, key: string): boolean { return Boolean(app.storageResources?.some((entry) => entry.area === area && entry.key === key && settingResets(app, area, key))); }
function appendKey(plan: AppResetPlan, area: ResetStorageArea, key: string): void { const keys = area === "local" ? plan.localKeys : plan.syncKeys; if (!keys.includes(key))
    keys.push(key); }
function preserve(plan: AppResetPlan, app: MilxdyAppManifest, area: ResetStorageArea, key: string, reason: string): void { if (plan.preservedResources.some((entry) => entry.area === area && entry.key === key))
    return; const kind = app.storageResources?.find((entry) => entry.area === area && entry.key === key)?.kind || "settings"; plan.preservedResources.push({ area, key, kind, reason }); recordAuthored(plan, app, area, key, false); }
function recordAuthored(plan: AppResetPlan, app: MilxdyAppManifest, area: ResetStorageArea, key: string, reset: boolean): void { if (app.storageResources?.some((entry) => entry.area === area && entry.key === key && entry.kind === "authoredData") && !plan.authoredData.some((entry) => entry.area === area && entry.key === key))
    plan.authoredData.push({ area, key, reset }); }
function keyId(area: ResetStorageArea, key: string): string { return `${area}:${key}`; }
