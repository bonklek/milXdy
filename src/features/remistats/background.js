// Background service worker. The only job is to seed default settings on
// fresh install. Settings are read directly from chrome.storage.sync wherever
// they're needed, so no message-passing layer is necessary.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      showTooltips: true,
      soundsEnabled: true,
    });
  }
});
