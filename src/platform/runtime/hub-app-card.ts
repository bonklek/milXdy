import type { AppIconAsset, MilxdyAppId, MilxdyAppManifest } from "../app-sdk/app-platform";
import type { RemiStatsRuntimePhaseState } from "./remistats-runtime-phase";
type HubState = {
    enabledApps: Set<MilxdyAppId>;
    hubExpandedApps: Set<MilxdyAppId>;
    remistatsRuntimePhases: RemiStatsRuntimePhaseState;
};
type Lifecycle = {
    state: string;
    label: string;
    detail: string;
};
type Dock = {
    getAppOrder: () => readonly string[];
};
type Dependencies = {
    state: HubState;
    hubPackageKind: (app: MilxdyAppManifest) => string;
    isHubRailApp: (app: MilxdyAppManifest) => boolean;
    isRailPinned: (app: MilxdyAppManifest) => boolean;
    appHubLifecycle: (app: MilxdyAppManifest) => Lifecycle;
    runtimeAssetUrl: (path: string) => string;
    resolveIcon: (icon: AppIconAsset) => string;
    startDrag: (event: PointerEvent, id: MilxdyAppId) => void;
    renderHubPanel: () => void;
    appHubEnableControl: (app: MilxdyAppManifest) => HTMLElement;
    packageKindLabel: (app: MilxdyAppManifest) => string;
    appHubMetadataNotes: (app: MilxdyAppManifest) => HTMLElement;
    appRuntimeSummary: (app: MilxdyAppManifest) => string;
    formatPhase: (value: RemiStatsRuntimePhaseState) => string;
    setRailPinned: (id: MilxdyAppId, value: boolean) => void;
    openApp: (app: MilxdyAppManifest, reason: string) => Promise<void>;
    getDock: () => Dock;
    moveHubAppBy: (id: MilxdyAppId, delta: -1 | 1, label: string) => void;
    hasResettableStorage: (app: MilxdyAppManifest) => boolean;
    resetAppSettings: (app: MilxdyAppManifest) => void;
    appHubDetails: (app: MilxdyAppManifest) => HTMLElement;
    generatedSettings: (app: MilxdyAppManifest) => HTMLElement | null;
};
export function createHubAppCard(deps: Dependencies): (app: MilxdyAppManifest) => HTMLElement {
    return (app) => {
        const lifecycle = deps.appHubLifecycle(app);
        const card = document.createElement("section");
        card.className = "milxdy-app-hub-card";
        setCardState(card, app, lifecycle, deps);
        card.append(createSummary(app, lifecycle, deps), createBody(app, lifecycle, deps), createControls(app, deps));
        return card;
    };
}
function setCardState(card: HTMLElement, app: MilxdyAppManifest, lifecycle: Lifecycle, deps: Dependencies): void {
    card.dataset.hubAppId = app.id;
    card.dataset.tier = deps.hubPackageKind(app);
    card.dataset.available = String(app.available !== false);
    card.dataset.enabled = String(deps.state.enabledApps.has(app.id));
    card.dataset.railApp = String(deps.isHubRailApp(app));
    card.dataset.pinned = String(deps.isRailPinned(app));
    card.dataset.expanded = String(deps.state.hubExpandedApps.has(app.id));
    card.dataset.lifecycle = lifecycle.state;
}
function createSummary(app: MilxdyAppManifest, lifecycle: Lifecycle, deps: Dependencies): HTMLElement {
    const summary = document.createElement("button");
    const expanded = deps.state.hubExpandedApps.has(app.id);
    summary.className = "milxdy-app-hub-card-summary";
    summary.dataset.hubFocusId = `app:${app.id}:summary`;
    summary.type = "button";
    summary.setAttribute("aria-expanded", String(expanded));
    summary.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${app.name}`);
    if (deps.isHubRailApp(app))
        summary.append(createDragHandle(app, deps));
    summary.append(createIcon(app, deps), createSummaryText(app, lifecycle), createExpandIcon());
    summary.addEventListener("click", () => toggleExpanded(app.id, deps));
    return summary;
}
function createDragHandle(app: MilxdyAppManifest, deps: Dependencies): HTMLElement {
    const handle = document.createElement("span");
    handle.className = "milxdy-app-hub-drag-handle";
    handle.title = "Drag to reorder app stacking";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "⋮⋮";
    handle.addEventListener("pointerdown", (event) => deps.startDrag(event, app.id));
    return handle;
}
function createIcon(app: MilxdyAppManifest, deps: Dependencies): HTMLElement {
    const icon = document.createElement("span");
    icon.className = "milxdy-app-hub-icon";
    if (!app.dock?.icon) {
        icon.textContent = (app.dock?.label || app.name).slice(0, 1).toUpperCase();
        return icon;
    }
    const image = document.createElement("img");
    image.className = "milxdy-app-hub-icon-img";
    image.src = deps.runtimeAssetUrl(deps.resolveIcon(app.dock.icon));
    image.alt = "";
    image.decoding = "async";
    icon.append(image);
    return icon;
}
function createSummaryText(app: MilxdyAppManifest, lifecycle: Lifecycle): HTMLElement {
    const text = document.createElement("span");
    const title = document.createElement("strong");
    const badge = document.createElement("span");
    text.className = "milxdy-app-hub-card-title";
    title.textContent = app.name;
    title.title = app.name;
    badge.className = "milxdy-app-hub-lifecycle";
    badge.dataset.state = lifecycle.state;
    badge.textContent = lifecycle.label;
    text.append(title, badge);
    return text;
}
function createExpandIcon(): HTMLElement {
    const icon = document.createElement("span");
    icon.className = "milxdy-app-hub-expand-icon";
    return icon;
}
function toggleExpanded(id: MilxdyAppId, deps: Dependencies): void {
    if (deps.state.hubExpandedApps.has(id))
        deps.state.hubExpandedApps.delete(id);
    else
        deps.state.hubExpandedApps.add(id);
    deps.renderHubPanel();
}
function createBody(app: MilxdyAppManifest, lifecycle: Lifecycle, deps: Dependencies): HTMLElement {
    const body = document.createElement("div");
    body.className = "milxdy-app-hub-body";
    body.append(deps.appHubEnableControl(app), createDescription(app, lifecycle, deps), deps.appHubMetadataNotes(app));
    if (app.available === false && app.unavailableReason)
        body.append(createUnavailable(app.unavailableReason));
    if (app.id === "remistats")
        body.append(createPhaseSummary(deps));
    body.append(deps.appHubDetails(app));
    const settings = deps.generatedSettings(app);
    if (settings)
        body.append(settings);
    return body;
}
function createDescription(app: MilxdyAppManifest, lifecycle: Lifecycle, deps: Dependencies): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const description = document.createElement("p");
    const meta = document.createElement("span");
    const runtime = document.createElement("span");
    description.textContent = app.hub?.shortDescription || app.description;
    meta.textContent = `${deps.packageKindLabel(app)} | ${app.hub?.category || "app"} | ${app.available === false ? "Unavailable in this build" : deps.state.enabledApps.has(app.id) ? "On" : "Off"}`;
    runtime.className = "milxdy-app-hub-runtime-state";
    runtime.textContent = `${lifecycle.detail} | ${deps.appRuntimeSummary(app)}`;
    fragment.append(description, meta, runtime);
    return fragment;
}
function createUnavailable(reason: string): HTMLElement {
    const item = document.createElement("span");
    item.className = "milxdy-app-hub-unavailable";
    item.textContent = reason;
    return item;
}
function createPhaseSummary(deps: Dependencies): HTMLElement {
    const item = document.createElement("span");
    item.className = "milxdy-app-hub-runtime-state";
    item.dataset.remistatsRuntimePhase = "true";
    item.textContent = deps.formatPhase(deps.state.remistatsRuntimePhases);
    return item;
}
function createControls(app: MilxdyAppManifest, deps: Dependencies): HTMLElement {
    const controls = document.createElement("div");
    controls.className = "milxdy-app-hub-controls";
    appendPin(controls, app, deps);
    appendOpen(controls, app, deps);
    appendOrder(controls, app, deps);
    appendReset(controls, app, deps);
    return controls;
}
function appendPin(controls: HTMLElement, app: MilxdyAppManifest, deps: Dependencies): void {
    if (app.available === false || !app.dock || app.hub?.rail.supported === false)
        return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hubFocusId = `app:${app.id}:pin`;
    button.textContent = deps.isRailPinned(app) ? "Unpin" : "Pin";
    button.disabled = !deps.state.enabledApps.has(app.id);
    button.addEventListener("click", () => deps.setRailPinned(app.id, !deps.isRailPinned(app)));
    controls.append(button);
}
function appendOpen(controls: HTMLElement, app: MilxdyAppManifest, deps: Dependencies): void {
    if (app.available === false || !app.dock || !deps.state.enabledApps.has(app.id))
        return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hubFocusId = `app:${app.id}:open`;
    button.textContent = "Open";
    button.addEventListener("click", () => void deps.openApp(app, "hubOpen"));
    controls.append(button);
}
function appendOrder(controls: HTMLElement, app: MilxdyAppManifest, deps: Dependencies): void {
    if (!deps.isHubRailApp(app))
        return;
    const order = deps.getDock().getAppOrder();
    const index = order.indexOf(app.id);
    for (const [label, delta] of [["Move up", -1], ["Move down", 1]] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.hubFocusId = `app:${app.id}:move:${delta}`;
        button.textContent = label;
        button.setAttribute("aria-label", `${label} ${app.name}`);
        button.disabled = index < 0 || index + delta < 0 || index + delta >= order.length;
        button.addEventListener("click", () => deps.moveHubAppBy(app.id, delta, label));
        controls.append(button);
    }
}
function appendReset(controls: HTMLElement, app: MilxdyAppManifest, deps: Dependencies): void {
    if (app.available === false || !deps.hasResettableStorage(app))
        return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hubFocusId = `app:${app.id}:reset`;
    button.textContent = "Reset";
    button.title = "Reset app settings";
    button.addEventListener("click", () => deps.resetAppSettings(app));
    controls.append(button);
}
