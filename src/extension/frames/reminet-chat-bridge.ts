const SOCKET_URL = "wss://www.remilia.net/api/ws";
const SOCKET_PORT_NAME = "reminetChat:site-socket";
const CHAT_ID = 1;
const HEARTBEAT_MS = 25_000;

let socket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let port: chrome.runtime.Port | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let active = true;

function post(message: Record<string, unknown>): void {
  try {
    port?.postMessage(message);
  } catch {
    closeSocket();
  }
}

function connectPort(): void {
  if (!active || port) return;
  const nextPort = chrome.runtime.connect({ name: SOCKET_PORT_NAME });
  port = nextPort;
  nextPort.onMessage.addListener(handlePortMessage);
  nextPort.onDisconnect.addListener(() => {
    if (port !== nextPort) return;
    port = null;
    closeSocket();
    if (active) reconnectTimer = setTimeout(connectPort, 1_000);
  });
}

function connectSocket(): void {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  const nextSocket = new WebSocket(SOCKET_URL);
  socket = nextSocket;
  post({ type: "socket:connecting" });
  nextSocket.addEventListener("open", () => {
    if (socket !== nextSocket) return;
    nextSocket.send(JSON.stringify({ type: "subscribe", payload: { chat_id: CHAT_ID } }));
    startHeartbeat(nextSocket);
    post({ type: "socket:open", at: Date.now() });
  });
  nextSocket.addEventListener("message", (event) => {
    if (socket !== nextSocket || typeof event.data !== "string") return;
    post({ type: "socket:frame", data: event.data });
  });
  nextSocket.addEventListener("close", (event) => {
    stopHeartbeat();
    if (socket === nextSocket) socket = null;
    post({ type: "socket:close", code: event.code, reason: event.reason, wasClean: event.wasClean });
  });
  nextSocket.addEventListener("error", () => {
    post({ type: "socket:error", error: "Connection interrupted.", reason: "site-socket-error" });
  });
}

function closeSocket(): void {
  stopHeartbeat();
  const current = socket;
  socket = null;
  if (current && current.readyState !== WebSocket.CLOSED && current.readyState !== WebSocket.CLOSING) current.close();
}

function startHeartbeat(target: WebSocket): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket !== target || target.readyState !== WebSocket.OPEN) {
      stopHeartbeat();
      return;
    }
    post({ type: "socket:heartbeat", ok: true, readyState: target.readyState, at: Date.now() });
  }, HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function handlePortMessage(message: unknown): void {
  const record = message && typeof message === "object" ? message as Record<string, unknown> : {};
  if (record.type === "connect") {
    connectSocket();
    return;
  }
  if (record.type === "close") {
    closeSocket();
    return;
  }
  if (record.type === "send") {
    if (!socket || socket.readyState !== WebSocket.OPEN || !record.payload || typeof record.payload !== "object") {
      post({ type: "socket:error", error: "Socket is not open.", reason: "site-socket-not-open" });
      return;
    }
    socket.send(JSON.stringify(record.payload));
  }
}

window.addEventListener("pagehide", () => {
  active = false;
  if (reconnectTimer !== null) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  closeSocket();
  port?.disconnect();
  port = null;
}, { once: true });

connectPort();
