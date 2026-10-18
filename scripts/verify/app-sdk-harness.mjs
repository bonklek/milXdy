import assert from "node:assert/strict";
import { createAppHarness } from "../../sdk/testing/app-harness.mjs";

const key = "milxdy.local.harness.openCount";
const events = [];
const app = {
  async boot(context) {
    events.push("boot");
    context.addDisposable(() => events.push("disposable"));
    context.scheduler.idle(() => events.push("idle"));
    context.recordDiagnostic("harness.booted", true);
    context.requestSurfaceRescan();
    const stored = await context.storage.local.get({ [key]: 0 });
    await context.storage.local.set({ [key]: Number(stored[key]) + 1 });
    assert.match(context.resolveAssetUrl("assets/icon.svg"), /assets\/icon\.svg$/);
    await context.sendMessage({ type: "harness:ready" }, "boot");
  },
  enable() { events.push("enable"); },
  onRouteChange(route) { events.push(`route:${route.pathname}`); },
  onSurface(surface) { events.push(`surface:${surface.kind}`); },
  open() { events.push("open"); },
  close() { events.push("close"); },
  disable() { events.push("disable"); },
  dispose() { events.push("dispose"); },
};

const harness = createAppHarness({
  storageKeys: { local: [key] },
  assets: ["assets/icon.svg"],
  messageTypes: ["harness:ready"],
  hostActions: ["wiki.openPage"],
  openWikiPage: (url) => ({ ok: url === "https://wiki.remilia.org/wiki/Milady" }),
  messageHandler: (message) => ({ ok: message?.type === "harness:ready" }),
});

await harness.boot(app);
await harness.enable(app);
await harness.route(app, { href: "https://x.com/home", pathname: "/home", previousHref: null, visible: true, changedAt: 1 });
await harness.surface(app, { kind: "tweet", element: /** @type {HTMLElement} */ ({}), handle: null, avatarUrl: null, textContainers: [], statusUrl: null, actionRow: null, cacheKey: "tweet:1", emittedAt: 1 });
await harness.open(app);
await harness.close(app);
harness.flushScheduled();
assert.deepEqual(await harness.context.openWikiPage("https://remilia.wiki/wiki/Milady?useskin=vector"), { ok: true });
assert.deepEqual(await harness.context.openWikiPage("https://example.com/wiki/Milady"), { ok: false, reason: "invalid-url" });
await harness.disable(app);
harness.abort();
await harness.dispose(app);

assert.deepEqual(events, ["boot", "enable", "route:/home", "surface:tweet", "open", "close", "idle", "disable", "dispose", "disposable"]);
assert.deepEqual(await harness.context.storage.local.get({ [key]: 0 }), { [key]: 1 });
assert.equal(harness.context.signal.aborted, true);
assert.equal(harness.rescanCount, 1);
assert.equal(harness.diagnostics.get("harness.booted"), true);
assert.equal(harness.messages.length, 1);
assert.deepEqual(harness.context.site, { id: "x", origin: "https://x.com", mode: "fullRail" });
assert.equal(await harness.context.sendMessage({ type: "harness:denied" }), null);
assert.equal(harness.messages.length, 1);
assert.deepEqual(harness.diagnostics.get("harness.messageDenied"), {
  label: "runtimeMessage",
  messageType: "harness:denied",
  declaredPatterns: ["harness:ready"],
});
await assert.rejects(() => harness.context.storage.local.get({ "milxdy.local.undeclared": false }), /Undeclared/);
assert.throws(() => harness.context.resolveAssetUrl("../private.js"), /Unsafe/);
assert.throws(() => harness.context.resolveAssetUrl("assets/undeclared.svg"), /Undeclared/);

const cancelled = [];
const cancellationHarness = createAppHarness();
assert.deepEqual(await cancellationHarness.context.openWikiPage("https://wiki.remilia.org/wiki/Milady"), { ok: false, reason: "unavailable" });
let windowClosed = 0;
const appWindow = cancellationHarness.context.windows.create({ id: "fixture", title: "Fixture", content: /** @type {HTMLElement} */ ({}) , onClose: () => { windowClosed += 1; } });
assert.equal(appWindow.isOpen, false);
appWindow.open();
assert.equal(appWindow.isOpen, true);
appWindow.close();
assert.equal(windowClosed, 1);
cancellationHarness.context.scheduler.timeout(() => cancelled.push("ran"), 1);
cancellationHarness.abort();
cancellationHarness.flushScheduled();
assert.deepEqual(cancelled, []);
assert.throws(() => cancellationHarness.context.scheduler.idle(() => cancelled.push("late")), { name: "AbortError" });

console.log("App SDK author harness passed.");
