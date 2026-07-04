import { readFile } from "node:fs/promises";

const qaLog = await readFile("docs/QA_LOG_0.2.0.md", "utf8");
const probe = extractLatestProbe(qaLog);

assert(probe.status === "passed", `live probe status must be passed; got ${JSON.stringify(probe.status)}`);
assert(probe.version === "0.2.0", `live probe version must be 0.2.0; got ${JSON.stringify(probe.version)}`);
assert(probe.buildTarget === "chromium", `live probe buildTarget must be chromium; got ${JSON.stringify(probe.buildTarget)}`);
assert(["lite", "balanced", "full"].includes(probe.buildProfile), `live probe buildProfile must be lite, balanced, or full; got ${JSON.stringify(probe.buildProfile)}`);
assert(["fast", "balanced", "full", "developer"].includes(probe.performanceMode), `live probe performanceMode is invalid: ${JSON.stringify(probe.performanceMode)}`);
assert(Array.isArray(probe.missingRequired) && probe.missingRequired.length === 0, `live probe missingRequired must be empty; got ${JSON.stringify(probe.missingRequired)}`);
assert(probe.present?.overlayDockRoot === true, "live probe must show present.overlayDockRoot true");
assert(probe.counts?.overlayDockRoot >= 1, "live probe must count at least one overlay dock root");

console.log("0.2.0 live probe log verification passed.");

function extractLatestProbe(markdown) {
  const marker = "Latest structured probe:";
  const markerIndex = markdown.lastIndexOf(marker);
  assert(markerIndex >= 0, "QA log missing latest structured probe marker");
  const afterMarker = markdown.slice(markerIndex);
  const match = afterMarker.match(/```json\s*([\s\S]*?)\s*```/);
  assert(match?.[1], "QA log missing JSON code block after latest structured probe marker");
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`QA log live probe JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
