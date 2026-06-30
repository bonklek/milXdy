# RemiNet Chat Recovery QA

Use the unpacked Chromium build and an existing RemiliaNET browser session. Do not enter or store passwords in milXdy.

## Token expiry / invalid session

1. Open X/Twitter with RemiNet Chat visible.
2. In another tab, sign out of RemiliaNET or invalidate the RemiliaNET session.
3. Return to X and click the chat refresh button, or wait for socket recovery after a close/error.
4. Expected: chat shows an inline retry state with `Reconnect / Retry session` and an `Open RemiliaNET` link. It must not fail silently.
5. Sign back into RemiliaNET, return to X, click `Reconnect / Retry session`.
6. Expected: existing chat panel recovers in place, recent messages refresh, and status returns to `Live`.

## WebSocket close

1. Open RemiNet Chat and verify status is `Live`.
2. Simulate a socket close by toggling network offline briefly, sleeping the machine, or closing the socket from DevTools if available.
3. Expected: status changes to `Reconnecting...`, auth is rechecked silently, recent messages refresh, and the socket reconnects without reloading X.

## Browser sleep / resume

1. Open RemiNet Chat and verify status is `Live`.
2. Put the machine to sleep long enough for the socket to become stale.
3. Resume and focus the X tab.
4. Expected: chat silently rechecks the RemiliaNET browser session, refreshes recent messages, reconnects, and returns to `Live`.

## Extension reload

1. Reload the unpacked extension from `chrome://extensions`.
2. Return to an existing X tab with RemiNet Chat enabled.
3. Expected: the chat mounts normally, checks auth, refreshes recent messages, and reconnects without requiring an X page refresh.

## X route navigation

1. Navigate between Home, Notifications, a profile, and Messages.
2. Open RemiNet Chat on each supported route.
3. Expected: route changes do not require refreshing X; the chat reuses the existing RemiliaNET session and reconnects when visible.

## Diagnostics

When `milxdy.diagnostics.enabled` is true, inspect `chrome.storage.local` for `milxdy.diagnostics.apps` entries under `reminetChat.*` keys. Expected events include socket close/error details, recovery attempts, auth refresh success/failure, and final visible state.
