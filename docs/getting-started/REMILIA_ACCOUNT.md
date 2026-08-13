# Connect A Remilia Account

milXdy 0.2.5 Chromium beta connects to RemiliaNET through the official Remilia Login flow.
The extension opens the Remilia authorization page, you approve the listed
abilities, and RemiliaNET returns control to the same installed extension.
milXdy does not reuse a RemiliaNET browser session, read RemiliaNET cookies, or
ask for a username, password, client secret, authorization code, or token.

## Connect

1. Open the milXdy popup and find **Official Remilia connection**.
2. Review the boundary: “Connect through Remilia Login. milXdy does not reuse
   your website cookies or silently reconnect an old browser session.”
3. Review the exact requested abilities. `openid` confirms the account;
   `remilia:stats.read`, `remilia:notifications.read`,
   `remilia:beetle.read`, `remilia:chat.read`, and
   `remilia:directory.read` load enabled read features. The
   `remilia:pokes.write` and `remilia:chat.write` abilities run only after the
   user chooses the corresponding poke or text-message action.
4. Choose **Connect with Remilia**. Finish sign-in and consent on RemiliaNET.
5. Return to milXdy. Confirm that the connected identity and granted abilities
   are the ones you expected.

The authorization uses OIDC Authorization Code with PKCE S256. The callback is
bound to milXdy's installed beta identity, and state validation prevents a
callback from an unrelated login attempt from being accepted.

## Firefox Compatibility

The 0.2.5 Firefox build is intentionally keyless and does not include a Remilia
identity client or registered login callback. Its Remilia connection status is
`UNSUPPORTED`; the popup says **Remilia connection is unavailable in Firefox**
and explains that the build is intentionally keyless. It shows no consent,
Connect, Reconnect, Disconnect, or Revoke controls. milXdy does not fall back to website
cookies, session adoption, or hidden tabs. Public/non-auth behavior and other
Firefox-supported settings and features remain available.

## Existing Installations

0.2.5 does not silently carry forward the old browser-session connector. An
existing installation shows a one-time migration notice. Choose **Delete old
login data** to remove the known legacy token/browser-session state. This
explicit deletion leaves milXdy disconnected and does not connect an account.
Ordinary appearance, app, audio, and other settings are not part of that
cleanup.

Choose **Connect with Remilia** after migration when you want Remilia features. Dismissing or
cancelling login leaves milXdy disconnected; it does not fall back to cookies,
hidden tabs, or browser-session reuse.

## Reconnect, Disconnect, And Revoke

- **Reconnect** starts a new visible authorization flow. Use it after consent
  changes, revocation, expiry that cannot be refreshed, or a missing-scope
  warning.
- **Disconnect** clears milXdy's local Remilia credentials. It does not erase
  unrelated settings or claim to end every RemiliaNET web session.
- **Revoke authorization** asks for confirmation, requests remote revocation or
  logout when the service supports it,
  then clears local credentials even if the remote request is unavailable.
  When Remilia cannot confirm remote revocation, review active Remilia
  authorizations; local credentials are still removed.

Access, refresh, and ID tokens plus connected identity/scopes live only in
trusted `chrome.storage.session`. They survive Manifest V3 worker suspension but
end with the browser session. After a full browser restart, milXdy returns to a
disconnected/reconnect-required state; it never opens a hidden RemiliaNET tab or
adopts a web session. Within one browser session, trusted background code may
rotate a refresh token when the official service returns one.

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
