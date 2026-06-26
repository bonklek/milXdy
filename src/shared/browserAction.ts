/**
 * Cross-browser wrapper for the extension action API.
 *
 *   MV3 Chromium  -> chrome.action
 *   MV3 Firefox   -> browser.action
 *   MV2 Firefox   -> browser.browserAction
 *
 * Usage:
 *   import { browserAction } from "../shared/browserAction";
 *   await browserAction.setBadgeText({ text: "UP" });
 */

type ActionAPI = typeof chrome.action;

function resolveActionAPI(): ActionAPI {
  // Firefox exposes a `browser` global that Chromium does not. Reference it
  // via globalThis so TypeScript (typed against the Chromium `chrome` API)
  // does not require a `browser` ambient declaration.
  const g = globalThis as unknown as {
    browser?: { action?: ActionAPI; browserAction?: ActionAPI };
  };
  if (g.browser) {
    if (g.browser.action) return g.browser.action;            // Firefox MV3
    if (g.browser.browserAction) return g.browser.browserAction; // Firefox MV2
  }
  return chrome.action; // Chromium MV3 (and Firefox MV3 via the `chrome` alias)
}

export const browserAction: ActionAPI = resolveActionAPI();
