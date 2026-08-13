# Firefox And Waterfox

milXdy supports Firefox and Waterfox 140 or newer through the Firefox release archive.

## Install A Temporary Build

1. Extract the Firefox archive.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose `manifest.json` from the extracted folder.
5. Refresh any open X/Twitter tabs.

Temporary add-ons are removed when the browser closes. Reload the same extracted folder after restarting the browser.

## Browser-Specific Notes

- Features that depend on Chromium's File System Access API may offer a reduced workflow or report that local folder access is unavailable.
- Remilia Login must use the Firefox build's generated identity callback and the
  same OIDC Authorization Code + PKCE, state validation, background-only
  credential custody, scope checks, and API-v1 routes as Chromium. A Chromium
  callback or build identity is not valid Firefox evidence.
- Closing Firefox removes a temporary add-on. Reload the exact candidate before
  evaluating restart/refresh behavior, and record that reload separately from
  account reconnect behavior.
- X/Twitter can emit its own Content Security Policy messages in the browser console. A message is relevant to milXdy only when it names a milXdy extension URL or blocks a milXdy asset.
- Update downloads select the Firefox archive rather than the Chromium archive.

Run every required Firefox row in the
[Remilia API migration QA matrix](REMILIA_API_QA.md) from the same integrated
source commit used for Chromium. `npm.cmd run build:firefox` and
`npm.cmd run lint:firefox` are prerequisites, not substitutes for the recorded
compatibility observations.

For general problems, see [Troubleshooting](../getting-started/TROUBLESHOOTING.md).
