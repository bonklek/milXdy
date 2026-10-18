import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("RemiNet Chat disconnected rail contract", () => {
  it("keeps Chat opt-in while exposing its default-pinned X rail launcher", async () => {
    const [runtime, registrySource] = await Promise.all([
      readFile(new URL("./content-runtime.ts", import.meta.url), "utf8"),
      readFile(new URL("../app-sdk/first-party-apps.json", import.meta.url), "utf8"),
    ]);
    const registry = JSON.parse(registrySource) as Array<{
      id: string;
      defaultEnabled: boolean;
      settings?: Array<{ id: string; defaultValue?: unknown }>;
      hub?: { rail?: { defaultPinned?: boolean } };
    }>;
    const chat = registry.find((app) => app.id === "reminetChat");

    expect(chat?.defaultEnabled).toBe(false);
    expect(chat?.settings?.find((setting) => setting.id === "reminetChat.enabled")?.defaultValue).toBe(false);
    expect(chat?.hub?.rail?.defaultPinned).toBe(true);
    expect(runtime).toContain('function isRailDiscoverableWhenDisabled(app: MilxdyAppManifest): boolean');
    expect(runtime).toContain('state.site.id === "x"');
    expect(runtime).toContain('app.id === "reminetChat"');
    expect(runtime).toContain('updateAppDiagnostics(app, "disabled");\n        updateDockRegistration(app);');
    expect(runtime).toContain('if (!state.enabledApps.has(app.id) && !isRailDiscoverableWhenDisabled(app)) return false;');
    expect(runtime).toContain('void openRailApp(app);');
  });

  it("treats rail selection as explicit enablement before package load", async () => {
    const runtime = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
    const activation = runtime.slice(runtime.indexOf("async function openRailApp"), runtime.indexOf("async function closeApp"));

    expect(activation).toContain("await app.setEnabled(true)");
    expect(activation).toContain("state.enabledApps.add(app.id)");
    expect(activation).toContain('await openApp(app, "dockOpen")');
    expect(activation.indexOf("await app.setEnabled(true)")).toBeLessThan(activation.indexOf('await openApp(app, "dockOpen")'));
    expect(activation).not.toContain("remilia-auth:");
    expect(activation).not.toContain("socket");
  });

  it("renders extension login guidance and keeps recheck on official reconciliation", async () => {
    const source = await readFile(new URL("../../apps/reminet-chat/content.ts", import.meta.url), "utf8");
    const reconnect = await readFile(new URL("../../apps/reminet-chat/chat-connection-view.ts", import.meta.url), "utf8");
    const background = await readFile(new URL("../../apps/reminet-chat/background.ts", import.meta.url), "utf8");
    const authRouter = await readFile(new URL("../../extension/background/remilia-auth-router.ts", import.meta.url), "utf8");
    expect(source).toContain("renderChatReconnectState(extensionAuthPhase, state, escapeHtml)");
    const clickHandler = source.slice(source.indexOf("function handleChatActionClick"), source.indexOf("async function refreshAuthAndHistory"));

    expect(reconnect).toContain("Open the milXdy popup");
    expect(reconnect).toContain("Remilia connection → Connect/Reconnect");
    expect(reconnect).toContain("Recheck Chat");
    expect(reconnect).not.toContain("Open RemiliaNET");
    expect(reconnect).not.toContain("remilia-auth:");
    expect(reconnect).toContain('data-chat-action="login"');
    expect(clickHandler).toContain('type: "reminetChat:openLogin"');
    expect(background).toContain("await chrome.action.openPopup()");
    expect(background).toContain('chrome.runtime.getURL("popup.html?focus=remilia-login")');
    expect(authRouter).toContain('chrome.runtime.getURL("popup.html")');
    expect(authRouter).toContain("actual.pathname === expected.pathname");
    expect(authRouter).toContain("sender.frameId !== 0");
    expect(clickHandler).toContain('kind === "retry-connection"');
    expect(clickHandler).toContain("refreshAuthAndHistory(true)");
  });
});
