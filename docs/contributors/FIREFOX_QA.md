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
- X/Twitter can emit its own Content Security Policy messages in the browser console. A message is relevant to milXdy only when it names a milXdy extension URL or blocks a milXdy asset.
- Update downloads select the Firefox archive rather than the Chromium archive.

For general problems, see [Troubleshooting](../getting-started/TROUBLESHOOTING.md).
