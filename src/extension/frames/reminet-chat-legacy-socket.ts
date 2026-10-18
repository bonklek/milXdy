import {
  LEGACY_CHAT_ID,
  LEGACY_SOCKET_OPEN_TIMEOUT_MS,
  LEGACY_SOCKET_URL,
  isExactLegacySocketUrl,
  legacyPortReconnectDelay,
  parseLegacySocketBridgeCommand,
  parseLegacySocketFrame,
  type LegacySocketBridgeEvent,
} from "../../apps/reminet-chat/legacy-adapters";

const SOCKET_PORT_NAME = "reminetChat:site-socket";
const HEARTBEAT_MS = 25_000;

let socket: WebSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let port: chrome.runtime.Port | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let socketOpenTimer: ReturnType<typeof setTimeout> | null = null;
let portReconnectAttempts = 0;
let active = false;

export function startReminetLegacySocketBridge(): void {
  if (active) return;
  active = true;
  connectPort();
  window.addEventListener("pagehide", stopReminetLegacySocketBridge, { once: true });
}

function stopReminetLegacySocketBridge(): void {
  active = false;
  if (reconnectTimer !== null) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  closeSocket();
  port?.disconnect();
  port = null;
}

function post(message: LegacySocketBridgeEvent): void {
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
    if (!active) return;
    const delay = legacyPortReconnectDelay(portReconnectAttempts);
    portReconnectAttempts += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectPort();
    }, delay);
  });
}

function connectSocket(): void {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  if (!isExactLegacySocketUrl(LEGACY_SOCKET_URL)) {
    post({ type: "socket:error", error: "Connection interrupted.", reason: "site-socket-error" });
    return;
  }
  const nextSocket = new WebSocket(LEGACY_SOCKET_URL);
  socket = nextSocket;
  post({ type: "socket:connecting" });
  clearSocketOpenTimer();
  socketOpenTimer = setTimeout(() => {
    if (socket !== nextSocket || nextSocket.readyState !== WebSocket.CONNECTING) return;
    socket = null;
    nextSocket.close();
    post({ type: "socket:error", error: "Connection interrupted.", reason: "socket-open-timeout" });
    post({ type: "socket:reconcile", reason: "legacy-socket-close" });
  }, LEGACY_SOCKET_OPEN_TIMEOUT_MS);
  nextSocket.addEventListener("open", () => {
    if (socket !== nextSocket) return;
    clearSocketOpenTimer();
    nextSocket.send(JSON.stringify({ type: "subscribe", payload: { chat_id: LEGACY_CHAT_ID } }));
    startHeartbeat(nextSocket);
    post({ type: "socket:open", at: Date.now() });
    post({ type: "socket:reconcile", reason: "legacy-socket-open" });
  });
  nextSocket.addEventListener("message", (event) => {
    if (socket !== nextSocket) return;
    const frame = parseLegacySocketFrame(event.data);
    if (!frame) {
      post({ type: "socket:reconcile", reason: "legacy-frame-dropped" });
      return;
    }
    post({ type: "socket:hint", event: frame.type, at: Date.now() });
  });
  nextSocket.addEventListener("close", (event) => {
    clearSocketOpenTimer();
    stopHeartbeat();
    if (socket === nextSocket) socket = null;
    post({ type: "socket:close", code: Math.max(0, Math.min(4999, Math.floor(event.code))), reason: "remote-close", wasClean: event.wasClean });
    post({ type: "socket:reconcile", reason: "legacy-socket-close" });
  });
  nextSocket.addEventListener("error", () => {
    post({ type: "socket:error", error: "Connection interrupted.", reason: "site-socket-error" });
  });
}

function closeSocket(): void {
  clearSocketOpenTimer();
  stopHeartbeat();
  const current = socket;
  socket = null;
  if (current && current.readyState !== WebSocket.CLOSED && current.readyState !== WebSocket.CLOSING) current.close();
}

function clearSocketOpenTimer(): void {
  if (socketOpenTimer !== null) clearTimeout(socketOpenTimer);
  socketOpenTimer = null;
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
  const command = parseLegacySocketBridgeCommand(message);
  if (!command) {
    post({ type: "socket:error", error: "Connection interrupted.", reason: "invalid-client-command" });
    post({ type: "socket:reconcile", reason: "legacy-frame-dropped" });
    return;
  }
  portReconnectAttempts = 0;
  if (command.type === "connect") {
    connectSocket();
    return;
  }
  if (command.type === "close") {
    closeSocket();
    return;
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    post({ type: "socket:error", error: "Socket is not open.", reason: "site-socket-not-open" });
    return;
  }
  socket.send(JSON.stringify(command.mutation));
  post({ type: "socket:mutation-sent", requestId: command.requestId, at: Date.now() });
}
