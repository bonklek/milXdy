import { REMILIA_AUTH_MESSAGE, REMILIA_CONSENT_VERSION, REMILIA_MIGRATION_VERSION, instantBeetleResultsAvailability, normalizeRemiliaAuthResponse, remiliaConnectionView, remiliaErrorMessage, remiliaIdentityLabel, remiliaScopeRows, type RemiliaAuthStatus, } from "./remilia-connection";
type PanelDependencies = {
    renderOnboarding: () => Promise<void>;
    renderPokeDiagnostic: (root: HTMLElement) => Promise<void>;
};
type PanelElements = {
    root: HTMLElement;
    migration: HTMLElement;
    consent: HTMLElement;
    statusTitle: HTMLElement;
    statusDetail: HTMLElement;
    identity: HTMLElement;
    error: HTMLElement;
    scopeList: HTMLElement;
    connect: HTMLButtonElement;
    reconnect: HTMLButtonElement;
    disconnect: HTMLButtonElement;
    revoke: HTMLButtonElement;
    completeMigration: HTMLButtonElement;
    message: HTMLElement;
    pokeDiagnostic: HTMLElement;
    color: HTMLSelectElement;
    mode: HTMLSelectElement;
    instantResultsSetting: HTMLElement;
    instantResultsControl: HTMLInputElement;
    instantResultsHelp: HTMLElement;
};
function panelElements(): PanelElements | null {
    const elements = {
        root: document.getElementById("remiliaConnection"), migration: document.getElementById("remiliaMigration"),
        consent: document.getElementById("remiliaConsent"), statusTitle: document.getElementById("remiliaAuthTitle"),
        statusDetail: document.getElementById("remiliaAuthDetail"), identity: document.getElementById("remiliaIdentity"),
        error: document.getElementById("remiliaAuthError"), scopeList: document.getElementById("remiliaScopeList"),
        connect: document.getElementById("remiliaConnect") as HTMLButtonElement | null,
        reconnect: document.getElementById("remiliaReconnect") as HTMLButtonElement | null,
        disconnect: document.getElementById("remiliaDisconnect") as HTMLButtonElement | null,
        revoke: document.getElementById("remiliaRevoke") as HTMLButtonElement | null,
        completeMigration: document.getElementById("remiliaCompleteMigration") as HTMLButtonElement | null,
        message: document.getElementById("remiliaAuthMessage"), pokeDiagnostic: document.getElementById("beetolPokeDiagnostic"),
        color: document.getElementById("beetolColor") as HTMLSelectElement | null,
        mode: document.getElementById("beetolMode") as HTMLSelectElement | null,
        instantResultsSetting: document.getElementById("beetleInstantResultsSetting"),
        instantResultsControl: document.querySelector<HTMLInputElement>('[data-control="reminet.beetleInstantResults"]'),
        instantResultsHelp: document.getElementById("beetleInstantResultsHelp"),
    };
    return Object.values(elements).some((element) => !element) ? null : elements as PanelElements;
}
function renderScopeRows(root: HTMLElement, authStatus: RemiliaAuthStatus): void {
    root.textContent = "";
    const rows = remiliaScopeRows(authStatus);
    if (rows.length === 0) {
        const item = document.createElement("li");
        const marker = document.createElement("span");
        marker.setAttribute("aria-hidden", "true");
        const body = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = "Abilities unavailable";
        const detail = document.createElement("small");
        detail.textContent = "Reload after the connection service has been updated.";
        body.append(label, detail);
        item.append(marker, body);
        root.append(item);
        return;
    }
    for (const row of rows) {
        const item = document.createElement("li");
        item.dataset.granted = String(row.granted);
        item.setAttribute("aria-label", `${row.label}: ${row.granted ? "granted" : "not granted"}`);
        const marker = document.createElement("span");
        marker.setAttribute("aria-hidden", "true");
        const body = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = row.label;
        const detail = document.createElement("small");
        detail.textContent = `${row.detail} ${row.granted ? "Granted." : "Not granted."}`;
        body.append(label, detail);
        item.append(marker, body);
        root.append(item);
    }
}
class RemiliaConnectionPanel {
    constructor(private readonly elements: PanelElements, private readonly dependencies: PanelDependencies) { }
    private setMessage(text: string, kind = ""): void {
        const { message } = this.elements;
        message.textContent = text;
        if (kind)
            message.dataset.kind = kind;
        else
            delete message.dataset.kind;
    }
    private setBusy(busy: boolean): void {
        const { root, connect, reconnect, disconnect, revoke, completeMigration } = this.elements;
        const buttons = [connect, reconnect, disconnect, revoke, completeMigration];
        root.toggleAttribute("aria-busy", busy);
        buttons.forEach((button) => { button.disabled = busy; });
    }
    private async renderStatus(authStatus: RemiliaAuthStatus, announceError = false): Promise<void> {
        const { root, statusTitle, statusDetail, migration, consent, connect, reconnect, disconnect, revoke, instantResultsControl, instantResultsSetting, instantResultsHelp, identity, scopeList, error, pokeDiagnostic } = this.elements;
        const view = remiliaConnectionView(authStatus);
        const availability = instantBeetleResultsAvailability(authStatus);
        root.dataset.phase = view.phase;
        root.dataset.tone = view.tone;
        statusTitle.textContent = view.title;
        statusDetail.textContent = view.detail;
        migration.hidden = !view.showMigration;
        consent.hidden = !view.showConsent;
        connect.hidden = !view.showConnect;
        reconnect.hidden = !view.showReconnect;
        disconnect.hidden = !view.showDisconnect;
        revoke.hidden = !view.showRevoke;
        instantResultsControl.disabled = !availability.active;
        instantResultsSetting.dataset.connectorAvailable = String(availability.active);
        instantResultsSetting.setAttribute("aria-disabled", String(!availability.active));
        instantResultsHelp.textContent = availability.help;
        const connectedIdentity = authStatus.phase === "connected" ? remiliaIdentityLabel(authStatus.identity) : "";
        identity.textContent = connectedIdentity;
        identity.hidden = !connectedIdentity;
        renderScopeRows(scopeList, authStatus);
        const showError = authStatus.phase !== "unsupported" && (authStatus.phase === "error" || Boolean(authStatus.lastError));
        error.hidden = !showError;
        error.textContent = showError ? remiliaErrorMessage(authStatus.lastError) : "";
        if (announceError && showError)
            error.focus({ preventScroll: false });
        if (authStatus.phase === "connected")
            pokeDiagnostic.hidden = true;
        else
            await this.dependencies.renderPokeDiagnostic(pokeDiagnostic).catch(() => { pokeDiagnostic.hidden = true; });
    }
    private async fetchStatus(announceError = false): Promise<RemiliaAuthStatus> {
        const response = await chrome.runtime.sendMessage({ type: REMILIA_AUTH_MESSAGE.status }).catch(() => ({ error: { code: "BACKGROUND_UNAVAILABLE" } }));
        const status = normalizeRemiliaAuthResponse(response);
        await this.renderStatus(status, announceError);
        return status;
    }
    private async runAction(request: Record<string, unknown>, pendingText: string, successText: string | ((response: Record<string, unknown>) => string)): Promise<void> {
        this.setBusy(true);
        this.setMessage(pendingText);
        try {
            const response = await chrome.runtime.sendMessage(request).catch(() => ({ error: { code: "BACKGROUND_UNAVAILABLE" } }));
            const record = response && typeof response === "object" ? response as Record<string, unknown> : null;
            if (!record || record.ok === false) {
                await this.renderStatus(normalizeRemiliaAuthResponse(response), true);
                this.setMessage("");
                return;
            }
            const latest = await this.fetchStatus(true);
            if (latest.phase === "error" || latest.lastError) {
                this.setMessage("");
                return;
            }
            this.setMessage(typeof successText === "function" ? successText(record) : successText, "success");
            await this.dependencies.renderOnboarding();
        }
        finally {
            this.setBusy(false);
        }
    }
    private bindActions(): void {
        const { connect, reconnect, completeMigration, disconnect, revoke, color, mode } = this.elements;
        connect.addEventListener("click", () => { void this.runAction({ type: REMILIA_AUTH_MESSAGE.connect, consentVersion: REMILIA_CONSENT_VERSION }, "Opening Remilia Login...", "Remilia account connected."); });
        reconnect.addEventListener("click", () => { void this.runAction({ type: REMILIA_AUTH_MESSAGE.reconnect, consentVersion: REMILIA_CONSENT_VERSION }, "Opening Remilia Login to reconnect...", "Remilia account reconnected."); });
        completeMigration.addEventListener("click", () => { void this.runAction({ type: REMILIA_AUTH_MESSAGE.completeMigration, migrationVersion: REMILIA_MIGRATION_VERSION, decision: "delete-legacy" }, "Deleting old login data...", "Old login data deleted. No account was connected; connect only when you are ready."); });
        disconnect.addEventListener("click", () => { void this.runAction({ type: REMILIA_AUTH_MESSAGE.disconnect }, "Disconnecting...", "Disconnected. Your other milXdy settings were kept."); });
        revoke.addEventListener("click", () => {
            if (window.confirm("Revoke this Remilia authorization? milXdy will remove its local credentials but keep your other settings."))
                void this.runAction({ type: REMILIA_AUTH_MESSAGE.revoke }, "Revoking authorization...", (response) => response.remoteRevoked === false ? "Local credentials removed. Remilia could not confirm remote revocation; you can review active authorizations on Remilia. Your other milXdy settings were kept." : "Authorization revoked and local credentials removed. Your other milXdy settings were kept.");
        });
        color.addEventListener("change", () => { void chrome.storage.local.set({ beetolColor: color.value }); });
        mode.addEventListener("change", () => { void chrome.storage.local.set({ beetolMode: mode.value }); });
    }
    async start(): Promise<void> {
        const { color, mode } = this.elements;
        const stored = await chrome.storage.local.get(["beetolColor", "beetolMode"]);
        color.value = typeof stored.beetolColor === "string" ? stored.beetolColor : "red";
        mode.value = typeof stored.beetolMode === "string" ? stored.beetolMode : "settings";
        this.bindActions();
        await this.fetchStatus();
        const statusTimer = setInterval(() => { void this.fetchStatus(); }, 2000);
        addEventListener("pagehide", () => clearInterval(statusTimer), { once: true });
    }
}
export async function setupRemiliaConnectionPanel(dependencies: PanelDependencies): Promise<void> {
    const elements = panelElements();
    if (elements)
        await new RemiliaConnectionPanel(elements, dependencies).start();
}
