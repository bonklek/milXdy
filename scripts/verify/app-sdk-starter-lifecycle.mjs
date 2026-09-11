import assert from "node:assert/strict";
import * as starter from "../../sdk/templates/docked-app/content.js";
import { createAppHarness } from "../../sdk/testing/app-harness.mjs";

const key = "milxdy.local.docked-app.openCount";
// A DOM-free run is deliberate: a stale open touching document fails the probe.
for (const stop of ["close", "dispose", "abort"]) {
  const harness = createAppHarness({ storageKeys: { local: [key] } });
  let releaseWrite;
  let writeStarted;
  const writing = new Promise((resolve) => { writeStarted = resolve; });
  const pendingWrite = new Promise((resolve) => { releaseWrite = resolve; });
  harness.context.storage.local.set = async () => {
    writeStarted();
    await pendingWrite;
  };
  starter.boot(harness.context);
  const pendingOpen = starter.open();
  await writing;
  if (stop === "abort") harness.abort();
  else starter[stop]();
  releaseWrite();
  await pendingOpen;
  starter.dispose();
}

// An older activation cannot use the replacement activation's live signal.
const first = createAppHarness({ storageKeys: { local: [key] } });
let releaseRead;
first.context.storage.local.get = () => new Promise((resolve) => { releaseRead = resolve; });
starter.boot(first.context);
const oldOpen = starter.open();
starter.dispose();
starter.boot(createAppHarness({ storageKeys: { local: [key] } }).context);
releaseRead({ [key]: 0 });
await oldOpen;
starter.dispose();
assert.equal(typeof document, "undefined");
console.log("Docked starter lifecycle passed: close/dispose/abort during storage write and replacement activation during read.");
