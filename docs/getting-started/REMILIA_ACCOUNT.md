# Connect A Remilia Account

milXdy 0.2.5 connects to RemiliaNET through the official Remilia Login flow.
The extension opens the Remilia authorization page, you approve the listed
abilities, and RemiliaNET returns control to the same installed extension.
milXdy does not reuse a RemiliaNET browser session, read RemiliaNET cookies, or
ask for a username, password, client secret, authorization code, or token.

## Connect

1. Open the milXdy popup and find **Remilia account**.
2. Review the abilities milXdy requests. They correspond to Remilia's named
   delegated scopes and can include profile, stats, notifications, directory,
   poke, Beetle, and chat access.
3. Choose **Connect**. Finish sign-in and consent on RemiliaNET.
4. Return to milXdy. Confirm that the connected identity and granted abilities
   are the ones you expected.

The authorization uses OIDC Authorization Code with PKCE S256. The callback is
bound to milXdy's installed beta identity, and state validation prevents a
callback from an unrelated login attempt from being accepted.

## Existing Installations

0.2.5 does not silently carry forward the old browser-session connector. An
existing installation shows a one-time migration notice and removes legacy
connector credentials before official login can begin. Ordinary extension
settings, app enablement, appearance choices, and unrelated local data are not
part of that cleanup.

Choose **Connect** after migration when you want Remilia features. Dismissing or
cancelling login leaves milXdy disconnected; it does not fall back to cookies,
hidden tabs, or browser-session reuse.

## Reconnect, Disconnect, And Revoke

- **Reconnect** starts a new visible authorization flow. Use it after consent
  changes, revocation, expiry that cannot be refreshed, or a missing-scope
  warning.
- **Disconnect** clears milXdy's local Remilia credentials. It does not erase
  unrelated settings or claim to end every RemiliaNET web session.
- **Revoke** requests remote revocation or logout when the service supports it,
  then clears local credentials even if the remote request is unavailable.

After a browser or extension restart, milXdy may refresh an existing grant in
trusted background code. It never opens a hidden RemiliaNET tab or adopts a web
session. If refresh is rejected or revoked, the popup returns to a disconnected
or reconnect-required state.

## Abilities And Errors

milXdy distinguishes these states instead of treating all failures as “not
logged in”:

- **Access denied or cancelled**: no grant was issued; start Connect again when
  ready.
- **Expired or revoked**: reconnect is required when refresh cannot recover.
- **Missing ability**: reconnect and approve the scope required by that
  feature.
- **Rate limited or cooldown**: wait for the displayed service-provided retry
  time; reconnecting does not bypass it.
- **Offline**: the local UI and labeled cached fallback may remain available,
  but remote reads and actions wait for connectivity.

For feature-specific behavior, see [RemiStats](../guides/remistats.md),
[Beetol](../guides/beetol.md), and [RemiNet Chat](../guides/reminet-chat.md).
For custody and service details, see
[Privacy and permissions](PRIVACY_AND_PERMISSIONS.md).
