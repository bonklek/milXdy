import "./features/wiki/background";
import "./features/postreader/background";
import "./features/miladymaxxer/background";
import "./features/beetol/background.js";
import "./features/reminetChat/background";
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

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isUpdateMessage(message)) {
    void runUpdateCheck().then(sendResponse);
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

chrome.runtime.onInstalled.addListener((details) => {
  scheduleUpdateChecks();
  void runUpdateCheck();
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
    await chrome.action.setBadgeText({ text: "UP" });
    await chrome.action.setBadgeBackgroundColor({ color: "#a45100" });
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
    return;
  }
  await chrome.action.setBadgeText({ text: "" });
}
