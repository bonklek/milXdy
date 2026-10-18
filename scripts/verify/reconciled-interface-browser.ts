import { setupBundledAppSettings } from "../../src/extension/popup/bundled-app-settings";
import { FIRST_PARTY_APPS } from "../../src/platform/app-sdk/first-party-registry";
import { createConnectionElements } from "../../src/extension/popup/remilia-connection-elements";
import { createConnectionStatusRenderer } from "../../src/extension/popup/remilia-connection-presentation";
import { normalizeRemiliaAuthResponse } from "../../src/extension/popup/remilia-connection";
const checks: string[] = [];
const check = (value: unknown, label: string) => { if (!value) throw new Error(label); checks.push(label); };
(async () => {
  let resolveAccount!: (value: unknown) => void;
  let accountRequests = 0;
  const saved: Record<string, unknown> = {};
  const area = {
    get: async () => ({ ...saved }), set: async (values: Record<string, unknown>) => { Object.assign(saved, values); },
    remove: async (key: string) => { delete saved[key]; },
  };
  Object.assign(globalThis, { chrome: { storage: { local: area, sync: area, onChanged: { addListener() {}, removeListener() {} } }, runtime: { sendMessage: async (message: { type: string }) => { if (message.type !== "remilia-auth:me") throw new Error("Unexpected auth action"); accountRequests++; return await new Promise(resolve => { resolveAccount = resolve; }); } } } });
  const elements = await createConnectionElements(); if (!elements) throw new Error("Required account controls missing");
  let connected = false, accent = "";
  const render = createConnectionStatusRenderer({ renderOnboarding: async () => {}, renderPokeDiagnostic: async () => {}, onSignedIn: value => { connected = value; }, onAccent: value => { accent = value; }, refreshAccent() {} }, elements, "");
  const status = (phase: string) => normalizeRemiliaAuthResponse({ authStateVersion: 1, status: { phase, requiredScopes: ["openid", "profile", "chat.read"], grantedScopes: phase === "connected" ? ["openid", "profile", "chat.read"] : [], migration: { version: 1, required: false, legacyDeleted: true } } });
  const initial = render(status("connected")); await Promise.resolve();
  check(accountRequests === 1, "Connected presentation requests only the routed account profile");
  await render(status("disconnected"));
  resolveAccount({ ok: true, identity: { displayName: "Stale identity", username: "stale" } }); await initial;
  check(!connected && elements.identity!.hidden && !document.getElementById("remiliaIdentity")!.textContent, "Late account response cannot restore a disconnected identity");
  check(elements.instantResultsControl!.disabled && elements.instantResultsSetting!.getAttribute("aria-disabled") === "true", "Disconnected instant-results setting remains disabled and described");
  const pending = render(status("connected")); await Promise.resolve();
  resolveAccount({ ok: true, identity: { displayName: "Fixture account", username: "fixture" }, preview: { account: { avatarUrl: null } }, theme: { mode: "color", hue: 80 } }); await pending;
  check(connected && elements.identity!.textContent === "Fixture account", "Connected account name appears in private redesigned header");
  check(!document.getElementById("remiliaHeaderAvatar")!.hidden && document.getElementById("remiliaHeaderAvatarInitial")!.textContent === "F", "Avatar fallback remains available without an image");
  check(/^#[0-9a-f]{6}$/i.test(accent) && Object.keys(saved).length === 1, "Profile accent persists through the existing isolated setting");
  check(!elements.instantResultsControl!.disabled && elements.instantResultsSetting!.getAttribute("aria-disabled") === "false", "Connected account enables native instant-results presentation");
  const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map(element => element.id);
  check(new Set(ids).size === ids.length, "Reconciled popup document has no duplicate control ids");
  check(["visualHideBoostButton", "visualTweetPngIncludeDisplayName", "visualTweetPngIncludeHandle", "visualMediaAdvanced", "visualInterfaceAccentColor"].every(id => document.getElementById(id)), "Public release controls coexist with private appearance controls");
  check(Boolean(document.querySelector('[data-control="feed.hideNonFollowedGifs"]')), "Public GIF filtering control is retained");
  setupBundledAppSettings(FIRST_PARTY_APPS); setupBundledAppSettings(FIRST_PARTY_APPS, true);
  await Promise.resolve(); await Promise.resolve();
  const generated = (id: string) => document.querySelector<HTMLInputElement>(`[data-bundled-setting="${id}"]`);
  check(Boolean(generated("composerTools.enabled")), "Composer enablement is rendered from its manifest-owned bundled setting");
  check(Boolean(generated("remistats.sounds.enabled")) && Boolean(generated("remistats.sounds.volume")), "RemiStats sound enablement and gain render in generated sound controls");
  const composer = generated("composerTools.enabled")!; composer.checked = false; composer.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 20));
  const metadata = FIRST_PARTY_APPS.find(app => app.id === "composerTools")!.settings!.find(setting => setting.id === "composerTools.enabled")!;
  check(saved[metadata.storage.key] === false, "Generated Composer control persists through its declared storage key");
  Object.assign(globalThis, { __reconciledInterfaceResult: { passed: true, checks, mockedAccountTransport: true } });
})().catch(error => { Object.assign(globalThis, { __reconciledInterfaceResult: { passed: false, checks, error: String(error) } }); });
