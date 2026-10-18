import { captureHubRenderState } from "./hub-focus";
import type { MilxdyAppManifest } from "../app-sdk/app-platform";
type HubState = {
    hubPanelRoot: HTMLElement | null;
    hubDockSettingsOpen: boolean;
    firstRunPending: boolean;
    hubSearchQuery: string;
    apps: readonly MilxdyAppManifest[];
};
type Dock = {
    getSide: () => "left" | "right";
    createSettingsPanel: (render: () => void, options: {
        excludeActionIds: string[];
    }) => HTMLElement;
};
type Dependencies = {
    state: HubState;
    getDock: () => Dock;
    currentTheme: () => string;
    presetActions: () => HTMLElement;
    completeFirstRun: (value: "complete" | "skipped") => void;
    closeHubPanel: () => void;
    appHubSetupSettings: () => HTMLElement;
    appHubRuntimeSummary: () => HTMLElement;
    appMatchesSearch: (app: MilxdyAppManifest, query: string) => boolean;
    hubPackageKind: (app: MilxdyAppManifest) => string;
    orderedHubApps: (apps: MilxdyAppManifest[]) => MilxdyAppManifest[];
    appendHubSection: (list: HTMLElement, label: string, apps: MilxdyAppManifest[]) => void;
    markLayoutReady: (root: HTMLElement, ready: boolean) => void;
};
export function createHubPanelRenderer(deps: Dependencies): () => void {
    return () => renderHubPanel(deps);
}
function renderHubPanel(deps: Dependencies): void {
    const root = deps.state.hubPanelRoot;
    if (!root?.isConnected)
        return;
    const restoreFocus = captureHubRenderState(root);
    prepareRoot(root, deps);
    root.append(createHeader(deps));
    if (deps.state.firstRunPending)
        root.append(createFirstRun(deps));
    if (deps.state.hubDockSettingsOpen) {
        renderDockSettings(root, restoreFocus, deps);
        return;
    }
    renderAppList(root, deps);
    finishRender(root, restoreFocus, deps);
}
function prepareRoot(root: HTMLElement, deps: Dependencies): void {
    const side = deps.getDock().getSide();
    root.dataset.side = side;
    root.dataset.theme = deps.currentTheme();
    root.style.setProperty("--milxdy-overlay-app-transform-origin", side === "right" ? "top right" : "top left");
    root.innerHTML = "";
}
function createHeader(deps: Dependencies): HTMLElement {
    const header = document.createElement("div");
    header.className = "milxdy-app-hub-header";
    const title = document.createElement("strong");
    title.textContent = "Apps & Features";
    const actions = document.createElement("div");
    actions.className = "milxdy-app-hub-header-actions";
    actions.append(createSettingsButton(deps), createCloseButton(deps));
    header.append(title, actions);
    return header;
}
function createSettingsButton(deps: Dependencies): HTMLButtonElement {
    const button = document.createElement("button");
    const active = deps.state.hubDockSettingsOpen;
    button.type = "button";
    button.className = "milxdy-app-hub-settings-button";
    button.dataset.hubFocusId = "settings";
    button.title = active ? "Back to apps and features" : "Rail settings";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", String(active));
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? "←" : "⚙";
    button.addEventListener("click", () => {
        deps.state.hubDockSettingsOpen = !deps.state.hubDockSettingsOpen;
        renderHubPanel(deps);
    });
    return button;
}
function createCloseButton(deps: Dependencies): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Minimize";
    button.title = "Minimize Apps & Features";
    button.setAttribute("aria-label", "Minimize Apps & Features");
    button.dataset.hubFocusId = "close";
    button.addEventListener("click", deps.closeHubPanel);
    return button;
}
function createFirstRun(deps: Dependencies): HTMLElement {
    const section = document.createElement("section");
    section.className = "milxdy-app-hub-first-run";
    const heading = document.createElement("strong");
    heading.textContent = "Light Start";
    const copy = document.createElement("p");
    copy.textContent = "Choose an exact app set, default rail pins, and matching Performance mode.";
    const actions = deps.presetActions();
    const skip = document.createElement("button");
    skip.type = "button";
    skip.textContent = "Keep defaults";
    skip.addEventListener("click", () => deps.completeFirstRun("skipped"));
    actions.append(skip);
    section.append(heading, copy, actions);
    return section;
}
function renderDockSettings(root: HTMLElement, restoreFocus: () => void, deps: Dependencies): void {
    const settings = deps.getDock().createSettingsPanel(() => renderHubPanel(deps), { excludeActionIds: ["milxdy.addApps"] });
    settings.classList.add("milxdy-app-hub-dock-settings");
    settings.append(deps.appHubSetupSettings());
    root.append(settings);
    finishRender(root, restoreFocus, deps);
}
function renderAppList(root: HTMLElement, deps: Dependencies): void {
    root.append(deps.appHubRuntimeSummary(), createSearch(deps));
    const list = document.createElement("div");
    list.className = "milxdy-app-hub-list";
    const apps = deps.state.apps.filter((app) => app.hub && deps.appMatchesSearch(app, deps.state.hubSearchQuery));
    deps.appendHubSection(list, "Apps", deps.orderedHubApps(apps.filter((app) => deps.hubPackageKind(app) === "app")));
    deps.appendHubSection(list, "Features", apps.filter((app) => deps.hubPackageKind(app) === "feature"));
    deps.appendHubSection(list, "Themes", apps.filter((app) => deps.hubPackageKind(app) === "theme"));
    if (!apps.length) {
        const empty = document.createElement("p");
        empty.className = "milxdy-app-hub-empty";
        empty.textContent = "No apps or features match that search.";
        list.append(empty);
    }
    root.append(list);
}
function createSearch(deps: Dependencies): HTMLElement {
    const label = document.createElement("label");
    label.className = "milxdy-app-hub-search";
    const text = document.createElement("span");
    text.textContent = "Search apps and features";
    const input = document.createElement("input");
    input.type = "search";
    input.dataset.hubFocusId = "search";
    input.placeholder = "Search by name, category, setting, data, or permissions";
    input.value = deps.state.hubSearchQuery;
    input.addEventListener("input", () => {
        deps.state.hubSearchQuery = input.value;
        renderHubPanel(deps);
    });
    label.append(text, input);
    return label;
}
function finishRender(root: HTMLElement, restoreFocus: () => void, deps: Dependencies): void {
    deps.markLayoutReady(root, true);
    restoreFocus();
}
