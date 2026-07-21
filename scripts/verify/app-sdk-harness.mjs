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
  messageHandler: (message) => ({ ok: message?.type === "harness:ready" }),
});

await harness.boot(app);
await harness.enable(app);
await harness.route(app, { href: "https://x.com/home", pathname: "/home", previousHref: null, visible: true, changedAt: 1 });
await harness.surface(app, { kind: "tweet", element: /** @type {HTMLElement} */ ({}), handle: null, avatarUrl: null, textContainers: [], statusUrl: null, actionRow: null, cacheKey: "tweet:1", emittedAt: 1 });
await harness.open(app);
await harness.close(app);
harness.flushScheduled();
await harness.disable(app);
harness.abort();
await harness.dispose(app);

assert.deepEqual(events, ["boot", "enable", "route:/home", "surface:tweet", "open", "close", "idle", "disable", "dispose", "disposable"]);
assert.deepEqual(await harness.context.storage.local.get({ [key]: 0 }), { [key]: 1 });
assert.equal(harness.context.signal.aborted, true);
assert.equal(harness.rescanCount, 1);
assert.equal(harness.diagnostics.get("harness.booted"), true);
assert.equal(harness.messages.length, 1);
await assert.rejects(() => harness.context.storage.local.get({ "milxdy.local.undeclared": false }), /Undeclared/);
assert.throws(() => harness.context.resolveAssetUrl("../private.js"), /Unsafe/);
assert.throws(() => harness.context.resolveAssetUrl("assets/undeclared.svg"), /Undeclared/);

const cancelled = [];
const cancellationHarness = createAppHarness();
cancellationHarness.context.scheduler.timeout(() => cancelled.push("ran"), 1);
cancellationHarness.abort();
cancellationHarness.flushScheduled();
assert.deepEqual(cancelled, []);

console.log("App SDK author harness passed.");
