import { REMILIA_AUTH_MESSAGE, REMILIA_CONSENT_VERSION, REMILIA_MIGRATION_VERSION, instantBeetleResultsAvailability, normalizeRemiliaAuthResponse, remiliaConnectionView, remiliaErrorMessage, remiliaIdentityLabel, remiliaScopeRows, type RemiliaAuthStatus, } from "./remilia-connection";
import { refreshSettingsChoice } from "./settings-tiles";
import { updateRemiliaSettingLocks } from "./remilia-setting-locks";
import { setPreviewProfile } from "./settings-previews";
import { REMILIA_PROFILE_ACCENT_KEY, remiliaHueAccent } from "../../platform/visuals/reskin-profile";
import { createConnectionElements } from "./remilia-connection-elements";
import { createConnectionStatusRenderer } from "./remilia-connection-presentation";
export type PanelDependencies = {
  renderOnboarding: () => Promise<void>;
  renderPokeDiagnostic: (root: HTMLElement) => Promise<void>;
  onSignedIn: (connected: boolean) => void;
  onAccent: (accent: string) => void;
  refreshAccent: () => void;
};
export async function setupRemiliaConnectionPanel(deps: PanelDependencies): Promise<void> {
  const elements = await createConnectionElements();
  if (!elements) return;
  const { root, migration, consent, statusTitle, statusDetail, identity, error, scopeList, connect, reconnect, disconnect, revoke, completeMigration, message, retryProfile, pokeDiagnostic, color, mode, instantResultsSetting, instantResultsControl, instantResultsHelp, updateNameTicker, setMessage, setBusy } = elements;
  const accent = (await chrome.storage.local.get(REMILIA_PROFILE_ACCENT_KEY))[REMILIA_PROFILE_ACCENT_KEY];
  const renderStatus = createConnectionStatusRenderer(deps, elements, typeof accent === "string" ? accent : "");
  const fetchStatus = async (announceError = false, refreshProfile = false): Promise<RemiliaAuthStatus> => {
    const response = await chrome.runtime.sendMessage({ type: REMILIA_AUTH_MESSAGE.status })
      .catch(() => ({ error: { code: "BACKGROUND_UNAVAILABLE" } }));
    const authStatus = normalizeRemiliaAuthResponse(response);
    await renderStatus(authStatus, announceError, refreshProfile);
    return authStatus;
  };

  retryProfile?.addEventListener("click", async () => {
    retryProfile.disabled = true;
    try {
      await fetchStatus(false, true);
    } finally {
      retryProfile.disabled = false;
    }
  });

  const runAction = async (
    request: Record<string, unknown>,
    pendingText: string,
    successText: string | ((response: Record<string, unknown>) => string),
  ): Promise<void> => {
    setBusy(true);
    setMessage(pendingText);
    try {
      const response = await chrome.runtime.sendMessage(request)
        .catch(() => ({ error: { code: "BACKGROUND_UNAVAILABLE" } }));
      const record = response && typeof response === "object" ? response as Record<string, unknown> : null;
      if (!record || record.ok === false) {
        const failure = normalizeRemiliaAuthResponse(response);
        await renderStatus(failure, true);
        setMessage("");
        return;
      }
      const latest = await fetchStatus(true, true);
      if (latest.phase === "error" || latest.lastError) {
        setMessage("");
        return;
      }
      setMessage(typeof successText === "function" ? successText(record) : successText, "success");
      await deps.renderOnboarding();
    } finally {
      setBusy(false);
    }
  };

  bindAccountActions(elements, runAction);
  color!.addEventListener("change", () => {
    void chrome.storage.local.set({ beetolColor: color!.value });
  });
  mode!.addEventListener("change", () => {
    void chrome.storage.local.set({ beetolMode: mode!.value });
  });

  await fetchStatus();
  const loginFocus = await chrome.storage.session.get("milxdy.popup.focusRemiliaLogin").catch(() => ({})) as Record<string, unknown>;
  if (loginFocus["milxdy.popup.focusRemiliaLogin"] === true || new URL(location.href).searchParams.get("focus") === "remilia-login") {
    await chrome.storage.session.remove("milxdy.popup.focusRemiliaLogin");
    root!.scrollIntoView({ block: "start" });
    const loginControl = [connect, reconnect, completeMigration].find((button) => button && !button.hidden && !button.disabled);
    (loginControl || root)!.focus({ preventScroll: true });
  }
  const statusTimer = setInterval(() => {
    void fetchStatus();
  }, 2_000);
  addEventListener("pagehide", () => clearInterval(statusTimer), { once: true });

}

function bindAccountActions(elements: Awaited<ReturnType<typeof createConnectionElements>> & {}, runAction: (request: Record<string, unknown>, pending: string, success: string | ((response: Record<string, unknown>) => string)) => Promise<void>): void {
  const { connect, reconnect, completeMigration, disconnect, revoke } = elements;
  connect!.addEventListener("click", () => {
    void runAction(
      { type: REMILIA_AUTH_MESSAGE.connect, consentVersion: REMILIA_CONSENT_VERSION },
      "Opening Remilia Login...",
      "",
    );
  });
  reconnect!.addEventListener("click", () => {
    void runAction(
      { type: REMILIA_AUTH_MESSAGE.reconnect, consentVersion: REMILIA_CONSENT_VERSION },
      "Opening Remilia Login to reconnect...",
      "",
    );
  });
  completeMigration!.addEventListener("click", () => {
    void runAction(
      {
        type: REMILIA_AUTH_MESSAGE.completeMigration,
        migrationVersion: REMILIA_MIGRATION_VERSION,
        decision: "delete-legacy",
      },
      "Deleting old login data...",
      "Old login data deleted. No account was connected; connect only when you are ready.",
    );
  });
  disconnect!.addEventListener("click", () => {
    void runAction(
      { type: REMILIA_AUTH_MESSAGE.disconnect },
      "Disconnecting...",
      "Disconnected. Your other milXdy settings were kept.",
    );
  });
  revoke!.addEventListener("click", () => {
    const confirmed = window.confirm("Revoke this Remilia authorization? milXdy will remove its local credentials but keep your other settings.");
    if (!confirmed) return;
    void runAction(
      { type: REMILIA_AUTH_MESSAGE.revoke },
      "Revoking authorization...",
      (response) => response.remoteRevoked === false
        ? "Local credentials removed. Remilia could not confirm remote revocation; you can review active authorizations on Remilia. Your other milXdy settings were kept."
        : "Authorization revoked and local credentials removed. Your other milXdy settings were kept.",
    );
  });
}
