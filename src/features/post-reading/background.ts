import { registerBackgroundMessageHandlers, runNetworkTask } from "../../shared/backgroundRouter";

type FetchJsonMessage = {
  type: "post-reading:fetchJson";
  url: string;
};

type FetchTextMessage = {
  type: "post-reading:fetchText";
  url: string;
};

type FetchBlobMessage = {
  type: "post-reading:fetchBlob";
  url: string;
};

type BackgroundMessage = FetchJsonMessage | FetchTextMessage | FetchBlobMessage;

registerBackgroundMessageHandlers([{
  type: "post-reading:fetch",
  matches: isBackgroundMessage,
  handle: fetchPostReadingResource,
}]);

async function fetchPostReadingResource(message: BackgroundMessage): Promise<Record<string, unknown>> {
  try {
    if (!isAllowedFetchMessage(message)) {
      return { ok: false, status: 0, error: "UNSUPPORTED_URL" };
    }
    const response = await runNetworkTask(
      () => fetch(message.url, { credentials: "omit" }),
      message.type,
    );
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    if (message.type === "post-reading:fetchJson") return { ok: true, data: await response.json() };
    if (message.type === "post-reading:fetchBlob") {
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      return { ok: true, contentType, base64: arrayBufferToBase64(await response.arrayBuffer()) };
    }
    return { ok: true, text: await response.text() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function isBackgroundMessage(message: unknown): message is BackgroundMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return (
    record.type === "post-reading:fetchJson"
    || record.type === "post-reading:fetchText"
    || record.type === "post-reading:fetchBlob"
  ) && typeof record.url === "string";
}

function isAllowedFetchMessage(message: BackgroundMessage): boolean {
  let url: URL;
  try {
    url = new URL(message.url);
  } catch {
    return false;
  }

  if (message.type === "post-reading:fetchJson") {
    return url.protocol === "https:"
      && url.hostname === "cdn.syndication.twimg.com"
      && url.pathname === "/tweet-result";
  }

  if (message.type === "post-reading:fetchBlob") {
    return url.protocol === "https:"
      && url.hostname === "pbs.twimg.com"
      && url.pathname.startsWith("/media/");
  }

  return url.protocol === "https:"
    && (url.hostname === "x.com" || url.hostname === "twitter.com")
    && /^\/[^/?#]+\/status\/\d+\/?$/.test(url.pathname);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
