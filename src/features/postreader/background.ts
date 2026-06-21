type FetchJsonMessage = {
  type: "postreader:fetchJson";
  url: string;
};

type FetchTextMessage = {
  type: "postreader:fetchText";
  url: string;
};

type BackgroundMessage = FetchJsonMessage | FetchTextMessage;

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isBackgroundMessage(message)) return false;

  void fetch(message.url, { credentials: "omit" })
    .then(async (response) => {
      if (!response.ok) {
        sendResponse({ ok: false, status: response.status, error: `HTTP ${response.status}` });
        return;
      }
      if (message.type === "postreader:fetchJson") {
        sendResponse({ ok: true, data: await response.json() });
      } else {
        sendResponse({ ok: true, text: await response.text() });
      }
    })
    .catch((error: unknown) => {
      sendResponse({ ok: false, status: 0, error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});

function isBackgroundMessage(message: unknown): message is BackgroundMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return (record.type === "postreader:fetchJson" || record.type === "postreader:fetchText") && typeof record.url === "string";
}
