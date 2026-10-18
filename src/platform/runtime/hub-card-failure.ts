import type { MilxdyAppManifest } from "../app-sdk/app-platform";
export function createHubCardFailure(hubPackageKind: (app: MilxdyAppManifest) => string): (app: MilxdyAppManifest) => HTMLElement {
    return function appHubCardFailure(app: MilxdyAppManifest): HTMLElement {
        const card = document.createElement("section");
        card.className = "milxdy-app-hub-card milxdy-app-hub-card-error";
        card.dataset.hubAppId = app.id;
        card.dataset.tier = hubPackageKind(app);
        const title = document.createElement("strong");
        title.textContent = app.name;
        const detail = document.createElement("p");
        detail.textContent = "This app could not be rendered.";
        card.append(title, detail);
        return card;
    };
}
