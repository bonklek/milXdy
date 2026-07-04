type ActionApi = typeof chrome.action;

function resolveBrowserAction(): ActionApi {
  const globals = globalThis as typeof globalThis & {
    browser?: {
      action?: ActionApi;
      browserAction?: ActionApi;
    };
  };
  return globals.browser?.action ?? globals.browser?.browserAction ?? chrome.action;
}

export const browserAction = resolveBrowserAction();
