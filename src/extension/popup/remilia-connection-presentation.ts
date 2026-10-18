import { REMILIA_AUTH_MESSAGE, REMILIA_CONSENT_VERSION, REMILIA_MIGRATION_VERSION, instantBeetleResultsAvailability, normalizeRemiliaAuthResponse, remiliaConnectionView, remiliaErrorMessage, remiliaIdentityLabel, remiliaScopeRows, type RemiliaAuthStatus, } from "./remilia-connection";
import { refreshSettingsChoice } from "./settings-tiles";
import { updateRemiliaSettingLocks } from "./remilia-setting-locks";
import { setPreviewProfile } from "./settings-previews";
import { REMILIA_PROFILE_ACCENT_KEY, remiliaHueAccent } from "../../platform/visuals/reskin-profile";
import type { PanelDependencies } from "./remilia-connection-panel";
import type { ConnectionElements } from "./remilia-connection-elements";

function renderScopeRows(root: HTMLElement, authStatus: RemiliaAuthStatus): void {
    root.textContent = "";
    const showingGrantedAbilities = authStatus.phase === "connected";
    document.getElementById("remiliaScopesTitle")!.textContent = showingGrantedAbilities ? "Granted abilities" : "Requested abilities";
    const rows = remiliaScopeRows(authStatus).filter(row => !showingGrantedAbilities || row.granted);
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
    } else {
      for (const row of rows) {
        const item = document.createElement("li");
        item.dataset.granted = String(row.granted);
        item.setAttribute("aria-label", `${row.label}: ${row.granted ? "granted" : "not granted"}`);
        const marker = document.createElement("span");
        marker.setAttribute("aria-hidden", "true");
        const body = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = row.label;
        body.append(label);
        item.append(marker, body);
        root.append(item);
      }
    }

}

type AccountResponse = {
  ok?: boolean; error?: string; status?: number;
  identity?: { displayName?: string; username?: string };
  preview?: Parameters<typeof setPreviewProfile>[0];
  theme?: { mode?: string; hue?: number };
};
export function createConnectionStatusRenderer(deps: PanelDependencies, elements: ConnectionElements, initialAccent: string) {
  const presentation = new AccountPresentation(deps, elements, initialAccent);
  return presentation.renderStatus.bind(presentation);
}
class AccountPresentation {
  private profileRequested = false;
  private profileRequestVersion = 0;
  private profileLoading = false;
  constructor(private deps: PanelDependencies, private elements: ConnectionElements, private accountAccentColor: string) {}
  async renderStatus(authStatus: RemiliaAuthStatus, announceError = false, refreshProfile = false): Promise<void> {
    const { root, migration, consent, statusTitle, statusDetail, identity, error, scopeList, connect, reconnect, disconnect, revoke, completeMigration, message, retryProfile, pokeDiagnostic, color, mode, instantResultsSetting, instantResultsControl, instantResultsHelp, updateNameTicker, setMessage, setBusy } = this.elements;
    const view = remiliaConnectionView(authStatus);
    const topbar = root!.closest<HTMLElement>(".topbar");
    const isSignedIn = authStatus.phase === "connected";
    this.deps.onSignedIn(isSignedIn);
    updateRemiliaSettingLocks(isSignedIn);
    this.deps.refreshAccent();
    if (topbar) topbar.dataset.signedIn = String(isSignedIn);
    const brandLogo = document.querySelector<HTMLImageElement>(".topbar-logo");
    const logoSource = isSignedIn ? "brand/milxdy-logo-square.png" : "brand/milxdy-home-logo-wide.png";
    if (brandLogo && brandLogo.getAttribute("src") !== logoSource) brandLogo.src = logoSource;
    document.getElementById("topbarAccount")!.hidden = !isSignedIn;
    document.getElementById("remiliaHeaderAvatar")!.hidden = !isSignedIn;
    const instantResultsAvailability = instantBeetleResultsAvailability(authStatus);
    root!.dataset.phase = view.phase;
    root!.dataset.tone = view.tone;
    statusTitle!.textContent = view.title;
    const statusIcon = document.getElementById("remiliaStatusIcon");
    if (statusIcon) {
      statusIcon.dataset.phase = view.phase;
      const tooltipStatus = document.getElementById("remiliaTooltipStatus");
      if (tooltipStatus) {
        tooltipStatus.textContent = view.phase === "connected" ? "Loading account…" : view.title;
        tooltipStatus.hidden = view.phase === "connected" && !document.getElementById("remiliaTooltipAccount")!.hidden;
      }
      statusIcon.setAttribute("aria-label", `${view.title}. ${view.detail}`);
      statusIcon.querySelector("use")?.setAttribute("href", `connection-status.svg#${view.phase}`);
    }
    const signedIn = document.getElementById("remiliaSignedIn");
    if (signedIn) signedIn.hidden = authStatus.phase !== "connected";
    document.getElementById("remiliaAuthStatus")!.hidden = false;
    statusDetail!.textContent = view.detail;
    migration!.hidden = !view.showMigration;
    consent!.hidden = !view.showConsent;
    connect!.hidden = !view.showConnect;
    reconnect!.hidden = !view.showReconnect;
    disconnect!.hidden = !view.showDisconnect;
    revoke!.hidden = !view.showRevoke;
    instantResultsControl!.disabled = !instantResultsAvailability.active;
    instantResultsSetting!.dataset.connectorAvailable = String(instantResultsAvailability.active);
    instantResultsSetting!.setAttribute("aria-disabled", String(!instantResultsAvailability.active));
    instantResultsHelp!.textContent = instantResultsAvailability.help;
    refreshSettingsChoice(instantResultsControl!);

    await this.renderProfile(authStatus, refreshProfile);
    renderScopeRows(scopeList!, authStatus);

    const showError = authStatus.phase !== "unsupported" && (authStatus.phase === "error" || Boolean(authStatus.lastError));
    error!.hidden = !showError;
    error!.textContent = showError ? remiliaErrorMessage(authStatus.lastError) : "";
    if (announceError && showError) error!.focus({ preventScroll: false });

    await this.deps.renderPokeDiagnostic(pokeDiagnostic!).catch(() => {
      pokeDiagnostic!.hidden = true;
      document.getElementById("pokeDiagnosticDetails")!.hidden = true;
    });
   }
  private async renderProfile(authStatus: RemiliaAuthStatus, refreshProfile: boolean): Promise<void> {
    const { root, migration, consent, statusTitle, statusDetail, identity, error, scopeList, connect, reconnect, disconnect, revoke, completeMigration, message, retryProfile, pokeDiagnostic, color, mode, instantResultsSetting, instantResultsControl, instantResultsHelp, updateNameTicker, setMessage, setBusy } = this.elements;
    const accountDetails = document.getElementById("remiliaSignedInDetails");
    const setAccountName = (name: string, state?: string) => {
      identity!.textContent = name;
      identity!.title = name;
      updateNameTicker();
      identity!.hidden = authStatus.phase !== "connected";
      if (state) identity!.dataset.state = state;
      else delete identity!.dataset.state;
      const explanation = state === "pending" ? "Your account name is loading."
        : state === "unavailable" ? "Your account name is unavailable."
        : `Account: ${name}.`;
      if (accountDetails) accountDetails.textContent = `Sign-in succeeded. ${explanation} Disconnect signs out of milXdy on this browser; your RemiliaNET permission remains.`;
    };
    const profileCheck = document.getElementById("remiliaProfileCheck");
    if (authStatus.phase === "connected" && (!this.profileRequested || refreshProfile) && !this.profileLoading) {
      this.profileRequested = true;
      this.profileLoading = true;
      const requestVersion = ++this.profileRequestVersion;
      const hasAccountName = identity!.dataset.state !== "pending" && identity!.dataset.state !== "unavailable" && !identity!.hidden;
      if (!hasAccountName) setAccountName("Loading account…", "pending");
      if (retryProfile) retryProfile.hidden = true;
      if (profileCheck) {
        profileCheck.hidden = hasAccountName;
        profileCheck.textContent = "Loading your account details…";
      }
      const me = await chrome.runtime.sendMessage({ type: "remilia-auth:me" }).catch(() => null) as AccountResponse | null;
      // A response from an old connection must not restore its account name.
      if (requestVersion !== this.profileRequestVersion || root!.dataset.phase !== "connected") return;
      this.profileLoading = false;
      setPreviewProfile(me?.ok ? me.preview ?? null : null);
      const name = me?.ok && me.identity
        ? me.identity.displayName || (me.identity?.username ? `@${me.identity.username.replace(/^@/, "")}` : "")
        : "";
      if (name && me) {
        setAccountName(name);
        await this.renderAccountAppearance(me, name, accountDetails, profileCheck);
      } else {
        if (!hasAccountName) {
          setAccountName("Account name unavailable", "unavailable");
          document.getElementById("remiliaTooltipStatus")!.textContent = "Account details unavailable";
        }
        const failureCode = typeof me?.error === "string" ? me.error : me?.ok ? "account_name_missing" : "background_unavailable";
        const failureStatus = typeof me?.status === "number" && me.status > 0 ? `; HTTP ${me.status}` : "";
        const failureDetail = `Account request failed (${failureCode}${failureStatus}).`;
        if (profileCheck) { profileCheck.hidden = false; profileCheck.textContent = failureDetail; }
        if (accountDetails) accountDetails.textContent += ` ${failureDetail}`;
        if (retryProfile) retryProfile.hidden = false;
      }
    } else if (authStatus.phase !== "connected") {
      if (this.accountAccentColor) {
        this.accountAccentColor = ""; this.deps.onAccent("");
        void chrome.storage.local.remove(REMILIA_PROFILE_ACCENT_KEY);
      }
      if (this.profileRequested) setPreviewProfile(null);
      this.profileRequested = false;
      this.profileLoading = false;
      ++this.profileRequestVersion;
      document.getElementById("remiliaTooltipAccount")!.hidden = true;
      document.getElementById("remiliaHeaderAvatar")!.hidden = true;
      (document.getElementById("remiliaHeaderAvatarImage") as HTMLImageElement).removeAttribute("src");
      const tooltip = document.getElementById("remiliaConnectionDetails")!;
      delete tooltip.dataset.accountTheme;
      tooltip.style.removeProperty("--account-hue");
      (document.getElementById("remiliaTooltipAvatar") as HTMLImageElement).removeAttribute("src");
      identity!.hidden = true;
      identity!.textContent = "";
      identity!.title = "";
      identity!.dataset.state = "pending";
      if (profileCheck) profileCheck.hidden = true;
      if (retryProfile) retryProfile.hidden = true;
    }

  }
  private async renderAccountAppearance(me: AccountResponse, name: string, accountDetails: HTMLElement | null, profileCheck: HTMLElement | null): Promise<void> {
        const tooltip = document.getElementById("remiliaConnectionDetails")!;
        const account = document.getElementById("remiliaTooltipAccount")!;
        document.getElementById("remiliaTooltipName")!.textContent = name;
        document.getElementById("remiliaTooltipHandle")!.textContent = me.identity?.username ? `~${String(me.identity.username).replace(/^[@~]+/, "")}` : "";
        const avatar = document.getElementById("remiliaTooltipAvatar") as HTMLImageElement;
        const initial = document.getElementById("remiliaTooltipInitial")!;
        initial.textContent = name.slice(0, 1);
        avatar.hidden = !me.preview?.account?.avatarUrl;
        initial.hidden = !avatar.hidden;
        avatar.onerror = () => { avatar.hidden = true; initial.hidden = false; };
        if (!avatar.hidden) avatar.src = me.preview!.account!.avatarUrl!;
        else avatar.removeAttribute("src");
        const headerAvatar = document.getElementById("remiliaHeaderAvatar")!;
        const headerImage = document.getElementById("remiliaHeaderAvatarImage") as HTMLImageElement;
        const headerInitial = document.getElementById("remiliaHeaderAvatarInitial")!;
        headerAvatar.hidden = false;
        headerAvatar.setAttribute("aria-label", `${name} profile picture`);
        headerImage.hidden = !me.preview?.account?.avatarUrl;
        headerInitial.hidden = !headerImage.hidden;
        headerInitial.textContent = name.slice(0, 1);
        headerImage.onerror = () => { headerImage.hidden = true; headerInitial.hidden = false; };
        if (!headerImage.hidden) headerImage.src = me.preview!.account!.avatarUrl!;
        else headerImage.removeAttribute("src");
        account.hidden = false;
        document.getElementById("remiliaTooltipStatus")!.hidden = true;
        tooltip.dataset.accountTheme = me.theme?.mode === "color" || me.theme?.mode === "dark" ? me.theme.mode : "default";
        const hue = typeof me.theme?.hue === "number" && Number.isFinite(me.theme.hue) ? me.theme.hue : 180;
        tooltip.style.setProperty("--account-hue", String(hue));
        this.accountAccentColor = remiliaHueAccent(hue); this.deps.onAccent(this.accountAccentColor);
        await chrome.storage.local.set({ [REMILIA_PROFILE_ACCENT_KEY]: this.accountAccentColor });

        this.deps.refreshAccent();
        if (accountDetails && me.identity?.displayName && me.identity?.username) {
          accountDetails.textContent += ` @${me.identity.username.replace(/^@/, "")}`;
        }
        if (profileCheck) profileCheck.hidden = true;
  }
}
