import "./features/wiki/background";
import "./features/postreader/background";
import "./features/miladymaxxer/background";
import "./features/beetol/background.js";
import "./features/reminetChat/background";
import { browserAction } from "./shared/browserAction";
import {
  UPDATE_ALARM_NAME,
  UPDATE_CHECK_INTERVAL_MINUTES,
  UPDATE_STATUS_KEY,
  checkForUpdate,
  type UpdateStatus,
} from "./shared/updateCheck";

type RemiStatsMessage = {
  type: "remistats:getUser";
  handle: string;
};

type UpdateMessage = {
  type: "milxdy:checkUpdate";
};

type FetchImageDataUrlMessage = {
  type: "milxdy:fetchImageDataUrl";
  url: string;
};

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isUpdateMessage(message)) {
    void runUpdateCheck().then(sendResponse);
    return true;
  }

  if (isFetchImageDataUrlMessage(message)) {
    void fetchImageDataUrl(message.url).then(sendResponse);
    return true;
  }

  if (!isRemiStatsMessage(message)) return false;
  const handle = message.handle.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    sendResponse({ ok: false, status: 0, notFound: true });
    return false;
  }

  void fetch(`https://api.remistats.net/user/${encodeURIComponent(handle)}`, { credentials: "omit" })
    .then(async (response) => {
      if (response.status === 404) {
        sendResponse({ ok: false, status: 404, notFound: true });
        return;
      }
      if (!response.ok) {
        sendResponse({ ok: false, status: response.status, error: `HTTP ${response.status}` });
        return;
      }
      sendResponse({ ok: true, data: await response.json() });
    })
    .catch((error: unknown) => {
      sendResponse({ ok: false, status: 0, error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});

function isRemiStatsMessage(message: unknown): message is RemiStatsMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "remistats:getUser" && typeof record.handle === "string";
}

function isUpdateMessage(message: unknown): message is UpdateMessage {
  return Boolean(message && typeof message === "object" && (message as Record<string, unknown>).type === "milxdy:checkUpdate");
}

function isFetchImageDataUrlMessage(message: unknown): message is FetchImageDataUrlMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:fetchImageDataUrl" && typeof record.url === "string";
}

async function fetchImageDataUrl(url: string): Promise<Record<string, unknown>> {
  if (!/^https:\/\/miladymaker\.net\/banners\/nft\/\d+\.png$/i.test(url)) {
    return { ok: false, error: "UNSUPPORTED_IMAGE_URL" };
  }

  try {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\/png\b/i.test(contentType)) return { ok: false, error: "UNSUPPORTED_IMAGE_TYPE" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: true, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

chrome.runtime.onInstalled.addListener((details) => {
  scheduleUpdateChecks();
  void runUpdateCheck();
  void refreshBeetolInOpenXTabs();
  if (details.reason !== "install") return;
  void chrome.storage.local.set({
    "milxdy.diagnostics.enabled": false,
  });
  void chrome.storage.sync.set({
    showTooltips: true,
    soundsEnabled: true,
  });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleUpdateChecks();
  void runUpdateCheck();
  void refreshBeetolInOpenXTabs();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_ALARM_NAME) return;
  void runUpdateCheck();
});

void scheduleUpdateChecks();

function scheduleUpdateChecks(): void {
  void chrome.alarms.create(UPDATE_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES,
  });
}

async function runUpdateCheck(): Promise<UpdateStatus> {
  const status = await checkForUpdate();
  await chrome.storage.local.set({ [UPDATE_STATUS_KEY]: status });
  await renderUpdateBadge(status);
  return status;
}

async function renderUpdateBadge(status: UpdateStatus): Promise<void> {
  if (status.updateAvailable) {
    await browserAction.setBadgeText({ text: "UP" });
    await browserAction.setBadgeBackgroundColor({ color: "#a45100" });
    await browserAction.setBadgeTextColor?.({ color: "#ffffff" });
    return;
  }
  await browserAction.setBadgeText({ text: "" });
}

async function refreshBeetolInOpenXTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }).catch(() => []);
  await Promise.all(tabs.map(async (tab) => {
    if (typeof tab.id !== "number") return;
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["beetol/content.css"],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["features/beetol.js"],
      });
    } catch {
      // Some tabs may be discarded, restricted, or mid-navigation; manifest content scripts handle the next load.
    }
  }));
}
