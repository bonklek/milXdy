import type { AppSettingDefinition, MilxdyAppManifest } from "../app-sdk/app-platform";
import { captureHubRenderState } from "./hub-focus";
type SettingValue = string | number | boolean | null | string[];
type Dependencies = {
    hubPackageKind: (app: MilxdyAppManifest) => string;
    read: (setting: AppSettingDefinition) => Promise<SettingValue>;
    write: (setting: AppSettingDefinition, value: SettingValue) => Promise<void>;
    setValue: (control: HTMLElement, value: SettingValue) => void;
    optionValue: (value: string | number | boolean | null) => string;
    persist: (setting: AppSettingDefinition, element: HTMLElement) => Promise<void>;
    textValues: (control: HTMLElement) => string[];
};
export function createHubGeneratedFeatureSettings(deps: Dependencies): (app: MilxdyAppManifest) => HTMLElement | null {
    return (app) => createSettingsSection(app, deps);
}
function createSettingsSection(app: MilxdyAppManifest, deps: Dependencies): HTMLElement | null {
    const settings = eligibleSettings(app, deps);
    if (!settings.length)
        return null;
    const section = document.createElement("section");
    section.className = "milxdy-app-hub-generated-settings";
    const title = document.createElement("strong");
    title.textContent = "Settings";
    section.append(title, ...settings.map((setting) => createSettingRow(setting, deps, app.id)));
    return section;
}
function eligibleSettings(app: MilxdyAppManifest, deps: Dependencies): AppSettingDefinition[] {
    if (deps.hubPackageKind(app) !== "feature" && deps.hubPackageKind(app) !== "app")
        return [];
    return (app.settings || []).filter((setting) => setting.location === "appsAndFeatures"
        && setting.advanced !== true && (setting.scope === "feature" || setting.scope === "app")
        && setting.control.type !== "action" && setting.control.type !== "status");
}
function createSettingRow(setting: AppSettingDefinition, deps: Dependencies, appId: string): HTMLElement {
    const row = document.createElement("fieldset");
    row.disabled = true;
    row.style.border = "0";
    row.style.margin = "0";
    row.style.padding = "0";
    row.style.minWidth = "0";
    row.className = "milxdy-app-hub-generated-setting";
    row.dataset.settingId = setting.id;
    row.setAttribute("aria-label", setting.label);
    const text = document.createElement("span");
    text.className = "milxdy-app-hub-generated-setting-text";
    const label = document.createElement("strong");
    label.textContent = setting.label;
    text.append(label);
    if (setting.description) {
        const description = document.createElement("small");
        description.textContent = setting.description;
        text.append(description);
    }
    const status = document.createElement("small");
    status.setAttribute("role", "status");
    text.append(status);
    const control = createSettingControl(setting, {
        ...deps,
        write: (current, value) => saveSettingChange(row, status, control, setting, deps, () => deps.write(current, value)),
        persist: (current, element) => saveSettingChange(row, status, control, setting, deps, () => deps.persist(current, element)),
    });
    control.dataset.hubFocusId = `app:${appId}:setting:${setting.id}`;
    row.append(text, control);
    void deps.read(setting).then((value) => {
        if (row.isConnected) {
            deps.setValue(control, value);
            row.disabled = false;
        }
    }).catch(() => {
        status.textContent = "Could not load settings. Reload this page and try again.";
    });
    return row;
}
async function saveSettingChange(row: HTMLFieldSetElement, status: HTMLElement, control: HTMLElement, setting: AppSettingDefinition, deps: Dependencies, task: () => Promise<void>): Promise<void> {
    const restoreFocus = captureHubRenderState(row.closest<HTMLElement>('.milxdy-app-hub-panel') || row);
    row.disabled = true;
    status.textContent = "Saving…";
    try {
        await task();
        status.textContent = "";
    } catch {
        try { deps.setValue(control, await deps.read(setting)); } catch { /* Keep the last visible value. */ }
        status.textContent = "Could not save. Reload this page and try again.";
    } finally {
        row.disabled = false;
        if (document.activeElement === document.body) restoreFocus();
    }
}

function createSettingControl(setting: AppSettingDefinition, deps: Dependencies): HTMLElement {
    switch (setting.control.type) {
        case "toggle": return createToggle(setting, deps);
        case "select":
        case "segmented": return createSelect(setting, deps);
        case "slider":
        case "number": return createNumber(setting, deps);
        case "text":
        case "textarea": return createText(setting, deps);
        case "textList": return createTextList(setting, deps);
        default: return unsupportedControl(setting);
    }
}
function createToggle(setting: AppSettingDefinition, deps: Dependencies): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "milxdy-app-hub-switch milxdy-app-hub-generated-toggle";
    button.dataset.checked = "false";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", "false");
    button.setAttribute("aria-label", setting.label);
    const knob = document.createElement("span");
    knob.className = "milxdy-app-hub-switch-knob";
    const text = document.createElement("span");
    text.className = "milxdy-app-hub-switch-text";
    text.textContent = "Off";
    button.append(knob, text);
    button.addEventListener("click", () => {
        const next = button.dataset.checked !== "true";
        deps.setValue(button, next);
        void deps.write(setting, next).catch(() => deps.setValue(button, !next));
    });
    return button;
}
function createSelect(setting: AppSettingDefinition, deps: Dependencies): HTMLElement {
    const select = document.createElement("select");
    select.className = setting.control.type === "segmented" ? "milxdy-app-hub-generated-segmented" : "milxdy-app-hub-generated-select";
    select.setAttribute("aria-label", setting.label);
    for (const option of setting.control.options || []) {
        const element = document.createElement("option");
        element.value = deps.optionValue(option.value);
        element.textContent = option.label;
        select.append(element);
    }
    select.addEventListener("change", () => deps.persist(setting, select));
    return select;
}
function createNumber(setting: AppSettingDefinition, deps: Dependencies): HTMLElement {
    const input = document.createElement("input");
    input.className = "milxdy-app-hub-generated-number";
    input.type = setting.control.type === "slider" ? "range" : "number";
    input.setAttribute("aria-label", setting.label);
    if (typeof setting.control.min === "number")
        input.min = String(setting.control.min);
    if (typeof setting.control.max === "number")
        input.max = String(setting.control.max);
    if (typeof setting.control.step === "number")
        input.step = String(setting.control.step);
    input.addEventListener("change", () => deps.persist(setting, input));
    return input;
}
function createText(setting: AppSettingDefinition, deps: Dependencies): HTMLElement {
    const input = setting.control.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.className = "milxdy-app-hub-generated-text";
    input.setAttribute("aria-label", setting.label);
    if (input instanceof HTMLInputElement)
        input.type = "text";
    if (setting.control.placeholder)
        input.placeholder = setting.control.placeholder;
    input.addEventListener("change", () => deps.persist(setting, input));
    return input;
}
function createTextList(setting: AppSettingDefinition, deps: Dependencies): HTMLElement {
    const control = document.createElement("div");
    control.className = "milxdy-app-hub-generated-text-list";
    control.dataset.maxItems = String(setting.control.maxItems || 0);
    control.dataset.maxLength = String(setting.control.maxLength || 0);
    control.setAttribute("aria-label", setting.label);
    const items = document.createElement("div");
    items.className = "milxdy-app-hub-generated-text-list-items";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = setting.control.placeholder || "Add item";
    input.setAttribute("aria-label", `Add ${setting.label}`);
    input.maxLength = setting.control.maxLength || 280;
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add";
    add.addEventListener("click", () => addTextListValue(setting, control, input, deps));
    control.append(items, input, add);
    return control;
}
function addTextListValue(setting: AppSettingDefinition, control: HTMLElement, input: HTMLInputElement, deps: Dependencies): void {
    const value = input.value.trim();
    const values = deps.textValues(control);
    if (!value || values.length >= (setting.control.maxItems || 0))
        return;
    values.push(value);
    input.value = "";
    deps.setValue(control, values);
    void deps.write(setting, values);
}
function unsupportedControl(setting: AppSettingDefinition): HTMLElement {
    const value = document.createElement("span");
    value.className = "milxdy-app-hub-generated-unsupported";
    value.textContent = `${setting.control.type} unsupported`;
    return value;
}
