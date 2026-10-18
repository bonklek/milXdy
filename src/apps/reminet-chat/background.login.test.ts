import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ register: vi.fn(), status: vi.fn(), popup: vi.fn(), createTab: vi.fn(), setSession: vi.fn() }));
vi.mock("../../platform/background/router", () => ({ registerBackgroundMessageHandlers: mocks.register }));
vi.mock("../../platform/auth/remilia-auth", () => ({ getRemiliaAuthStatus: mocks.status, prepareRemiliaAccess: vi.fn() }));
const sender = { id: "extension-id", frameId: 0, url: "https://x.com/i/chat", tab: { id: 7, url: "https://x.com/i/chat" } };
describe("Chat extension login handoff", () => {
  beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks();
    mocks.popup.mockResolvedValue(undefined); mocks.createTab.mockResolvedValue({}); mocks.setSession.mockResolvedValue(undefined);
    vi.stubGlobal("chrome", { runtime: { id: "extension-id", getURL: (path: string) => `chrome-extension://extension-id/${path}`, onConnect: { addListener: vi.fn() } }, action: { openPopup: mocks.popup }, tabs: { create: mocks.createTab }, storage: { session: { set: mocks.setSession } } });
    await import("./background");
  });
  const handler = () => mocks.register.mock.calls[0][0][0];
  it("reads disconnected state from extension auth without requiring a Chat API call", async () => {
    mocks.status.mockResolvedValue({ phase: "disconnected" });
    expect(await handler().handle({ type: "reminetChat:authStatus" }, sender)).toEqual({ ok: true, signedIn: false, phase: "disconnected", user: null });
  });
  it("opens the existing popup and requests focus on its login control", async () => {
    expect(await handler().handle({ type: "reminetChat:openLogin" }, sender)).toEqual({ ok: true });
    expect(mocks.setSession).toHaveBeenCalledWith({ "milxdy.popup.focusRemiliaLogin": true });
    expect(mocks.popup).toHaveBeenCalledOnce(); expect(mocks.createTab).not.toHaveBeenCalled();
  });
  it("falls back to the same settings login control when toolbar popups are unsupported", async () => {
    mocks.popup.mockRejectedValue(new Error("Unavailable"));
    expect(await handler().handle({ type: "reminetChat:openLogin" }, sender)).toEqual({ ok: true });
    expect(mocks.createTab).toHaveBeenCalledWith({ url: "chrome-extension://extension-id/popup.html?focus=remilia-login", active: true });
  });
  it("keeps socket reconnect and unavailable-site recovery from opening login UI or tabs", () => {
    const onMessage = vi.fn(), onDisconnect = vi.fn(), postMessage = vi.fn();
    const port = { name: "reminetChat:socket", sender, postMessage, disconnect: vi.fn(), onMessage: { addListener: onMessage }, onDisconnect: { addListener: onDisconnect } };
    const connect = vi.mocked(chrome.runtime.onConnect.addListener).mock.calls[0][0];
    connect(port as unknown as chrome.runtime.Port);
    expect(onMessage).toHaveBeenCalledOnce();
    const command = onMessage.mock.calls[0][0] as (message: unknown) => void;
    command({ type: "connect" }); command({ type: "connect" }); command({ type: "unknown" });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ reason: "site-bridge-required" }));
    const disconnect = onDisconnect.mock.calls[0][0] as () => void; disconnect();
    expect(mocks.popup).not.toHaveBeenCalled(); expect(mocks.createTab).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it("rejects foreign senders and extra message fields", async () => {
    expect(await handler().handle({ type: "reminetChat:openLogin" }, { ...sender, id: "foreign" })).toMatchObject({ ok: false });
    expect(handler().matches({ type: "reminetChat:openLogin", url: "https://untrusted.example" })).toBe(false);
    expect(mocks.popup).not.toHaveBeenCalled(); expect(mocks.setSession).not.toHaveBeenCalled();
  });
});
