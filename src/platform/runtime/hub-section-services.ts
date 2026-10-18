import type { MilxdyAppManifest } from "../app-sdk/app-platform";
type Dependencies = {
    getOrder: () => readonly string[];
    isHubRailApp: (app: MilxdyAppManifest) => boolean;
    appHubCard: (app: MilxdyAppManifest) => HTMLElement;
    appHubCardFailure: (app: MilxdyAppManifest) => HTMLElement;
    recordDiagnostic: (key: string, value: Record<string, unknown>) => void;
};
export function createHubSectionServices(deps: Dependencies) {
    return { orderedHubApps: (apps: MilxdyAppManifest[]) => orderedHubApps(deps, apps), appendHubSection: (list: HTMLElement, label: string, apps: MilxdyAppManifest[]) => appendHubSection(deps, list, label, apps) };
}
function orderedHubApps(deps: Dependencies, apps: MilxdyAppManifest[]): MilxdyAppManifest[] {
    const railApps = apps.filter(deps.isHubRailApp);
    const nonRailApps = apps.filter((app) => !deps.isHubRailApp(app));
    const byId = new Map(railApps.map((app) => [app.id, app]));
    const ordered: MilxdyAppManifest[] = [];
    for (const id of deps.getOrder()) {
        const app = byId.get(id);
        if (app) {
            ordered.push(app);
            byId.delete(id);
        }
    }
    return [...ordered, ...byId.values(), ...nonRailApps];
}
function appendHubSection(deps: Dependencies, list: HTMLElement, label: string, apps: MilxdyAppManifest[]): void {
    if (!apps.length)
        return;
    const section = document.createElement("section");
    section.className = "milxdy-app-hub-section";
    section.dataset.section = label.toLowerCase();
    const heading = document.createElement("div");
    heading.className = "milxdy-app-hub-section-title";
    const title = document.createElement("strong");
    title.textContent = label;
    heading.append(title);
    if (label === "Apps" && apps.some(deps.isHubRailApp)) {
        const hint = document.createElement("span");
        hint.textContent = "reorder rail apps to change stacking priority";
        heading.append(hint);
    }
    section.append(heading);
    for (const app of apps) {
        try {
            section.append(deps.appHubCard(app));
        }
        catch {
            deps.recordDiagnostic(`hub.card.${app.id}`, { error: "card render failed", updatedAt: Date.now() });
            section.append(deps.appHubCardFailure(app));
        }
    }
    list.append(section);
}
