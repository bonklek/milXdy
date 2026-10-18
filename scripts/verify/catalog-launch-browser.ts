import { OverlayDockController } from "../../src/platform/overlay/dock-controller";
import { OverlayDockDomView } from "../../src/platform/overlay/dock-view";
import { createCatalogFeedback, registerAddonsCatalogAction } from "../../src/platform/runtime/addons-catalog-action";

document.body.style.cssText = "margin:0;background:#eef0f4;color:#222;font:16px system-ui";
const description = document.createElement("p");
description.textContent = "Catalog launcher verification — navigation is simulated.";
description.style.cssText = "margin:20px 80px";
document.body.append(description);
const dock = new OverlayDockController({
  persistence: { load: async () => ({ side: "right", order: [] }), saveSide() {}, saveOrder() {} },
  view: new OverlayDockDomView(), setStackOrder() {},
});
dock.register({ id: "milxdyHub", label: "Apps", icon: "▦", stackable: false, onActivate() {} });
for (let i = 0; i < 14; i++) dock.register({ id: `fixture${i}`, label: `Fixture app ${i + 1}`, icon: String(i + 1), onActivate() {} });
const feedback = createCatalogFeedback(() => dock.getSide());
let calls = 0, cues = 0, now = 0;
let resolve: (value: unknown) => void;
registerAddonsCatalogAction({
  dock, feedback: feedback.show, now: () => now,
  playCue: () => { cues++; },
  send: () => { calls++; return new Promise(r => { resolve = r; }); },
});
Object.assign(globalThis, { catalogFixture: {
  button: () => document.querySelector('button[data-item-id="milxdyAddOnsCatalog"]'),
  side: (value: "left" | "right") => dock.setSide(value),
  calls: () => calls, cues: () => cues,
  reset: () => { calls = 0; cues = 0; now += 1000; feedback.dispose(); },
  advance: () => { now += 1000; },
  fail: () => resolve({ ok: false, error: "private browser detail" }),
  succeed: () => resolve({ ok: true }),
} });
