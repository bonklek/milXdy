# Connect A Remilia Account

milXdy 0.2.5 Chromium release connects to RemiliaNET through the official Remilia Login flow.
The extension opens the Remilia authorization page, you approve the listed
abilities, and RemiliaNET returns control to the same installed extension.
milXdy does not reuse a RemiliaNET browser session, read RemiliaNET cookies, or
ask for a username, password, client secret, authorization code, or token.

## Temporary dual-auth holdover

During 0.2.5's transition, two separate sign-ins coexist:

- **milXdy connection:** official Remilia Login grants access to supported API
  features, including profile/stats reads, pokes, Beetle reads, and chat,
  subject to the granted abilities. Its status appears in the popup.
- **RemiliaNET website sign-in:** native Hunt, Claim, and Craft actions still
  run on the visible website under its own session. Check and manage this
  sign-in on RemiliaNET itself; milXdy does not inspect or adopt it.

Connecting milXdy does not confirm website sign-in, and disconnecting milXdy
does not sign out the website. The holdover retains native website actions
until supported official API equivalents are implemented and accepted; it does
not restore the removed browser-session connector. Temporary chat adapters
are documented separately in the [API migration guide](../contributors/REMILIA_API_MIGRATION.md).

Use **Log in with RemiliaNET** in the popup header for the milXdy connection.
The connection status button explains the current access. Check the separate
website sign-in on RemiliaNET itself. RemiStats and Beetol controls are under
**Remilia**.

## Connect

1. Open the milXdy popup and find **Log in with RemiliaNET** in the header. The
   status button opens the **RemiliaNET connection** details.
2. Review the boundary: “Connect through Remilia Login. milXdy does not reuse
   your website cookies or silently reconnect an old browser session.”
3. Review the exact requested abilities. `openid` confirms the account;
   `remilia:stats.read`, `remilia:notifications.read`,
   `remilia:beetle.read`, `remilia:chat.read`, and
   `remilia:directory.read` load enabled read features. The
   `remilia:pokes.write` and `remilia:chat.write` abilities run only after the
   user chooses the corresponding poke or text-message action.
4. Choose **Log in with RemiliaNET**. Finish sign-in and consent on RemiliaNET.
5. Return to milXdy. Confirm that the connected identity and granted abilities
   are the ones you expected.

The authorization uses OIDC Authorization Code with PKCE S256. The callback is
bound to milXdy's registered release identity, and state validation prevents a
callback from an unrelated login attempt from being accepted.

Before storing a connection, milXdy verifies RemiliaNET's identity proof using
exactly one of two discovery-published signing contracts: RS256 with the
matching RSA signing key, or EdDSA with the matching Ed25519 signing key. The
key ID, key type, signing use, declared algorithm, issuer, audience, authorized
party, nonce, time window, and account subject must all match. Other signing
algorithms and mismatched keys are rejected, and no credentials are stored.

## Firefox Compatibility

The 0.2.5 Firefox build is intentionally keyless and does not include a Remilia
identity client or registered login callback. Its Remilia connection status is
`UNSUPPORTED`; the popup says **Remilia connection is unavailable in this build**
and directs users to the Chromium release build. It shows no consent,
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

Choose **Log in with RemiliaNET** after migration when you want Remilia features. Dismissing or
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
end on extension reload or with the browser session. Popup close/reopen and an
MV3 worker restart within the same browser session retain the connection. After
extension reload or a full browser restart, milXdy returns to a
disconnected or expired/reconnect-required state; completed migration remains durable, so
the legacy prompt and cookie/session fallback do not return. Within one browser
session, trusted background code may rotate a refresh token when the official
service returns one.

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
