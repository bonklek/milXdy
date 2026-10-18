export function renderChatReconnectState(extensionAuthPhase: string, state: { recoveryMessage: string; recoveryVisibleState: string; composerError: string }, escapeHtml: (value: string) => string): string {
  const loginRequired = ["disconnected", "expired", "missing-scope", "migration-required"].includes(extensionAuthPhase);
  if (loginRequired) {
    const copy = extensionAuthPhase === "disconnected" ? "Log in with RemiliaNET to use Chat."
      : extensionAuthPhase === "missing-scope" ? "Reconnect RemiliaNET with Chat access."
      : extensionAuthPhase === "migration-required" ? "Review your RemiliaNET connection in milXdy."
      : "Your RemiliaNET connection has expired. Log in again to use Chat.";
    return `<div class="milxdy-chat-empty milxdy-chat-reconnect"><span>${copy}</span><button type="button" data-chat-action="login">${extensionAuthPhase === "missing-scope" ? "Reconnect" : "Log in"}</button></div>`;
  }
  if (extensionAuthPhase === "checking" || extensionAuthPhase === "connecting") {
    return `<div class="milxdy-chat-empty">${extensionAuthPhase === "connecting" ? "RemiliaNET login is in progress…" : "Checking RemiliaNET connection…"}</div>`;
  }
  const label = state.recoveryMessage || "Recheck Chat";
  const copy = state.recoveryVisibleState === "recovering"
    ? "Checking Remilia Chat authorization..."
    : state.recoveryVisibleState === "failed"
      ? state.composerError || "Chat could not reconnect. Open the milXdy popup, then use Remilia connection → Connect/Reconnect."
      : "Remilia connection is required. Open the milXdy popup, then use Remilia connection → Connect/Reconnect. Return here and recheck Chat.";
  const disabled = state.recoveryVisibleState === "recovering" ? " disabled" : "";
  return `
    <div class="milxdy-chat-empty milxdy-chat-reconnect">
      <span>${escapeHtml(copy)}</span>
      <button type="button" data-chat-action="retry-connection"${disabled}>${escapeHtml(label)}</button>
    </div>
  `;
}
