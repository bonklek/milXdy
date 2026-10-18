export async function createConnectionElements() {
  const root = document.getElementById("remiliaConnection");
  const migration = document.getElementById("remiliaMigration");
  const consent = document.getElementById("remiliaConsent");
  const statusTitle = document.getElementById("remiliaAuthTitle");
  setupConnectionTooltip();
  const statusDetail = document.getElementById("remiliaAuthDetail");
  const identity = document.getElementById("remiliaIdentity");
  const accountNameViewport = document.getElementById("topbarAccountName");
  const updateNameTicker = () => {
    if (!identity || !accountNameViewport) return;
    const overflow = Math.max(0, identity.scrollWidth - accountNameViewport.clientWidth);
    accountNameViewport.dataset.overflow = String(overflow > 1);
    accountNameViewport.style.setProperty("--name-travel", `${-overflow}px`);
    accountNameViewport.style.setProperty("--name-duration", `${Math.max(8, overflow / 16 + 4)}s`);
  };
  const nameObserver = new ResizeObserver(updateNameTicker);
  if (accountNameViewport) nameObserver.observe(accountNameViewport);
  if (identity) nameObserver.observe(identity);
  addEventListener("pagehide", () => nameObserver.disconnect(), { once: true });
  const error = document.getElementById("remiliaAuthError");
  const scopeList = document.getElementById("remiliaScopeList");
  const connect = document.getElementById("remiliaConnect") as HTMLButtonElement | null;
  const reconnect = document.getElementById("remiliaReconnect") as HTMLButtonElement | null;
  const disconnect = document.getElementById("remiliaDisconnect") as HTMLButtonElement | null;
  const revoke = document.getElementById("remiliaRevoke") as HTMLButtonElement | null;
  const completeMigration = document.getElementById("remiliaCompleteMigration") as HTMLButtonElement | null;
  const message = document.getElementById("remiliaAuthMessage");
  const retryProfile = document.getElementById("remiliaRetryProfile") as HTMLButtonElement | null;
  const pokeDiagnostic = document.getElementById("beetolPokeDiagnostic");
  const color = document.getElementById("beetolColor") as HTMLSelectElement | null;
  const mode = document.getElementById("beetolMode") as HTMLSelectElement | null;
  const instantResultsSetting = document.getElementById("beetleInstantResultsSetting");
  const instantResultsControl = document.querySelector<HTMLInputElement>('[data-control="reminet.beetleInstantResults"]');
  const instantResultsHelp = document.getElementById("beetleInstantResultsHelp");
  const required = [
    root, migration, consent, statusTitle, statusDetail, identity, error, scopeList, connect, reconnect,
    disconnect, revoke, completeMigration, message, pokeDiagnostic, color, mode,
    instantResultsSetting, instantResultsControl, instantResultsHelp,
  ];
  if (required.some((node) => !node)) return;

  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const syncAccountTheme = () => {
    document.querySelectorAll<HTMLElement>(".rmn-account").forEach((account) => {
      account.dataset.theme = document.documentElement.dataset.theme || "system";
    });
  };
  syncAccountTheme();
  systemTheme.addEventListener("change", syncAccountTheme);
  const actionButtons = [connect, reconnect, disconnect, revoke, completeMigration] as HTMLButtonElement[];
  const stored = await chrome.storage.local.get(["beetolColor", "beetolMode"]);
  color!.value = typeof stored.beetolColor === "string" ? stored.beetolColor : "red";
  mode!.value = typeof stored.beetolMode === "string" ? stored.beetolMode : "settings";

  const setMessage = (text: string, kind = "") => {
    message!.textContent = text;
    message!.hidden = !text;
    if (kind) message!.dataset.kind = kind;
    else delete message!.dataset.kind;
  };

  const setBusy = (busy: boolean) => {
    root!.toggleAttribute("aria-busy", busy);
    for (const button of actionButtons) button.disabled = busy;
    disconnect!.setAttribute("aria-busy", String(busy));
    disconnect!.setAttribute("aria-label", busy ? "Disconnecting RemiliaNET" : "Signed in with RemiliaNET. Disconnect RemiliaNET");
    const signedLabel = disconnect!.querySelector(".rmn-status__label");
    const actionLabel = disconnect!.querySelector(".rmn-status__action");
    if (signedLabel) signedLabel.textContent = busy ? "Disconnecting…" : "Signed in with RemiliaNET";
    if (actionLabel) actionLabel.textContent = busy ? "Disconnecting…" : "Disconnect";
  };

  return { root, migration, consent, statusTitle, statusDetail, identity, error, scopeList, connect, reconnect, disconnect, revoke, completeMigration, message, retryProfile, pokeDiagnostic, color, mode, instantResultsSetting, instantResultsControl, instantResultsHelp, updateNameTicker, setMessage, setBusy };
}
export type ConnectionElements = NonNullable<Awaited<ReturnType<typeof createConnectionElements>>>;

function setupConnectionTooltip(): void {
  const indicator = document.getElementById("remiliaStatusIcon");
  const positionIndicatorTip = () => {
    if (!indicator) return;
    const bounds = indicator.getBoundingClientRect();
    const accountButton = document.querySelector<HTMLElement>("#remiliaDisconnect:not([hidden]), #remiliaConnect:not([hidden]), #remiliaReconnect:not([hidden])");
    const left = Math.max(12, accountButton?.getBoundingClientRect().left ?? bounds.left);
    const right = Math.min(window.innerWidth - 12, bounds.right);
    const width = Math.max(0, right - left);
    const details = document.getElementById("remiliaConnectionDetails");
    if (!details) return;
    details.style.setProperty("--status-tip-left", `${left}px`);
    details.style.setProperty("--status-tip-width", `${width}px`);
    details.style.setProperty("--status-tip-top", `${(indicator.parentElement?.getBoundingClientRect().bottom ?? bounds.bottom) + 5}px`);
  };
  // Allow the cursor to cross the gap and interact with the account details.
  const indicatorRegion = indicator?.closest<HTMLElement>(".remilia-info");
  let indicatorTipClose: ReturnType<typeof setTimeout> | undefined;
  const cancelIndicatorTipClose = () => {
    clearTimeout(indicatorTipClose);
    indicatorTipClose = undefined;
  };
  indicatorRegion?.addEventListener("pointerenter", () => {
    cancelIndicatorTipClose();
    positionIndicatorTip();
    indicatorRegion.dataset.tooltipOpen = "true";
  });
  indicatorRegion?.addEventListener("pointerleave", () => {
    cancelIndicatorTipClose();
    indicatorTipClose = setTimeout(() => {
      delete indicatorRegion.dataset.tooltipOpen;
    }, 250);
  });
  window.addEventListener("pagehide", cancelIndicatorTipClose, { once: true });
  indicator?.addEventListener("pointerenter", positionIndicatorTip);
  indicator?.addEventListener("focus", positionIndicatorTip);
  window.addEventListener("resize", positionIndicatorTip);
  window.addEventListener("scroll", positionIndicatorTip, true);

}
