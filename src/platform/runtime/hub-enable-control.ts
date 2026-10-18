import type { MilxdyAppManifest } from "../app-sdk/app-platform";
type Dependencies = {
    state: {
        enabledApps: Set<string>;
    };
    blocked: (app: MilxdyAppManifest) => string | null;
    setEnabled: (app: MilxdyAppManifest, value: boolean) => void;
};
export function createHubEnableControl(deps: Dependencies): (app: MilxdyAppManifest) => HTMLElement {
    const { state, blocked: appEnableBlockedByPerformance, setEnabled: setAppEnabled } = deps;
    return function appHubEnableControl(app: MilxdyAppManifest): HTMLElement {
        const row = document.createElement("div");
        row.className = "milxdy-app-hub-enable-row";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "milxdy-app-hub-switch";
        toggle.dataset.hubFocusId = `app:${app.id}:enable`;
        const switchKnob = document.createElement("span");
        switchKnob.className = "milxdy-app-hub-switch-knob";
        const switchText = document.createElement("span");
        switchText.className = "milxdy-app-hub-switch-text";
        const detail = document.createElement("span");
        detail.className = "milxdy-app-hub-enable-detail";
        if (app.available === false) {
            toggle.disabled = true;
            toggle.dataset.checked = "false";
            toggle.setAttribute("role", "switch");
            toggle.setAttribute("aria-checked", "false");
            toggle.setAttribute("aria-disabled", "true");
            toggle.setAttribute("aria-label", `${app.name} unavailable in this build`);
            switchText.textContent = "Unavailable";
            detail.textContent = app.unavailableReason || "This app cannot be enabled right now.";
        }
        else if (!app.setEnabled) {
            toggle.disabled = true;
            toggle.dataset.checked = "true";
            toggle.setAttribute("role", "switch");
            toggle.setAttribute("aria-checked", "true");
            toggle.setAttribute("aria-disabled", "true");
            toggle.setAttribute("aria-label", `${app.name} is always on`);
            switchText.textContent = "Always on";
            detail.textContent = "Core feature";
        }
        else {
            const enabled = state.enabledApps.has(app.id);
            const performanceBlock = enabled ? null : appEnableBlockedByPerformance(app);
            toggle.dataset.checked = String(enabled);
            toggle.setAttribute("role", "switch");
            toggle.setAttribute("aria-checked", String(enabled));
            if (performanceBlock) {
                toggle.dataset.performanceBlocked = "true";
                toggle.setAttribute("aria-disabled", "true");
            }
            toggle.setAttribute("aria-label", performanceBlock || `${enabled ? "Disable" : "Enable"} ${app.name}`);
            toggle.title = performanceBlock || "";
            switchText.textContent = enabled ? "On" : "Off";
            detail.textContent = performanceBlock || (enabled ? "Click to disable this app." : "Click to enable this app.");
            toggle.addEventListener("click", () => setAppEnabled(app, !state.enabledApps.has(app.id)));
        }
        toggle.append(switchKnob, switchText);
        row.append(toggle, detail);
        return row;
    };
}
